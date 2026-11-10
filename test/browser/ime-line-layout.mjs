// Full production editor + Chromium native composition, isolated from OS input.
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
    headless: true, args: ['--disable-background-networking', '--no-first-run', '--disable-default-apps'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/conf') request.respond({ contentType: 'application/json', body: '{}' });
    else request.continue();
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://localhost:${server.httpServer.address().port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__editorSvc?.clEditor && document.querySelector('.editor__inner')?.isContentEditable);
  await page.evaluate(() => {
    window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
    testStore.dispatch('data/patchLayoutSettings', { welcomeTourFinished: true, showEditor: true, showSidePreview: false, showExplorer: false, showSideBar: false });
  });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const client = await page.createCDPSession();
  const snapshot = () => page.evaluate(() => {
    const content = __editorSvc.editorElt;
    const lineRects = [];
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      for (let i = node.textContent.indexOf('\n'); i !== -1; i = node.textContent.indexOf('\n', i + 1)) {
        const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
        const br = node.parentElement.closest('.hd-lf')?.parentElement.querySelector('br');
        const rect = br ? br.getBoundingClientRect() : range.getBoundingClientRect();
        lineRects.push(rect.top);
      }
    }
    return { lineRects, rows: Array.from(document.querySelectorAll('.editor__line-number'), row => [Number(row.textContent), row.getBoundingClientRect().top]),
      text: __editorSvc.clEditor.getContent(), dom: content.textContent,
      composing: __editorSvc.clEditor.highlighter.isComposing,
      font: getComputedStyle(content).fontFamily, fontSize: getComputedStyle(content).fontSize,
      selection: [__editorSvc.clEditor.selectionMgr.selectionStart, __editorSvc.clEditor.selectionMgr.selectionEnd] };
  });
  console.log('Environment', await browser.version());
  for (const monospaced of [false, true]) {
  for (const fenced of [false, true]) {
  for (const soft of [-3.5, 0]) {
  for (const cancel of [false, true]) {
    await page.evaluate(({ soft, monospaced }) => testStore.dispatch('data/setSettings', `softWrapOffset: ${soft}\nhardBreakOffset: 3\neditor:\n  monospacedFontOnly: ${monospaced}\n`), { soft, monospaced });
    const body = 'upper\n\n\ninput\n\n\nlower\n\nend\n';
    const text = fenced ? `\`\`\`text\n${body}\`\`\`\n` : body;
    const offset = text.indexOf('input') + 5;
    await page.evaluate(text => {
      const id = `ime-${Date.now()}`;
      testStore.commit('content/setItem', { id: `${id}/content`, text, properties: '\n', discussions: {}, comments: {} });
      testStore.commit('file/setItem', { id, name: 'IME fixture', parentId: null });
      testStore.commit('file/setCurrentId', id);
    }, text);
    await page.waitForFunction(text => __editorSvc.clEditor.getContent() === text, {}, text);
    await settle();
    await page.evaluate(offset => { __editorSvc.clEditor.focus(); __editorSvc.clEditor.setSelection(offset, offset); }, offset);
    await settle();
    const before = await snapshot();
    const check = async (inserted, composing) => {
      await settle();
      const state = await snapshot();
      assert.deepEqual(state.lineRects, before.lineRects, 'composition must preserve adjacent empty-line positions');
      assert.deepEqual(state.rows, before.rows, 'composition must preserve adjacent line-number positions');
      const expected = text.slice(0, offset) + inserted + text.slice(offset);
      assert.equal(state.text, expected, 'source text');
      assert.equal(state.dom, expected, 'editable DOM text');
      assert.equal(Boolean(state.composing), composing);
      return state;
    };
    for (const candidate of ['z', 'zhong', '中文']) {
      await client.send('Input.imeSetComposition', { text: candidate, selectionStart: candidate.length, selectionEnd: candidate.length });
      await check(candidate, true);
    }
    if (cancel) await client.send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
    else await client.send('Input.insertText', { text: '中' });
    await page.waitForFunction(() => !__editorSvc.clEditor.highlighter.isComposing);
    const after = await check(cancel ? '' : '中', false);
    if (!cancel) {
      assert.deepEqual(after.selection, [offset + 1, offset + 1], 'commit keeps caret after committed text');
      await page.waitForFunction(() => __editorSvc.clEditor.undoMgr.canUndo());
      await page.evaluate(() => __editorSvc.clEditor.undoMgr.undo());
      await check('', false);
      await page.evaluate(() => __editorSvc.clEditor.undoMgr.redo());
      await check('中', false);
    }
    console.log('PASS native composition geometry/text', JSON.stringify({ soft, hard: 3, monospaced, fenced, cancel, font: before.font, fontSize: before.fontSize }));
  }
  }
  }
  }
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
