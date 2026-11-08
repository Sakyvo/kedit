// Run against npm run build output, in a fresh headless profile (no production account).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} } });
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--disable-background-networking', '--no-first-run', '--disable-default-apps'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/conf') request.respond({ contentType: 'application/json', body: '{}' });
    else request.continue();
  });
  await page.goto(`http://localhost:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__editorSvc?.clEditor && document.querySelector('.editor__inner')?.isContentEditable);
  await page.evaluate(() => {
    window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
    testStore.dispatch('data/patchLayoutSettings', {
      welcomeTourFinished: true, showEditor: true, showSidePreview: false, showExplorer: false, showSideBar: false,
    });
  });
  await page.waitForFunction(() => testStore.getters['content/current'].id && __editorSvc.clEditor.getContent() === testStore.getters['content/current'].text);
  await page.evaluate(() => {
    const id = 'line-number-first-document';
    testStore.commit('content/setItem', { id: `${id}/content`, text: 'Fixture ready\n', properties: '\n', discussions: {}, comments: {} });
    testStore.commit('file/setItem', { id, name: 'Line number fixture', parentId: null });
    testStore.commit('file/setCurrentId', id);
  });
  await page.waitForFunction(() => __editorSvc.clEditor.getContent() === 'Fixture ready\n');
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const setText = async (text) => {
    await page.evaluate(text => {
      const id = `line-number-fixture-${Date.now()}`;
      testStore.commit('content/setItem', { id: `${id}/content`, text, properties: '\n', discussions: {}, comments: {} });
      testStore.commit('file/setItem', { id, name: 'Line number fixture', parentId: null });
      testStore.commit('file/setCurrentId', id);
      __editorSvc.editorElt.parentNode.scrollTop = 0;
    }, text);
    try {
      await page.waitForFunction(text => __editorSvc.clEditor.getContent() === text, {}, text);
    } catch (error) {
      console.error(await page.evaluate(() => ({ current: __editorSvc.clEditor.getContent(), id: testStore.getters['content/current'].id, dom: __editorSvc.editorElt.textContent })), errors);
      throw error;
    }
    await settle();
  };
  const numbers = () => page.$$eval('.editor__line-number', rows => rows.map(row => +row.textContent).sort((a, b) => a - b));
  const expectText = async (text) => {
    try {
      await page.waitForFunction(text => __editorSvc.clEditor.getContent() === text, { timeout: 5000 }, text);
    } catch (error) {
      console.error('CONTENT MISMATCH', await page.evaluate(() => ({ text: __editorSvc.clEditor.getContent(), dom: __editorSvc.editorElt.textContent, focus: document.activeElement?.className, selection: [__editorSvc.clEditor.selectionMgr.selectionStart, __editorSvc.clEditor.selectionMgr.selectionEnd] })), { expected: text }, errors);
      throw error;
    }
    await settle();
  };
  await setText('\n');
  assert.deepEqual(await numbers(), [1]);
  await setText('first\n');
  await page.evaluate(() => { __editorSvc.clEditor.focus(); __editorSvc.clEditor.setSelection(5, 5); });
  await page.keyboard.press('Enter');
  await expectText('first\n\n');
  assert.deepEqual(await numbers(), [1, 2]);
  await page.keyboard.press('Backspace');
  await expectText('first\n');
  assert.deepEqual(await numbers(), [1]);
  await page.evaluate(() => {
    const clip = new DataTransfer();
    clip.setData('text/plain', '\n\nlast');
    __editorSvc.editorElt.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: clip }));
  });
  await expectText('first\n\nlast\n');
  assert.deepEqual(await numbers(), [1, 2, 3]);
  await page.waitForFunction(() => __editorSvc.clEditor.undoMgr.canUndo());
  await page.evaluate(() => __editorSvc.clEditor.undoMgr.undo());
  await expectText('first\n');
  assert.deepEqual(await numbers(), [1]);
  await page.evaluate(() => __editorSvc.clEditor.undoMgr.redo());
  await expectText('first\n\nlast\n');
  assert.deepEqual(await numbers(), [1, 2, 3]);
  const copied = await page.evaluate(() => {
    const editor = __editorSvc.clEditor;
    editor.setSelection(0, editor.getContent().length - 1);
    const clip = new DataTransfer();
    editor.$contentElt.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: clip }));
    return { copied: clip.getData('text/plain'), stored: testStore.getters['content/current'].text,
      inside: !!editor.$contentElt.querySelector('.editor__line-number') };
  });
  assert.deepEqual(copied, { copied: 'first\n\nlast', stored: 'first\n\nlast\n', inside: false });
  console.log('PASS empty document, keyboard Enter/Backspace, paste, undo/redo, raw Markdown and copy isolation');

  const sample = `${'Wrapped text '.repeat(80)}\nAfterWrap\n\nLast\n`;
  await setText(sample);
  const alignMarker = async (marker, number) => {
    const alignment = await page.evaluate(({ marker, number }) => {
      const walker = document.createTreeWalker(__editorSvc.editorElt, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const start = node.textContent.indexOf(marker);
        if (start < 0) continue;
        const range = document.createRange();
        range.setStart(node, start); range.setEnd(node, start + 1);
        const rect = range.getBoundingClientRect();
        const row = Array.from(document.querySelectorAll('.editor__line-number')).find(row => +row.textContent === number);
        if (!row) return { missing: number };
        const rowRect = row.getBoundingClientRect();
        return { delta: Math.abs(rect.top - rowRect.top), leftOfText: rowRect.right < rect.left,
          rowTop: rowRect.top, textTop: rect.top };
      }
      return { missing: marker };
    }, { marker, number });
    assert.ok(alignment.delta < 1 && alignment.leftOfText, JSON.stringify(alignment));
    return alignment;
  };
  await alignMarker('Wrapped', 1);
  await alignMarker('AfterWrap', 2);
  assert.deepEqual(await numbers(), [1, 2, 3, 4]);
  const before = await alignMarker('AfterWrap', 2);
  const scrolled = await page.evaluate(() => { const elt = __editorSvc.editorElt.parentNode; elt.scrollTop = 60; return elt.scrollTop; });
  await settle();
  const after = await alignMarker('AfterWrap', 2);
  assert.ok(scrolled > 0 && Math.abs(before.rowTop - after.rowTop - scrolled) < 1);
  console.log('PASS actual wrapped-source rows and scroll geometry', JSON.stringify({ before, after, scrolled }));

  let baseWidth;
  for (const count of [9, 10, 99, 100, 999, 1000, 10000, 999]) {
    await setText('line\n'.repeat(count));
    const width = await page.$eval('.editor__line-numbers', layer => layer.getBoundingClientRect().width);
    if (!baseWidth) baseWidth = width;
    if (count < 1000) assert.equal(width, baseWidth);
    else assert.ok(width > baseWidth);
  }
  await page.evaluate(() => { __editorSvc.editorElt.parentNode.scrollTop = 980 * 34; });
  await settle();
  const ends = await numbers();
  assert.ok(ends.includes(999), JSON.stringify(ends));
  console.log('PASS actual width transitions and last-line scroll visibility');

  await setText('Position\n\nEnd\n');
  const colors = [];
  for (const width of [1280, 390]) {
    await page.setViewport({ width, height: 800 });
    for (const showSidePreview of [false, true]) {
      await page.evaluate(showSidePreview => testStore.dispatch('data/patchLayoutSettings', { showSidePreview }), showSidePreview);
      await settle();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => testStore.dispatch('data/setSettings', `colorTheme: ${theme}\n`), theme);
        await settle();
        await alignMarker('Position', 1);
        const style = await page.$eval('.editor__line-numbers', layer => {
          const css = getComputedStyle(layer);
          return { color: css.color, font: css.fontFamily, pointer: css.pointerEvents, selection: css.userSelect };
        });
        colors.push(style.color);
        assert.match(style.font, /mono|Console/i);
        assert.equal(style.pointer, 'none');
        assert.equal(style.selection, 'none');
        assert.equal(await page.$$eval('.preview .editor__line-numbers', nodes => nodes.length), 0);
      }
    }
  }
  assert.ok(new Set(colors).size === 2, JSON.stringify(colors));
  console.log('PASS desktop/narrow layout, editor/split mode, light/dark and preview isolation');

  await page.evaluate(() => {
    const id = 'line-number-second-document';
    testStore.commit('content/setItem', { id: `${id}/content`, text: 'NewDocument\n', properties: '\n', discussions: {}, comments: {} });
    testStore.commit('file/setItem', { id, name: 'Line number regression', parentId: null });
    testStore.commit('file/setCurrentId', id);
  });
  await expectText('NewDocument\n');
  assert.deepEqual(await numbers(), [1]);
  assert.equal(await page.$$eval('.editor__line-numbers', nodes => nodes.length), 1);
  console.log('PASS document switch replaces old numbering');
  assert.deepEqual(errors, [], 'page runtime errors');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
