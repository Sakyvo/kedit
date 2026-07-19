/**
 * Live-DOM helpers for TOC jumps (batch-5 #002).
 * Never trust cached sectionDesc.editorElt after re-highlight.
 */

export function findSectionIndexByTocElt(sectionDescList, tocSectionElt) {
  if (!sectionDescList || !tocSectionElt) {
    return -1;
  }
  for (let i = 0; i < sectionDescList.length; i += 1) {
    if (sectionDescList[i].tocElt === tocSectionElt) {
      return i;
    }
  }
  return -1;
}

/**
 * Prefer live section element from current sectionList; fall back to
 * sectionDesc.editorElt only if still parented in the document.
 */
export function resolveLiveEditorElt(sectionDesc, sectionList, index) {
  const fromList = sectionList && sectionList[index] && sectionList[index].elt;
  if (fromList && fromList.isConnected) {
    return fromList;
  }
  if (sectionDesc && sectionDesc.editorElt && sectionDesc.editorElt.isConnected) {
    return sectionDesc.editorElt;
  }
  return null;
}

/**
 * Prefer attached preview section; else nth child under preview root.
 */
export function resolveLivePreviewElt(sectionDesc, previewRoot, index) {
  if (sectionDesc && sectionDesc.previewElt && sectionDesc.previewElt.isConnected) {
    return sectionDesc.previewElt;
  }
  if (previewRoot && previewRoot.children && previewRoot.children[index]) {
    const child = previewRoot.children[index];
    if (child && child.isConnected) {
      return child;
    }
  }
  return null;
}

export function offsetTopInScroller(elt, scrollerElt) {
  if (!elt || !scrollerElt) {
    return 0;
  }
  let offset = 0;
  let node = elt;
  while (node && node !== scrollerElt) {
    offset += node.offsetTop || 0;
    node = node.offsetParent;
  }
  return offset;
}

export function clampScrollTop(offset, scrollerElt) {
  if (!scrollerElt) {
    return Math.max(0, offset || 0);
  }
  const maxScrollTop = scrollerElt.scrollHeight - scrollerElt.clientHeight;
  return Math.max(0, Math.min(offset || 0, maxScrollTop));
}

/**
 * Compute clamped scrollTop for a TOC jump.
 * @param {'editor'|'preview'} mode
 */
export function computeTocJumpScrollTop({
  mode,
  sectionDesc,
  sectionList,
  index,
  editorScroller,
  previewRoot,
  previewScroller,
}) {
  if (mode === 'editor') {
    const live = resolveLiveEditorElt(sectionDesc, sectionList, index);
    if (!live || !editorScroller) {
      return null;
    }
    return clampScrollTop(offsetTopInScroller(live, editorScroller), editorScroller);
  }
  const livePreview = resolveLivePreviewElt(sectionDesc, previewRoot, index);
  if (livePreview && previewScroller) {
    return clampScrollTop(offsetTopInScroller(livePreview, previewScroller), previewScroller);
  }
  if (sectionDesc && sectionDesc.previewDimension && previewScroller) {
    return clampScrollTop(sectionDesc.previewDimension.startOffset, previewScroller);
  }
  return null;
}
