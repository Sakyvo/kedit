import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sass from 'sass';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const component = await readFile('src/components/Editor.vue', 'utf8');
const css = sass.compileString(component.match(/<style lang="scss">([\s\S]*)<\/style>/)[1], {
  loadPaths: ['src/components'], logger: sass.Logger.silent,
}).css;
const module = await readFile('src/services/editor/lineNumbers.js', 'utf8');
const html = `<!doctype html><style>
body { margin:0; font:18px/1.67 Arial; }
.editor-container { width:600px; height:300px; }
.editor__inner { padding:10px 25px 300px; padding-left:max(25px, calc(var(--editor-line-number-space, 4em) + 6px)); }
.cledit-section * { display:inline; }
${css}
</style><div class="app"><div class="editor-container"><div class="editor"><pre class="editor__inner"></pre></div></div></div>
<script type="module">
import mount from '/lineNumbers.js';
const content = document.querySelector('.editor__inner');
const scroller = document.querySelector('.editor');
const events = new Map();
window.editor = { $contentElt: content, $scrollElt: scroller, getContent: () => window.text,
 on: (name, fn) => { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
 off: (name, fn) => { const list = events.get(name); const index = list?.indexOf(fn); if (index >= 0) list.splice(index, 1); },
 destroy: () => events.get('destroy')?.forEach(fn => fn()) };
window.setText = text => {
 window.text = text;
 const section = document.createElement('div'); section.className = 'cledit-section';
 for (const [index, line] of text.split('\\n').entries()) {
  if (index) { const lf = document.createElement('span'); lf.className = 'lf'; lf.innerHTML = '<br><span class="hd-lf" style="display:none">\\n</span>'; section.appendChild(lf); }
  section.appendChild(document.createTextNode(line));
 }
 content.replaceChildren(section, document.createElement('div'));
 events.get('contentChanged')?.forEach(fn => fn(text));
};
setText('one\\n\\nthree\\n');
window.view = mount(editor);
window.dispose = () => view.dispose();
window.remount = () => { dispose(); window.view = mount(editor); };
</script>`;
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/lineNumbers.js' ? 'application/javascript' : 'text/html');
  res.end(req.url === '/lineNumbers.js' ? module : html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true, args: ['--disable-background-networking', '--no-first-run', '--disable-default-apps'],
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => document.querySelectorAll('.editor__line-number').length === 3);
  const read = () => page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('.editor__line-number')).map(row => {
      const rect = row.getBoundingClientRect();
      return { number: +row.textContent, top: rect.top, bottom: rect.bottom, right: rect.right };
    }).sort((a, b) => a.number - b.number),
    width: document.querySelector('.editor__line-numbers').getBoundingClientRect().width,
    padding: parseFloat(getComputedStyle(editor.$contentElt).paddingLeft),
    text: editor.$contentElt.textContent,
  }));
  assert.deepEqual((await read()).rows.map(row => row.number), [1, 2, 3]);
  console.log('PASS source lines and empty line rendered');
  await page.evaluate(() => setText('line\n'.repeat(100)));
  await settle();
  const nativeScroll = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('.editor__line-number')).find(row => row.textContent === '4');
    const range = document.createRange();
    const node = editor.$contentElt.firstChild.childNodes[6];
    range.setStart(node, 0); range.setEnd(node, 1);
    const before = row.getBoundingClientRect().top - range.getBoundingClientRect().top;
    // Same JS turn: no scroll event or rAF can repair a viewport-fixed gutter.
    editor.$scrollElt.scrollTop = 73;
    const after = row.getBoundingClientRect().top - range.getBoundingClientRect().top;
    return { before, after };
  });
  assert.equal(nativeScroll.after, nativeScroll.before, 'numbers must move with text before JS scroll callbacks');
  console.log('PASS native scroll displacement without waiting for JavaScript');
  let baseWidth;
  for (const count of [1, 9, 10, 99, 100, 999, 1000, 10000, 999, 1]) {
    await page.evaluate(count => { editor.$scrollElt.scrollTop = 0; setText('line\n'.repeat(count)); }, count);
    await settle();
    const state = await read();
    if (!baseWidth) baseWidth = state.width;
    assert.equal(state.width, baseWidth, 'gutter width must not grow with the source-line count');
    assert.equal(state.text, 'line\n'.repeat(count));
    assert.ok(state.rows.every(row => Math.abs(row.right - state.rows[0].right) < 0.01));
  }
  console.log('PASS fixed gutter width across 1–10000 lines and right alignment');
  await page.evaluate(() => { setText('line\n'.repeat(10000)); editor.$scrollElt.scrollTop = 0; });
  await settle();
  for (const top of [120, 270, 180, 6000, 300000, 0]) {
    const movement = await page.evaluate(top => {
      const row = document.querySelector('.editor__line-number');
      const range = document.createRange();
      range.selectNodeContents(editor.$contentElt.firstChild.firstChild);
      const delta = () => row.getBoundingClientRect().top - range.getBoundingClientRect().top;
      const before = delta();
      editor.$scrollElt.scrollTop = top;
      return Math.abs(delta() - before);
    }, top);
    assert.ok(movement < 0.01);
    await settle();
    const state = await read();
    assert.ok(state.rows.length > 0 && state.rows.length < 100, 'bounded viewport rows, not full-document nodes');
    assert.ok(state.rows.some(row => row.bottom > 0 && row.top < 300), 'new viewport has visible numbers');
  }
  console.log('PASS forward/reverse/jump scrolling with bounded rows and no deferred displacement');
  await page.evaluate(() => setText('wrap words '.repeat(80) + '\nend\n'));
  await settle();
  const geometry = () => page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(editor.$contentElt.firstChild);
    return { padding: getComputedStyle(editor.$contentElt).paddingLeft,
      rects: Array.from(range.getClientRects(), rect => [rect.x, rect.y, rect.width, rect.height]) };
  });
  const original = await geometry();
  await page.evaluate(() => view.setEnabled(false));
  await settle();
  assert.deepEqual(await geometry(), original, 'disable preserves text positions and wrap points');
  assert.equal(await page.$eval('.editor__line-numbers', elt => getComputedStyle(elt).visibility), 'hidden');
  await page.evaluate(() => view.setEnabled(true));
  await settle();
  assert.deepEqual(await geometry(), original, 'enable preserves text positions and wrap points');
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.querySelector('.app').classList.toggle('app--dark', dark), dark);
    const band = await page.$eval('.editor__line-numbers', elt => ({
      height: elt.getBoundingClientRect().height, width: elt.getBoundingClientRect().width,
      background: getComputedStyle(elt).backgroundColor, shadow: getComputedStyle(elt).boxShadow,
    }));
    assert.equal(band.height, await page.$eval('.editor', elt => elt.clientHeight));
    assert.equal(band.shadow, 'none');
    assert.notEqual(band.background, 'rgba(0, 0, 0, 0)');
  }
  for (const count of [9999, 10000]) {
    await page.evaluate(count => { setText('line\n'.repeat(count)); }, count);
    await settle();
    await page.evaluate(() => { editor.$scrollElt.scrollTop = editor.$scrollElt.scrollHeight - editor.$scrollElt.clientHeight - 120; });
    await settle();
    const edge = await page.evaluate(count => {
      const layer = document.querySelector('.editor__line-numbers').getBoundingClientRect();
      const row = Array.from(document.querySelectorAll('.editor__line-number')).find(row => +row.textContent === count);
      const rect = row.getBoundingClientRect();
      return { left: rect.left - layer.left, right: layer.right - rect.right, width: layer.width };
    }, count);
    assert.equal(edge.width, baseWidth);
    assert.ok(count === 9999 ? edge.left >= 0 : edge.left < 0, JSON.stringify(edge));
    assert.equal(edge.right, 2);
  }
  console.log('PASS stable toggle geometry, full-height theme background, four digits fit and fifth overflows left');
  await page.evaluate(() => { setText('a long source line '.repeat(200) + '\n\nlast\n'); editor.$scrollElt.scrollTop = 0; });
  await settle();
  const viewport = await page.$eval('.editor', elt => ({ top: elt.getBoundingClientRect().top, bottom: elt.getBoundingClientRect().bottom }));
  assert.deepEqual((await read()).rows.filter(row => row.bottom > viewport.top && row.top < viewport.bottom).map(row => row.number), [1]);
  await page.evaluate(() => { editor.$scrollElt.scrollTop = 150; });
  await settle();
  const scroll = await read();
  assert.ok(scroll.rows.every(row => row.number <= 3), 'wrapped continuations never get numbers');
  await page.evaluate(() => { editor.$scrollElt.scrollTop = 0; setText('one\n\nthree\n'); });
  await settle();
  const align = await page.evaluate(() => {
    const range = document.createRange();
    range.setStart(editor.$contentElt.firstChild.firstChild, 0); range.setEnd(editor.$contentElt.firstChild.firstChild, 1);
    return { textTop: range.getBoundingClientRect().top, lineTop: document.querySelector('.editor__line-number').getBoundingClientRect().top,
      text: editor.$contentElt.textContent, inside: !!editor.$contentElt.querySelector('.editor__line-number') };
  });
  assert.equal(align.inside, false);
  assert.ok(Math.abs(align.textTop - align.lineTop) < 1, JSON.stringify(align));
  for (const monospaced of [false, true]) {
    for (const [soft, hard] of [[-2, 3], [0, 0], [4, 10], [-4, -1]]) {
      await page.evaluate(({ monospaced, soft, hard }) => {
        editor.$contentElt.classList.toggle('monospaced', monospaced);
        editor.$contentElt.style.setProperty('--kedit-soft-wrap-offset', `${soft}px`);
        editor.$contentElt.style.setProperty('--kedit-hard-break-offset', `${hard}px`);
      }, { monospaced, soft, hard });
      const baselines = [];
      for (const text of ['\n', 'x\n', '中\n', '\n']) {
        await page.evaluate(text => { editor.$scrollElt.scrollTop = 0; setText(text); }, text);
        await settle();
        baselines.push((await read()).rows[0].top);
      }
      assert.ok(Math.max(...baselines) - Math.min(...baselines) < 0.5, JSON.stringify({ monospaced, soft, hard, baselines }));
    }
  }
  console.log('PASS empty/Latin/Chinese/delete baseline stability with both fonts and four line-spacing settings');
  await page.evaluate(() => { setText('old\ntext\n'); remount(); setText('new\n'); });
  await settle();
  assert.deepEqual((await read()).rows.map(row => row.number), [1]);
  assert.equal(await page.$$eval('.editor__line-numbers', nodes => nodes.length), 1);
  await page.evaluate(() => { setText('queued\nwork\n'); dispose(); });
  await settle();
  assert.equal(await page.$$eval('.editor__line-numbers, .editor__line-number-rows', nodes => nodes.length), 0);
  console.log('PASS wrapping, scrolling, text isolation and pending-update cleanup');
  await page.evaluate(() => {
    remount();
    window.otherCleanupRan = false;
    editor.on('destroy', () => { window.otherCleanupRan = true; });
    editor.destroy();
  });
  await settle();
  assert.equal(await page.evaluate(() => otherCleanupRan), true);
  assert.equal(await page.$$eval('.editor__line-numbers, .editor__line-number-rows', nodes => nodes.length), 0);
  console.log('PASS destroy releases the gutter without skipping other editor cleanup');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
