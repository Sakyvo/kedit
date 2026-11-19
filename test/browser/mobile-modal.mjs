// Headless verification that a modal on a phone-sized viewport is flush with
// all four viewport edges and that its type drops one step, while wider
// viewports keep the desktop panel untouched. Runs against the real build in
// dist/ (shipped stylesheets, real modal components).
//
// Run after `npm run build`: node test/browser/mobile-modal.mjs
import { mkdir } from 'node:fs/promises';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, screenshot, stubPath } from './cdp.mjs';

const EVIDENCE = '.target/validation/mobile-modal';

// Phone (390) and the widest viewport still inside the mobile rule (590 — a
// per-modal `max-width` would leave side bands there), the first width above
// the rule (601), and desktop.
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
  const pick = sel => document.querySelector(sel);
  const inner1 = pick('.modal__inner-1');
  const inner2 = pick('.modal__inner-2');
  if (!inner1 || !inner2) return { error: 'modal missing' };
  const cs = sel => getComputedStyle(sel);
  const px = value => Math.round(value * 100) / 100;
  const r1 = inner1.getBoundingClientRect();
  const r2 = inner2.getBoundingClientRect();
  const tabs = pick('.modal__inner-2 .tabs');
  const tabLabel = pick('.modal__inner-2 .tabs__tab a');
  const title = pick('.modal__inner-2 .modal__title');
  const label = pick('.modal__inner-2 .form-entry__label');
  const bar = pick('.modal__inner-2 .modal__button-bar');
  const button = pick('.modal__inner-2 .modal__button-bar .button');
  const textfield = pick('.modal__inner-2 .textfield');
  return {
    vw,
    vh,
    inner1: { left: px(r1.left), top: px(r1.top), width: px(r1.width) },
    inner2: {
      left: px(r2.left),
      top: px(r2.top),
      width: px(r2.width),
      right: px(r2.right),
      bottom: px(r2.bottom),
      height: px(r2.height),
      radius: cs(inner2).borderTopLeftRadius,
      paddingTop: cs(inner2).paddingTop,
      maxHeight: cs(inner2).maxHeight,
      marginLeft: cs(inner2).marginLeft,
      scrolls: inner2.scrollHeight > inner2.clientHeight + 1,
    },
    tabs: tabs ? {
      marginLeft: cs(tabs).marginLeft,
      paddingLeft: cs(tabs).paddingLeft,
      boxShadow: cs(tabs).boxShadow,
      fontSize: cs(tabs).fontSize,
    } : null,
    tabLabel: tabLabel ? { fontSize: cs(tabLabel).fontSize } : null,
    title: title ? { fontSize: cs(title).fontSize } : null,
    label: label ? { fontSize: cs(label).fontSize } : null,
    bar: bar ? {
      marginLeft: cs(bar).marginLeft,
      bottom: cs(bar).bottom,
      rectBottom: px(bar.getBoundingClientRect().bottom),
    } : null,
    button: button ? {
      fontSize: cs(button).fontSize,
      height: px(button.getBoundingClientRect().height),
    } : null,
    textfield: textfield ? {
      fontSize: cs(textfield).fontSize,
      height: px(textfield.getBoundingClientRect().height),
    } : null,
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

    const measureModal = async (type, shot) => {
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
      if (shot) await screenshot(cdp, shot);
      const value = await cdp.evaluate(`return ${snapshot};`);
      if (type === 'settings') {
        value.scrolled = await cdp.evaluate(`return (() => {
          const inner2 = document.querySelector('.modal__inner-2');
          const tabs = document.querySelector('.modal__inner-2 .tabs');
          const px = value => Math.round(value * 100) / 100;
          const offset = () => px(tabs.getBoundingClientRect().top
            - inner2.getBoundingClientRect().top);
          const before = offset();
          inner2.scrollTop = 400;
          const after = offset();
          const panelTop = px(inner2.getBoundingClientRect().top);
          inner2.scrollTop = 0;
          return { before, after, panelTop, scrolled: px(inner2.scrollHeight) > 0 };
        })()`);
      }
      await cdp.evaluate("window.testStore.commit('modal/setStack', []); return true;");
      await waitFor(cdp, '!document.querySelector(".modal")', { label: `${type} modal closed` });
      return value;
    };

    for (const viewport of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      // The app exposes its debug handle (window.__editorSvc) on hostname
      // 'localhost' only, so the checks must run under that name.
      await navigate(cdp, `http://localhost:${port}/`);
      await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', {
        timeout: 60000, label: `application boot at ${viewport.width}px`,
      });
      await cdp.evaluate(`
        window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
        window.testStore.dispatch('data/patchLayoutSettings', { welcomeTourFinished: true });
        return true;
      `);
      await cdp.evaluate('return window.testStore.dispatch("data/toggleSideBar", false);');

      const settings = await measureModal('settings', `${EVIDENCE}/${viewport.id}-settings.png`);
      const properties = await measureModal('fileProperties');
      const short = viewport.mobile ? await measureModal('commentDeletion') : null;
      results[viewport.id] = {
        settings: { ...settings, title: properties.title },
        short,
      };
    }
  });
} finally {
  await server.close();
}

const desktop = results.desktop?.settings;
const narrow = VIEWPORTS.filter(viewport => viewport.mobile)
  .map(viewport => [viewport.id, results[viewport.id]?.settings]);
const wide = VIEWPORTS.filter(viewport => !viewport.mobile)
  .map(viewport => [viewport.id, results[viewport.id]?.settings]);

if (!desktop || narrow.some(([, value]) => !value) || wide.some(([, value]) => !value)) {
  failures.push(`missing measurement: ${JSON.stringify(results).slice(0, 800)}`);
} else {
  // 1. Every mobile viewport: the panel is flush with all four viewport edges.
  for (const [id, mobile] of narrow) {
    check(`${id} panel left edge`, mobile.inner2.left, 0);
    check(`${id} panel right edge`, mobile.inner2.right, mobile.vw);
    check(`${id} panel top edge`, mobile.inner2.top, 0);
    check(`${id} panel bottom edge`, mobile.inner2.bottom, mobile.vh);
    check(`${id} panel has no radius`, mobile.inner2.radius, '0px');
    // 批 113：面板高度锁定，内容不再决定面板大小（max-height 上限改为 height）。
    check(`${id} panel height is locked to the viewport`, mobile.inner2.height, mobile.vh);
    check(`${id} panel height cap is removed`, mobile.inner2.maxHeight, 'none');
    expectTrue(`${id} settings panel really overflows (content is taller than the panel)`,
      mobile.inner2.scrolls === true, JSON.stringify(mobile.inner2));
    expectTrue(`${id} sticky button bar hugs the panel bottom`,
      mobile.bar && Math.abs(mobile.bar.rectBottom - mobile.vh) < 1,
      JSON.stringify(mobile.bar));

    // 2. Sticky header cover follows the 12px padding, and the panel itself
    //    never scrolls out of the viewport when the content does.
    check(`${id} inner padding`, mobile.inner2.paddingTop, '12px');
    check(`${id} tabs negative margin`, mobile.tabs?.marginLeft, '-12px');
    check(`${id} tabs padding`, mobile.tabs?.paddingLeft, '12px');
    expectTrue(`${id} sticky cover equals the 12px top padding`,
      (mobile.tabs?.boxShadow || '').includes('-12px'), mobile.tabs?.boxShadow);
    check(`${id} header sits at the top padding edge`,
      mobile.scrolled?.before, parseFloat(mobile.inner2.paddingTop));
    check(`${id} header stays pinned after scrolling the content`,
      mobile.scrolled?.after, parseFloat(mobile.inner2.paddingTop));
    check(`${id} panel top stays at the viewport top after scrolling`,
      mobile.scrolled?.panelTop, 0);

    // 3. Type drops one step.
    check(`${id} tab label size`, mobile.tabLabel?.fontSize, '16px');
    check(`${id} section title size`, mobile.title?.fontSize, '20px');
    check(`${id} form label size`, mobile.label?.fontSize, '12.8px');

    // 4. Touch targets keep their desktop size.
    check(`${id} button font size unchanged`, mobile.button?.fontSize, desktop.button?.fontSize);
    check(`${id} button height unchanged`, mobile.button?.height, desktop.button?.height);
    check(`${id} field font size unchanged`, mobile.textfield?.fontSize, desktop.textfield?.fontSize);
    check(`${id} field height unchanged`, mobile.textfield?.height, desktop.textfield?.height);

    // 5. A short dialog is a flush sheet that still fills the locked panel
    //    (批 113 反转：短弹窗不再保持自然高度)。
    const short = results[id]?.short;
    check(`${id} short dialog left edge`, short?.inner2.left, 0);
    check(`${id} short dialog right edge`, short?.inner2.right, short?.vw);
    check(`${id} short dialog top edge`, short?.inner2.top, 0);
    check(`${id} short dialog has no radius`, short?.inner2.radius, '0px');
    check(`${id} short dialog also fills the viewport`, short?.inner2.bottom, short?.vh);
  }

  // 5. Wider viewports keep the desktop panel.
  for (const [id, viewport] of wide) {
    check(`${id} panel keeps its 10px side inset`, viewport.inner2.left - viewport.inner1.left, 10);
    check(`${id} panel keeps its 16px top inset`, viewport.inner2.top, 16);
    check(`${id} panel keeps its radius`, viewport.inner2.radius, '3px');
    check(`${id} panel keeps its padding`, viewport.inner2.paddingTop, '20px');
    check(`${id} panel keeps its locked height`, viewport.inner2.height, viewport.vh - 60);
    check(`${id} panel keeps its bottom inset`,
      viewport.vh - viewport.inner2.bottom, 44);
    check(`${id} panel keeps its own width cap`, viewport.inner1.width, Math.min(560, viewport.vw));
    check(`${id} panel keeps its side insets inside that cap`,
      viewport.inner2.width, viewport.inner1.width - 20);
    check(`${id} tabs keep their negative margin`, viewport.tabs?.marginLeft, '-20px');
    expectTrue(`${id} sticky cover keeps the 20px offset`,
      (viewport.tabs?.boxShadow || '').includes('-20px'), viewport.tabs?.boxShadow);
    check(`${id} tab label size unchanged`, viewport.tabLabel?.fontSize, '17.6px');
    check(`${id} section title size unchanged`, viewport.title?.fontSize, '24px');
    check(`${id} form label size unchanged`, viewport.label?.fontSize, '14.4px');
  }
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  console.error(`measured: ${JSON.stringify(results, null, 1)}`);
  process.exit(1);
}
console.log(`PASS mobile modal: flush at ${VIEWPORTS[0].width}px, desktop panel intact (evidence: ${EVIDENCE})`);