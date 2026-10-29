import cledit from './cleditCore';
import {
  normalizeSegments, columnText, applyColumnDeletion, deletionCaretOffset,
} from './cleditColumnUtils';

// Alt+拖拽瞬态矩形选择（ADR 0014）：overlay 独立于 cledit 选区/undo 主流程。
// 拖拽中画矩形；松开保持高亮（active），仅拦截 copy/cut/Backspace/Delete；
// 其余任何输入/点击/滚动/失焦即退出并恢复常规编辑。
function ColumnSelection(editor) {
  const contentElt = editor.$contentElt;
  const selectionMgr = editor.selectionMgr;
  let state = 'idle'; // idle | dragging | active
  let anchor = null; // 内容局部坐标 {x,y}
  let current = null;
  let segments = [];
  let overlayElt = null;

  const clientToLocal = (clientX, clientY) => {
    const rect = contentElt.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const localToClient = (x, y) => {
    const rect = contentElt.getBoundingClientRect();
    return { x: x + rect.left, y: y + rect.top };
  };

  // client 点 → 内容偏移。caretRangeFromPoint 命中 overlay 自身(空 div)或
  // 内容区之外时返回 null。
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

  // 二分找 [from, lineEnd] 内与 top 同一视觉行的最大偏移（wrapped 行内
  // top 单调不减）
  const rowEndWithTop = (from, top, lineEnd) => {
    let lo = from;
    let hi = lineEnd;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      const c = selectionMgr.getCoordinates(mid);
      if (c.top === top) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  };

  // 矩形（内容局部 px）→ 各行内容偏移区间。自上而下逐行采样左边界：
  // caret 落点行顶对齐后，取行中垂线的左/右 x 命中偏移；右边界超行尾或
  // 落到别的视觉行时收缩到本行末（短行/窄行截断语义）。
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

  const ensureOverlay = () => {
    if (!overlayElt) {
      contentElt.classList.add('cl-column-selection-host');
      editor.watcher.noWatch(() => {
        overlayElt = document.createElement('div');
        overlayElt.className = 'cl-column-selection';
        contentElt.appendChild(overlayElt);
      });
    }
  };
  const renderOverlay = (rect) => {
    ensureOverlay();
    overlayElt.style.cssText = `left:${rect.left}px;top:${rect.top}px`
      + `;width:${rect.width}px;height:${rect.height}px;`;
  };
  const removeOverlay = () => {
    if (overlayElt) {
      const elt = overlayElt;
      overlayElt = null;
      editor.watcher.noWatch(() => elt.remove());
    }
    contentElt.classList.remove('cl-column-selection-host');
  };

  const rectFromPoints = () => ({
    left: Math.min(anchor.x, current.x),
    top: Math.min(anchor.y, current.y),
    width: Math.abs(current.x - anchor.x),
    height: Math.abs(current.y - anchor.y),
  });

  const onScrollExit = () => exitColumn();
  const onAnyMouseDown = () => exitColumn();

  const performDelete = () => {
    if (state !== 'active' || !segments.length) {
      return;
    }
    const content = editor.getContent();
    const caret = deletionCaretOffset(content, segments);
    const text = applyColumnDeletion(content, segments);
    exitColumn();
    if (text !== content) {
      editor.undoMgr.setCurrentMode('single'); // 单个可撤销编辑
      editor.setContent(text);
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
    performDelete();
  };

  const NON_EXIT_KEYS = new Set(['shift', 'control', 'alt', 'meta', 'capslock', 'numlock', 'scrolllock']);
  const onKeyDown = (evt) => {
    if (state !== 'active') return;
    const key = `${evt.key}`.toLowerCase();
    if (NON_EXIT_KEYS.has(key)) return;
    const mod = evt.ctrlKey || evt.metaKey;
    if (mod && (key === 'c' || key === 'x')) return; // 交给 copy/cut 事件拦截
    if (!mod && (key === 'backspace' || key === 'delete')) {
      evt.preventDefault();
      evt.stopPropagation();
      performDelete();
      return;
    }
    if (key === 'escape') {
      evt.preventDefault();
      evt.stopPropagation();
      exitColumn();
      return;
    }
    // 其余任何输入 → 退出（不吞事件，交还常规编辑）
    exitColumn();
  };

  const onMouseMove = (evt) => {
    if (state !== 'dragging') return;
    current = clientToLocal(evt.clientX, evt.clientY);
    renderOverlay(rectFromPoints());
  };

  const bindTransient = () => {
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('copy', onCopy, true);
    window.addEventListener('cut', onCut, true);
    window.addEventListener('mousedown', onAnyMouseDown, true);
    const scrollElt = editor.$scrollElt;
    if (scrollElt) {
      scrollElt.addEventListener('scroll', onScrollExit, true);
    }
  };

  const endDrag = () => {
    if (state !== 'dragging') return;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    segments = computeSegments(rectFromPoints());
    if (!segments.length) {
      exitColumn();
      return;
    }
    state = 'active';
    bindTransient();
  };

  function exitColumn() {
    if (state === 'idle') return;
    state = 'idle';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', endDrag);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('copy', onCopy, true);
    window.removeEventListener('cut', onCut, true);
    window.removeEventListener('mousedown', onAnyMouseDown, true);
    const scrollElt = editor.$scrollElt;
    if (scrollElt) {
      scrollElt.removeEventListener('scroll', onScrollExit, true);
    }
    removeOverlay();
    segments = [];
    anchor = null;
    current = null;
  }

  const onMouseDown = (evt) => {
    if (state !== 'idle') return;
    if (!evt.altKey || evt.button !== 0) return;
    evt.preventDefault();
    evt.stopPropagation();
    state = 'dragging';
    anchor = clientToLocal(evt.clientX, evt.clientY);
    current = { ...anchor };
    const scrollElt = editor.$scrollElt;
    if (scrollElt) {
      scrollElt.addEventListener('scroll', onScrollExit, true);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', endDrag);
  };

  contentElt.addEventListener('mousedown', onMouseDown, true);
  editor.on('destroy', () => exitColumn());
}

cledit.ColumnSelection = ColumnSelection;
