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

// VSCode 式逐行插入：各行列段替换为同样的文本（一次性字符串变换，
// 与列删除同层；非多光标编辑器状态）
export const applyColumnInsertion = (content, segments, text) => {
  const sorted = normalizeSegments(segments, content.length);
  let result = '';
  let pos = 0;
  sorted.forEach((seg) => {
    result += content.slice(pos, seg.start);
    result += text;
    pos = seg.end;
  });
  result += content.slice(pos);
  return result;
};

// 插入后的落点光标：最上段起点 + 插入文本长度
export const insertionCaretOffset = (content, segments, text) => {
  const sorted = normalizeSegments(segments, content.length);
  return sorted.length ? sorted[0].start + text.length : 0;
};

// 多行粘贴（行数=列段数）：第 i 行列段替换为第 i 行文本
export const applyColumnPerRowInsertion = (content, segments, texts) => {
  const sorted = normalizeSegments(segments, content.length);
  let result = '';
  let pos = 0;
  sorted.forEach((seg, i) => {
    result += content.slice(pos, seg.start);
    result += texts[i] != null ? texts[i] : '';
    pos = seg.end;
  });
  result += content.slice(pos);
  return result;
};

// ---- 零宽列光标（粘性多行插入，Scintilla ThinRectangularRange 语义）----
// 各 caret 处插入同一文本；倒序施加避免偏移串扰
export const applyPerCaretInsertion = (content, carets, text) => {
  const sorted = [...new Set((carets || []).map(c => Math.max(0, Math.min(c, content.length))))]
    .sort((a, b) => b - a);
  let result = content;
  sorted.forEach((caret) => {
    result = result.slice(0, caret) + text + result.slice(caret);
  });
  return result;
};

// 各 caret 左侧/右侧删一字符；不跨越换行（行首 backward / 行尾 forward 不动）
export const applyPerCaretDeletion = (content, carets, direction = 'backward') => {
  const sorted = [...new Set((carets || []).map(c => Math.max(0, Math.min(c, content.length))))]
    .sort((a, b) => b - a);
  let result = content;
  sorted.forEach((caret) => {
    const from = direction === 'forward' ? caret : caret - 1;
    if (from < 0 || from >= result.length || result[from] === '\n') {
      return;
    }
    result = result.slice(0, from) + result.slice(from + 1);
  });
  return result;
};

// 短行补空格数：把行尾推到目标像素列（RealizeVirtualSpace 语义）
export const padToColumn = (currentX, targetX, spaceWidth) => {
  if (!spaceWidth || spaceWidth <= 0) {
    return 0;
  }
  return Math.max(0, Math.round((targetX - currentX) / spaceWidth));
};

// 矩形像素边界 + 各行行尾像素 → 行段（含虚拟空间补齐信息）。
// rows: [{ lineStart, lineEnd, lineEndX }]，lineStart/End 由 DOM 层按左边界换算。
// virtual=true 表示该行没有真实字符落在矩形内（整段为虚拟空间）。
export const perRowSegmentsFromRect = (rows, leftX, rightX) => {
  const left = Math.min(leftX, rightX);
  const right = Math.max(leftX, rightX);
  return (rows || []).map((row) => {
    const { lineStart, lineEnd, lineEndX } = row;
    const allVirtual = lineEndX <= left;
    const gapFromX = Math.max(lineEndX, left);
    const hasGap = gapFromX < right;
    return {
      start: lineStart,
      end: allVirtual ? lineStart : lineEnd,
      virtual: allVirtual,
      gapFromX: hasGap ? gapFromX : null,
      gapToX: hasGap ? right : null,
    };
  });
};
