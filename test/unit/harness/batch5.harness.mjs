/**
 * Node harness for batch-5 pure helpers (002–007).
 * Run: node test/unit/harness/batch5.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  shouldInterceptBeforeInput,
  textFromBeforeInput,
  normalizeInsertText,
} from '../../../src/services/editor/beforeinputPaste.js';
import {
  buildCodeBlockInsert,
  buildInlineCodeInsert,
} from '../../../src/services/editor/codeFence.js';
import {
  shouldApplyNaturalSize,
  shouldRecordNaturalSize,
  dimensionsForPreset,
} from '../../../src/services/editor/imgSizeGuard.js';
import {
  shouldFetchRemoteThumb,
  markInFlight,
  clearInFlight,
} from '../../../src/services/imgThumbLazy.js';
import {
  isExplorerNodeDraggable,
  shouldToggleManualSortOnClick,
  isTouchDevice,
} from '../../../src/services/explorerDragGate.js';
import {
  findSectionIndexByTocElt,
  computeTocJumpScrollTop,
} from '../../../src/services/editor/tocJump.js';

// --- 003 beforeinput ---
assert.equal(shouldInterceptBeforeInput('insertFromPaste', 'a\nb'), true);
assert.equal(shouldInterceptBeforeInput('insertFromPasteAsPlainText', 'x'), true);
assert.equal(shouldInterceptBeforeInput('insertText', 'a\nb\nc'), true);
assert.equal(shouldInterceptBeforeInput('insertText', 'single'), false);
assert.equal(shouldInterceptBeforeInput('insertCompositionText', 'a\nb'), false);
assert.equal(normalizeInsertText('a\r\nb\rc'), 'a\nb\nc');
assert.equal(textFromBeforeInput('insertFromPaste', 'line1\nline2'), 'line1\nline2');
assert.equal(textFromBeforeInput('insertText', 'no-nl'), null);

// Browser-normal paste: data=null, payload on dataTransfer (must NOT no-op)
{
  const dt = {
    getData(type) {
      if (type === 'text/plain' || type === 'Text') {
        return 'line1\nline2\nline3';
      }
      return '';
    },
  };
  const resolved = textFromBeforeInput('insertFromPaste', null, dt);
  assert.equal(resolved, 'line1\nline2\nline3');
  // Empty dataTransfer → null (do not preventDefault)
  assert.equal(textFromBeforeInput('insertFromPaste', null, {
    getData() { return ''; },
  }), null);
  assert.equal(textFromBeforeInput('insertFromPaste', null, null), null);
  assert.equal(textFromBeforeInput('insertFromPasteAsPlainText', undefined, dt), 'line1\nline2\nline3');
  // data wins over dataTransfer when non-empty
  assert.equal(textFromBeforeInput('insertFromPaste', 'from-data\nx', dt), 'from-data\nx');
}

// --- 004 code fence ---
{
  const empty = buildCodeBlockInsert('');
  assert.equal(empty.block, '```\n\n```');
  assert.equal(empty.caretOffsetInBlock, 4);
  const wrapped = buildCodeBlockInsert('foo\nbar');
  assert.equal(wrapped.block, '```\nfoo\nbar\n```');
  const inline = buildInlineCodeInsert('x');
  assert.equal(inline.block, '`x`');
  const emptyInline = buildInlineCodeInsert('');
  assert.equal(emptyInline.block, '``');
}

// --- 005 img size ---
assert.equal(shouldApplyNaturalSize({
  mapUri: 'a.png', imgUri: 'a.png', hasExplicitWidth: false, hasExplicitHeight: false,
  naturalWidth: 100, naturalHeight: 200,
}), true);
assert.equal(shouldApplyNaturalSize({
  mapUri: 'a.png', imgUri: 'b.png', hasExplicitWidth: false, hasExplicitHeight: false,
  naturalWidth: 100, naturalHeight: 200,
}), false);
assert.equal(shouldApplyNaturalSize({
  mapUri: 'a.png', imgUri: 'a.png', hasExplicitWidth: true, hasExplicitHeight: false,
  naturalWidth: 100, naturalHeight: 200,
}), false);
assert.equal(shouldRecordNaturalSize({
  eventSrc: 'blob:1', imgSrc: 'blob:1', mapUri: 'a.png', imgUri: 'a.png',
  naturalWidth: 10, naturalHeight: 20,
}), true);
assert.equal(shouldRecordNaturalSize({
  eventSrc: 'blob:1', imgSrc: 'blob:2', mapUri: 'a.png', imgUri: 'a.png',
  naturalWidth: 10, naturalHeight: 20,
}), false);
{
  const d = dimensionsForPreset({ width: 800, height: 600 }, { stretchSafe: true });
  assert.equal(d.width, 800);
  assert.equal(d.height, null);
  assert.equal(d.useHeightAuto, true);
}

// --- 006 thumbs ---
assert.equal(shouldFetchRemoteThumb({ dataUrl: '', path: 'imgs/a.png', visible: true, inFlight: false }), true);
assert.equal(shouldFetchRemoteThumb({ dataUrl: 'data:x', path: 'imgs/a.png', visible: true, inFlight: false }), false);
assert.equal(shouldFetchRemoteThumb({ dataUrl: '', path: 'imgs/a.png', visible: false, inFlight: false }), false);
assert.equal(shouldFetchRemoteThumb({ dataUrl: '', path: 'imgs/a.png', visible: true, inFlight: true }), false);
{
  let s = new Set();
  s = markInFlight(s, 'p');
  assert.equal(s.has('p'), true);
  s = clearInFlight(s, 'p');
  assert.equal(s.has('p'), false);
}

// --- 007 drag gate ---
assert.equal(isExplorerNodeDraggable({
  sortBy: 'manual', manualSortEnabled: false, noDrag: false, isTouch: false,
}), true);
assert.equal(isExplorerNodeDraggable({
  sortBy: 'manual', manualSortEnabled: false, noDrag: false, isTouch: true,
}), false);
assert.equal(isExplorerNodeDraggable({
  sortBy: 'manual', manualSortEnabled: true, noDrag: false, isTouch: true,
}), true);
assert.equal(isExplorerNodeDraggable({
  sortBy: 'name', manualSortEnabled: false, noDrag: false, isTouch: false,
}), true);
assert.equal(isExplorerNodeDraggable({
  sortBy: 'manual', manualSortEnabled: true, noDrag: true, isTouch: false,
}), false);
assert.equal(shouldToggleManualSortOnClick(false), false);
assert.equal(shouldToggleManualSortOnClick(true), true);
assert.equal(isTouchDevice({}), false);
assert.equal(isTouchDevice({ ontouchstart: null }), true);

// --- 002 smoke ---
assert.equal(findSectionIndexByTocElt([{ tocElt: 'a' }, { tocElt: 'b' }], 'b'), 1);
{
  const scroller = { scrollHeight: 2000, clientHeight: 400 };
  const live = { offsetTop: 300, offsetParent: scroller, isConnected: true };
  const top = computeTocJumpScrollTop({
    mode: 'editor',
    sectionDesc: { editorElt: { isConnected: false, offsetTop: 0 } },
    sectionList: [{ elt: live }],
    index: 0,
    editorScroller: scroller,
  });
  assert.equal(top, 300);
}

console.log('batch5.harness: all assertions passed');
