import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLineStarts, lineNumberDigits } from '../../src/services/editor/lineNumbers.js';

test('source lines include empty lines but not cledit’s mandatory final newline', () => {
  assert.deepEqual(sourceLineStarts(''), [0]);
  assert.deepEqual(sourceLineStarts('\n'), [0]);
  assert.deepEqual(sourceLineStarts('hello\n'), [0]);
  assert.deepEqual(sourceLineStarts('hello\n\n'), [0, 6]);
  assert.deepEqual(sourceLineStarts('one\n\nthree\n'), [0, 4, 5]);
  assert.deepEqual(sourceLineStarts('one\nlast'), [0, 4]);
  assert.deepEqual(sourceLineStarts('中文\n😀\n'), [0, 3]);
});

test('line-number width is stable below 1000 and follows larger counts in either direction', () => {
  assert.deepEqual([1, 9, 10, 99, 100, 999, 1000, 10000, 999].map(lineNumberDigits),
    [3, 3, 3, 3, 3, 3, 4, 5, 3]);
});
