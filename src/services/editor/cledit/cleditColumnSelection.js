import cledit from './cleditCore';
import {
  normalizeSegments, columnText, applyColumnDeletion, deletionCaretOffset,
  applyColumnInsertion, insertionCaretOffset, applyColumnPerRowInsertion,
} from './cleditColumnUtils';

// Alt+拖拽矩形选择（ADR 0014，Word 式重做）：拖拽中矩形反馈；松开后激活
// 列选区——多区高亮由 CSS Custom Highlight API（::highlight(cl-column)）
// 承载，SelectionMgr.save 锁定不再回读（columnSelectionLocked）。
// 激活期间：打字/粘贴 = VSCode 式逐行插入（单次可撤销）；Backspace/Delete
// = 列删除；Ctrl+C/X 列复制/剪切；其余按键/点击退出并恢复常规编辑。
// 无 Highlight API 时降级为持久矩形 overlay（行为等同，仅高亮形态不同）。
function ColumnSelection(editor) {
  const contentElt = editor.$contentElt;
  const selectionMgr = editor.selectionMgr;
  const HIGHLIGHT_NAME = 'cl-column';
  const supportsHighlight = typeof window !== 'undefined'
    && window.CSS && window.CSS.highlights && typeof window.Highlight === 'function';

  let state = 'idle'; // idle | dragging | active
  let anchor = null; // 内容局部坐标 {x,y}
  let current = null;
  let segments = [];
  let rectElt = null;
  let ranges = [];

  const clientToLocal = (clientX, clientY) => {
    const rect = contentElt.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const localToClient = (x, y) => {
    const rect = contentElt.getBoundingClientRect();
    return { x: x + rect.left, y: y + rect.top };
  };

  // client 点 → 内容偏移。矩形 div pointer-events:none，不挡命中。
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

  // 二分找 [from, bound] 内与 top 同一视觉行的最大偏移
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

  // 矩形（内容局部 px）→ 各行内容偏移区间（短行/窄行截断到行尾）
  const computeSegments = (rect) => {
    if (!rect || rect.width < 1 || rect.height < 1) {
      return [];
    }
    const content = editor.getContent();
    const segs = [];
    const yBottom = rect.top + rect.height;
    let y = rect.top + 1;
    let lastStart = -1;
    let guard = 0;
    while (y <= yBottom && guard < 2000) {
      guard += 1;
      const probePoint = localToClient(rect.left, y);
      const probe = offsetFromPoint(probePoint.x, probePoint.y);
      if (probe == null) {
        break;
      }
      const base = selectionMgr.getCoordinates(probe);
      if (!base.height || base.top > yBottom) {
        break;
      }
      const midY = base.top + base.height / 2;
      const leftPt = localToClient(rect.left, midY);
      const o1 = offsetFromPoint(leftPt.x, leftPt.y);
      if (o1 == null || o1 <= lastStart) {
        y = base.top + base.height;
        continue;
      }
      const nl = content.indexOf('\n', o1);
      const lineEnd = nl === -1 ? content.length : nl;
      const rightPt = localToClient(rect.left + rect.width, midY);
      let o2 = offsetFromPoint(rightPt.x, rightPt.y);
      if (o2 == null || o2 < o1 || o2 > lineEnd
        || selectionMgr.getCoordinates(o2).top !== base.top) {
        o2 = Math.min(rowEndWithTop(o1, base.top, lineEnd), lineEnd);
      }
      if (o2 > o1) {
        segs.push({ start: o1, end: o2 });
        lastStart = o1;
      }
      y = base.top + base.height;
    }
    return normalizeSegments(segs, content.length);
  };

  // —— 矩形 overlay（仅拖拽反馈 + 无 Highlight API 时的降级持久高亮）——
  const ensureRect = () => {
    if (!rectElt) {
      contentElt.classList.add('cl-column-selection-host');
      editor.watcher.noWatch(() => {
        rectElt = document.createElement('div');
        rectElt.className = 'cl-column-selection';
        contentElt.appendChild(rectElt);
      });
    }
  };
  const renderRect = (rect) => {
    ensureRect();
    rectElt.style.cssText = `left:${rect.left}px;top:${rect.top}px`
      + `;width:${rect.width}px;height:${rect.height}px;`;
  };
  const removeRect = () => {
    if (rectElt) {
      const elt = rectElt;
      rectElt = null;
      editor.watcher.noWatch(() => elt.remove());
    }
    contentElt.classList.remove('cl-column-selection-host');
  };

  // —— 多区高亮（CSS Custom Highlight API）——
  // 每个逻辑行段按视觉行拆开，各自建 Range；Range 是活的，高亮随 DOM 变更走。
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
        const lineEnd = nl === -1 ? content.length : nl;
        const bound = Math.min(seg.end, lineEnd);
        const rowEnd = Math.max(rowEndWithTop(offset, top, bound), offset);
        list.push(selectionMgr.createRange(offset, rowEnd));
        if (rowEnd <= offset) {
          offset += 1;
        } else {
          offset = rowEnd;
        }
      }
    });
    return list;
  };
  const paintHighlight = () => {
    if (!supportsHighlight) {
      renderRect(rectFromPoints()); // 降级：持久矩形
      return;
    }
    ranges = buildRanges();
    const highlight = new window.Highlight(...ranges);
    window.CSS.highlights.set(HIGHLIGHT_NAME, highlight);
  };
  const clearHighlight = () => {
    if (supportsHighlight) {
      window.CSS.highlights.delete(HIGHLIGHT_NAME);
    }
    ranges = [];
    removeRect();
  };

  const rectFromPoints = () => ({
    left: Math.min(anchor.x, current.x),
    top: Math.min(anchor.y, current.y),
    width: Math.abs(current.x - anchor.x),
    height: Math.abs(current.y - anchor.y),
  });

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

  const onCopy = (evt) => {
    if (state !== 'active') return;
    evt.preventDefault();
    evt.stopPropagation();
    evt.clipboardData.setData('text/plain', columnText(editor.getContent(), segments));
  };
  const onCut = (evt) => {
    if (state !== 'active') return;
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
    if (state !== 'active') return;
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
    // VSCode 式逐行插入：可打印字符（无修饰、非 IME 合成中）
    if (!mod && !evt.altKey && key.length === 1 && !evt.isComposing) {
      evt.preventDefault();
      evt.stopPropagation();
      const content = editor.getContent();
      performColumnEdit(
        applyColumnInsertion(content, segments, evt.key),
        insertionCaretOffset(content, segments, evt.key),
      );
      return;
    }
    // 其余任何按键（Enter/方向/Home/组合键/IME…）：退出不吞，交还常规编辑
    exit({ restore: true });
  };

  // 粘贴：行数与列段数一致时逐行各异，否则整段文本逐行同插（VSCode 块语义）
  const onPaste = (evt) => {
    if (state !== 'active') return;
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
  const onDragScroll = () => exit({ restore: false });
  const onContentChanged = () => {
    if (state === 'active') {
      exit({ restore: false }); // 外部内容变更（同步/工具栏撤销）→ 静默退出
    }
  };

  const onMouseMove = (evt) => {
    if (state !== 'dragging') return;
    current = clientToLocal(evt.clientX, evt.clientY);
    renderRect(rectFromPoints());
  };

  const endDrag = () => {
    if (state !== 'dragging') return;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    const scrollElt = editor.$scrollElt;
    if (scrollElt) {
      scrollElt.removeEventListener('scroll', onDragScroll, true);
    }
    segments = computeSegments(rectFromPoints());
    if (!segments.length) {
      exit({ restore: false });
      return;
    }
    state = 'active';
    removeRect();
    paintHighlight();
    selectionMgr.columnSelectionLocked = true;
    // 光标收拢到矩形左上角（不画选区，只定光标语义位置）
    selectionMgr.setSelectionStartEnd(segments[0].start, segments[0].start, false);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('copy', onCopy, true);
    window.addEventListener('cut', onCut, true);
    window.addEventListener('mousedown', onMouseDown, true);
    contentElt.addEventListener('paste', onPaste, true);
  };

  function exit({ restore = true } = {}) {
    if (state === 'idle') return;
    const wasActive = state === 'active';
    state = 'idle';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    const scrollElt = editor.$scrollElt;
    if (scrollElt) {
      scrollElt.removeEventListener('scroll', onDragScroll, true);
    }
    if (wasActive) {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('copy', onCopy, true);
      window.removeEventListener('cut', onCut, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      contentElt.removeEventListener('paste', onPaste, true);
      selectionMgr.columnSelectionLocked = false;
      clearHighlight();
    } else {
      removeRect();
    }
    const caret = wasActive ? caretTopLeft() : 0;
    segments = [];
    ranges = [];
    anchor = null;
    current = null;
    if (wasActive && restore) {
      // 恢复常规单光标编辑：画一个真实光标
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
    const scrollElt = editor.$scrollElt;
    if (scrollElt) {
      scrollElt.addEventListener('scroll', onDragScroll, true);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
  };

  contentElt.addEventListener('mousedown', onAltMouseDown, true);
  editor.on('contentChanged', onContentChanged);
  editor.on('destroy', () => exit({ restore: false }));
}

cledit.ColumnSelection = ColumnSelection;
