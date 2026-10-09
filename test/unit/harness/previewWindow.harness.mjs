// S3 红：previewWindow —— 可见窗口计算 / 高度估算 / 窗口切换计划（卡 014）
import assert from 'node:assert/strict';
import {
  estimateBlockHeight,
  computeSectionHeights,
  computeSectionOffsets,
  computeVisibleRange,
  planWindowChange,
} from '../../../src/services/editor/previewWindow.js';

let phase = 'init';
try {
  phase = '高度估算';
  const h1 = estimateBlockHeight('short', { avgCharPx: 8, lineHeight: 24, viewportWidth: 800 });
  assert.equal(h1, 24, '一行 → 一个行高');
  const h2 = estimateBlockHeight('x'.repeat(1000), { avgCharPx: 8, lineHeight: 24, viewportWidth: 800 });
  assert.ok(h2 >= 24 * 10, `1000 半角字符 @8px/800px 应 ≥10 行（实得 ${h2}）`);
  const wide = estimateBlockHeight('中'.repeat(100), { avgCharPx: 8, lineHeight: 24, viewportWidth: 800 });
  const narrow = estimateBlockHeight('a'.repeat(100), { avgCharPx: 8, lineHeight: 24, viewportWidth: 800 });
  assert.ok(wide > narrow, '宽字符更宽（同字数占更高）');
  assert.equal(estimateBlockHeight('\n\n\n', { lineHeight: 24 }), 24, '空文本至少一行');

  phase = '高度序列';
  const sections = [{ text: 'a' }, { text: 'b' }, { text: 'c' }];
  const heights = computeSectionHeights(sections, { 1: 100 }, { avgCharPx: 8, lineHeight: 24, viewportWidth: 800 });
  assert.deepEqual(heights, [24, 100, 24], '已测量的用真值，未测量的用估算');
  const starts = computeSectionOffsets(heights);
  assert.deepEqual(starts, [0, 24, 124]);

  phase = '可见窗口';
  const hs = [100, 100, 100, 100, 100];
  const st = computeSectionOffsets(hs);
  assert.deepEqual(computeVisibleRange(hs, st, 0, 150, 0), { from: 0, to: 2 }, '顶部 150px → 前两段');
  assert.deepEqual(computeVisibleRange(hs, st, 220, 100, 0), { from: 2, to: 4 }, '中段');
  assert.deepEqual(computeVisibleRange(hs, st, 400, 100, 0), { from: 4, to: 5 }, '尾部夹紧');
  assert.deepEqual(computeVisibleRange(hs, st, 500, 100, 100), { from: 4, to: 5 }, '越界夹紧');
  const buffered = computeVisibleRange(hs, st, 200, 100, 60);
  assert.deepEqual(buffered, { from: 1, to: 4 }, 'buffer 扩展窗口');
  assert.deepEqual(computeVisibleRange([], [], 0, 100, 0), { from: 0, to: 0 }, '空文档');

  phase = '窗口切换计划';
  assert.deepEqual(planWindowChange({ from: 0, to: 2 }, { from: 0, to: 2 }, 5), { mount: [], unmount: [] }, '同窗口无操作');
  assert.deepEqual(planWindowChange({ from: 0, to: 2 }, { from: 2, to: 4 }, 5), {
    mount: [{ from: 2, to: 4 }],
    unmount: [{ from: 0, to: 2 }],
  }, '不相交 → 全换');
  assert.deepEqual(planWindowChange({ from: 1, to: 3 }, { from: 2, to: 4 }, 5), {
    mount: [{ from: 3, to: 4 }],
    unmount: [{ from: 1, to: 2 }],
  }, '右移一屏');
  assert.deepEqual(planWindowChange({ from: 2, to: 4 }, { from: 1, to: 3 }, 5), {
    mount: [{ from: 1, to: 2 }],
    unmount: [{ from: 3, to: 4 }],
  }, '左移一屏');
  assert.deepEqual(planWindowChange(null, { from: 0, to: 2 }, 5), {
    mount: [{ from: 0, to: 2 }],
    unmount: [],
  }, '首次挂载');
  assert.deepEqual(planWindowChange({ from: 0, to: 2 }, { from: 1, to: 1 }, 5), {
    mount: [],
    unmount: [{ from: 0, to: 2 }],
  }, '窗口收缩到空');

  console.log('PASS S3 previewWindow');
  process.exit(0);
} catch (err) {
  console.error(`FAIL S3 [${phase}]: ${err.message}`);
  process.exit(1);
}