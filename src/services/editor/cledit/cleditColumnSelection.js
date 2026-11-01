import cledit from './cleditCore';
import {
  normalizeSegments, columnText, applyColumnDeletion, deletionCaretOffset,
  applyColumnInsertion, applyColumnPerRowInsertion, applyRowInsertions,
  applyPerCaretDeletion, padToColumn, autoScrollDelta,
  snapBandToLines, clusterFragmentsByTop,
} from './cleditColumnUtils';

// 矩形选择 v4（ADR 0014，照搬 Notepad4 / Word 2016 观感）：
// - 行几何 = 带状扫描：Range.getClientRects 只扫与拖拽带纵向相交的文本
//   节点（先按 section boundingRect 剪枝），O(可见行)；热路径零
//   findContainer/getCoordinates（O(全文)，spec: Editor Hot-Path Geometry）。
// - 绘制 = 单一自绘选中块（实心半透明矩形，含虚拟空间），Word 2016 式。
//   无 CSS Highlight API、无边框、无补齐容器。
// - 偏移 = DOM 偏移空间 + 全量挂载不变量（稳态 DOM 文本 ≡ 模型文本；
//   分片构建瞬态直接判不可用），编辑走 cleditColumnUtils 整段变换。
function ColumnSelection(editor) {
  const contentElt = editor.$contentElt;
  const scrollElt = editor.$scrollElt || contentElt;
  const selectionMgr = editor.selectionMgr;

  let state = 'idle'; // idle | dragging | column
  let anchor = null; // 内容局部坐标 {x,y}
  let current = null;
  let rect = null; // 内容局部带 {left,top,width,height}
  let lines = []; // 本帧行（局部几何 + 视口探测坐标）
  let rows = []; // 偏移行（模型空间）
  let segments = []; // 真实行段（模型空间）
  let layerElt = null;
  let blockElt = null;
  let lastColumnCopyText = null;
  let selfEditing = 0;
  let rafId = null;
  let autoScrollRaf = null;
  let lastPointer = null;
  let spaceWidthCache = null;

  const contentOrigin = () => {
    const cRect = contentElt.getBoundingClientRect();
    const sRect = scrollElt.getBoundingClientRect();
    return {
      x: (cRect.left - sRect.left) + scrollElt.scrollLeft,
      y: (cRect.top - sRect.top) + scrollElt.scrollTop,
    };
  };
  const clientToLocal = (clientX, clientY) => {
    const cRect = contentElt.getBoundingClientRect();
    return { x: clientX - cRect.left, y: clientY - cRect.top };
  };

  // —— 带状扫描（每帧，仅几何；viewport 探测坐标仅本帧有效）——
  const scanLines = (band) => {
    const contentRect = contentElt.getBoundingClientRect();
    const topV = band.top + contentRect.top;
    const bottomV = topV + band.height;
    const frags = [];
    const sections = contentElt.children;
    for (let i = 0; i < sections.length; i += 1) {
      const elt = sections[i];
      if (!elt.classList || !elt.classList.contains('cledit-section')) {
        continue; // trailingNode 等非 section 元素
      }
      const sRect = elt.getBoundingClientRect();
      if (!sRect.height || sRect.bottom <= topV || sRect.top >= bottomV) {
        continue; // section 剪枝
      }
      const walker = document.createTreeWalker(elt, window.NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.nodeValue.length) {
          continue;
        }
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();
        for (let j = 0; j < rects.length; j += 1) {
          const r = rects[j];
          if (r.width <= 0 && r.height <= 0) {
            continue;
          }
          if (r.bottom <= topV || r.top >= bottomV) {
            continue;
          }
          frags.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        }
      }
    }
    return clusterFragmentsByTop(frags).map(g => ({
      top: g.top - contentRect.top,
      bottom: g.bottom - contentRect.top,
      left: g.left - contentRect.left,
      right: g.right - contentRect.left,
      topV: g.top,
      bottomV: g.bottom,
      midV: (g.top + g.bottom) / 2,
      leftV: g.left,
      rightV: g.right,
    }));
  };

  // —— DOM 偏移索引（每次计算行偏移时一次全量遍历，O(节点数)）——
  // 稳态 DOM 文本 ≡ 模型文本（分片构建瞬态由 total 校验兜住）
  const buildOffsetIndex = () => {
    const entries = [];
    const base = new Map();
    let offset = 0;
    const walker = document.createTreeWalker(contentElt, window.NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      base.set(node, offset);
      entries.push({ node, offset });
      offset += node.nodeValue.length;
    }
    return { base, entries, total: offset };
  };

  const caretFromPoint = (x, y) => {
    if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(x, y);
      if (range && contentElt.contains(range.startContainer)) {
        return { node: range.startContainer, offset: range.startOffset };
      }
      return null;
    }
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos && contentElt.contains(pos.offsetNode)) {
        return { node: pos.offsetNode, offset: pos.offset };
      }
    }
    return null;
  };

  // 行内 x → DOM 偏移：阶梯探测（x、x-2、x-8），命中 caret 的 top 必须
  // 落在该行内（防止浏览器把超界点吸到相邻行）
  const caretOffsetAt = (x, line, index) => {
    const ladder = [x, x - 2, x - 8];
    for (let i = 0; i < ladder.length; i += 1) {
      const pos = caretFromPoint(ladder[i], line.midV);
      if (!pos) {
        continue;
      }
      const baseOff = index.base.get(pos.node);
      if (baseOff === undefined) {
        continue;
      }
      try {
        const r = document.createRange();
        r.setStart(pos.node, pos.offset);
        r.collapse(true);
        const cr = r.getBoundingClientRect();
        if (cr.top < line.topV - 3 || cr.top > line.bottomV - 3) {
          continue;
        }
      } catch (e) {
        continue;
      }
      return baseOff + pos.offset;
    }
    return null;
  };

  // 模型偏移 → 像素 x（内容局部）：编辑后推进列光标用，冷路径
  const xOfModelOffset = (offset, index) => {
    const list = index.entries;
    let lo = 0;
    let hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (list[mid].offset <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    if (!list.length) {
      return 0;
    }
    const entry = list[lo];
    const rel = Math.max(0, Math.min(offset - entry.offset, entry.node.nodeValue.length));
    try {
      const r = document.createRange();
      r.setStart(entry.node, rel);
      r.collapse(true);
      const cr = r.getBoundingClientRect();
      const contentRect = contentElt.getBoundingClientRect();
      return cr.left - contentRect.left;
    } catch (e) {
      return 0;
    }
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

  // —— 计算行偏移（endDrag / 每次编辑后）——
  const computeRows = () => {
    const content = editor.getContent();
    const index = buildOffsetIndex();
    if (index.total !== content.length) {
      rows = []; // 分片构建瞬态：DOM ⊂ 模型，偏移不可信
      segments = [];
      return;
    }
    const contentRect = contentElt.getBoundingClientRect();
    const thin = rect.width < 1;
    rows = lines.map((line) => {
      const leftXv = Math.max(rect.left + contentRect.left, line.leftV - 1);
      const rightXv = Math.min(rect.left + rect.width + contentRect.left, line.rightV);
      const startOff = caretOffsetAt(leftXv, line, index);
      if (startOff == null) {
        return null;
      }
      let endOff = startOff;
      if (!thin && rightXv > leftXv) {
        const endProbe = rightXv >= line.rightV - 0.5 ? line.rightV - 0.5 : rightXv;
        const probed = caretOffsetAt(endProbe, line, index);
        if (probed != null && probed >= startOff) {
          endOff = probed;
        }
      }
      const rowEndProbe = line.rightV - 0.5;
      let rowEnd = endOff;
      const rowProbed = caretOffsetAt(rowEndProbe, line, index);
      if (rowProbed != null && rowProbed >= endOff) {
        rowEnd = rowProbed;
      }
      return {
        lineStart: startOff,
        lineEnd: endOff,
        rowEnd,
        lineEndX: line.right,
        top: line.top,
        height: line.bottom - line.top,
      };
    }).filter(row => row && row.rowEnd > row.lineStart);
    segments = normalizeSegments(
      rows.filter(row => row.lineEnd > row.lineStart)
        .map(row => ({ start: row.lineStart, end: row.lineEnd })),
      content.length,
    );
  };

  // —— 绘制：单一选中块（Word 2016 式实心矩形，含虚拟空间）——
  const ensureLayer = () => {
    if (!layerElt) {
      layerElt = document.createElement('div');
      layerElt.className = 'cl-column-layer';
      scrollElt.appendChild(layerElt);
      blockElt = document.createElement('div');
      blockElt.className = 'cl-column-block';
      layerElt.appendChild(blockElt);
    }
  };
  const removeLayer = () => {
    if (layerElt) {
      layerElt.remove();
      layerElt = null;
      blockElt = null;
    }
  };

  const paint = () => {
    if (state === 'idle' || !rect || rect.width < 1 || rect.height < 1) {
      if (blockElt) {
        blockElt.style.display = 'none';
      }
      return;
    }
    const snap = snapBandToLines(lines, rect.top, rect.top + rect.height);
    if (!snap) {
      if (blockElt) {
        blockElt.style.display = 'none';
      }
      return;
    }
    ensureLayer();
    const origin = contentOrigin();
    blockElt.style.display = '';
    blockElt.style.cssText = `display:block;left:${origin.x + rect.left}px`
      + `;top:${origin.y + snap.top}px;width:${rect.width}px;height:${snap.bottom - snap.top}px;`;
  };

  // —— rAF 节流渲染 ——
  const requestRender = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(renderFrame);
    }
  };

  function renderFrame() {
    rafId = null;
    if (state === 'idle') {
      return;
    }
    rect = rectFromPoints();
    lines = scanLines(rect);
    paint();
  }

  // —— 自动滚动（拖出视口持续扩选）——
  const stopAutoScroll = () => {
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  };
  const scheduleAutoScroll = () => {
    if (!autoScrollRaf) {
      autoScrollRaf = requestAnimationFrame(autoScrollStep);
    }
  };
  function autoScrollStep() {
    autoScrollRaf = null;
    if (state !== 'dragging' || !lastPointer) {
      return;
    }
    const box = scrollElt.getBoundingClientRect();
    const delta = autoScrollDelta(lastPointer.clientY, box.top, box.bottom);
    if (!delta) {
      return;
    }
    const before = scrollElt.scrollTop;
    scrollElt.scrollTop = before + delta;
    if (scrollElt.scrollTop === before) {
      return; // 内容边界
    }
    current = clientToLocal(lastPointer.clientX, lastPointer.clientY);
    requestRender();
    scheduleAutoScroll();
  }

  // —— 编辑语义（模型空间整段变换）——
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
  const caretTopLeft = () => (segments.length ? segments[0].start : (rows.length ? rows[0].lineStart : 0));

  const performColumnEdit = (newText, caret) => {
    const content = editor.getContent();
    exit({ restore: false });
    if (newText !== content) {
      editor.undoMgr.setCurrentMode('single');
      editor.setContent(newText);
      editor.setSelection(caret, caret);
    }
  };

  // 列模式内原地编辑（不退出）：重算行并重绘
  const applyColumnTyping = (newText, mode) => {
    const content = editor.getContent();
    if (newText === content) {
      return;
    }
    editor.undoMgr.setCurrentMode(mode);
    selfEditing += 1;
    editor.setContent(newText);
    setTimeout(() => {
      selfEditing = 0;
    }, 0);
    lines = scanLines(rect);
    computeRows();
    paint();
  };

  const columnClipText = () => (segments.length ? columnText(editor.getContent(), segments) : null);

  const onCopy = (evt) => {
    if (state !== 'column') return;
    const text = columnClipText();
    if (text == null) return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.clipboardData.setData('text/plain', text);
    lastColumnCopyText = text;
  };
  const onCut = (evt) => {
    if (state !== 'column') return;
    const text = columnClipText();
    if (text == null) return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.clipboardData.setData('text/plain', text);
    lastColumnCopyText = text;
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
    if (mod && (key === 'c' || key === 'x')) return;
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
      if (isThin()) {
        const back = key === 'backspace';
        const firstCaret = rows.length ? rows[0].lineStart : 0;
        const next = applyPerCaretDeletion(
          content, rows.map(row => row.lineStart), back ? 'backward' : 'forward',
        );
        if (next === content) {
          return;
        }
        applyColumnTyping(next, 'single');
        if (back) {
          const index = buildOffsetIndex();
          rect = {
            left: xOfModelOffset(Math.max(0, firstCaret - 1), index),
            top: rect.top,
            width: 0,
            height: rect.height,
          };
          lines = scanLines(rect);
          computeRows();
          paint();
        }
        return;
      }
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
        const ops = rows.map((row) => {
          const pad = padToColumn(row.lineEndX, rect.left, spaceWidth());
          return { at: row.lineStart, text: pad > 0 ? `${' '.repeat(pad)}${evt.key}` : evt.key };
        });
        if (!ops.length) {
          return;
        }
        applyColumnTyping(applyRowInsertions(content, ops), 'typing');
        const index = buildOffsetIndex();
        rect = {
          left: xOfModelOffset(ops[0].at + ops[0].text.length, index),
          top: rect.top,
          width: 0,
          height: rect.height,
        };
        lines = scanLines(rect);
        computeRows();
        paint();
        return;
      }
      const nextText = applyColumnInsertion(content, segments, evt.key);
      const caretOffset = segments.length ? segments[0].start + evt.key.length : 0;
      applyColumnTyping(nextText, 'typing');
      const index = buildOffsetIndex();
      rect = {
        left: xOfModelOffset(caretOffset, index),
        top: rect.top,
        width: 0,
        height: rect.height,
      };
      lines = scanLines(rect);
      computeRows();
      paint();
      return;
    }
    exit({ restore: true });
  };

  const onPaste = (evt) => {
    if (state !== 'column') return;
    evt.preventDefault();
    evt.stopPropagation();
    const clip = evt.clipboardData || window.clipboardData;
    const text = clip && clip.getData('text/plain');
    if (!text || !rows.length) return;
    const content = editor.getContent();
    const own = lastColumnCopyText !== null && lastColumnCopyText === text;
    const lines0 = text.split(String.fromCharCode(10))
      .map(line => line.split(String.fromCharCode(13)).join(''));
    while (lines0.length > 1 && lines0[lines0.length - 1] === '') {
      lines0.pop();
    }
    const LINESEP = String.fromCharCode(10);
    const padFor = row => ' '.repeat(padToColumn(row.lineEndX, rect.left, spaceWidth()));
    const topLeft = rows[0].lineStart;

    if (own) {
      const perRow = lines0.length === rows.length && rows.length > 1;
      if (isThin()) {
        const ops = rows.map((row, i) => ({
          at: row.lineStart,
          text: padFor(row) + (perRow ? lines0[i] : lines0.join(LINESEP)),
        }));
        performColumnEdit(applyRowInsertions(content, ops), ops[0].at + ops[0].text.length);
      } else {
        const texts = rows.map((row, i) => padFor(row) + (perRow ? lines0[i] : lines0.join(LINESEP)));
        performColumnEdit(
          applyColumnPerRowInsertion(content, segments, texts),
          topLeft + texts[0].length,
        );
      }
      return;
    }
    const newText = isThin()
      ? applyRowInsertions(content, [{ at: topLeft, text }])
      : applyColumnPerRowInsertion(content, segments, [text]);
    performColumnEdit(newText, topLeft + text.length);
  };

  const onMouseDown = () => exit({ restore: false });
  const onScrollRetrack = () => requestRender();
  const onContentChanged = () => {
    if (selfEditing > 0) {
      selfEditing -= 1;
      return;
    }
    if (state === 'column') {
      exit({ restore: false });
    }
  };

  const onMouseMove = (evt) => {
    if (state !== 'dragging') return;
    lastPointer = { clientX: evt.clientX, clientY: evt.clientY };
    current = clientToLocal(evt.clientX, evt.clientY);
    requestRender(); // 每帧至多一次重算
    scheduleAutoScroll();
  };

  const endDrag = () => {
    if (state !== 'dragging') return;
    stopAutoScroll();
    lastPointer = null;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    rect = rectFromPoints();
    lines = scanLines(rect);
    computeRows();
    if (!rows.length && (!rect.width || !rect.height)) {
      exit({ restore: false });
      return;
    }
    if (!rows.length) {
      // 偏移不可用（分片构建瞬态）——保留几何但不进入编辑模式
      exit({ restore: false });
      return;
    }
    state = 'column';
    selectionMgr.columnSelectionLocked = true;
    selectionMgr.setSelectionStartEnd(caretTopLeft(), caretTopLeft(), false);
    paint();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('copy', onCopy, true);
    window.addEventListener('cut', onCut, true);
    window.addEventListener('mousedown', onMouseDown, true);
    contentElt.addEventListener('paste', onPaste, true);
  };

  function exit({ restore = true } = {}) {
    if (state === 'idle') return;
    const wasColumn = state === 'column';
    stopAutoScroll();
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastPointer = null;
    state = 'idle';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    scrollElt.removeEventListener('scroll', onScrollRetrack, true);
    if (wasColumn) {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('copy', onCopy, true);
      window.removeEventListener('cut', onCut, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      contentElt.removeEventListener('paste', onPaste, true);
      selectionMgr.columnSelectionLocked = false;
    }
    const caret = wasColumn ? caretTopLeft() : 0;
    removeLayer();
    segments = [];
    rows = [];
    lines = [];
    rect = null;
    anchor = null;
    current = null;
    if (wasColumn && restore) {
      selectionMgr.setSelectionStartEnd(caret, caret);
    }
  }

  const onAltMouseDown = (evt) => {
    if (state !== 'idle') return;
    // Alt 仅此刻判定：拖拽中松开 Alt 仍保持矩形（Scintilla selType 粘性）
    if (!evt.altKey || evt.button !== 0) return;
    evt.preventDefault();
    evt.stopPropagation();
    state = 'dragging';
    anchor = clientToLocal(evt.clientX, evt.clientY);
    current = { ...anchor };
    scrollElt.addEventListener('scroll', onScrollRetrack, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
    requestRender();
  };

  contentElt.addEventListener('mousedown', onAltMouseDown, true);
  editor.on('contentChanged', onContentChanged);
  editor.on('destroy', () => exit({ restore: false }));
}

cledit.ColumnSelection = ColumnSelection;
