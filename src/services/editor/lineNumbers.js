// cledit keeps one final newline as its editable end-of-document sentinel.
export function sourceLineStarts(text) {
  const starts = [0];
  for (let offset = text.indexOf('\n'); offset !== -1; offset = text.indexOf('\n', offset + 1)) {
    if (offset + 1 < text.length) starts.push(offset + 1);
  }
  return starts;
}

// 行号总闸（与动态加载同构）：默认开，用户可显式关掉；旧配置缺该键即开启。
export const isLineNumbersEnabled = settings =>
  !settings || settings.lineNumbers !== false;

export default function mountLineNumbers(editor, enabled = true) {
  const content = editor.$contentElt;
  const scroller = editor.$scrollElt;
  const layer = document.createElement('div');
  layer.className = 'editor__line-numbers';
  layer.setAttribute('aria-hidden', 'true');
  scroller.parentNode.appendChild(layer);
  layer.style.visibility = enabled ? 'visible' : 'hidden';
  let text = editor.getContent();
  let starts = null;
  let groups = null;
  let frame = null;
  let disposed = false;
  const rows = new Map();

  // Cache DOM anchors after edits, never walk the text again on scroll.
  const indexLines = () => {
    const indexed = [];
    let offset = 0;
    let line = 0;
    Array.from(content.children).forEach((section) => {
      if (!section.classList.contains('cledit-section')) return;
      const anchors = [];
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const end = offset + node.length;
        while (line < starts.length && starts[line] < end) {
          const relative = starts[line] - offset;
          if (relative >= 0) {
            const range = document.createRange();
            range.setStart(node, relative);
            range.setEnd(node, relative + 1);
            // Chromium's newline text is hidden; its BR carries the row geometry.
            const br = node.parentElement.closest('.hd-lf')?.parentElement.querySelector('br');
            const lineBreak = node.parentElement.closest('.lf');
            anchors.push({ number: line + 1, range, br, lineBreak });
          }
          line += 1;
        }
        offset = end;
      }
      indexed.push({ section, anchors });
    });
    return indexed;
  };

  const draw = () => {
    frame = null;
    if (disposed || !content.isConnected) return;
    const width = layer.getBoundingClientRect().width;
    const space = `${width}px`;
    if (content.style.getPropertyValue('--editor-line-number-space') !== space) {
      content.style.setProperty('--editor-line-number-space', space);
    }
    const scrollRect = scroller.getBoundingClientRect();
    const contentStyle = getComputedStyle(content);
    layer.style.left = `${scroller.offsetLeft + parseFloat(contentStyle.paddingLeft) - width - 6}px`;
    if (!enabled) return;
    if (!starts) starts = sourceLineStarts(text);
    if (!groups) groups = indexLines();
    const positions = [];
    groups.forEach(({ section, anchors }) => {
      const sectionRect = section.getBoundingClientRect();
      if (!sectionRect.height || sectionRect.bottom < scrollRect.top
        || sectionRect.top > scrollRect.bottom) return;
      const rectAt = (index) => {
        const { range, br, lineBreak } = anchors[index];
        const rect = br ? br.getBoundingClientRect() : range.getClientRects()[0];
        if (!rect || !lineBreak) return rect;
        // Composition can replace BR with text inside the same shifted .lf.
        const shift = parseFloat(getComputedStyle(lineBreak).verticalAlign) || 0;
        return { top: rect.top + shift, bottom: rect.bottom + shift, height: rect.height };
      };
      // A single section can contain thousands of lines: seek the viewport first.
      let low = 0;
      let high = anchors.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const rect = rectAt(middle);
        if (rect && rect.bottom < scrollRect.top) low = middle + 1;
        else high = middle;
      }
      for (let index = low; index < anchors.length; index += 1) {
        const rect = rectAt(index);
        if (rect && rect.top > scrollRect.bottom) break;
        if (rect && rect.height && rect.bottom >= scrollRect.top) {
          positions.push({
            number: anchors[index].number,
            top: rect.top - scrollRect.top,
            height: rect.height,
          });
        }
      }
    });
    if (!text && !positions.length) {
      positions.push({ number: 1, top: content.offsetTop + parseFloat(contentStyle.paddingTop) - scroller.scrollTop, height: parseFloat(contentStyle.lineHeight) });
    }
    const visible = new Set();
    positions.forEach(({ number, top, height }) => {
      visible.add(number);
      let row = rows.get(number);
      if (!row) {
        row = document.createElement('span');
        row.className = 'editor__line-number';
        row.textContent = number;
        rows.set(number, row);
        layer.appendChild(row);
      }
      row.style.top = `${top}px`;
      row.style.lineHeight = `${height}px`;
    });
    rows.forEach((row, number) => {
      if (!visible.has(number)) {
        row.remove();
        rows.delete(number);
      }
    });
  };
  const schedule = () => {
    if (!disposed && frame === null) frame = requestAnimationFrame(draw);
  };
  const invalidate = () => {
    groups = null;
    if (enabled) schedule();
  };
  const onContent = (value) => {
    text = value;
    starts = null;
    invalidate();
  };
  const mutationObserver = new MutationObserver(invalidate);
  mutationObserver.observe(content, { childList: true, characterData: true, subtree: true });
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(content);
  resizeObserver.observe(scroller);
  const onScroll = () => { if (enabled) schedule(); };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  content.addEventListener('load', schedule, true);
  document.fonts.addEventListener('loadingdone', schedule);
  editor.on('contentChanged', onContent);
  editor.on('highlightedSectionsRefreshed', invalidate);
  const onDestroy = () => dispose(true);
  const dispose = (destroying = false) => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    mutationObserver.disconnect();
    resizeObserver.disconnect();
    scroller.removeEventListener('scroll', onScroll);
    content.removeEventListener('load', schedule, true);
    document.fonts.removeEventListener('loadingdone', schedule);
    editor.off('contentChanged', onContent);
    editor.off('highlightedSectionsRefreshed', invalidate);
    // Do not splice cledit's live listener array during its destroy dispatch.
    if (!destroying) editor.off('destroy', onDestroy);
    content.style.removeProperty('--editor-line-number-space');
    layer.remove();
  };
  editor.on('destroy', onDestroy);
  schedule();
  return {
    dispose,
    setEnabled(value) {
      enabled = value;
      layer.style.visibility = enabled ? 'visible' : 'hidden';
      if (!enabled) {
        rows.forEach(row => row.remove());
        rows.clear();
      }
      schedule();
    },
  };
}
