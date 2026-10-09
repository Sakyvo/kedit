// S1 红：headingsScan —— 独立行扫描提取 ATX 标题（TOC 数据源）
// 真值来源：样本独立统计（2038 个围栏外 ATX 标题、围栏内 0 个）+ 语法规则手工用例
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { extractHeadings, mapHeadingsToSections } from '../../../src/services/editor/headingsScan.js';

const FIXTURE = 'K:/Syncthing/Syncthings/A_sync/GlitchesSwap.md';
const text = fs.readFileSync(FIXTURE, 'utf8').replace(/\r\n?/g, '\n');
const ensureNl = t => (t.slice(-1) === '\n' ? t : `${t}\n`);

let phase = 'init';
try {
  // --- 样本：ATX 数量与 fence 隔离（独立事实：2038 / 0） ---
  phase = '样本';
  const t0 = performance.now();
  const hs = extractHeadings(text);
  const elapsed = performance.now() - t0;
  assert.equal(hs.length, 2038, `样本 ATX 标题应为 2038（实得 ${hs.length}）`);
  assert.ok(hs.every(h => h.level >= 1 && h.level <= 6), 'level 在 1..6');
  assert.ok(hs.every(h => h.start < h.end), 'start < end');
  // 每个标题必须落在其报告行的行首（缩进后）
  for (const h of hs) {
    const lineText = text.slice(h.start, h.end);
    assert.ok(/^ {0,3}#{1,6}(?:\s|$)/.test(lineText), `行内容必须是 ATX：${JSON.stringify(lineText.slice(0, 40))}`);
  }
  assert.ok(elapsed < 60, `样本扫描应 <60ms（实得 ${elapsed.toFixed(1)}ms）`);

  // --- 围栏内 # 不算标题 ---
  phase = 'fence';
  const fenced = ensureNl([
    '# real',
    '```',
    '# not a heading',
    '~~~',
    '## also not (tilde fence open, still inside ``` )',
    '```',
    '# real2',
  ].join('\n'));
  const fh = extractHeadings(fenced);
  assert.deepEqual(fh.map(h => h.text), ['real', 'real2'], 'unclosed-tilde 在 ``` 内仍属围栏');

  phase = 'fence 闭合语义';
  const f2 = ensureNl('```js\n# no\n```\n# yes\n');
  assert.deepEqual(extractHeadings(f2).map(h => h.text), ['yes']);

  // --- frontmatter 不被误当标题 ---
  phase = 'frontmatter';
  const fm = ensureNl('---\ntitle: x\n# not a heading\n---\n# yes\n');
  assert.deepEqual(extractHeadings(fm).map(h => h.text), ['yes']);
  // 无闭合 → 不视作 frontmatter（markdown-it 回退为 hr）
  const fmOpen = ensureNl('---\n# yes\n');
  assert.deepEqual(extractHeadings(fmOpen).map(h => h.text), ['yes']);

  // --- 缩进 4 空格 = 代码块，不算标题 ---
  phase = '缩进代码';
  assert.deepEqual(extractHeadings(ensureNl('    # code\n# real\n')).map(h => h.text), ['real']);

  // --- 收尾井号与内容 ---
  phase = '收尾井号';
  const closing = extractHeadings(ensureNl('## 标题 ##\n# NoSpace#\n####### too many\n'));
  assert.deepEqual(closing.map(h => h.text), ['标题', 'NoSpace#'], '# 收尾序列被剥离;7 个 # 不是标题');
  assert.deepEqual(closing.map(h => h.level), [2, 1]);

  // --- 无标题 → 空 ---
  phase = '空文档';
  assert.deepEqual(extractHeadings(''), []);
  assert.deepEqual(extractHeadings(ensureNl('普通段落\n\n- 列表\n')), []);

  // --- 分节映射：标题 → 所在 section 索引（累计偏移，二分） ---
  phase = '分节映射';
  const doc = ensureNl('# A\n\n正文一\n\n## B\n\n正文二\n');
  const docSections = [{ text: '# A\n\n' }, { text: '正文一\n\n' }, { text: '## B\n\n' }, { text: '正文二\n' }];
  const docHeadings = extractHeadings(doc);
  assert.deepEqual(
    mapHeadingsToSections(docHeadings, docSections).map(it => it.sectionIndex),
    [0, 2],
    'A 在第 0 节、B 在第 2 节',
  );

  // --- 样本分节映射：全部命中且单调不减 ---
  phase = '样本分节映射';
  const sampleSections = text.split(/(?<=\n\n)/).map(t => ({ text: t })); // 近似照搬偏移
  const mapped = mapHeadingsToSections(hs, sampleSections);
  assert.equal(mapped.length, hs.length);
  for (let i = 1; i < mapped.length; i += 1) {
    assert.ok(mapped[i].sectionIndex >= mapped[i - 1].sectionIndex, 'sectionIndex 单调不减');
  }

  console.log(`PASS S1 headingsScan: ${hs.length} headings, ${elapsed.toFixed(1)}ms, map ok`);
  process.exit(0);
} catch (err) {
  console.error(`FAIL S1 [${phase}]: ${err.message}`);
  process.exit(1);
}