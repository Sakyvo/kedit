import assert from 'node:assert/strict';
import { isDynamicLoadingEnabled } from '../../../src/services/editor/dynamicLoading.js';

assert.equal(isDynamicLoadingEnabled({ dynamicLoading: true }), true, 'explicit true => ON');
assert.equal(isDynamicLoadingEnabled({ dynamicLoading: false }), false, 'explicit false => OFF');
assert.equal(isDynamicLoadingEnabled(undefined), false, 'no settings => default OFF');
assert.equal(isDynamicLoadingEnabled(null), false, 'null settings => OFF');
assert.equal(isDynamicLoadingEnabled({}), false, 'empty settings => default OFF');
assert.equal(isDynamicLoadingEnabled({ segmentedLoading: true }), false, 'old key ignored');
assert.equal(isDynamicLoadingEnabled(['dynamic']), false, 'garbage => OFF');

console.log('dynamicLoadingGate.harness: all assertions passed');
