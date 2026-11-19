// Headless verification that a narrow side bar (the full-width overlay used
// when the layout overflows) yields the screen as soon as the document area
// shows a revision diff — otherwise tapping a revision in 文件历史 looks like a
// no-op. On desktop the side bar is a fixed column and must stay put.
//
// The revision-content dispatch is the seam: 文件历史 fetches the revision and
// dispatches it unchanged; this slice is about what the side bar does when that
// content arrives.
//
// Run after `npm run build`: node test/browser/mobile-history.mjs
import { mkdir } from 'node:fs/promises';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, screenshot, stubPath } from './cdp.mjs';

const EVIDENCE = '.target/validation/mobile-history';

// 390 is inside the narrow overlay layout (layoutOverflow), 1280 is not.
const VIEWPORTS = [
  { id: 'narrow', width: 390, height: 844, expectSideBarClosed: true },
  { id: 'desktop', width: 1280, height: 900, expectSideBarClosed: false },
];

const ORIGINAL = 'fixture line\n';
const REVISED = 'fixture line\nadded by the revision\n';

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const expectTrue = (label, value, detail) => {
  if (!value) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const state = `(() => {
  const panel = document.querySelector('.layout__panel--side-bar');
  const history = document.querySelector('.side-bar .history');
  const visible = elt => !!elt && elt.offsetParent !== null;
  return {
    showSideBar: window.testStore.getters['layout/styles'].showSideBar,
    layoutOverflow: window.testStore.getters['layout/styles'].layoutOverflow,
    sideBarVisible: visible(panel),
    historyMounted: !!history,
    historyVisible: visible(history),
    sideBarPanel: window.testStore.getters['data/layoutSettings'].sideBarPanel,
    revisionActive: !!window.testStore.state.content.revisionContent,
    revisionLayout: !!document.querySelector('.layout--revision'),
    diffMarks: document.querySelectorAll('.revision-diff').length,
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

    for (const viewport of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await navigate(cdp, `http://localhost:${port}/`);
      await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', {
        timeout: 60000, label: `application boot at ${viewport.width}px`,
      });

      // A document to compare against, then the side bar parked on 文件历史.
      await cdp.evaluate(`
        window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
        const id = 'history-fixture';
        window.testStore.commit('content/setItem', {
          id: id + '/content',
          text: ${JSON.stringify(ORIGINAL)},
          properties: '',
          discussions: {},
          comments: {},
        });
        window.testStore.commit('file/setItem', { id, name: 'History fixture', parentId: null });
        window.testStore.commit('file/setCurrentId', id);
        window.testStore.dispatch('data/patchLayoutSettings', {
          welcomeTourFinished: true,
          showEditor: true,
          showSidePreview: false,
          showExplorer: false,
          showSideBar: true,
          sideBarPanel: 'history',
        });
        return true;
      `);
      await waitFor(cdp, 'document.querySelector(".side-bar .history")', {
        timeout: 20000, label: 'history panel rendered',
      });
      const before = await cdp.evaluate(`return ${state};`);
      check(`${viewport.id} starts with the side bar open on 文件历史`,
        before.historyVisible && before.sideBarPanel, 'history');
      check(`${viewport.id} narrow-overlay mode matches the viewport`,
        before.layoutOverflow, viewport.expectSideBarClosed);
      await screenshot(cdp, `${EVIDENCE}/${viewport.id}-before.png`);

      // A revision arrives — the same dispatch 文件历史 makes after fetching it.
      await cdp.evaluate(`
        await window.testStore.dispatch('content/setRevisionContent', { text: ${JSON.stringify(REVISED)} });
        return true;
      `);
      await cdp.evaluate(
        'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
      );
      const after = await cdp.evaluate(`return ${state};`);
      results[viewport.id] = { before, after };
      await screenshot(cdp, `${EVIDENCE}/${viewport.id}-after.png`);

      // The diff really is on screen in both layouts.
      expectTrue(`${viewport.id} revision view is active`, after.revisionActive && after.revisionLayout,
        JSON.stringify(after));
      expectTrue(`${viewport.id} diff is rendered`, after.diffMarks > 0, JSON.stringify(after));

      // The behaviour under test: the overlay yields, the fixed column stays.
      check(`${viewport.id} side bar visibility`,
        after.sideBarVisible, !viewport.expectSideBarClosed);
      check(`${viewport.id} side bar state`,
        after.showSideBar, !viewport.expectSideBarClosed);

      // Closing the overlay must not throw the revision away: the panel state
      // stays on 文件历史 (the side bar is only hidden), so the diff survives.
      if (viewport.expectSideBarClosed) {
        check('narrow close keeps the 文件历史 panel', after.sideBarPanel, 'history');
        expectTrue('narrow close keeps 文件历史 mounted (its teardown clears the diff)',
          after.historyMounted, JSON.stringify(after));
      }

      // Clearing the revision (Esc / 关闭修订) must not move the side bar back.
      await cdp.evaluate(`
        window.testStore.commit('content/setRevisionContent');
        return true;
      `);
      await cdp.evaluate(
        'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
      );
      const cleared = await cdp.evaluate(`return ${state};`);
      results[viewport.id].cleared = cleared;
      expectTrue(`${viewport.id} clearing the revision leaves the side bar alone`,
        !cleared.revisionActive && cleared.sideBarVisible === after.sideBarVisible,
        JSON.stringify(cleared));

      // Regression guard for the narrow close semantics established in 批 016:
      // on the TOC panel the ✕ still closes the whole side bar.
      if (viewport.expectSideBarClosed) {
        await cdp.evaluate(`
          await window.testStore.dispatch('data/patchLayoutSettings', {
            showSideBar: true, sideBarPanel: 'toc',
          });
          return true;
        `);
        await waitFor(cdp, 'document.querySelector(".side-bar .toc")', {
          timeout: 20000, label: 'TOC panel rendered',
        });
        await cdp.evaluate(`
          const buttons = document.querySelectorAll('.side-title__button');
          buttons[buttons.length - 1].click();
          return true;
        `);
        await cdp.evaluate(
          'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
        );
        const tocClosed = await cdp.evaluate(`return ${state};`);
        results[viewport.id].tocClosed = tocClosed;
        expectTrue('narrow TOC ✕ still closes the side bar (016 semantics)',
          !tocClosed.sideBarVisible, JSON.stringify(tocClosed));
      }
    }
  });
} finally {
  await server.close();
}

const narrow = results.narrow;
const desktop = results.desktop;

if (!narrow || !desktop) {
  failures.push(`missing measurement: ${JSON.stringify(results).slice(0, 600)}`);
} else {
  // Red/green pair on the very same dispatch: only the narrow overlay yields.
  expectTrue('narrow overlay no longer covers the document', !narrow.after.sideBarVisible,
    JSON.stringify(narrow.after));
  expectTrue('desktop column stays open', desktop.after.sideBarVisible,
    JSON.stringify(desktop.after));
  expectTrue('narrow layout really overflowed (precondition)', narrow.before.layoutOverflow,
    JSON.stringify(narrow.before));
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  console.error(`measured: ${JSON.stringify(results, null, 1)}`);
  process.exit(1);
}
console.log(`PASS mobile history: narrow overlay yields to the diff, desktop column stays (evidence: ${EVIDENCE})`);