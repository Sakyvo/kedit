// Headless verification that the preview/export container wraps long tokens the
// same way the editor does, while code blocks and wide tables keep their own
// horizontal scroll.
//
// Run: node test/browser/preview-wrap.mjs
import { mkdir } from 'node:fs/promises';
import { createServer as createVite } from 'vite';
import { withBrowser, navigate, waitFor, screenshot } from './cdp.mjs';

const KEY = 'sk-9772d4ca9970e5b5d4f110c8f42b7a3040598cccdf7d10030e1926647aad0bee';
const VIEWPORT = { width: 360, height: 720 };
const EVIDENCE = '.target/validation/preview-wrap';

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const expectTrue = (label, value, detail) => {
  if (!value) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const fixtures = {
  inlineCode: `Fixture\n\n密钥 \`${KEY}\` 是这次请求的凭证。\n`,
  bareToken: `Fixture\n\n${KEY}\n`,
  codeBlock: `Fixture\n\n\`\`\`text\n${KEY}\n\`\`\`\n`,
  wideTable: 'Fixture\n\n| 名称 | 值 | 备注 |\n' +
    '| --- | --- | --- |\n' +
    `| key | ${KEY} | 该值只在本地保存 |\n`,
  cjk: 'Fixture\n\n这是一段中文段落，用来确认自动换行位置没有因为断词规则而改变，' +
    '句子长度足够跨越一行以便观察换行点。\n',
};

// Line boxes are counted on the *last* paragraph: the fixtures put their subject
// after a short "Fixture" paragraph.
const measure = `(() => {
  const container = document.getElementById('preview');
  const overflowing = elt => elt.scrollWidth - elt.clientWidth > 1;
  const lineBoxes = (elt) => {
    if (!elt) return null;
    const walker = document.createTreeWalker(elt, NodeFilter.SHOW_TEXT);
    let boxes = 0;
    while (walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      boxes = Math.max(boxes, range.getClientRects().length);
    }
    return boxes;
  };
  const paragraph = container.querySelector('p:last-of-type');
  const code = container.querySelector('p code');
  const codeBlock = container.querySelector('pre > code');
  const wrapper = container.querySelector('.table-wrapper');
  const cell = [...container.querySelectorAll('td')].find(td => td.textContent.includes('sk-')) || null;
  return {
    overflowWrap: getComputedStyle(container).overflowWrap,
    containerOverflow: overflowing(container),
    containerScroll: container.scrollWidth,
    containerClient: container.clientWidth,
    paragraphLineBoxes: lineBoxes(paragraph),
    codeOverflow: code ? overflowing(code) : null,
    codeLineBoxes: code ? lineBoxes(code) : null,
    codeWhiteSpace: code ? getComputedStyle(code).whiteSpace : null,
    codeBlockOverflow: codeBlock ? overflowing(codeBlock) : null,
    codeBlockWhiteSpace: codeBlock ? getComputedStyle(codeBlock).whiteSpace : null,
    codeBlockLineBoxes: codeBlock ? lineBoxes(codeBlock) : null,
    wrapperOverflow: wrapper ? overflowing(wrapper) : null,
    wrapperOverflowX: wrapper ? getComputedStyle(wrapper).overflowX : null,
    cellLineBoxes: cell ? lineBoxes(cell) : null,
  };
})()`;

const server = await createVite({
  root: process.cwd(),
  logLevel: 'error',
  server: { port: 0, host: '127.0.0.1', watch: { ignored: ['**/.npm-cache/**'] } },
});
await server.listen();
const port = server.httpServer.address().port;
await mkdir(EVIDENCE, { recursive: true });

try {
  await withBrowser(async (cdp) => {
    cdp.listeners.set('Runtime.exceptionThrown', [(params) => {
      failures.push(`page exception: ${params.exceptionDetails.exception?.description || params.exceptionDetails.text}`);
    }]);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1, mobile: false,
    });
    await navigate(cdp, `http://127.0.0.1:${port}/test/browser/harness/divider.html`);
    await waitFor(cdp, 'window.harnessReady');

    const render = async (markdown) => cdp.evaluate(`
      window.harness.setTheme({});
      window.harness.render(${JSON.stringify(markdown)});
      return true;
    `);

    // 1. A long token inside inline code wraps inside the preview column.
    await render(fixtures.inlineCode);
    const inline = await cdp.evaluate(`return ${measure};`);
    check('container carries the wrap rule', inline.overflowWrap, 'anywhere');
    expectTrue('long inline code does not overflow its own box', inline.codeOverflow === false,
      JSON.stringify(inline));
    expectTrue('long inline code wraps onto several line boxes', inline.codeLineBoxes > 1,
      `got ${inline.codeLineBoxes}`);
    expectTrue('preview column does not scroll sideways', inline.containerOverflow === false,
      `${inline.containerScroll} > ${inline.containerClient}`);
    await screenshot(cdp, `${EVIDENCE}/inline-code-wrapped.png`);

    // 2. Removing the rule reproduces the reported bug on the very same fixture:
    //    the red/green pair runs in one browser session.
    await cdp.evaluate(`
      window.harness.render(${JSON.stringify(fixtures.inlineCode)});
      document.getElementById('preview').style.overflowWrap = 'normal';
      return true;
    `);
    const withoutRule = await cdp.evaluate(`return ${measure};`);
    expectTrue('without the rule the same fixture overflows (bug reproduced)',
      withoutRule.containerOverflow === true, JSON.stringify(withoutRule));
    await screenshot(cdp, `${EVIDENCE}/inline-code-overflowing.png`);
    await cdp.evaluate("document.getElementById('preview').style.overflowWrap = ''; return true;");

    // 3. A bare long token in a paragraph wraps too — the fix is not code-only.
    await render(fixtures.bareToken);
    const bare = await cdp.evaluate(`return ${measure};`);
    expectTrue('bare long token wraps onto several line boxes', bare.paragraphLineBoxes > 1,
      `got ${bare.paragraphLineBoxes}`);
    expectTrue('bare long token does not overflow', bare.containerOverflow === false,
      `${bare.containerScroll} > ${bare.containerClient}`);

    // 4. A fenced code block keeps white-space: pre and its own horizontal scroll.
    await render(fixtures.codeBlock);
    const block = await cdp.evaluate(`return ${measure};`);
    check('fenced code keeps white-space: pre', block.codeBlockWhiteSpace, 'pre');
    expectTrue('fenced code scrolls horizontally instead of wrapping',
      block.codeBlockOverflow === true, JSON.stringify(block));
    // One text line plus the empty rect the trailing newline produces.
    expectTrue('fenced code line is not wrapped', block.codeBlockLineBoxes <= 2,
      `got ${block.codeBlockLineBoxes}`);
    await screenshot(cdp, `${EVIDENCE}/code-block-unwrapped.png`);

    // 5. Tables: the wrap rule reaches table cells (they wrap instead of pushing
    //    the column sideways), and the .table-wrapper keeps its horizontal
    //    scroll for content that cannot wrap at all.
    await render(fixtures.wideTable);
    const table = await cdp.evaluate(`return ${measure};`);
    expectTrue('table cells wrap their own long values', table.cellLineBoxes > 1,
      JSON.stringify(table));
    expectTrue('table does not overflow the preview column', table.containerOverflow === false,
      `${table.containerScroll} > ${table.containerClient}`);
    check('table wrapper keeps its horizontal scroll', table.wrapperOverflowX, 'auto');

    // 6. CJK prose still wraps: the rule adds no break chance inside a CJK run.
    await render(fixtures.cjk);
    const cjk = await cdp.evaluate(`return ${measure};`);
    expectTrue('CJK paragraph wraps', cjk.paragraphLineBoxes > 1, `got ${cjk.paragraphLineBoxes}`);
    expectTrue('CJK paragraph does not overflow', cjk.containerOverflow === false,
      `${cjk.containerScroll} > ${cjk.containerClient}`);
    await screenshot(cdp, `${EVIDENCE}/cjk-wrapped.png`);

    // 7. The rule lives on the export container as well: the styled/plain
    //    templates wrap the body in this exact class.
    const exportRule = await cdp.evaluate(`
      const probe = document.createElement('div');
      probe.className = 'stackedit__html';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).overflowWrap;
      probe.remove();
      return value;
    `);
    check('export container carries the wrap rule', exportRule, 'anywhere');
  });
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  process.exit(1);
}
console.log(`PASS preview wrap: inline code, bare token, code block, wide table, CJK at ${VIEWPORT.width}px (evidence: ${EVIDENCE})`);
