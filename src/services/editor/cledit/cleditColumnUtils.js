// 矩形选择纯文本变换（ADR 0014 瞬态列模式）。零依赖：仅做区间归一化与
// 内容变换,供 DOM 交互层（cleditColumnSelection.js）与后台测试共用。
// segments 为内容偏移区间 [{start,end}]，自上而下语义由 start 排序保证。

const clampSegment = (seg, contentLength) => {
  let { start, end } = seg;
  if (start > end) {
    [start, end] = [end, start];
  }
  start = Math.max(0, Math.min(start, contentLength));
  end = Math.max(0, Math.min(end, contentLength));
  return start < end ? { start, end } : null;
};

// 排序（start 升序）→ 丢空/反向纠正 → 越界钳制 → 重叠合并；相邻不合并
export const normalizeSegments = (segments, contentLength = Infinity) => {
  const clamped = [];
  (segments || []).forEach((seg) => {
    const c = clampSegment(seg, contentLength);
    if (c) {
      clamped.push(c);
    }
  });
  clamped.sort((a, b) => a.start - b.start);
  const merged = [];
  clamped.forEach((seg) => {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  });
  return merged;
};

// 列复制：各行段按行拼接（短行截断后的行段照抄，行间以 \n 连接）
export const columnText = (content, segments) => normalizeSegments(segments, content.length)
  .map(seg => content.slice(seg.start, seg.end))
  .join('\n');

// 列删除：自底向上逐段移除，保持上方偏移不变；单次内容替换 = 单个可撤销编辑
export const applyColumnDeletion = (content, segments) => {
  const sorted = normalizeSegments(segments, content.length);
  let text = content;
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const { start, end } = sorted[i];
    text = text.slice(0, start) + text.slice(end);
  }
  return text;
};

// 删除后的落点光标：最上段起点（删除后仍有效，因上方偏移不变）
export const deletionCaretOffset = (content, segments) => {
  const sorted = normalizeSegments(segments, content.length);
  return sorted.length ? sorted[0].start : 0;
};
