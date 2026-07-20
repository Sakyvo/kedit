/**
 * Node harness for layout remeasure orchestration (batch #008).
 * Run: node test/unit/harness/layoutRemeasure.harness.mjs
 */
import assert from 'node:assert/strict';
import { createLayoutRemeasure } from '../../../src/services/editor/layoutRemeasure.js';

// --- flush happens synchronously, before the frame is scheduled ---
{
  const order = [];
  let frameCb;
  const handler = createLayoutRemeasure({
    saveContentState: () => order.push('save'),
    measure: () => order.push('measure'),
    requestFrame: (cb) => { order.push('requestFrame'); frameCb = cb; return 1; },
    cancelFrame: () => {},
  });
  handler();
  assert.deepEqual(order, ['save', 'requestFrame']);
  frameCb();
  assert.deepEqual(order, ['save', 'requestFrame', 'measure']);
}

// --- re-entry before the frame fires cancels the pending frame (coalescing) ---
{
  const cancelled = [];
  let nextId = 10;
  const handler = createLayoutRemeasure({
    saveContentState: () => {},
    measure: () => {},
    requestFrame: () => { nextId += 1; return nextId; },
    cancelFrame: id => cancelled.push(id),
  });
  handler();
  handler();
  assert.deepEqual(cancelled, [undefined, 11]);
}

// --- every invocation flushes the snapshot ---
{
  let saves = 0;
  const handler = createLayoutRemeasure({
    saveContentState: () => { saves += 1; },
    measure: () => {},
    requestFrame: () => 0,
    cancelFrame: () => {},
  });
  handler();
  handler();
  handler();
  assert.equal(saves, 3);
}

console.log('layoutRemeasure.harness: all assertions passed');
