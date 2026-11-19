// Headless verification that the locked modal panel follows the *visual*
// viewport, so an on-screen keyboard cannot cover the button bar.
//
// A fake `visualViewport` is installed before the app boots: shrinking only
// `innerHeight` would also shrink `100vh`, which cannot tell a real
// visual-viewport implementation from a plain `vh` one. The fake keeps the
// layout viewport intact and moves only the visual viewport, then fires the
// event the platform fires.
//
// Run after `npm run build`: node test/browser/modal-keyboard-viewport.mjs
import { mkdir } from 'node:fs/promises';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, screenshot, stubPath } from './cdp.mjs';

const EVIDENCE = '.target/validation/modal-keyboard-viewport';

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const expectTrue = (label, value, detail) => {
  if (!value) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

// Installed before any app code runs. `setKeyboard(height, top)` mimics an
// on-screen keyboard shrinking (and panning) the visual viewport.
const fakeVisualViewport = `(() => {
  const listeners = { resize: [], scroll: [] };
  const fake = {
    get width() { return window.innerWidth; },
    height: window.innerHeight,
    offsetTop: 0,
    offsetLeft: 0,
    pageTop: 0,
    pageLeft: 0,
    scale: 1,
    addEventListener(type, handler) {
      if (listeners[type]) listeners[type].push(handler);
    },
    removeEventListener(type, handler) {
      if (listeners[type]) listeners[type] = listeners[type].filter(item => item !== handler);
    },
    dispatchEvent() { return true; },
  };
  window.__setKeyboardViewport = (height, top = 0) => {
    fake.height = height;
    fake.offsetTop = top;
    listeners.resize.forEach(handler => handler({ target: fake }));
  };
  window.__visualViewportListeners = listeners;
  // Record window subscriptions so we can prove the app does NOT hang the panel
  // off window scroll (the touch scroll proxy fires it continuously).
  window.__windowListeners = [];
  const originalAdd = window.addEventListener.bind(window);
  window.addEventListener = (type, handler, options) => {
    window.__windowListeners.push(type);
    return originalAdd(type, handler, options);
  };
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
  return true;
})();`;

const snapshot = `(() => {
  const px = (value) => Math.round(value * 100) / 100;
  const inner2 = document.querySelector('.modal__inner-2');
  if (!inner2) return { error: 'modal missing' };
  const bar = document.querySelector('.modal__inner-2 .modal__button-bar');
  const r2 = inner2.getBoundingClientRect();
  const cs = getComputedStyle(inner2);
  const properties = cs.transitionProperty.split(',');
  const durations = cs.transitionDuration.split(',');
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    visualHeight: window.visualViewport ? window.visualViewport.height : null,
    visualTop: window.visualViewport ? window.visualViewport.offsetTop : null,
    panel: {
      top: px(r2.top), bottom: px(r2.bottom), height: px(r2.height),
      maxHeight: cs.maxHeight,
    },
    bar: bar ? { bottom: px(bar.getBoundingClientRect().bottom) } : null,
    animatedHeight: properties.some((property, index) => property.trim() === 'height'
      && (durations[index] || '').trim() !== '0s'),
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
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: fakeVisualViewport });

    // Phone: the panel must track the visual viewport.
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
    });
    await navigate(cdp, `http://localhost:${port}/`);
    await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', {
      timeout: 60000, label: 'application boot',
    });
    await cdp.evaluate(`
      window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
      await window.testStore.dispatch('data/patchLayoutSettings', {
        welcomeTourFinished: true, showSideBar: false,
      });
      window.testStore.dispatch('modal/open', 'settings');
      return true;
    `);
    await waitFor(cdp, 'document.querySelector(".modal__inner-2")', {
      timeout: 20000, label: 'settings modal open',
    });
    await cdp.evaluate(
      'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
    );

    const idle = await cdp.evaluate(`return ${snapshot};`);
    results.idle = idle;
    expectTrue('panel starts at the full viewport height',
      idle.panel.height === 844, JSON.stringify(idle.panel));

    const listeners = await cdp.evaluate(`return {
      visualResize: window.__visualViewportListeners.resize.length,
      visualScroll: window.__visualViewportListeners.scroll.length,
      windowTypes: window.__windowListeners,
    };`);
    results.listeners = listeners;
    expectTrue('app subscribes to the visual viewport', listeners.visualResize > 0,
      JSON.stringify(listeners));
    expectTrue('app does not hang the panel off window scroll',
      !listeners.windowTypes.includes('scroll'), JSON.stringify(listeners));

    // On-screen keyboard: visual viewport shrinks to 480px, layout stays 844.
    await cdp.evaluate(`
      window.__setKeyboardViewport(480, 0);
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
    `);
    const keyboard = await cdp.evaluate(`return ${snapshot};`);
    results.keyboard = keyboard;
    await screenshot(cdp, `${EVIDENCE}/phone-keyboard.png`);
    check('layout viewport did not change', keyboard.vh, 844);
    check('panel height follows the visual viewport', keyboard.panel.height, 480);
    check('panel keeps its height cap removed', keyboard.panel.maxHeight, 'none');
    expectTrue('button bar stays inside the visual viewport',
      keyboard.bar && keyboard.bar.bottom <= keyboard.visualHeight + 1.5,
      JSON.stringify(keyboard));
    expectTrue('button bar still hugs the panel bottom',
      keyboard.bar && Math.abs(keyboard.bar.bottom - keyboard.panel.bottom) < 1.5,
      JSON.stringify(keyboard));
    expectTrue('height is not animated', keyboard.animatedHeight === false,
      JSON.stringify(keyboard.animatedHeight));

    // Panning the visual viewport (iOS scrolls the page behind the keyboard)
    // moves the panel with it instead of leaving its top off-screen.
    await cdp.evaluate(`
      window.__setKeyboardViewport(480, 200);
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
    `);
    const panned = await cdp.evaluate(`return ${snapshot};`);
    results.panned = panned;
    check('panel follows the visual viewport top', panned.panel.top, 200);
    check('panel height still follows the visual viewport', panned.panel.height, 480);

    // Keyboard dismissed: back to the locked full height.
    await cdp.evaluate(`
      window.__setKeyboardViewport(window.innerHeight, 0);
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
    `);
    const restored = await cdp.evaluate(`return ${snapshot};`);
    results.restored = restored;
    check('panel returns to the full viewport height', restored.panel.height, 844);
    check('panel returns to the viewport top', restored.panel.top, 0);

    // Desktop: the variable degrades to the window height (no regression).
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await navigate(cdp, `http://localhost:${port}/`);
    await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', {
      timeout: 60000, label: 'application boot (desktop)',
    });
    await cdp.evaluate(`
      window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
      await window.testStore.dispatch('data/patchLayoutSettings', {
        welcomeTourFinished: true, showSideBar: false,
      });
      window.testStore.dispatch('modal/open', 'settings');
      return true;
    `);
    await waitFor(cdp, 'document.querySelector(".modal__inner-2")', {
      timeout: 20000, label: 'settings modal open (desktop)',
    });
    await cdp.evaluate(
      'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
    );
    const desktop = await cdp.evaluate(`return ${snapshot};`);
    results.desktop = desktop;
    check('desktop panel keeps the 60px cap', desktop.panel.height, 840);
    check('desktop panel keeps its 16px top inset', desktop.panel.top, 16);
  });
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  console.error(`measured: ${JSON.stringify(results, null, 1).slice(0, 3000)}`);
  process.exit(1);
}
console.log(`PASS modal keyboard viewport: panel tracks the visual viewport (evidence: ${EVIDENCE})`);
