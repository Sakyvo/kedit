// Headless verification that a modal panel's size is locked to the viewport cap
// instead of following its content: every tab of the settings modal, a long and
// a short modal all measure the same panel box, the button bar stays flush with
// the panel's bottom edge, and fixed-height inner widgets are not stretched.
//
// Run after `npm run build`: node test/browser/modal-locked-size.mjs
import { mkdir } from 'node:fs/promises';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, screenshot, stubPath } from './cdp.mjs';

const EVIDENCE = '.target/validation/modal-locked-size';

// 390/590 are inside the mobile rule (panel = viewport), 601/1280 above it
// (panel = viewport - 60px).
const VIEWPORTS = [
  { id: 'phone', width: 390, height: 844, mobile: true },
  { id: 'phablet', width: 590, height: 900, mobile: true },
  { id: 'tablet', width: 601, height: 900, mobile: false },
  { id: 'desktop', width: 1280, height: 900, mobile: false },
];

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const expectTrue = (label, value, detail) => {
  if (!value) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const snapshot = `(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pick = (sel) => document.querySelector(sel);
  const inner2 = pick('.modal__inner-2');
  if (!inner2) return { error: 'modal missing' };
  const cs = (elt) => getComputedStyle(elt);
  const px = (value) => Math.round(value * 100) / 100;
  const r2 = inner2.getBoundingClientRect();
  const inner1 = pick('.modal__inner-1');
  const r1 = inner1 ? inner1.getBoundingClientRect() : null;
  const bar = pick('.modal__inner-2 .modal__button-bar');
  const codeEditor = pick('.modal__inner-2 .code-editor');
  const cleanupList = pick('.modal__inner-2 .image-cleanup__list');
  const properties = cs(inner2).transitionProperty.split(',');
  const durations = cs(inner2).transitionDuration.split(',');
  return {
    vw,
    vh,
    inner1Left: r1 ? px(r1.left) : null,
    panel: {
      left: px(r2.left), top: px(r2.top), width: px(r2.width),
      bottom: px(r2.bottom), height: px(r2.height),
      maxHeight: cs(inner2).maxHeight,
      scrolls: inner2.scrollHeight > inner2.clientHeight + 1,
      scrollHeight: px(inner2.scrollHeight),
      clientHeight: px(inner2.clientHeight),
    },
    bar: bar ? {
      bottom: px(bar.getBoundingClientRect().bottom),
      height: px(bar.getBoundingClientRect().height),
    } : null,
    codeEditor: codeEditor ? { height: px(codeEditor.getBoundingClientRect().height) } : null,
    cleanupList: cleanupList ? {
      maxHeight: cs(cleanupList).maxHeight,
      height: px(cleanupList.getBoundingClientRect().height),
    } : null,
    animatedHeight: properties.some((property, index) => property.trim() === 'height'
      && (durations[index] || '').trim() !== '0s'),
  };
})()`;

const scrollToEnd = `(() => {
  const inner2 = document.querySelector('.modal__inner-2');
  inner2.scrollTop = inner2.scrollHeight;
  const px = (value) => Math.round(value * 100) / 100;
  const bar = document.querySelector('.modal__inner-2 .modal__button-bar');
  return {
    reachedEnd: px(inner2.scrollTop + inner2.clientHeight) >= px(inner2.scrollHeight) - 1,
    barBottom: bar ? px(bar.getBoundingClientRect().bottom) : null,
    barTop: bar ? px(bar.getBoundingClientRect().top) : null,
    panelBottom: px(inner2.getBoundingClientRect().bottom),
    contentBottom: px(document.querySelector('.modal__content').getBoundingClientRect().bottom),
  };
})()`;

const server = await startPreview({
  preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} },
  logLevel: 'error',
});
const port = server.httpServer.address().port;
await mkdir(EVIDENCE, { recursive: true });

const results = {};

try {
  await withBrowser(async (cdp) => {
    cdp.listeners.set('Runtime.exceptionThrown', [(params) => {
      const text = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
      failures.push(`page exception: ${text}`);
    }]);
    await stubPath(cdp, '/conf', '{}');

    const closeModal = async () => {
      await cdp.evaluate("window.testStore.commit('modal/setStack', []); return true;");
      await waitFor(cdp, '!document.querySelector(".modal")', { label: 'modal closed' });
    };

    const openModal = async (type) => {
      await cdp.evaluate(`
        window.testStore.dispatch('modal/open', ${JSON.stringify(type)});
        return true;
      `);
      await waitFor(cdp, 'document.querySelector(".modal__inner-2")', {
        timeout: 20000, label: `${type} modal open`,
      });
      await cdp.evaluate(
        'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
      );
    };

    const selectTab = async (index) => {
      await cdp.evaluate(`
        const tabs = document.querySelectorAll('.modal__inner-2 .tabs__tab a');
        if (!tabs[${index}]) throw new Error('tab ${index} missing');
        tabs[${index}].click();
        return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
      `);
    };

    for (const viewport of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false,
      });
      await navigate(cdp, `http://localhost:${port}/`);
      await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', {
        timeout: 60000, label: `application boot at ${viewport.width}px`,
      });
      await cdp.evaluate(`
        window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
        await window.testStore.dispatch('data/patchLayoutSettings', {
          welcomeTourFinished: true, showSideBar: false,
        });
        return true;
      `);

      const cases = {};

      // The settings modal: same panel, three tab contents of very different length.
      await openModal('settings');
      for (const [tab, index] of [['visual', 0], ['yaml', 1], ['default', 2]]) {
        if (index > 0) await selectTab(index);
        cases[`settings-${tab}`] = await cdp.evaluate(`return ${snapshot};`);
        await screenshot(cdp, `${EVIDENCE}/${viewport.id}-settings-${tab}.png`);
      }
      // Long content must still scroll to its end, above the pinned button bar.
      await selectTab(0);
      cases['settings-scrolled'] = await cdp.evaluate(`return ${scrollToEnd};`);
      await closeModal();

      // A content-light modal must not produce a shorter panel.
      await openModal('commentDeletion');
      cases.short = await cdp.evaluate(`return ${snapshot};`);
      await closeModal();

      // A medium modal with its own field list.
      await openModal('fileProperties');
      cases.properties = await cdp.evaluate(`return ${snapshot};`);
      await closeModal();

      // A modal whose own list is capped: the cap must survive the locked panel.
      await openModal('imageCleanup');
      cases.cleanup = await cdp.evaluate(`return ${snapshot};`);
      await closeModal();

      results[viewport.id] = cases;
    }
  });
} finally {
  await server.close();
}

for (const viewport of VIEWPORTS) {
  const cases = results[viewport.id];
  if (!cases) {
    failures.push(`missing measurement for ${viewport.id}`);
    continue;
  }
  const expectedHeight = viewport.mobile ? viewport.height : viewport.height - 60;
  const panelCases = Object.entries(cases).filter(([name]) => name !== 'settings-scrolled');

  // 1. Every content length and every modal yields the same locked panel box.
  for (const [name, result] of panelCases) {
    if (!result?.panel) {
      failures.push(`${viewport.id}/${name}: no panel — ${JSON.stringify(result)}`);
      continue;
    }
    check(`${viewport.id}/${name} panel height`, result.panel.height, expectedHeight);
    // Margin collapse: inner-2's 16px top margin lives on inner-1 too, so a wide
    // panel starts 16px down; the mobile rule zeroes the margin.
    check(`${viewport.id}/${name} panel top`, result.panel.top, viewport.mobile ? 0 : 16);
    expectTrue(`${viewport.id}/${name} panel height is not animated`,
      result.animatedHeight === false, JSON.stringify(result.animatedHeight));
  }

  // 2. The button bar is pinned to the panel's bottom edge, content or not.
  for (const [name, result] of panelCases) {
    if (!result?.panel || !result.bar) {
      failures.push(`${viewport.id}/${name}: no button bar — ${JSON.stringify(result)}`);
      continue;
    }
    expectTrue(`${viewport.id}/${name} button bar is flush with the panel bottom`,
      Math.abs(result.bar.bottom - result.panel.bottom) < 1.5,
      `bar ${result.bar.bottom} vs panel ${result.panel.bottom}`);
  }

  // 3. Mobile loses the insets and the cap; desktop keeps them.
  if (viewport.mobile) {
    check(`${viewport.id} panel left edge`, cases['settings-visual'].panel.left, 0);
    check(`${viewport.id} panel width`, cases['settings-visual'].panel.width, viewport.width);
    check(`${viewport.id} height cap removed`,
      cases['settings-visual'].panel.maxHeight, 'none');
  } else {
    check(`${viewport.id} panel keeps its 10px side inset`,
      cases['settings-visual'].panel.left - cases['settings-visual'].inner1Left, 10);
    check(`${viewport.id} panel width`, cases['settings-visual'].panel.width, 540);
  }

  // 4. The yaml tab's editor keeps its own size instead of filling the panel.
  const yamlCase = cases['settings-yaml'];
  expectTrue(`${viewport.id} yaml editor is not stretched`,
    yamlCase?.codeEditor && yamlCase.codeEditor.height < yamlCase.panel.height / 2,
    JSON.stringify(yamlCase?.codeEditor));

  // 5. A capped inner list keeps its own cap inside the locked panel.
  const cleanupCase = cases.cleanup;
  if (cleanupCase?.cleanupList) {
    check(`${viewport.id} image-cleanup list keeps its cap`,
      cleanupCase.cleanupList.maxHeight, '320px');
    expectTrue(`${viewport.id} image-cleanup list is not stretched`,
      cleanupCase.cleanupList.height <= 322, JSON.stringify(cleanupCase.cleanupList));
  }

  // 6. Long content still reaches its end and stays above the pinned bar.
  const scrolled = cases['settings-scrolled'];
  expectTrue(`${viewport.id} long content scrolls to its end`, scrolled?.reachedEnd === true,
    JSON.stringify(scrolled));
  expectTrue(`${viewport.id} last content row stays above the button bar`,
    scrolled && scrolled.contentBottom <= scrolled.barTop + 1.5, JSON.stringify(scrolled));
  expectTrue(`${viewport.id} button bar still hugs the panel while scrolled`,
    scrolled && Math.abs(scrolled.barBottom - scrolled.panelBottom) < 1.5, JSON.stringify(scrolled));
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  console.error(`measured: ${JSON.stringify(results, null, 1).slice(0, 4000)}`);
  process.exit(1);
}
console.log(`PASS locked modal size: one panel box for every content length at ${VIEWPORTS.map(v => v.width).join('/')}px (evidence: ${EVIDENCE})`);
