/**
 * Node harness: highlight fill batching (task 013 / A3).
 *
 * `planFillBatch` decides how many deferred sections to re-highlight in one
 * idle callback. The old rule was a flat character budget (60k chars), which
 * measured ~344-375ms of blocked main thread per batch on an 810k document —
 * well past the 50ms "long task" threshold, so typing during the backfill
 * stuttered (A3: "补齐不冻结输入").
 *
 * The new rule plans by *estimated cost* with a wall-clock budget, so a batch
 * stays short regardless of how the document is composed (a single fenced
 * section can be tens of thousands of chars).
 *
 * Design notes pinned here:
 * - estimates are deliberately conservative (over-estimate) so the real batch
 *   lands under budget even when the model is wrong by a factor;
 * - a batch always takes at least one section (otherwise it can never drain);
 * - a batch never takes more than `maxSections` (bounds the idle callback's
 *   bookkeeping cost when sections are tiny).
 */
import assert from 'node:assert/strict';
import {
  estimateHighlightCost,
  planFillBatch,
} from '../../../src/services/editor/highlightFillPlan.js';

const FENCE = String.fromCharCode(96, 96, 96);
const prose = (n) => ({ text: 'word '.repeat(Math.ceil(n / 5)).slice(0, n), data: 'main' });
// 真实分段器把围栏标记一并留在段文本里
const fenced = (n) => ({
  text: `${FENCE}js\n${'const x = fn(y);\n'.repeat(Math.ceil(n / 18))}`.slice(0, n),
  data: 'main',
  fenceAfter: false,
});

// --- 估算：代码段比同长度文本段贵 ---
{
  const p = estimateHighlightCost(prose(200));
  const f = estimateHighlightCost(fenced(200));
  assert.ok(p > 0 && f > 0, 'estimates are positive');
  assert.ok(f > p, `fenced (${f}) should cost more than prose (${p})`);
  assert.ok(f >= p * 2, 'fenced penalty should be material, not cosmetic');
}

// --- 估算：更长 = 更贵（单调不减） ---
{
  let prev = 0;
  for (const n of [0, 50, 200, 1000, 5000]) {
    const c = estimateHighlightCost(prose(n));
    assert.ok(c >= prev, `estimate must not decrease with length (n=${n})`);
    prev = c;
  }
}

// --- 估算：空段/畸形输入不炸，且给出正值（有底价开销） ---
{
  assert.ok(estimateHighlightCost({ text: '' }) > 0, 'empty section still costs something');
  assert.ok(estimateHighlightCost({}) > 0, 'missing text still costs something');
  assert.ok(estimateHighlightCost(null) > 0, 'null section still costs something');
}

// --- 计划：按成本预算取段，不超预算（在估算范围内） ---
{
  const sections = Array.from({ length: 500 }, () => prose(300));
  const plan = planFillBatch(sections, { budgetMs: 12, maxSections: 200 });
  assert.ok(plan.count > 0, 'takes at least one section');
  assert.ok(plan.count <= 200, `respects maxSections (got ${plan.count})`);
  assert.ok(
    plan.estimatedMs <= 12 * 1.35,
    `estimated cost should stay near budget (got ${plan.estimatedMs}ms)`,
  );
  // 该预算下不应一次吞掉全部 500 段
  assert.ok(plan.count < 500, `should not take everything (got ${plan.count})`);
}

// --- 计划：单个巨大段也必须能推进（至少取一个） ---
{
  const huge = [fenced(200000)];
  const plan = planFillBatch(huge, { budgetMs: 12, maxSections: 200 });
  assert.equal(plan.count, 1, 'a single oversized section is still taken');
}

// --- 计划：空输入 / 无候选 → 0 ---
{
  assert.equal(planFillBatch([], { budgetMs: 12 }).count, 0);
  assert.equal(planFillBatch(null, { budgetMs: 12 }).count, 0);
}

// --- 计划：小段很多时受 maxSections 约束（限制单次簿记成本） ---
{
  const tiny = Array.from({ length: 1000 }, () => prose(4));
  const plan = planFillBatch(tiny, { budgetMs: 12, maxSections: 150 });
  assert.equal(plan.count, 150, 'tiny sections are capped by maxSections');
}

// --- 计划：预算越大取越多（单调） ---
{
  const sections = Array.from({ length: 400 }, () => prose(400));
  const small = planFillBatch(sections, { budgetMs: 5, maxSections: 400 }).count;
  const big = planFillBatch(sections, { budgetMs: 25, maxSections: 400 }).count;
  assert.ok(big > small, `larger budget must take more (${small} -> ${big})`);
}

// --- 计划：同一输入必须确定（自适应校正依赖可重复性） ---
{
  const sections = Array.from({ length: 300 }, (_, i) => (i % 7 === 0 ? fenced(500) : prose(200)));
  const a = planFillBatch(sections, { budgetMs: 12, maxSections: 400 });
  const b = planFillBatch(sections, { budgetMs: 12, maxSections: 400 });
  assert.deepEqual(a, b, 'planning is deterministic');
  assert.ok(a.count > 0 && a.count < 300, 'mixed content yields a partial batch');
}

console.log('highlightFill.harness: all assertions passed');