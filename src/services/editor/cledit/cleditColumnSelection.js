import cledit from './cleditCore';
import {
  normalizeSegments, columnText, applyColumnDeletion, deletionCaretOffset,
  applyColumnInsertion, insertionCaretOffset, applyColumnPerRowInsertion,
  perRowSegmentsFromRect, applyRowInsertions, padToColumn,
} from './cleditColumnUtils';

// 矩形选择（ADR 0014，照搬 Notepad4 矩形选区）：Alt+拖拽即实时逐行选区，
// 边界取鼠标像素 x（非行尾截断），短行缺失段用同色实心补齐成整齐矩形块。
// 真实文本段由 CSS Custom Highlight API（::highlight(cl-column)）绘制；
// 无该 API 时降级为整块自绘矩形。cledit 单光标架构不变——批量编辑一律
// 表达为整段字符串变换。
//
// 补齐矩形挂载在滚动容器而非 contentElt：cledit 高亮器会移除 contentElt
// 下所有非 section 子节点（cleditHighlighter.js 「Remove unauthorized nodes」）。
function ColumnSelection(editor) {
  const contentElt = editor.$contentElt;
  const scrollElt = editor.$scrollElt || contentElt;
  const selectionMgr = editor.selectionMgr;
  const HIGHLIGHT_NAME = 'cl-column';
  const supportsHighlight = typeof window !== 'undefined'
    && window.CSS && window.CSS.highlights && typeof window.Highlight === 'function';

  let state = 'idle'; // idle | dragging | column
  let anchor = null; // 内容局部坐标 {x,y}
  let current = null;
  let rect = null; // 内容局部坐标 {left, top, width, height}
  let rows = []; // 视觉行 × 内容区间 + 像素信息
  let segments = []; // 归一化后的真实文本区间（编辑用）
  let selfEditing = 0; // 自己的编辑引发的 contentChanged 次数（不该触发退出）
  let gapElt = null; // 补齐矩形容器（scrollElt 子节点）
  let rectElt = null; // 无 Highlight API 时的降级整块

  const contentOrigin = () => {
    const cRect = contentElt.getBoundingClientRect();
    const sRect = scrollElt.getBoundingClientRect();
    return {
      x: (cRect.left - sRect.left) + scrollElt.scrollLeft,
      y: (cRect.top - sRect.top) + scrollElt.scrollTop,
    };
  };
  const clientToLocal = (clientX, clientY) => {
    const rect0 = contentElt.getBoundingClientRect();
    return { x: clientX - rect0.left, y: clientY - rect0.top };
  };
  const localToClient = (x, y) => {
    const rect0 = contentElt.getBoundingClientRect();
    return { x: x + rect0.left, y: y + rect0.top };
  };

  // client 点 → 内容偏移；补齐矩形 pointer-events:none，不挡命中
  const offsetFromPoint = (clientX, clientY) => {
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }
    if (!range || !contentElt.contains(range.startContainer)) {
      return null;
    }
    const r = document.createRange();
    r.setStart(contentElt, 0);
    try {
      r.setEnd(range.startContainer, range.startOffset);
    } catch (e) {
      return null;
    }
    return r.toString().length;
  };

  // 二分找 [from, bound] 内与 top 同一视觉行的最大偏移（换行后 top 递增）
  const rowEndWithTop = (from, top, bound) => {
    let lo = from;
    let hi = bound;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (selectionMgr.getCoordinates(mid).top === top) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  };

  const xOfOffset = (offset) => {
    const coords = selectionMgr.getCoordinates(offset);
    return coords.left;
  };

  // 逐视觉行采集：行内容区间 + 行尾像素 + 行顶/高
  const computeRows = (r) => {
    if (!r || r.height < 1) {
      return [];
    }
    const content = editor.getContent();
    const result = [];
    const yBottom = r.top + r.height;
    let y = r.top + 1;
    let guard = 0;
    while (y <= yBottom && guard < 2000) {
      guard += 1;
      const probePt = localToClient(r.left, y);
      const probe = offsetFromPoint(probePt.x, probePt.y);
      if (probe == null) {
        break;
      }
      const base = selectionMgr.getCoordinates(probe);
      if (!base.height || base.top > yBottom) {
        break;
      }
      const midY = base.top + base.height / 2;
      const rowStartPt = localToClient(1, midY);
      let rowStart = offsetFromPoint(rowStartPt.x, rowStartPt.y);
      if (rowStart == null) {
        rowStart = probe;
      }
      const logicalEndIdx = content.indexOf('\n', rowStart);
      const logicalEnd = logicalEndIdx === -1 ? content.length : logicalEndIdx;
      const rowEnd = Math.min(rowEndWithTop(rowStart, base.top, logicalEnd), logicalEnd);
      const leftPt = localToClient(r.left, midY);
      const rawStart = offsetFromPoint(leftPt.x, leftPt.y);
      const startOff = Math.max(rowStart, Math.min(rawStart == null ? rowEnd : rawStart, rowEnd));
      let endOff;
      if (r.width < 1) {
        endOff = startOff; // 零宽列光标（ThinRectangularRange）
      } else if (r.left + r.width >= xOfOffset(rowEnd)) {
        endOff = rowEnd;
      } else {
        const rightPt = localToClient(r.left + r.width, midY);
        const rawEnd = offsetFromPoint(rightPt.x, rightPt.y);
        endOff = Math.max(startOff, Math.min(rawEnd == null ? rowEnd : rawEnd, rowEnd));
      }
      result.push({
        lineStart: startOff,
        lineEnd: endOff,
        rowEnd,
        lineEndX: xOfOffset(rowEnd),
        top: base.top,
        height: base.height,
      });
      y = base.top + base.height;
      if (base.height <= 0) {
        break;
      }
    }
    return result;
  };

  const computeAll = (r) => {
    rows = computeRows(r);
    segments = normalizeSegments(
      rows.filter(row => row.lineEnd > row.lineStart)
        .map(row => ({ start: row.lineStart, end: row.lineEnd })),
      editor.getContent().length,
    );
    return perRowSegmentsFromRect(rows, r.left, r.left + r.width);
  };

  const rectFromPoints = () => {
    const left = Math.min(anchor.x, current.x);
    const top = Math.min(anchor.y, current.y);
    return {
      left,
      top,
      width: Math.abs(current.x - anchor.x),
      height: Math.abs(current.y - anchor.y),
    };
  };

  // —— 补齐矩形（短行虚拟空间）——
  const clearGaps = () => {
    if (gapElt) {
      const elt = gapElt;
      gapElt = null;
      elt.remove();
    }
  };
  const paintGaps = (segs) => {
    const filled = segs.filter(seg => seg.gapFromX != null && seg.gapToX > seg.gapFromX);
    if (!filled.length) {
      clearGaps();
      return;
    }
    if (!gapElt) {
      gapElt = document.createElement('div');
      gapElt.className = 'cl-column-gaps';
      scrollElt.appendChild(gapElt);
    }
    const origin = contentOrigin();
    gapElt.textContent = '';
    filled.forEach((seg) => {
      const row = rows.find(r0 => r0.lineStart === seg.start || r0.lineEnd === seg.end);
      if (!row) {
        return;
      }
      const elt = document.createElement('div');
      elt.className = 'cl-column-gap';
      elt.style.cssText = `left:${origin.x + seg.gapFromX}px;top:${origin.y + row.top}px`
        + `;width:${seg.gapToX - seg.gapFromX}px;height:${row.height}px;`;
      gapElt.appendChild(elt);
    });
  };

  // —— 真实文本高亮 / 降级整块 ——
  const ensureRect = () => {
    if (!rectElt) {
      rectElt = document.createElement('div');
      rectElt.className = 'cl-column-selection';
      scrollElt.appendChild(rectElt);
    }
  };
  const removeRect = () => {
    if (rectElt) {
      rectElt.remove();
      rectElt = null;
    }
  };

  const buildRanges = () => {
    const content = editor.getContent();
    const list = [];
    segments.forEach((seg) => {
      let offset = seg.start;
      let guard = 0;
      while (offset < seg.end && guard < 1000) {
        guard += 1;
        const top = selectionMgr.getCoordinates(offset).top;
        const nl = content.indexOf('\n', offset);
        const bound = Math.min(seg.end, nl === -1 ? content.length : nl);
        const end = Math.max(rowEndWithTop(offset, top, bound), offset);
        list.push(selectionMgr.createRange(offset, end));
        offset = end > offset ? end : offset + 1;
      }
    });
    return list;
  };

  // 统一渲染入口：拖拽期与激活期同一路径（照搬 Notepad 的实时选区）
  const render = () => {
    if (!rect) {
      return;
    }
    const segs = computeAll(rect);
    if (supportsHighlight) {
      const ranges = buildRanges();
      window.CSS.highlights.set(HIGHLIGHT_NAME, new window.Highlight(...ranges));
      paintGaps(segs);
      removeRect();
    } else {
      ensureRect();
      const origin = contentOrigin();
      rectElt.style.cssText = `left:${origin.x + rect.left}px;top:${origin.y + rect.top}px`
        + `;width:${rect.width}px;height:${rect.height}px;`;
      paintGaps(segs);
    }
  };

  const clearPaint = () => {
    if (supportsHighlight) {
      window.CSS.highlights.delete(HIGHLIGHT_NAME);
    }
    clearGaps();
    removeRect();
  };

  const caretTopLeft = () => (segments.length ? segments[0].start : 0);

  // 统一编辑出口：先退出列模式（不恢复选区），再以单次可撤销编辑落盘
  const performColumnEdit = (newText, caret) => {
    const content = editor.getContent();
    exit({ restore: false });
    if (newText !== content) {
      editor.undoMgr.setCurrentMode('single');
      editor.setContent(newText);
      editor.setSelection(caret, caret);
    }
  };

  // 空格像素宽（补齐列对齐用）：canvas 量当前编辑器字体，不碰 DOM
  let spaceWidthCache = null;
  const spaceWidth = () => {
    if (spaceWidthCache) {
      return spaceWidthCache;
    }
    try {
      const cs = window.getComputedStyle(contentElt);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      spaceWidthCache = ctx.measureText(' ').width || (parseFloat(cs.fontSize) * 0.5);
    } catch (e) {
      spaceWidthCache = 8;
    }
    return spaceWidthCache;
  };

  const isThin = () => !!rect && rect.width < 1;

  // 短行补空格到目标列再插入（RealizeVirtualSpace）
  const rowInsertOps = (text) => rows.map((row) => {
    const pad = padToColumn(row.lineEndX, rect.left, spaceWidth());
    if (isThin() && pad > 0) {
      return { at: row.rowEnd, text: `${' '.repeat(pad)}${text}` };
    }
    return { at: row.lineStart, text };
  });

  // 列模式内的原地编辑：不退出，重算行后继续（粘性多行输入）
  const applyColumnTyping = (newText, mode) => {
    const content = editor.getContent();
    if (newText === content) {
      return;
    }
    editor.undoMgr.setCurrentMode(mode); // 'typing' → 连续按键合并为单个 undo 单元
    selfEditing += 1; // 自己的编辑不该触发"外部内容变更 → 退出"
    editor.setContent(newText);
    setTimeout(() => { selfEditing = 0; }, 0); // 兜底：观察回调必为微任务，先于该定时器
    render();
  };

  const onCopy = (evt) => {
    if (state !== 'column') return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.clipboardData.setData('text/plain', columnText(editor.getContent(), segments));
  };
  const onCut = (evt) => {
    if (state !== 'column') return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.clipboardData.setData('text/plain', columnText(editor.getContent(), segments));
    const content = editor.getContent();
    performColumnEdit(
      applyColumnDeletion(content, segments),
      deletionCaretOffset(content, segments),
    );
  };

  const NON_EXIT_KEYS = new Set(['shift', 'control', 'alt', 'meta', 'capslock', 'numlock', 'scrolllock']);
  const onKeyDown = (evt) => {
    if (state !== 'column') return;
    const key = `${evt.key}`.toLowerCase();
    if (NON_EXIT_KEYS.has(key)) return;
    const mod = evt.ctrlKey || evt.metaKey;
    if (mod && (key === 'c' || key === 'x')) return; // copy/cut 事件处理
    if (key === 'escape') {
      evt.preventDefault();
      evt.stopPropagation();
      exit({ restore: true });
      return;
    }
    if (!mod && !evt.altKey && (key === 'backspace' || key === 'delete')) {
      evt.preventDefault();
      evt.stopPropagation();
      const content = editor.getContent();
      performColumnEdit(
        applyColumnDeletion(content, segments),
        deletionCaretOffset(content, segments),
      );
      return;
    }
    if (!mod && !evt.altKey && key.length === 1 && !evt.isComposing) {
      evt.preventDefault();
      evt.stopPropagation();
      const content = editor.getContent();
      if (isThin()) {
        // 粘性多行输入：各光标处插入（短行先补空格到该列），列随输入右移
        const ops = rowInsertOps(evt.key);
        const firstOp = ops[0];
        if (!firstOp) {
          return;
        }
        applyColumnTyping(applyRowInsertions(content, ops), 'typing');
        rect = {
          left: xOfOffset(firstOp.at + firstOp.text.length),
          top: rect.top,
          width: 0,
          height: rect.height,
        };
        render();
        return;
      }
      const firstRow = rows[0];
      if (!firstRow) {
        return;
      }
      const nextText = applyColumnInsertion(content, segments, evt.key);
      const caretOffset = firstRow.lineStart + evt.key.length;
      applyColumnTyping(nextText, 'typing');
      // 收成零宽列光标（ThinRectangularRange）：垂直范围不变，宽度归零
      rect = {
        left: xOfOffset(caretOffset), top: rect.top, width: 0, height: rect.height,
      };
      segments = [];
      render();
      return;
    }
    // 其余任何按键（Enter/方向/Home/组合键/IME…）：退出不吞，交还常规编辑
    exit({ restore: true });
  };

  const onPaste = (evt) => {
    if (state !== 'column') return;
    evt.preventDefault();
    evt.stopPropagation();
    const clip = evt.clipboardData || window.clipboardData;
    const text = clip && clip.getData('text/plain');
    if (!text) return;
    const content = editor.getContent();
    const lines = text.split('\n');
    let newText;
    let caret;
    if (lines.length > 1 && lines.length === segments.length) {
      newText = applyColumnPerRowInsertion(content, segments, lines);
      caret = segments[0].start + (lines[0] || '').length;
    } else {
      newText = applyColumnInsertion(content, segments, text);
      caret = insertionCaretOffset(content, segments, text);
    }
    performColumnEdit(newText, caret);
  };

  const onMouseDown = () => exit({ restore: false });
  const onContentChanged = () => {
    if (selfEditing > 0) {
      selfEditing -= 1; // 自己刚落的编辑，不是外部变更
      return;
    }
    if (state === 'column') {
      exit({ restore: false }); // 外部内容变更（同步/撤销）→ 静默退出
    }
  };

  const onMouseMove = (evt) => {
    if (state !== 'dragging') return;
    current = clientToLocal(evt.clientX, evt.clientY);
    rect = rectFromPoints();
    render(); // 实时逐行重算重绘
  };

  const endDrag = () => {
    if (state !== 'dragging') return;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    rect = rectFromPoints();
    render();
    if (!segments.length) {
      // 纯虚拟空间矩形（整段超出所有行尾）仍算有效选区，只有零面积才退出
      if (!rect.width && !rect.height) {
        exit({ restore: false });
        return;
      }
      if (!rect.width) {
        exit({ restore: false });
        return;
      }
    }
    state = 'column';
    selectionMgr.columnSelectionLocked = true;
    selectionMgr.setSelectionStartEnd(caretTopLeft(), caretTopLeft(), false);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('copy', onCopy, true);
    window.addEventListener('cut', onCut, true);
    window.addEventListener('mousedown', onMouseDown, true);
    contentElt.addEventListener('paste', onPaste, true);
    scrollElt.addEventListener('scroll', onScrollRetrack, true);
  };

  // 滚动时补齐矩形与高亮都要重定位（高亮随文本走，补齐块用的是容器坐标）
  function onScrollRetrack() {
    if (state === 'column' || state === 'dragging') {
      const segs = perRowSegmentsFromRect(rows, rect.left, rect.left + rect.width);
      paintGaps(segs);
    }
  }

  function exit({ restore = true } = {}) {
    if (state === 'idle') return;
    const wasColumn = state === 'column';
    state = 'idle';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    if (wasColumn) {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('copy', onCopy, true);
      window.removeEventListener('cut', onCut, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      contentElt.removeEventListener('paste', onPaste, true);
      scrollElt.removeEventListener('scroll', onScrollRetrack, true);
      selectionMgr.columnSelectionLocked = false;
    }
    const caret = wasColumn ? caretTopLeft() : 0;
    clearPaint();
    segments = [];
    rows = [];
    rect = null;
    anchor = null;
    current = null;
    if (wasColumn && restore) {
      selectionMgr.setSelectionStartEnd(caret, caret);
    }
  }

  const onAltMouseDown = (evt) => {
    if (state !== 'idle') return;
    if (!evt.altKey || evt.button !== 0) return;
    evt.preventDefault();
    evt.stopPropagation();
    state = 'dragging';
    anchor = clientToLocal(evt.clientX, evt.clientY);
    current = { ...anchor };
    rect = rectFromPoints();
    scrollElt.addEventListener('scroll', onScrollRetrack, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
  };

  contentElt.addEventListener('mousedown', onAltMouseDown, true);
  editor.on('contentChanged', onContentChanged);
  editor.on('destroy', () => exit({ restore: false }));
}

cledit.ColumnSelection = ColumnSelection;
