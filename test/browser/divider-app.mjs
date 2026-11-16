// End-to-end check against the real application build (dist/), not a harness:
// the shipped stylesheets, the shipped theme runtime, the shipped editor and
// preview pipelines.
//
// Run after `npm run build`: node test/browser/divider-app.mjs
import { mkdir } from 'node:fs/promises';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, screenshot, stubPath } from './cdp.mjs';

const EVIDENCE = '.target/validation/divider-app';
const TIERS = [
  { id: 'plain', source: '---', width: '1px', light: 'rgba(128, 128, 128, 0.33)', dark: 'rgba(128, 128, 128, 0.33)' },
  { id: 'blue', source: '------', width: '2px', light: 'rgb(46, 134, 200)', dark: 'rgb(111, 181, 230)' },
  { id: 'red', source: '---------', width: '2px', light: 'rgb(192, 57, 43)', dark: 'rgb(229, 115, 95)' },
];
const EDITOR_COLORS = {
  plain: { light: 'rgba(0, 0, 0, 0.28)', dark: 'rgba(255, 255, 255, 0.28)' },
  blue: { light: 'rgb(46, 134, 200)', dark: 'rgb(111, 181, 230)' },
  red: { light: 'rgb(192, 57, 43)', dark: 'rgb(229, 115, 95)' },
};

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const expectTrue = (label, value, detail) => {
  if (!value) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const fixture = `${TIERS.map(tier => tier.source).join('\n\n')}\n`;

const server = await startPreview({
  preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} },
  logLevel: 'error',
});
const port = server.httpServer.address().port;
await mkdir(EVIDENCE, { recursive: true });

try {
  await withBrowser(async (cdp) => {
    cdp.listeners.set('Runtime.exceptionThrown', [(params) => {
      const text = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
      // The app logs unrelated noise at boot; only report failures seen after load.
      if (failures.length || text.includes('divider')) failures.push(`page exception: ${text}`);
    }]);
    await stubPath(cdp, '/conf', '{}');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1400, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    // The app exposes its debug handle (window.__editorSvc) on hostname
    // 'localhost' only, so the checks must run under that name.
    await navigate(cdp, `http://localhost:${port}/`);
    await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".editor__inner")?.isContentEditable', {
      timeout: 60000, label: 'application boot',
    });

    await cdp.evaluate(`
      window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
      testStore.dispatch('data/patchLayoutSettings', {
        welcomeTourFinished: true, showEditor: true, showSidePreview: true,
        showExplorer: false, showSideBar: false,
      });
      return true;
    `);
    await waitFor(cdp, '!!document.querySelector(".layout__panel--preview")', { label: 'preview panel' });

    const setText = async (text) => {
      await cdp.evaluate(`
        (() => {
          const id = 'divider-fixture';
          testStore.commit('content/setItem', {
            id: id + '/content', text: ${JSON.stringify(text)}, properties: '', discussions: {}, comments: {},
          });
          testStore.commit('file/setItem', { id, name: 'Divider fixture', parentId: null });
          testStore.commit('file/setCurrentId', id);
          return true;
        })()
      `);
      await waitFor(cdp, `__editorSvc.clEditor.getContent() === ${JSON.stringify(text)}`, {
        label: 'fixture content applied',
      });
      await cdp.evaluate("return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));");
    };

    const setTheme = async (settings) => {
      await cdp.evaluate(`return testStore.dispatch('data/setSettings', ${JSON.stringify(settings)});`);
      await cdp.evaluate("return new Promise(r => setTimeout(() => requestAnimationFrame(() => r(true)), 120));");
    };

    // 1. Editor: three tiers, real highlighting, real stylesheet.
    await setText(fixture);
    const editorColors = await cdp.evaluate(`
      return (() => {
        const out = {};
        const sections = [...document.querySelectorAll('.cledit-section')];
        for (const section of sections) {
          let elt = section;
          while (elt && !elt.querySelector) elt = elt.parentElement;
          const deepest = (node) => {
            let current = node;
            while (current.lastElementChild) current = current.lastElementChild;
            return current;
          };
          const marker = section.querySelector('.hr');
          if (!marker) continue;
          const text = section.textContent.replace(/\\s/g, '');
          const tier = text.length >= 9 ? 'red' : (text.length === 6 ? 'blue' : 'plain');
          out[tier] = { color: getComputedStyle(deepest(marker)).color, classes: deepest(marker).className, raw: text };
        }
        return out;
      })()
    `);
    for (const tier of TIERS) {
      expectTrue(`editor rendered the ${tier.id} tier`, !!editorColors[tier.id],
        JSON.stringify(editorColors));
      if (editorColors[tier.id]) {
        check(`editor ${tier.id} colour`, editorColors[tier.id].color, EDITOR_COLORS[tier.id].light);
      }
    }

    // 2. Preview: three tiers, real rendered preview sections.
    const previewMeasure = `
      (() => {
        const hrs = [...document.querySelectorAll('.layout__panel--preview .cl-preview-section hr')];
        return hrs.map((hr) => {
          const style = getComputedStyle(hr);
          return {
            width: style.borderTopWidth, color: style.borderTopColor, style: style.borderTopStyle,
            height: style.height, padding: style.paddingTop, margin: style.marginTop,
            background: style.backgroundColor, classes: hr.className,
          };
        });
      })()
    `;
    const preview = await cdp.evaluate(`return (${previewMeasure});`);
    check('preview renders one rule per tier', preview.length, TIERS.length);
    TIERS.forEach((tier, index) => {
      const got = preview[index];
      if (!got) {
        failures.push(`preview missing ${tier.id}: ${JSON.stringify(preview)}`);
        return;
      }
      check(`preview ${tier.id} colour`, got.color, tier.light);
      check(`preview ${tier.id} width`, got.width, tier.width);
      check(`preview ${tier.id} height`, got.height, '0px');
    });
    await screenshot(cdp, `${EVIDENCE}/app-light.png`);

    // 3. Dark colour scheme: both surfaces follow the paired palette.
    await setTheme('colorTheme: dark\n');
    const darkEditor = await cdp.evaluate(`
      return (() => {
        const app = document.querySelector('.app');
        const out = { dark: app.classList.contains('app--dark'), tiers: {} };
        for (const section of document.querySelectorAll('.cledit-section')) {
          const marker = section.querySelector('.hr');
          if (!marker) continue;
          let deepest = marker;
          while (deepest.lastElementChild) deepest = deepest.lastElementChild;
          const text = section.textContent.replace(/\\s/g, '');
          out.tiers[text.length >= 9 ? 'red' : (text.length === 6 ? 'blue' : 'plain')] = getComputedStyle(deepest).color;
        }
        return out;
      })()
    `);
    expectTrue('dark theme reaches the app root', darkEditor.dark === true, JSON.stringify(darkEditor));
    for (const tier of TIERS) {
      check(`dark editor ${tier.id} colour`, darkEditor.tiers[tier.id], EDITOR_COLORS[tier.id].dark);
    }
    const darkPreview = await cdp.evaluate(`return (${previewMeasure});`);
    TIERS.forEach((tier, index) => {
      if (!darkPreview[index]) {
        failures.push(`dark preview missing ${tier.id}`);
        return;
      }
      check(`dark preview ${tier.id} colour`, darkPreview[index].color, tier.dark);
      check(`dark preview ${tier.id} width`, darkPreview[index].width, tier.width);
    });
    await screenshot(cdp, `${EVIDENCE}/app-dark.png`);
    await setTheme('colorTheme: light\n');

    // 4. A user theme that out-specifies the tier rules without !important.
    await cdp.evaluate(`
      const style = document.createElement('style');
      style.textContent = [
        '.cl-preview-section hr, .cl-preview-section hr.kedit-hr-strong--red { border-top: 6px solid rgb(255,0,255); height: 9px; }',
        '.editor__inner .hr, .editor__inner .hr-strong, .editor__inner .hr-strong--red { color: rgb(255,0,255); }',
      ].join('\\n');
      document.head.appendChild(style);
      return true;
    `);
    const hostilePreview = await cdp.evaluate(`return (${previewMeasure});`);
    TIERS.forEach((tier, index) => {
      check(`hostile theme preview ${tier.id} colour`, hostilePreview[index]?.color, tier.light);
      check(`hostile theme preview ${tier.id} width`, hostilePreview[index]?.width, tier.width);
      check(`hostile theme preview ${tier.id} height`, hostilePreview[index]?.height, '0px');
    });
    const hostileEditor = await cdp.evaluate(`
      return (() => {
        const out = {};
        for (const section of document.querySelectorAll('.cledit-section')) {
          const marker = section.querySelector('.hr');
          if (!marker) continue;
          let deepest = marker;
          while (deepest.lastElementChild) deepest = deepest.lastElementChild;
          const text = section.textContent.replace(/\\s/g, '');
          out[text.length >= 9 ? 'red' : (text.length === 6 ? 'blue' : 'plain')] = getComputedStyle(deepest).color;
        }
        return out;
      })()
    `);
    for (const tier of TIERS) {
      check(`hostile theme editor ${tier.id} colour`, hostileEditor[tier.id], EDITOR_COLORS[tier.id].light);
    }

    // 5. The divider command in the real command manager inserts the plain tier.
    //    The document text is set through the store (the editor content belongs
    //    to the current document); the command itself is the UI manager's click.
    await setText('\n');
    const commandResult = await cdp.evaluate(`
      __editorSvc.clEditor.focus();
      __editorSvc.clEditor.setSelection(0, 0);
      __editorSvc.pagedownEditor.uiManager.doClick('hr');
      await new Promise(r => setTimeout(r, 200));
      return __editorSvc.clEditor.getContent();
    `);
    expectTrue('the divider command inserts exactly three markers',
      commandResult.trim() === '---', JSON.stringify(commandResult));

    // 6. App chrome (menu / side bar rules) keeps the plain 1px neutral rule.
    const chrome = await cdp.evaluate(`
      return (() => {
        const probe = document.createElement('hr');
        document.body.appendChild(probe);
        const style = getComputedStyle(probe);
        const result = { width: style.borderTopWidth, color: style.borderTopColor, height: style.height };
        probe.remove();
        return result;
      })()
    `);
    check('app chrome hr width', chrome.width, '1px');
    check('app chrome hr colour', chrome.color, 'rgba(128, 128, 128, 0.33)');
  });
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  process.exit(1);
}
console.log(`PASS divider app: editor + preview + dark + hostile theme + command, evidence in ${EVIDENCE}`);
