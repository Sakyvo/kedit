/**
 * Harness for the inline image cap memory (batch 016 slice 1).
 * Run: node test/unit/harness/imgLineFit.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  fitImgWrapper,
  applyRememberedCap,
} from '../../../src/services/editor/imgLineFit.js';

// --- minimal DOM shim: an own-line card (no marker prefix) ---
const SECTION_LEFT = 0;
const SECTION_RIGHT = 600;

function makeRangeShim(text) {
  return {
    selectNodeContents() {},
    setEndBefore() {},
    toString: () => text,
    getClientRects: () => [{ right: 0 }],
  };
}

globalThis.document = {
  createRange: () => makeRangeShim('plain text line\n'),
};

const section = {
  getBoundingClientRect: () => ({
    left: SECTION_LEFT, right: SECTION_RIGHT, top: 0, bottom: 100,
  }),
};
globalThis.getComputedStyle = () => ({ fontSize: '16px', paddingRight: '0px' });

function makeWrapper(uri, naturalWidth) {
  const img = {
    getAttribute: name => (name === 'data-img-uri' ? uri : null),
    naturalWidth,
  };
  const wrapper = {
    style: { maxWidth: '' },
    className: 'token img-wrapper',
    querySelector: sel => (sel === 'img' ? img : null),
    closest: sel => (sel === '.cledit-section' ? section : null),
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
  };
  return wrapper;
}

// 1) A wide image on its own line gets capped to the line room; the cap is remembered.
{
  const w1 = makeWrapper('/imgs/wide.png', 2000);
  const changed1 = fitImgWrapper(w1);
  assert.equal(changed1, true, 'first fit writes a cap');
  const cap = w1.style.maxWidth;
  assert.match(cap, /^\d+px$/, 'cap is an px value');
  assert.equal(parseInt(cap, 10), Math.floor(600 - ((0.4 * 16) + 2)), 'usable room = floor(section width - slack)');

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

// 5) Memory tracks the latest cap: a wider section rewrites it.
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
}

// 6) A pre-capped wrapper is never overwritten by the memory.
{
  const w = makeWrapper('/imgs/wide.png', 2000);
  w.style.maxWidth = '123px';
  applyRememberedCap(w);
  assert.equal(w.style.maxWidth, '123px', 'existing inline cap wins');
}

console.log('imgLineFit cap-memory harness: all assertions passed');
