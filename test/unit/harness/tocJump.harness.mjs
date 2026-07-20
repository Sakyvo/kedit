/**
 * Node harness for shipped tocJump helpers (no Jest).
 * Run: node test/unit/harness/tocJump.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  findSectionIndexByTocElt,
  resolveLiveEditorElt,
  resolveLivePreviewElt,
  offsetTopInScroller,
  clampScrollTop,
  computeTocJumpScrollTop,
  computeTocJumpTargets,
} from '../../../src/services/editor/tocJump.js';

function mockElt({ offsetTop = 0, parentNode = null, isConnected = true, children } = {}) {
  const elt = {
    offsetTop,
    offsetParent: parentNode,
    parentNode,
    isConnected,
    children: children || [],
  };
  return elt;
}

// --- findSectionIndexByTocElt ---
{
  const t0 = {};
  const t1 = {};
  const list = [{ tocElt: t0 }, { tocElt: t1 }];
  assert.equal(findSectionIndexByTocElt(list, t1), 1);
  assert.equal(findSectionIndexByTocElt(list, {}), -1);
  assert.equal(findSectionIndexByTocElt(null, t0), -1);
}

// --- resolveLiveEditorElt prefers sectionList when connected ---
{
  const live = mockElt({ isConnected: true, offsetTop: 100 });
  const stale = mockElt({ isConnected: false, offsetTop: 0 });
  const sectionDesc = { editorElt: stale };
  const sectionList = [{ elt: mockElt() }, { elt: live }];
  assert.equal(resolveLiveEditorElt(sectionDesc, sectionList, 1), live);
}

// --- falls back to sectionDesc when list elt detached ---
{
  const attached = mockElt({ isConnected: true });
  const detached = mockElt({ isConnected: false });
  const sectionDesc = { editorElt: attached };
  const sectionList = [{ elt: detached }];
  assert.equal(resolveLiveEditorElt(sectionDesc, sectionList, 0), attached);
}

// --- resolveLivePreviewElt ---
{
  const live = mockElt({ isConnected: true });
  assert.equal(resolveLivePreviewElt({ previewElt: live }, null, 0), live);
  const child = mockElt({ isConnected: true });
  const root = { children: [child] };
  assert.equal(resolveLivePreviewElt({ previewElt: mockElt({ isConnected: false }) }, root, 0), child);
}

// --- offset + clamp ---
{
  const scroller = mockElt({ offsetTop: 0 });
  scroller.scrollHeight = 1000;
  scroller.clientHeight = 200;
  const child = mockElt({ offsetTop: 350, parentNode: scroller });
  child.offsetParent = scroller;
  assert.equal(offsetTopInScroller(child, scroller), 350);
  assert.equal(clampScrollTop(350, scroller), 350);
  assert.equal(clampScrollTop(9999, scroller), 800);
  assert.equal(clampScrollTop(-10, scroller), 0);
}

// --- computeTocJumpScrollTop editor path uses live list, not detached cache ---
{
  const scroller = { scrollHeight: 2000, clientHeight: 400, offsetTop: 0 };
  const live = mockElt({ offsetTop: 500, parentNode: scroller, isConnected: true });
  live.offsetParent = scroller;
  const stale = mockElt({ offsetTop: 0, isConnected: false });
  const sectionDesc = { editorElt: stale };
  const top = computeTocJumpScrollTop({
    mode: 'editor',
    sectionDesc,
    sectionList: [{ elt: live }],
    index: 0,
    editorScroller: scroller,
  });
  assert.equal(top, 500);
}

// --- detached-only returns null for editor ---
{
  const scroller = { scrollHeight: 2000, clientHeight: 400 };
  const top = computeTocJumpScrollTop({
    mode: 'editor',
    sectionDesc: { editorElt: mockElt({ isConnected: false }) },
    sectionList: [{ elt: mockElt({ isConnected: false }) }],
    index: 0,
    editorScroller: scroller,
  });
  assert.equal(top, null);
}

// --- computeTocJumpTargets: side-by-side teleports BOTH panes (no catch-up animation) ---
{
  const editorScroller = { scrollHeight: 2000, clientHeight: 400 };
  const previewScroller = { scrollHeight: 3000, clientHeight: 400 };
  const editorLive = mockElt({ offsetTop: 500, isConnected: true });
  editorLive.offsetParent = editorScroller;
  const previewLive = mockElt({ offsetTop: 700, isConnected: true });
  previewLive.offsetParent = previewScroller;
  const args = {
    sectionDesc: { editorElt: editorLive, previewElt: previewLive },
    sectionList: [{ elt: editorLive }],
    index: 0,
    editorScroller,
    previewRoot: { children: [previewLive] },
    previewScroller,
  };
  const both = computeTocJumpTargets({ showEditor: true, showSidePreview: true, ...args });
  assert.equal(both.editor, 500);
  assert.equal(both.preview, 700);

  // Editor-only layout: no preview target
  const editorOnly = computeTocJumpTargets({ showEditor: true, showSidePreview: false, ...args });
  assert.equal(editorOnly.editor, 500);
  assert.equal(editorOnly.preview, null);

  // Preview-only layout: no editor target (hidden editor geometry is unreliable)
  const previewOnly = computeTocJumpTargets({ showEditor: false, showSidePreview: false, ...args });
  assert.equal(previewOnly.editor, null);
  assert.equal(previewOnly.preview, 700);
}

console.log('tocJump.harness: all assertions passed');
