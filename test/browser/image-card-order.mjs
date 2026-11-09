// 图片卡顺序翻转（ADR 0016）+ 模态紧凑化 的运行时验证。
// Run against npm run build output, in a fresh headless profile.
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { preview } from 'vite';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');

// 60x30 纯灰 PNG（自带 zlib 生成，不依赖外部图源）
function makePng(width, height) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crcTable = [];
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  const raw = Buffer.alloc((width + 1) * height, 0x80);
  for (let y = 0; y < height; y += 1) raw[y * (width + 1)] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pngUri = `data:image/png;base64,${makePng(60, 30).toString('base64')}`;
const markdown = `- ![alt](${pngUri})\n\ntail line\n`;

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
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/conf') {
      request.respond({ contentType: 'application/json', body: '{}' });
    } else {
      request.continue();
    }
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

  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const setText = async (text) => {
    await page.evaluate((text) => {
      const id = `img-order-fixture-${Date.now()}`;
      testStore.commit('content/setItem', { id: `${id}/content`, text, properties: '\n', discussions: {}, comments: {} });
      testStore.commit('file/setItem', { id, name: 'Image order fixture', parentId: null });
      testStore.commit('file/setCurrentId', id);
    }, text);
    await page.waitForFunction(t => __editorSvc.clEditor.getContent() === t, { timeout: 5000 }, text);
  };

  const cardState = () => page.evaluate(() => {
    const wrapper = document.querySelector('.editor__inner .img-wrapper');
    if (!wrapper) return null;
    const img = wrapper.querySelector('img');
    const src = wrapper.querySelector('.token.img');
    return {
      childOrder: Array.prototype.map.call(wrapper.children, c => c.tagName + (c.classList.contains('img') ? '.img' : '')),
      flexDirection: getComputedStyle(wrapper).flexDirection,
      display: getComputedStyle(wrapper).display,
      imgTop: img.getBoundingClientRect().top,
      srcTop: src.getBoundingClientRect().top,
      imgWidth: Math.round(img.getBoundingClientRect().width),
      wrapperMaxWidth: wrapper.style.maxWidth,
      wrapperLeft: Math.round(wrapper.getBoundingClientRect().left),
      sectionLeft: Math.round(wrapper.closest('.cledit-section').getBoundingClientRect().left),
    };
  });

  await setText(markdown);
  await settle();
  await settle();
  const above = await cardState();
  assert.ok(above, 'image card should exist');
  assert.deepEqual(above.childOrder, ['IMG', 'SPAN.img'], 'DOM order stays image-first');
  assert.equal(above.display, 'inline-flex');
  assert.equal(above.flexDirection, 'column');
  assert.ok(above.imgTop < above.srcTop, 'default: image above its source text');
  assert.ok(parseFloat(above.wrapperMaxWidth) > 0, 'marker-pinned cap still written');
  assert.ok(above.imgWidth > 0, 'image rendered with a width');

  // 切到「文本在上」——不刷新、不重开文档
  await page.evaluate(() => testStore.dispatch('data/setSettings', 'editor:\n  inlineImageOrder: text-above\n'));
  await settle();
  await settle();
  await settle();
  const below = await cardState();
  assert.deepEqual(below.childOrder, ['IMG', 'SPAN.img'], 'flip must not touch DOM order');
  assert.equal(below.flexDirection, 'column-reverse');
  assert.ok(below.srcTop < below.imgTop, 'text-above: source text above the image');
  assert.ok(parseFloat(below.wrapperMaxWidth) > 0, 'marker-pinned cap still written after flip');
  assert.equal(below.imgWidth, above.imgWidth, 'image keeps its size across the flip');
  assert.ok(below.wrapperLeft > below.sectionLeft, 'card still starts after the "- " marker');

  // 切回默认
  await page.evaluate(() => testStore.dispatch('data/setSettings', ''));
  await settle();
  await settle();
  const back = await cardState();
  assert.equal(back.flexDirection, 'column');
  assert.ok(back.imgTop < back.srcTop);

  // 模态紧凑化：公共层 + 配置窗专属层
  // 注意：modal/open 的 promise 在模态关闭时才 resolve，不能 await。
  await page.evaluate(() => { testStore.dispatch('modal/open', 'settings'); });
  await page.waitForFunction(() => document.querySelector('.modal__inner-1--settings .modal__inner-2'));
  await settle();
  const modal = await page.evaluate(() => {
    const inner = document.querySelector('.modal__inner-1--settings .modal__inner-2');
    const cs = getComputedStyle(inner);
    const tabs = inner.querySelector('.tabs');
    const bar = inner.querySelector('.modal__button-bar');
    const barCs = bar && getComputedStyle(bar);
    const rows = Array.prototype.slice.call(inner.querySelectorAll('.form-entry'))
      .filter(e => !e.classList.contains('form-entry--inline'));
    const wide = inner.querySelector('.form-entry--wide');
    const grid = rows.find(e => !e.classList.contains('form-entry--wide'));
    return {
      paddingTop: cs.paddingTop,
      paddingLeft: cs.paddingLeft,
      paddingBottom: cs.paddingBottom,
      marginTop: cs.marginTop,
      tabsShadow: tabs && getComputedStyle(tabs).boxShadow,
      tabsMargin: tabs && getComputedStyle(tabs).margin,
      barMargin: barCs && barCs.margin,
      barBottom: barCs && barCs.bottom,
      scrollHeight: inner.scrollHeight,
      gridDisplay: grid && getComputedStyle(grid).display,
      gridColumns: grid && getComputedStyle(grid).gridTemplateColumns,
      fieldWidth: grid && Math.round(grid.querySelector('.form-entry__field').getBoundingClientRect().width),
      wideDisplay: wide && getComputedStyle(wide).display,
      wideFieldWidth: wide && Math.round(wide.querySelector('.form-entry__field').getBoundingClientRect().width),
      innerWidth: Math.round(inner.getBoundingClientRect().width),
      labelTops: rows.slice(0, 6).map(e => Math.round(e.querySelector('.form-entry__label').getBoundingClientRect().top)),
      fieldTops: rows.slice(0, 6).map(e => Math.round(e.querySelector('.form-entry__field').getBoundingClientRect().top)),
    };
  });
  assert.equal(modal.paddingTop, '20px');
  assert.equal(modal.paddingLeft, '20px');
  assert.equal(modal.paddingBottom, '14px');
  assert.equal(modal.marginTop, '16px');
  assert.match(modal.tabsShadow, /-20px/, 'sticky cover must equal the top padding');
  assert.equal(modal.barBottom, '-14px');
  assert.equal(modal.gridDisplay, 'grid', 'settings fields go single-row');
  assert.equal(modal.fieldWidth, 170);
  assert.notEqual(modal.wideDisplay, 'grid', 'textarea fields stay full-width blocks');
  assert.ok(modal.wideFieldWidth > 300, 'textarea field keeps the panel width');
  // 单行：标签与控件同一行（纵向中心对齐）
  modal.labelTops.forEach((top, i) => {
    assert.ok(Math.abs(top - modal.fieldTops[i]) < 24, `row ${i} label and field share a line`);
  });

  // 选项文案与顺序
  const options = await page.evaluate(() => {
    const labelOf = e => ((e.querySelector('.form-entry__label') || {}).textContent || '').trim();
    const rows = Array.prototype.slice.call(document.querySelectorAll('.modal__inner-1--settings .form-entry'));
    const row = rows.find(e => labelOf(e).startsWith('图片显示'));
    return row ? {
      label: labelOf(row),
      selectText: row.querySelector('.settings-select__current').textContent.trim(),
    } : null;
  });
  assert.ok(options && options.label.includes('默认：图片在上'), 'settings row shows the default');
  assert.equal(options.selectText, '图片在上', 'select renders the current value');

  console.log('OK image card order + modal compaction', JSON.stringify({
    above: { flexDirection: above.flexDirection, imgWidth: above.imgWidth, maxWidth: above.wrapperMaxWidth },
    below: { flexDirection: below.flexDirection, imgWidth: below.imgWidth, maxWidth: below.wrapperMaxWidth },
    modal,
    options,
  }, null, 2));
  assert.deepEqual(errors, []);
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
