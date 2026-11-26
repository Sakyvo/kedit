// Isolated production UI, synthetic images only; never sends a deletion request.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { withBrowser, navigate, waitFor, stubPath, screenshot } from './cdp.mjs';

const evidence = '.target/validation/image-cleanup';
await mkdir(evidence, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} }, logLevel: 'error' });
try {
  await withBrowser(async (cdp) => {
    await stubPath(cdp, '/conf', '{}');
    await navigate(cdp, `http://localhost:${server.httpServer.address().port}/`);
    await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".editor__inner")?.isContentEditable', { timeout: 60000 });
    await cdp.evaluate(`
      window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
      await testStore.dispatch('data/patchLayoutSettings', { welcomeTourFinished: true });
      await testStore.dispatch('data/setSettings', ${JSON.stringify('# keep this comment\ncustomKey: untouched\n')});
    `);
    const settle = () => cdp.evaluate('return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));');
    const open = async () => {
      await cdp.evaluate("testStore.dispatch('modal/open', 'imageCleanup').catch(() => {});");
      await waitFor(cdp, 'document.querySelector(".image-cleanup__list") && !document.querySelector(".image-cleanup__list").getAttribute("aria-busy").includes("true")');
      await cdp.evaluate(`
        const find = (vnode) => {
          if (vnode?.component?.type.methods?.savePolicy) return vnode.component.proxy;
          if (vnode?.component) return find(vnode.component.subTree);
          for (const child of Array.isArray(vnode?.children) ? vnode.children : []) {
            const result = find(child);
            if (result) return result;
          }
        };
        window.cleanupVm = find(document.querySelector('[data-v-app]')._vnode);
        if (!cleanupVm) throw new Error('Image cleanup component not found');
      `);
    };
    const close = async () => {
      await cdp.evaluate("document.querySelector('.modal__close-button').click();");
      await waitFor(cdp, '!document.querySelector(".image-cleanup")');
    };
    const days = async value => {
      await cdp.evaluate(`const input = document.querySelector('#image-cleanup-days'); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true }));`);
      await settle();
    };
    const save = async () => {
      await cdp.evaluate("document.querySelector('.image-cleanup__duration button').click();");
      await waitFor(cdp, 'cleanupVm.saved');
    };
    const seed = async (count = 36) => {
      await cdp.evaluate(`
        const now = Date.now();
        cleanupVm.entries = Array.from({ length: ${count} }, (_, i) => ({
          path: 'imgs/2026-07-29/' + 'reference-image-'.repeat(3) + i + '.png',
          sha: 'synthetic-' + i, since: now - (i % 8) * 86400000, selected: false,
          dataUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#7b8d98"/></svg>'),
        }));
        await testStore.dispatch('data/setImgCleanup', { unreferencedSince: {}, log: Array.from({ length: 50 }, (_, i) => ({ path: 'imgs/old/' + 'long-name-'.repeat(7) + i + '.png', ts: now - i * 86400000 })) });
      `);
      await settle();
    };
    await open();
    assert.equal(await cdp.evaluate("return document.querySelector('#image-cleanup-days').value;"), '3');
    assert.equal(await cdp.evaluate('return cleanupVm.draftEnabled;'), true);
    for (const invalid of ['', '0', '-1', '1.5']) {
      await days(invalid);
      assert.equal(await cdp.evaluate("return document.querySelector('.image-cleanup__duration button').disabled;"), true, `invalid ${invalid}`);
      assert.equal(await cdp.evaluate("return testStore.getters['data/settings'].includes('imageCleanup');"), false);
    }
    await days('7');
    await save();
    assert.match(await cdp.evaluate("return testStore.getters['data/settings'];"), /days: 7/);
    assert.match(await cdp.evaluate("return testStore.getters['data/settings'];"), /# keep this comment/);
    await days('12');
    await close();
    await open();
    assert.equal(await cdp.evaluate('return cleanupVm.draftDays;'), 7, 'unsaved draft is discarded');
    console.log('PASS default, integer validation, explicit save, comments and reopen');

    await cdp.evaluate("document.querySelector('.image-cleanup__policy input[type=checkbox]').click();");
    await save();
    await close(); await open(); await seed();
    assert.equal(await cdp.evaluate('return cleanupVm.draftEnabled;'), false);
    assert.equal(await cdp.evaluate("return document.querySelector('#image-cleanup-days').disabled;"), true);
    assert.match(await cdp.evaluate("return document.querySelector('.image-cleanup__age').textContent;"), /自动清理已关闭/);
    await cdp.evaluate("document.querySelector('.image-cleanup__entry input').click();");
    await settle();
    assert.equal(await cdp.evaluate("return document.querySelector('.image-cleanup__toolbar input').indeterminate;"), true);
    await cdp.evaluate("document.querySelector('.modal__button-bar .button--resolve').click();");
    await waitFor(cdp, '!!document.querySelector(".image-cleanup__confirmation")');
    assert.match(await cdp.evaluate("return document.querySelector('.image-cleanup__confirmation').textContent;"), /不可撤销/);
    await cdp.evaluate("document.querySelector('.modal__button-bar .button').click();");
    await settle();
    assert.equal(await cdp.evaluate('return cleanupVm.selectedCount;'), 1);
    await cdp.evaluate("document.querySelector('.image-cleanup__toolbar input').click();");
    await settle();
    assert.equal(await cdp.evaluate('return cleanupVm.selectedCount;'), 36);
    await cdp.evaluate("document.querySelector('.image-cleanup__toolbar input').click();");
    console.log('PASS disable, manual confirmation/cancel and partial/all selection');

    await cdp.evaluate("document.querySelector('.image-cleanup__policy input[type=checkbox]').click();");
    await days('3'); await save();
    for (const width of [390, 590, 601, 1280]) {
      for (const theme of ['light', 'dark']) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width <= 600 });
        await cdp.evaluate(`await testStore.dispatch('data/setSettings', testStore.getters['data/settings'].replace(/^colorTheme:.*\\n?/m, '') + ${JSON.stringify('colorTheme: ')} + '${theme}' + '\\n');`);
        await settle();
        const layout = await cdp.evaluate(`
          const list = document.querySelector('.image-cleanup__list');
          const panel = document.querySelector('.modal__inner-2');
          const bar = document.querySelector('.modal__button-bar');
          const lr = list.getBoundingClientRect(), pr = panel.getBoundingClientRect(), br = bar.getBoundingClientRect();
          return { listHeight: lr.height, panelWidth: pr.width, panelRight: pr.right, barBottom: br.bottom,
            noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth + 1,
            listScrollable: list.scrollHeight > list.clientHeight,
            disabledColor: getComputedStyle(bar.querySelector('.button--resolve')).color,
            bodyWidth: innerWidth };
        `);
        assert.ok(layout.listHeight > 320, JSON.stringify(layout));
        assert.ok(layout.noHorizontalOverflow && layout.listScrollable, JSON.stringify(layout));
        assert.ok(layout.panelRight <= width + 1 && layout.barBottom <= 900, JSON.stringify(layout));
        if (width <= 600) assert.ok(Math.abs(layout.panelWidth - width) < 2, JSON.stringify(layout));
        console.log(`PASS layout ${width}px ${theme}: list ${Math.round(layout.listHeight)}px`);
        if (width === 390 || width === 1280) await screenshot(cdp, `${evidence}/${width}-${theme}.png`);
      }
    }
    await cdp.evaluate("document.querySelector('.image-cleanup__log').open = true;");
    await settle();
    assert.equal(await cdp.evaluate("return document.querySelector('.modal__inner-2').scrollWidth <= document.querySelector('.modal__inner-2').clientWidth + 1;"), true);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 450, deviceScaleFactor: 1, mobile: true });
    await settle();
    assert.ok(await cdp.evaluate("return document.querySelector('.modal__button-bar').getBoundingClientRect().bottom <= 450;"));
    await cdp.evaluate('cleanupVm.entries = []; cleanupVm.scanError = false;');
    await settle();
    assert.match(await cdp.evaluate("return document.querySelector('.image-cleanup__list').textContent;"), /未发现未引用图片/);
    await cdp.evaluate('cleanupVm.scanError = true;'); await settle();
    assert.match(await cdp.evaluate("return document.querySelector('.image-cleanup__list').textContent;"), /扫描失败/);
    await cdp.evaluate("document.querySelector('.image-cleanup__empty button').click();");
    await waitFor(cdp, '!cleanupVm.scanning && !cleanupVm.scanError');
    console.log('PASS expanded logs, short viewport, empty/error states and retry');
    await close();
  });
} finally {
  await new Promise(resolve => server.httpServer.close(resolve));
}
