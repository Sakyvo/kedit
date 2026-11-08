// Run against npm run build output, in a fresh headless profile (no production account).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const server = await preview({
  ...(process.env.KEDIT_TEST_DIST ? { build: { outDir: process.env.KEDIT_TEST_DIST } } : {}),
  preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} },
});
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

  for (const monospaced of [false, true]) {
    await page.evaluate(monospaced => testStore.dispatch('data/setSettings', `editor:\n  monospacedFontOnly: ${monospaced}\n`), monospaced);
    for (const character of ['x', '中']) {
      await setText('anchor\n\nend\n');
      await page.evaluate(() => { __editorSvc.clEditor.focus(); __editorSvc.clEditor.setSelection(7, 7); });
      await settle();
      const lineTop = () => page.$$eval('.editor__line-number', rows => rows.find(row => row.textContent === '2').getBoundingClientRect().top);
      const emptyTop = await lineTop();
      await page.keyboard.type(character);
      await page.waitForFunction(character => __editorSvc.clEditor.getContent().startsWith(`anchor\n${character}\n`), {}, character);
      await settle();
      const typedText = await page.evaluate(() => __editorSvc.clEditor.getContent());
      // The pre-existing input/model duplication also reproduces without the gutter.
      if (typedText !== `anchor\n${character}\nend\n`) {
        assert.equal(typedText, `anchor\n${character}\ne${character}nd\n`, 'unexpected input regression');
        console.log('BASELINE input duplicates a character outside the edited line (also reproduced with gutter disposed)');
      }
      const typedTop = await lineTop();
      assert.ok(Math.abs(typedTop - emptyTop) < 0.5, JSON.stringify({ monospaced, character, emptyTop, typedTop }));
      await page.keyboard.press('Backspace');
      await page.waitForFunction(() => __editorSvc.clEditor.getContent().startsWith('anchor\n\n'));
      await settle();
      assert.ok(Math.abs(await lineTop() - emptyTop) < 0.5);
    }
  }
  await page.evaluate(() => testStore.dispatch('data/setSettings', ''));
  console.log('PASS real keyboard empty/Latin/Chinese/delete baseline stability with both fonts');
  for (const fontSizeFactor of [0.85, 1.25]) {
    await page.evaluate(fontSizeFactor => testStore.dispatch('data/setSettings', `fontSizeFactor: ${fontSizeFactor}\nsoftWrapOffset: 4\nhardBreakOffset: 10\n`), fontSizeFactor);
    for (const fenced of [false, true]) {
      const text = fenced ? '```text\n\n```\n' : 'anchor\n\nend\n';
      const offset = fenced ? 8 : 7;
      await setText(text);
      const lineTop = () => page.$$eval('.editor__line-number', rows => rows.find(row => row.textContent === '2').getBoundingClientRect().top);
      const emptyTop = await lineTop();
      await setText(text.slice(0, offset) + 'test' + text.slice(offset));
      assert.ok(Math.abs(await lineTop() - emptyTop) < 0.5, `code/prose baseline ${fontSizeFactor}/${fenced}`);
      await setText(text);
      assert.ok(Math.abs(await lineTop() - emptyTop) < 0.5);
    }
  }
  console.log('PASS code/prose empty/text baseline stability at two font sizes and custom spacing');
  await page.evaluate(() => testStore.dispatch('data/setSettings', ''));

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
    assert.equal(width, baseWidth, 'fixed four-digit gutter must not expand');
  }
  await page.evaluate(() => { __editorSvc.editorElt.parentNode.scrollTop = 980 * 34; });
  await settle();
  const ends = await numbers();
  assert.ok(ends.includes(999), JSON.stringify(ends));
  console.log('PASS actual width transitions and last-line scroll visibility');

  await setText('Position\n\nEnd\n');
  const colors = [];
  const backgrounds = [];
  const textGeometry = () => page.evaluate(() => {
    const content = __editorSvc.editorElt;
    const range = document.createRange();
    range.selectNodeContents(content);
    return { padding: getComputedStyle(content).paddingLeft, width: content.clientWidth,
      rects: Array.from(range.getClientRects(), rect => [rect.x, rect.y, rect.width, rect.height]) };
  });
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
          return { color: css.color, font: css.fontFamily, pointer: css.pointerEvents, selection: css.userSelect,
            background: css.backgroundColor, height: layer.getBoundingClientRect().height,
            editorHeight: __editorSvc.editorElt.parentNode.clientHeight };
        });
        colors.push(style.color);
        backgrounds.push(style.background);
        assert.equal(style.height, style.editorHeight);
        assert.notEqual(style.background, 'rgba(0, 0, 0, 0)');
        assert.match(style.font, /mono|Console/i);
        assert.equal(style.pointer, 'none');
        assert.equal(style.selection, 'none');
        assert.equal(await page.$$eval('.preview .editor__line-numbers', nodes => nodes.length), 0);
        const original = await textGeometry();
        for (const enabled of [false, true]) {
          await page.evaluate(({ theme, enabled }) => testStore.dispatch('data/setSettings', `colorTheme: ${theme}\nlineNumbers: ${enabled}\n`), { theme, enabled });
          await settle();
          assert.deepEqual(await textGeometry(), original, `toggle geometry: ${width}/${theme}/${showSidePreview}`);
        }
      }
    }
  }
  assert.ok(new Set(colors).size === 2, JSON.stringify(colors));
  assert.equal(new Set(backgrounds).size, 2);
  console.log('PASS desktop/narrow layout, editor/split mode, light/dark and preview isolation');

  // Toggle visibility only: every character keeps the same wrapping coordinates.
  const gutterState = () => page.evaluate(() => {
    const content = __editorSvc.editorElt;
    const range = document.createRange();
    range.selectNodeContents(content);
    const css = getComputedStyle(content);
    return {
      layers: document.querySelectorAll('.editor__line-numbers').length,
      rows: document.querySelectorAll('.editor__line-number').length,
      visibility: getComputedStyle(document.querySelector('.editor__line-numbers')).visibility,
      space: content.style.getPropertyValue('--editor-line-number-space'),
      text: __editorSvc.clEditor.getContent(),
      geometry: { padding: css.paddingLeft, width: content.clientWidth,
        rects: Array.from(range.getClientRects(), rect => [rect.x, rect.y, rect.width, rect.height]) },
    };
  });
  const onState = await gutterState();
  assert.equal(onState.layers, 1);
  assert.notEqual(onState.space, '');
  await page.evaluate(() => testStore.dispatch('data/setSettings', ['colorTheme: light', 'lineNumbers: false', ''].join('\n')));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.editor__line-numbers')).visibility === 'hidden');
  await settle();
  const offState = await gutterState();
  assert.equal(offState.rows, 0);
  assert.equal(offState.space, onState.space);
  assert.deepEqual(offState.geometry, onState.geometry);
  assert.equal(offState.text, onState.text);
  await page.evaluate(() => testStore.dispatch('data/setSettings', ['colorTheme: light', 'lineNumbers: true', ''].join('\n')));
  await page.waitForFunction(() => document.querySelectorAll('.editor__line-number').length > 0);
  assert.deepEqual(await numbers(), [1, 2, 3]);
  assert.deepEqual((await gutterState()).geometry, onState.geometry);
  console.log('PASS settings toggle preserves text width, left edge and wrap positions');
  await page.evaluate(() => testStore.dispatch('data/setSettings', 'colorTheme: light'));
  await settle();
  assert.equal(await page.$$eval('.editor__line-numbers', n => n.length), 1, 'missing key defaults to enabled');

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
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluate(() => {
    testStore.dispatch('data/patchLayoutSettings', { showSidePreview: true });
    __editorSvc.clEditor.focus(); __editorSvc.clEditor.setSelection(0, 5);
  });
  await page.waitForSelector('.new-discussion-button');
  await settle();
  const commentGeometry = await page.evaluate(() => {
    const button = document.querySelector('.new-discussion-button');
    const rect = button.getBoundingClientRect();
    const band = document.querySelector('.editor__line-numbers').getBoundingClientRect();
    const scroller = __editorSvc.editorElt.parentNode.getBoundingClientRect();
    return { noOverlap: rect.left >= band.right, insideEditor: rect.right <= scroller.right,
      clickable: button.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)) };
  });
  assert.deepEqual(commentGeometry, { noOverlap: true, insideEditor: true, clickable: true });
  console.log('PASS comment action remains clickable without covering line numbers');
  for (const enabled of [false, true]) {
    await page.evaluate(() => { void testStore.dispatch('modal/open', 'settings').catch(() => {}); });
    await page.waitForSelector('.settings-visual__section');
    await page.evaluate(enabled => {
      const entry = Array.from(document.querySelectorAll('.settings-visual .form-entry')).find(entry => entry.querySelector('label').textContent.trim().startsWith('显示行号'));
      const input = entry.querySelector('input');
      if (input.checked !== enabled) input.click();
    }, enabled);
    const beforeConfirm = await textGeometry();
    await page.click('.modal .button--resolve');
    await page.waitForFunction(enabled => !document.querySelector('.settings-visual') && testStore.getters['data/computedSettings'].lineNumbers === enabled, {}, enabled);
    await settle();
    assert.deepEqual(await textGeometry(), beforeConfirm);
    assert.equal(await page.$eval('.editor__line-numbers', elt => getComputedStyle(elt).visibility), enabled ? 'visible' : 'hidden');
  }
  console.log('PASS real settings checkbox/Confirm retains editor geometry');
  await page.evaluate(() => testStore.dispatch('data/setSettings', 'lineNumbers: false\n'));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('data/settings'))?.data?.includes('lineNumbers: false'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__editorSvc?.clEditor && document.querySelector('.editor__line-numbers'));
  await page.evaluate(() => { window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store; });
  await page.waitForFunction(() => testStore.getters['data/computedSettings'].lineNumbers === false);
  await settle();
  assert.equal(await page.$eval('.editor__line-numbers', elt => getComputedStyle(elt).visibility), 'hidden');
  const reloaded = await textGeometry();
  await page.evaluate(() => testStore.dispatch('data/setSettings', 'lineNumbers: true\n'));
  await page.waitForFunction(() => document.querySelectorAll('.editor__line-number').length > 0);
  await settle();
  assert.deepEqual(await textGeometry(), reloaded);
  console.log('PASS persisted OFF survives reload; enabling after reload retains text geometry');
  assert.deepEqual(errors, [], 'page runtime errors');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
