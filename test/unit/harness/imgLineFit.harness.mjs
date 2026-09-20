/**
 * Harness for the inline image cap memory (batch 016 slice 1).
 * Run: node test/unit/harness/imgLineFit.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  fitImgWrapper,
  applyRememberedCap,
} from '../../../src/services/editor/imgLineFit.js';

// --- minimal DOM shim ---
const SECTION_RIGHT = 600;

// Text the marker-prefix Range reports; `right` is the last preceding rect's
// right edge, which is what the marker room is measured from.
let rangePrefix = 'plain text line\n';
let rangeRight = 0;

globalThis.document = {
  createRange: () => ({
    selectNodeContents() {},
    setEndBefore() {},
    toString: () => rangePrefix,
    getClientRects: () => [{ right: rangeRight }],
  }),
};

const section = {
  getBoundingClientRect: () => ({
    left: 0, right: SECTION_RIGHT, top: 0, bottom: 100,
  }),
};
globalThis.getComputedStyle = () => ({ fontSize: '16px', paddingRight: '0px' });

function makeWrapper(uri, naturalWidth) {
  const img = {
    getAttribute: name => (name === 'data-img-uri' ? uri : null),
    naturalWidth,
  };
  return {
    style: { maxWidth: '' },
    className: 'token img-wrapper',
    parentNode: section,
    querySelector: sel => (sel === 'img' ? img : null),
    closest: sel => (sel === '.cledit-section' ? section : null),
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
  };
}

const slackAt16px = (0.4 * 16) + 2; // 8.4 — SLACK_EM * fontSize + 2

// ---------------------------------------------------------------------------
// Own-line branch (no marker prefix)
// ---------------------------------------------------------------------------

// 1) A wide image on its own line gets capped to the line room; the cap is remembered.
{
  const w1 = makeWrapper('/imgs/wide.png', 2000);
  assert.equal(fitImgWrapper(w1), true, 'first fit writes a cap');
  const cap = w1.style.maxWidth;
  assert.match(cap, /^\d+px$/, 'cap is a px value');
  assert.equal(
    parseInt(cap, 10),
    Math.floor(SECTION_RIGHT - slackAt16px),
    'own-line usable room = floor(section width - slack)',
  );

  // 2) A freshly rebuilt wrapper for the same URI gets that cap synchronously,
  //    with no measuring call at all (that is what kills the typing jump).
  const w2 = makeWrapper('/imgs/wide.png', 2000);
  assert.equal(w2.style.maxWidth, '', 'new wrapper starts unset');
  applyRememberedCap(w2);
  assert.equal(w2.style.maxWidth, cap, 'rebuilt card carries the remembered cap on frame 1');
}

// 3) An unknown URI gets nothing (document first render — expected one-frame lag).
{
  const fresh = makeWrapper('/imgs/brand-new.png', 2000);
  applyRememberedCap(fresh);
  assert.equal(fresh.style.maxWidth, '', 'no memory → untouched');
}

// 4) A card that fits naturally clears the cap AND the memory entry.
{
  const w = makeWrapper('/imgs/small.png', 100);
  assert.equal(fitImgWrapper(w), false, 'natural width fits → no cap written');
  assert.equal(w.style.maxWidth, '', 'stays uncapped');
  const rebuilt = makeWrapper('/imgs/small.png', 100);
  applyRememberedCap(rebuilt);
  assert.equal(rebuilt.style.maxWidth, '', 'nothing remembered for a fitting card');
}

// 5) Memory tracks the latest cap: a different font size rewrites it.
{
  const w = makeWrapper('/imgs/wide.png', 2000);
  fitImgWrapper(w);
  const before = w.style.maxWidth;
  globalThis.getComputedStyle = () => ({ fontSize: '32px', paddingRight: '0px' });
  const w2 = makeWrapper('/imgs/wide.png', 2000);
  fitImgWrapper(w2);
  assert.notEqual(w2.style.maxWidth, before, 'font-size change re-fits');
  const rebuilt = makeWrapper('/imgs/wide.png', 2000);
  applyRememberedCap(rebuilt);
  assert.equal(rebuilt.style.maxWidth, w2.style.maxWidth, 'memory holds the newest cap');
  globalThis.getComputedStyle = () => ({ fontSize: '16px', paddingRight: '0px' });
}

// 6) A pre-capped wrapper is never overwritten by the memory.
{
  const w = makeWrapper('/imgs/wide.png', 2000);
  w.style.maxWidth = '123px';
  applyRememberedCap(w);
  assert.equal(w.style.maxWidth, '123px', 'existing inline cap wins');
}

// ---------------------------------------------------------------------------
// Marker-prefix branch (`- ` / `> ` / …) — always capped, never cleared by fit
// ---------------------------------------------------------------------------

// 7) A pure-marker prefix caps to the room left after the marker glyphs.
{
  rangePrefix = '- ';
  rangeRight = 20; // marker glyphs end 20px in
  const w = makeWrapper('/imgs/marker.png', 2000);
  assert.equal(fitImgWrapper(w), true, 'marker-line card is capped');
  assert.equal(
    parseInt(w.style.maxWidth, 10),
    Math.floor(SECTION_RIGHT - 20 - slackAt16px),
    'marker room = floor(section right - marker right edge - slack)',
  );

  // 8) The marker cap is remembered too, so the rebuilt card holds the marker line.
  const rebuilt = makeWrapper('/imgs/marker.png', 2000);
  applyRememberedCap(rebuilt);
  assert.equal(rebuilt.style.maxWidth, w.style.maxWidth, 'marker cap survives a rebuild');
}

// 9) The 4em fallback: a card that WAS capped, then loses its room, drops both
//    the cap and its memory entry (no stale cap survives to the next frame).
{
  rangePrefix = '- - - - - - - - - - - - - - - - - ';
  const wide = makeWrapper('/imgs/narrow.png', 2000);
  rangeRight = 20;
  assert.equal(fitImgWrapper(wide), true, 'room available → capped');
  assert.notEqual(wide.style.maxWidth, '', 'cap written while room exists');

  rangeRight = SECTION_RIGHT - 5; // only 5px left: below MIN_FIT_EM (64px)
  const w = makeWrapper('/imgs/narrow.png', 2000);
  w.style.maxWidth = wide.style.maxWidth; // card kept its old cap across a layout change
  assert.equal(fitImgWrapper(w), true, 'too-narrow card changes state');
  assert.equal(w.style.maxWidth, '', 'cap cleared in the 4em fallback');
  const rebuilt = makeWrapper('/imgs/narrow.png', 2000);
  applyRememberedCap(rebuilt);
  assert.equal(rebuilt.style.maxWidth, '', 'no stale cap remembered after the fallback');

  // 10) Widening again re-caps (the fallback is not sticky).
  rangeRight = 20;
  const wider = makeWrapper('/imgs/narrow.png', 2000);
  assert.equal(fitImgWrapper(wider), true, 're-caps once room returns');
  assert.notEqual(wider.style.maxWidth, '', 'cap restored');
}

// 11) An ordinary text prefix is NOT treated as a marker line: the card falls
//     back to its own-line rule (fixed natural size when it fits).
{
  rangePrefix = 'some prose before the image\n';
  rangeRight = 20;
  const w = makeWrapper('/imgs/prose.png', 100);
  assert.equal(fitImgWrapper(w), false, 'prose prefix → own-line branch, no cap when it fits');
  assert.equal(w.style.maxWidth, '', 'no cap written');
}

// 12) Range reports no rects / no ancestors: never throws, never caps.
{
  rangePrefix = '- ';
  rangeRight = 20;
  const orphan = makeWrapper('/imgs/orphan.png', 2000);
  orphan.parentNode = null; // measureMarkerPrefixRoom bails
  orphan.closest = () => null; // measureInlineRoom bails
  assert.equal(fitImgWrapper(orphan), false, 'unmeasurable card is left alone');
  assert.equal(orphan.style.maxWidth, '', 'no cap without a section');
}

console.log('imgLineFit cap-memory harness: all assertions passed');