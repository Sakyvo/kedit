// 预览按需分段渲染（卡 014）：可见窗口计算 + 高度估算 + 窗口挂载计划。
//
// 预览是只读渲染产物，不需要文本模型/DOM 等价性，因此窗口化风险远小于编辑器侧：
// 未挂载段用占位元素（估算高度）保持滚动条量级，挂载后测量真实高度回填并收敛。
//
// 纯函数，无 DOM。

/** 字符宽度按全角/半角近似（估算用，不当精确值）。 */
const isWideChar = (code) => code >= 0x1100 && (
  code <= 0x115f
  || (code >= 0x2e80 && code <= 0xa4cf)
  || (code >= 0xac00 && code <= 0xd7a3)
  || (code >= 0xf900 && code <= 0xfaff)
  || (code >= 0xfe30 && code <= 0xfe6f)
  || (code >= 0xff00 && code <= 0xff60)
  || (code >= 0xffe0 && code <= 0xffe6)
);

/**
 * 段文本的估算高度。avgCharPx 为半角字符平均宽度，lineHeight 为行高；
 * 宽字符按 2 倍计。返回像素（至少 1 行）。
 */
export function estimateBlockHeight(text, { avgCharPx = 8, lineHeight = 24, viewportWidth = 800 } = {}) {
  const contentWidth = Math.max(80, viewportWidth);
  let px = 0;
  let lines = 1;
  const newlines = (text.match(/\n/g) || []).length;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 10) {
      continue;
    }
    px += isWideChar(code) ? avgCharPx * 2 : avgCharPx;
    if (px >= contentWidth) {
      lines += 1;
      px = 0;
    }
  }
  return Math.max(lineHeight, lines * lineHeight);
}

/**
 * 各段的显示高度：已测量者用真实值，未测量者用估算。
 * @param {Array<{text:string}>} sections
 * @param {Object} estimated 已测量/估算缓存 { [sectionIndex]: heightPx }
 * @param {Object} opts 估算参数
 * @returns {Array<number>}
 */
export function computeSectionHeights(sections, estimated, opts) {
  const heights = new Array(sections.length);
  for (let i = 0; i < sections.length; i += 1) {
    const known = estimated && estimated[i];
    heights[i] = typeof known === 'number' && known > 0
      ? known
      : estimateBlockHeight(sections[i].text || '', opts);
  }
  return heights;
}

/** 累积偏移：starts[i] 为段 i 顶部的像素位置。 */
export function computeSectionOffsets(heights) {
  const starts = new Array(heights.length);
  let offset = 0;
  for (let i = 0; i < heights.length; i += 1) {
    starts[i] = offset;
    offset += heights[i];
  }
  return starts;
}

/**
 * 计算需要挂载的段区间 [from, to)（闭开）。
 * 视口 [scrollTop, scrollTop + viewportHeight)，前后各留 buffer 像素。
 * @returns {{from:number, to:number}}
 */
export function computeVisibleRange(heights, starts, scrollTop, viewportHeight, bufferPx = 800) {
  const n = heights.length;
  if (!n) {
    return { from: 0, to: 0 };
  }
  const top = scrollTop - bufferPx;
  const bottom = scrollTop + viewportHeight + bufferPx;
  let from = 0;
  // 二分找到第一个 end > top 的段
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] + heights[mid] > top) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  from = lo;
  let to = from;
  while (to < n && starts[to] < bottom) {
    to += 1;
  }
  return { from, to };
}

/**
 * 在旧窗口 {from,to} 与新窗口之间，给出需挂载 / 需卸载的连续切片。
 * 都按「相邻区间差」表达，便于 DOM 侧用 insertBefore / removeChild 批量执行。
 * @returns {{mount: Array<{from:number,to:number}>, unmount: Array<{from:number,to:number}>}}
 */
export function planWindowChange(oldRange, newRange, total) {
  const oldFrom = oldRange ? oldRange.from : 0;
  const oldTo = oldRange ? oldRange.to : 0;
  const nFrom = newRange ? newRange.from : 0;
  const nTo = newRange ? newRange.to : 0;
  const clamp = r => ({ from: Math.max(0, Math.min(r.from, total)), to: Math.max(0, Math.min(r.to, total)) });
  const o = clamp({ from: oldFrom, to: oldTo });
  const w = clamp({ from: nFrom, to: nTo });
  const mount = [];
  const unmount = [];
  // 空窗口（无可见段）→ 只卸载
  if (w.to <= w.from) {
    if (o.to > o.from) unmount.push(o);
    return { mount, unmount };
  }
  if (o.to <= o.from) {
    mount.push(w);
    return { mount, unmount };
  }
  if (w.to <= o.from || w.from >= o.to) {
    // 两窗口不相交：全部换
    if (o.to > o.from) unmount.push(o);
    if (w.to > w.from) mount.push(w);
    return { mount, unmount };
  }
  if (w.from < o.from) mount.push({ from: w.from, to: Math.min(o.from, w.to) });
  if (w.to > o.to) mount.push({ from: Math.max(o.to, w.from), to: w.to });
  if (o.from < w.from) unmount.push({ from: o.from, to: Math.min(w.from, o.to) });
  if (o.to > w.to) unmount.push({ from: Math.max(w.to, o.from), to: o.to });
  return { mount, unmount };
}