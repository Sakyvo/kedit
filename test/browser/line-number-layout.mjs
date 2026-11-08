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
.editor__inner { padding:10px 25px 300px; padding-left:calc(25px + var(--editor-line-number-space, 0px)); }
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
window.dispose = mount(editor);
window.remount = () => { dispose(); window.dispose = mount(editor); };
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
  let baseWidth;
  for (const count of [1, 9, 10, 99, 100, 999, 1000, 10000, 999, 1]) {
    await page.evaluate(count => { editor.$scrollElt.scrollTop = 0; setText('line\n'.repeat(count)); }, count);
    await settle();
    const state = await read();
    if (!baseWidth) baseWidth = state.width;
    if (count < 1000) assert.equal(state.width, baseWidth);
    else assert.ok(state.width > baseWidth);
    assert.equal(state.text, 'line\n'.repeat(count));
    assert.ok(state.rows.every(row => Math.abs(row.right - state.rows[0].right) < 0.01));
  }
  console.log('PASS 1/9/10/99/100/999/1000/10000 width transitions, shrink and right alignment');
  await page.evaluate(() => setText('a long source line '.repeat(200) + '\n\nlast\n'));
  await settle();
  assert.deepEqual((await read()).rows.map(row => row.number), [1]);
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
  await page.evaluate(() => { setText('old\ntext\n'); remount(); setText('new\n'); });
  await settle();
  assert.deepEqual((await read()).rows.map(row => row.number), [1]);
  assert.equal(await page.$$eval('.editor__line-numbers', nodes => nodes.length), 1);
  await page.evaluate(() => { setText('queued\nwork\n'); dispose(); });
  await settle();
  assert.equal(await page.$$eval('.editor__line-numbers', nodes => nodes.length), 0);
  console.log('PASS wrapping, scrolling, text isolation and pending-update cleanup');
  await page.evaluate(() => {
    remount();
    window.otherCleanupRan = false;
    editor.on('destroy', () => { window.otherCleanupRan = true; });
    editor.destroy();
  });
  await settle();
  assert.equal(await page.evaluate(() => otherCleanupRan), true);
  assert.equal(await page.$$eval('.editor__line-numbers', nodes => nodes.length), 0);
  console.log('PASS destroy releases the gutter without skipping other editor cleanup');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
