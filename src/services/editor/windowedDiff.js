// 窗口化 diff（ADR-0012）：公共前后缀截断 + 窗口内 diff_main。
// 与全文 diff_main 数学等价：diff(A,B) = [[0,pre]] + diff(A',B') + [[0,suf]]，
// 其中 A'/B' 为截断公共前后缀后的窗口。marker 平移与 undo patch 语义不变。
import DiffMatchPatch from 'diff-match-patch';

const diffMatchPatch = new DiffMatchPatch();

// 分块字符比较：先块级定位再块内线性，避免 810k 逐字符循环的常数开销
const BLOCK = 4096;
const commonPrefixLen = (a, b) => {
  const minLen = Math.min(a.length, b.length);
  let fast = 0;
  while (fast + BLOCK <= minLen && a.substring(fast, fast + BLOCK) === b.substring(fast, fast + BLOCK)) {
    fast += BLOCK;
  }
  let i = fast;
  while (i < minLen && a.charCodeAt(i) === b.charCodeAt(i)) {
    i += 1;
  }
  return i;
};
const commonSuffixLen = (a, b, maxLen) => {
  let fast = 0;
  while (
    fast + BLOCK <= maxLen
    && a.substring(a.length - fast - BLOCK, a.length - fast)
      === b.substring(b.length - fast - BLOCK, b.length - fast)
  ) {
    fast += BLOCK;
  }
  let i = fast;
  while (
    i < maxLen
    && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)
  ) {
    i += 1;
  }
  return i;
};

/**
 * 计算等价于 diff_main(oldText, newText) 的 diff，但只在变化窗口内运行。
 * @returns {Array<[Number, String]>} diff 序列（含 EQUAL 前后缀段）
 */
export function windowedDiff(oldText, newText) {
  if (oldText === newText) {
    return [];
  }
  // 公共前后缀（后缀不与前缀重叠）
  const pre = commonPrefixLen(oldText, newText);
  const suf = commonSuffixLen(oldText, newText, Math.min(oldText.length, newText.length) - pre);
  const oldWin = oldText.slice(pre, oldText.length - suf);
  const newWin = newText.slice(pre, newText.length - suf);
  if (!oldWin.length) {
    const result = [];
    if (pre) result.push([0, oldText.slice(0, pre)]);
    result.push([1, newWin]);
    if (suf) result.push([0, newText.slice(newText.length - suf)]);
    return result;
  }
  if (!newWin.length) {
    const result = [];
    if (pre) result.push([0, oldText.slice(0, pre)]);
    result.push([-1, oldWin]);
    if (suf) result.push([0, newText.slice(newText.length - suf)]);
    return result;
  }
  const winDiff = diffMatchPatch.diff_main(oldWin, newWin, false);
  const result = [];
  if (pre) {
    result.push([0, oldText.slice(0, pre)]);
  }
  for (const d of winDiff) {
    result.push(d);
  }
  if (suf) {
    result.push([0, newText.slice(newText.length - suf)]);
  }
  return result;
}
