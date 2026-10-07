// mutationDeltas（ADR-0012）：MutationRecord 的归一化描述 → 文本 delta 序列。
// 输入由 DOM 薄壳（cleditCore，用 selectionMgr/工具函数定位偏移）产出；
// 本模块只做纯逻辑：归并、冲突检测、公共前后缀收紧。
// 返回 null = 无法安全归并（调用方走 setFullText 安全网）。
import { windowedDiff } from './windowedDiff.js';

const toDelta = (desc) => {
  if (desc.type === 'text') {
    if (desc.oldValue === desc.value) {
      return null; // 无变化
    }
    // 公共前后缀收紧到最小变更
    let pre = 0;
    const a = desc.oldValue;
    const b = desc.value;
    const minLen = Math.min(a.length, b.length);
    while (pre < minLen && a.charCodeAt(pre) === b.charCodeAt(pre)) pre += 1;
    let suf = 0;
    while (suf < minLen - pre
      && a.charCodeAt(a.length - 1 - suf) === b.charCodeAt(b.length - 1 - suf)) suf += 1;
    return {
      start: desc.offset + pre,
      removedText: a.slice(pre, a.length - suf),
      insertedText: b.slice(pre, b.length - suf),
    };
  }
  if (desc.type === 'list') {
    if (!desc.removedText && !desc.addedText) {
      return null; // 无文本影响（如纯元素移动）
    }
    return {
      start: desc.offset,
      removedText: desc.removedText,
      insertedText: desc.addedText,
    };
  }
  return undefined; // 未知类型
};

/**
 * @param {Array} descs 归一化 mutation 描述（任意顺序）
 * @returns {Array<{start,removedText,insertedText}>|null} 升序 delta；null=无法归并
 */
export function mergeMutationDeltas(descs) {
  if (!Array.isArray(descs) || !descs.length) {
    return [];
  }
  const deltas = [];
  for (const desc of descs) {
    const d = toDelta(desc);
    if (d === undefined) {
      return null; // 未知形态 → 安全网
    }
    if (d) {
      deltas.push(d);
    }
  }
  deltas.sort((x, y) => x.start - y.start);
  // 重叠/交叉检测（区间 [start, start+removedLen)）
  for (let i = 1; i < deltas.length; i += 1) {
    const prev = deltas[i - 1];
    const cur = deltas[i];
    if (cur.start < prev.start + prev.removedText.length) {
      return null;
    }
  }
  return deltas;
}

// 供 DOM 薄壳复用：windowedDiff 的再导出（薄壳安全网可用）
export { windowedDiff };
