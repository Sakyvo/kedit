// Headless verification of the divider tiers (ADR 0017) against the real
// renderer, the real editor highlighting path and the real stylesheets.
//
// Run: node test/browser/divider-tiers.mjs
// Optional: CHROME_PATH=... (defaults to the local Chrome install)
import { readdirSync } from 'node:fs';
import { createServer as createVite } from 'vite';
import { withBrowser, navigate, waitFor } from './cdp.mjs';

const NEUTRAL = 'rgba(128, 128, 128, 0.33)';
const TIERS = [
  { id: 'plain', source: '---', width: '1px', light: NEUTRAL, dark: NEUTRAL, previewClass: '' },
  { id: 'blue', source: '------', width: '2px', light: 'rgb(46, 134, 200)', dark: 'rgb(111, 181, 230)', previewClass: 'kedit-hr-strong' },
  { id: 'red', source: '---------', width: '2px', light: 'rgb(192, 57, 43)', dark: 'rgb(229, 115, 95)', previewClass: 'kedit-hr-strong kedit-hr-strong--red' },
];
// Editor marker colours, from variables.scss (independent literal source).
const EDITOR_COLORS = {
  plain: { light: 'rgba(0, 0, 0, 0.28)', dark: 'rgba(255, 255, 255, 0.28)' },
  blue: { light: 'rgb(46, 134, 200)', dark: 'rgb(111, 181, 230)' },
  red: { light: 'rgb(192, 57, 43)', dark: 'rgb(229, 115, 95)' },
};

// Theme names without the .js suffix: the harness fetches /static/themes/<name>.js.
const themeFiles = readdirSync('static/themes');
const previewThemes = themeFiles.filter(name => name.startsWith('preview-theme-')).map(name => name.replace(/\.js$/, ''));
const editThemes = themeFiles.filter(name => name.startsWith('edit-theme-')).map(name => name.replace(/\.js$/, ''));

const failures = [];
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures.push(`${label}: expected ${expected}, got ${actual}`);
  return ok;
};

const server = await createVite({
  root: process.cwd(),
  logLevel: 'error',
  server: { port: 0, host: '127.0.0.1', watch: { ignored: ['**/.npm-cache/**'] } },
});
await server.listen();
const port = server.httpServer.address().port;

try {
  await withBrowser(async (cdp) => {
    cdp.listeners.set('Runtime.exceptionThrown', [(params) => {
      failures.push(`page exception: ${params.exceptionDetails.exception?.description || params.exceptionDetails.text}`);
    }]);
    await navigate(cdp, `http://127.0.0.1:${port}/test/browser/harness/divider.html`);
    await waitFor(cdp, 'window.harnessReady');

    // 1. The renderer tags each tier with the class the stylesheet expects.
    const html = await cdp.evaluate(`
      return window.harness.render(${JSON.stringify(`${TIERS.map(t => t.source).join('\n\n')}\n`)});
    `);
    const hrTags = [...html.matchAll(/<hr[^>]*>/g)].map(match => match[0]);
    check('preview renders one hr per tier', hrTags.length, TIERS.length);
    TIERS.forEach((tier, index) => {
      const tag = hrTags[index] || '';
      const hasClass = tier.previewClass
        ? tag.includes(`class="${tier.previewClass}"`)
        : !tag.includes('class=');
      if (!hasClass) failures.push(`renderer class for ${tier.id}: got ${tag}`);
    });

    // 2. Every built-in preview theme, both colour schemes, all three tiers.
    const measurePreview = `return (async () => {
      const out = {};
      for (const tier of ${JSON.stringify(TIERS)}) {
        window.harness.render(tier.source + '\\n');
        const hr = document.querySelector('#preview hr');
        const style = getComputedStyle(hr);
        out[tier.id] = {
          width: style.borderTopWidth,
          color: style.borderTopColor,
          style: style.borderTopStyle,
          padding: style.paddingTop,
          margin: style.marginTop,
          height: style.height,
          background: style.backgroundColor,
          rectHeight: Math.round(hr.getBoundingClientRect().height),
        };
      }
      return out;
    })()`;

    for (const file of previewThemes) {
      for (const dark of [false, true]) {
        await cdp.evaluate(`return window.harness.setTheme(${JSON.stringify({ preview: file, dark })});`);
        const measured = await cdp.evaluate(measurePreview);
        for (const tier of TIERS) {
          const got = measured[tier.id];
          const expectedColor = dark ? tier.dark : tier.light;
          const label = `${file}${dark ? ' (dark)' : ''} ${tier.id}`;
          check(`${label} colour`, got.color, expectedColor);
          check(`${label} width`, got.width, tier.width);
          check(`${label} style`, got.style, 'solid');
          check(`${label} padding`, got.padding, '0px');
          check(`${label} margin`, got.margin, '32px');
          check(`${label} height`, got.height, '0px');
          check(`${label} background`, got.background, 'rgba(0, 0, 0, 0)');
          check(`${label} drawn height`, got.rectHeight, tier.width === '2px' ? 2 : 1);
        }
      }
    }

    // 3. A theme that out-specifies the tier selectors but stays ordinary CSS
    //    (no !important) still cannot recolour a divider.
    await cdp.evaluate(`
      window.harness.addCustomTheme([
        '.preview-theme--jikebrack hr, .stackedit__html .preview-theme--jikebrack hr,',
        '.cl-preview-section hr.kedit-hr-strong, .cl-preview-section hr.kedit-hr-strong--red {',
        '  border-top: 5px solid rgb(255, 0, 255);',
        '  height: 7px;',
        '  padding: 9px;',
        '  margin: 40px;',
        '  background: rgb(0, 255, 0);',
        '}',
      ].join('\\n'));
      return true;
    `);
    for (const dark of [false, true]) {
      await cdp.evaluate(`return window.harness.setTheme(${JSON.stringify({ preview: 'preview-theme-jikebrack', dark })});`);
      const measured = await cdp.evaluate(measurePreview);
      for (const tier of TIERS) {
        const label = `hostile theme (no !important)${dark ? ' dark' : ''} ${tier.id}`;
        check(`${label} colour`, measured[tier.id].color, dark ? tier.dark : tier.light);
        check(`${label} width`, measured[tier.id].width, tier.width);
        check(`${label} height`, measured[tier.id].height, '0px');
      }
    }

    // 4. The editor marker run, across every built-in edit theme.
    const measureEditor = `return (async () => {
      const out = {};
      for (const tier of ${JSON.stringify(TIERS)}) {
        window.harness.highlight(tier.source);
        // The tier tokens nest (hr > hr-strong > hr-strong--red); the deepest
        // element is the one holding the text, so it is the painted colour.
        let span = document.querySelector('#editor');
        while (span.lastElementChild) span = span.lastElementChild;
        out[tier.id] = {
          color: getComputedStyle(span).color,
          classes: span.className,
        };
      }
      return out;
    })()`;

    for (const file of editThemes) {
      for (const dark of [false, true]) {
        await cdp.evaluate(`return window.harness.setTheme(${JSON.stringify({ edit: file, dark })});`);
        const measured = await cdp.evaluate(measureEditor);
        for (const tier of TIERS) {
          const label = `${file}${dark ? ' (dark)' : ''} ${tier.id} marker`;
          check(`${label} colour`, measured[tier.id].color, EDITOR_COLORS[tier.id][dark ? 'dark' : 'light']);
        }
      }
    }

    // 5. The red tier is a refinement of the blue run: one span carries both
    //    classes, so the editor cannot show a blue red-divider.
    const redClasses = await cdp.evaluate(`
      window.harness.highlight('---------');
      let span = document.querySelector('#editor');
      while (span.lastElementChild) span = span.lastElementChild;
      return span.className;
    `);
    if (!redClasses.includes('hr-strong') || !redClasses.includes('hr-strong--red')) {
      failures.push(`red marker classes: ${redClasses}`);
    }

    // 6. Mixed markers and the spaced form reach the same tier.
    for (const source of ['******', '- - - - - -', '_____________']) {
      const expected = source.replace(/[ \t]/g, '').length >= 9 ? 'red' : 'blue';
      const measured = await cdp.evaluate(`
        window.harness.setTheme({});
        window.harness.highlight(${JSON.stringify(source)});
        let span = document.querySelector('#editor');
        while (span.lastElementChild) span = span.lastElementChild;
        return getComputedStyle(span).color;
      `);
      check(`marker ${source} colour`, measured, EDITOR_COLORS[expected].light);
    }

    // 7. App chrome keeps its own divider: the pinned declarations are scoped.
    const chrome = await cdp.evaluate(`
      const probe = document.createElement('hr');
      document.body.appendChild(probe);
      const style = getComputedStyle(probe);
      const result = { width: style.borderTopWidth, color: style.borderTopColor, margin: style.marginTop, height: style.height };
      probe.remove();
      return result;
    `);
    check('app chrome hr width', chrome.width, '1px');
    check('app chrome hr colour', chrome.color, NEUTRAL);
    check('app chrome hr height', chrome.height, '0px');
  });
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  [...new Set(failures)].slice(0, 40).forEach(line => console.error(` - ${line}`));
  process.exit(1);
}
console.log(`PASS divider tiers: ${TIERS.length} tiers × ${previewThemes.length} preview themes × ${editThemes.length} edit themes, light + dark`);
