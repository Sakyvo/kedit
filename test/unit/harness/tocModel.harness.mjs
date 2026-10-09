// S2 红：tocModel —— 扫描结果 → TOC 条目模型 + 增量补丁计划（纯函数）
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { extractHeadings, mapHeadingsToSections } from '../../../src/services/editor/headingsScan.js';
import { computeTocEntries, tocEntryKey, planTocPatch } from '../../../src/services/editor/tocModel.js';

const FIXTURE = 'K:/Syncthing/Syncthings/A_sync/GlitchesSwap.md';
const text = fs.readFileSync(FIXTURE, 'utf8').replace(/\r\n?/g, '\n');

let phase = 'init';
try {
  // --- 条目与 section 索引一一对齐（含无标题段占位） ---
  phase = '条目对齐';
  const doc = '# A\n\n正文一\n\n正文二\n\n## B\n';
  const rawSections = [
    { text: '# A\n\n' },
    { text: '正文一\n\n' },
    { text: '正文二\n\n' },
    { text: '## B\n' },
  ];
  // 补上真实偏移（单源真相：拼接物化）
  let off = 0;
  const sections = rawSections.map((s) => {
    const start = off;
    off += s.text.length;
    return { ...s, start, end: off };
  });
  assert.equal(sections.map(s => s.text).join(''), doc, 'fixture 自洽');
  const headings = mapHeadingsToSections(extractHeadings(doc), sections);
  assert.deepEqual(headings.map(h => h.sectionIndex), [0, 3], 'A→0、B→3');
  const entries = computeTocEntries(sections, headings);
  assert.equal(entries.length, sections.length, '条目数 = section 数');
  assert.deepEqual(entries.map(e => e.level), [1, 0, 0, 2], '无标题段 level 0');
  assert.deepEqual(entries.map(e => e.text), ['A', '', '', 'B']);

  // --- key 稳定性：内容不变则 key 不变（位置由 splice 表达） ---
  phase = 'key 稳定';
  assert.equal(tocEntryKey({ level: 1, text: 'A' }), tocEntryKey({ level: 1, text: 'A' }));
  assert.notEqual(tocEntryKey({ level: 1, text: 'A' }), tocEntryKey({ level: 2, text: 'A' }));
  assert.notEqual(tocEntryKey({ level: 1, text: 'A' }), tocEntryKey({ level: 1, text: 'B' }));

  // --- 补丁计划：无变化 → 无操作 ---
  phase = '计划-无变化';
  const keys = entries.map(e => tocEntryKey(e));
  assert.deepEqual(planTocPatch(keys, keys.slice()), []);

  // --- 补丁计划：中间插入 → 单次 splice，尾部键不变（无索引依赖） ---
  phase = '计划-插入';
  assert.deepEqual(planTocPatch(['k0', 'k1', 'k2', 'k3'], ['k0', 'k1', 'n2', 'k2', 'k3']), [
    { type: 'splice', index: 2, removeCount: 0, keys: ['n2'] },
  ]);

  // --- 补丁计划：删除 → 单次 splice ---
  phase = '计划-删除';
  assert.deepEqual(planTocPatch(['k0', 'k1', 'k2'], ['k0', 'k2']), [
    { type: 'splice', index: 1, removeCount: 1, keys: [] },
  ]);

  // --- 补丁计划：修改 → 单次 splice（删除+新建合并） ---
  phase = '计划-修改';
  assert.deepEqual(planTocPatch(['k0', 'k1'], ['k0', 'k1x']), [
    { type: 'splice', index: 1, removeCount: 1, keys: ['k1x'] },
  ]);

  // --- 补丁计划：顶部插入一段（A→A2 改一级）→ 局部 splice ---
  phase = '计划-顶部插入';
  const topOps = planTocPatch(['b', 'c', 'd'], ['a', 'b', 'c', 'd']);
  assert.deepEqual(topOps, [{ type: 'splice', index: 0, removeCount: 0, keys: ['a'] }]);

  // --- 样本规模：条目数 = 段数 9546，标题数 2038 ---
  phase = '样本规模';
  const { computeSections } = await import('../../../src/services/editor/segmenter.js');
  const sampleSections = computeSections(text);
  const sampleHeadings = mapHeadingsToSections(extractHeadings(text), sampleSections);
  const t0 = performance.now();
  const sampleEntries = computeTocEntries(sampleSections, sampleHeadings);
  const elapsed = performance.now() - t0;
  assert.equal(sampleEntries.length, sampleSections.length);
  assert.equal(sampleEntries.filter(e => e.level > 0).length, 2038);
  assert.ok(elapsed < 40, `样本条目计算应 <40ms（实得 ${elapsed.toFixed(1)}ms）`);

  console.log(`PASS S2 tocModel: entries=${sampleEntries.length}, headings=2038, ${elapsed.toFixed(1)}ms`);
  process.exit(0);
} catch (err) {
  console.error(`FAIL S2 [${phase}]: ${err.message}`);
  process.exit(1);
}