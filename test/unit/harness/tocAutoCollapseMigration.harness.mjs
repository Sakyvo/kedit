/**
 * Node harness for shipped tocAutoCollapse migration helper (no Jest).
 * Run: node test/unit/harness/tocAutoCollapseMigration.harness.mjs
 *
 * Covers batch-A #040: the persisted layoutSettings key `tocAutoJump` was
 * renamed to `tocAutoCollapse` (the setting never controlled jumping, only
 * post-jump collapsing). One-shot idempotent migration moves the old value
 * and deletes the dead key.
 */
import assert from 'node:assert/strict';
import { migrateTocAutoCollapse } from '../../../src/services/editor/tocAutoCollapseMigration.js';

// Old value true -> new key true, old key gone
{
  const data = { tocAutoJump: true };
  assert.equal(migrateTocAutoCollapse(data), true);
  assert.equal(data.tocAutoCollapse, true);
  assert.equal('tocAutoJump' in data, false);
}

// Old value false survives (the Author turned it off on purpose); the return
// value reports "a migration write happened", not the setting value
{
  const data = { tocAutoJump: false };
  assert.equal(migrateTocAutoCollapse(data), true);
  assert.equal(data.tocAutoCollapse, false);
  assert.equal('tocAutoJump' in data, false);
}

// No old key: no-op, nothing written (fresh devices fall back to the default)
{
  const data = { sideBarPanel: 'menu' };
  assert.equal(migrateTocAutoCollapse(data), false);
  assert.equal('tocAutoCollapse' in data, false);
  assert.deepEqual(data, { sideBarPanel: 'menu' });
}

// Both keys present: the new key wins, the old one is removed (migration
// returns true — a write happened because the old key was deleted)
{
  const data = { tocAutoJump: false, tocAutoCollapse: true };
  assert.equal(migrateTocAutoCollapse(data), true);
  assert.equal(data.tocAutoCollapse, true);
  assert.equal('tocAutoJump' in data, false);
}

// Already migrated: idempotent, no second write
{
  const data = { tocAutoCollapse: false };
  assert.equal(migrateTocAutoCollapse(data), false);
  assert.deepEqual(data, { tocAutoCollapse: false });
}

// No input / non-object: safe no-op
{
  assert.equal(migrateTocAutoCollapse(null), false);
  assert.equal(migrateTocAutoCollapse(undefined), false);
  assert.equal(migrateTocAutoCollapse('x'), false);
}

console.log('tocAutoCollapseMigration.harness: all assertions passed');
