/**
 * Node harness for scrollSync suppressor (batch-6 #013).
 * Run: node test/unit/harness/scrollSyncSuppress.harness.mjs
 */
import assert from 'node:assert/strict';
import { createScrollSyncSuppressor } from '../../../src/services/editor/scrollSyncSuppress.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

// --- freshly created: not suppressed ---
{
  const s = createScrollSyncSuppressor();
  assert.equal(s.isSuppressed(), false);
}

// --- suppress() opens a window that isSuppressed() honors, then auto-expires ---
{
  const s = createScrollSyncSuppressor();
  s.suppress(120);
  assert.equal(s.isSuppressed(), true);
  await wait(140);
  assert.equal(s.isSuppressed(), false);
}

// --- default window duration is non-trivial and self-expiring ---
{
  const s = createScrollSyncSuppressor();
  s.suppress();
  assert.equal(s.isSuppressed(), true);
  await wait(260);
  assert.equal(s.isSuppressed(), false);
}

// --- re-suppression extends the window past the first deadline ---
{
  const s = createScrollSyncSuppressor();
  s.suppress(120);
  await wait(60);
  s.suppress(120);
  await wait(60);
  assert.equal(s.isSuppressed(), true);
  await wait(120);
  assert.equal(s.isSuppressed(), false);
}

console.log('scrollSyncSuppress.harness: all assertions passed');
