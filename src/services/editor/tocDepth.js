/**
 * Whole-TOC outline depth pass (batch-A #039).
 *
 * refreshPreview updates the TOC DOM incrementally via a section diff, but a
 * heading's indent depth depends on the whole document prefix. Unchanged
 * sections keep stale `dataset.outlineDepth` values, and freshly rendered
 * sections compute against a stack that never saw the unchanged ancestors —
 * typing `#` to change a heading level therefore corrupts alignment until a
 * full rebuild. This module recomputes depths over the final DOM order after
 * every refresh; `computeTocOutlineDepths` (tocJump.js) stays the tested
 * reference for the stack semantics.
 */

const headingTagNameMatcher = /^H[1-6]$/;

/**
 * ATX heading level per TOC section in document order (0 = no heading clone).
 */
export function collectTocHeadingLevels(tocElt) {
  const children = (tocElt && tocElt.children) || [];
  const levels = [];
  for (let i = 0; i < children.length; i += 1) {
    const headingElt = children[i].firstElementChild;
    levels.push(headingElt && headingTagNameMatcher.test(headingElt.tagName)
      ? Number(headingElt.tagName.slice(1))
      : 0);
  }
  return levels;
}

/**
 * Rewrite `dataset.outlineDepth` on every TOC section from the full document
 * order. Returns the number of entries whose depth actually changed, so an
 * unchanged document writes nothing.
 */
export function applyTocOutlineDepths(tocElt) {
  const levels = collectTocHeadingLevels(tocElt);
  const stack = [];
  let changedCount = 0;
  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    // Depth = number of strictly shallower ancestors before pushing this
    // heading (reference semantics: computeTocOutlineDepths in tocJump.js).
    // Sections without a heading clone keep no attribute, as before.
    let depth = null;
    if (level) {
      while (stack.length && stack[stack.length - 1] >= level) {
        stack.pop();
      }
      depth = stack.length;
      stack.push(level);
    }
    if (depth === null) {
      continue;
    }
    const depthStr = String(depth);
    const elt = tocElt.children[i];
    if (elt.dataset.outlineDepth !== depthStr) {
      elt.dataset.outlineDepth = depthStr;
      changedCount += 1;
    }
  }
  return changedCount;
}
