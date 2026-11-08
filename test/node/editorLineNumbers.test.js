import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceLineStarts, isLineNumbersEnabled } from '../../src/services/editor/lineNumbers.js';
import settingsYamlSvc, { DEFAULT_SYNC_EXCLUDES } from '../../src/services/settingsYamlSvc.js';
import settingsFields from '../../src/components/modals/settings/settingsFields.js';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

test('source lines include empty lines but not cledit’s mandatory final newline', () => {
  assert.deepEqual(sourceLineStarts(''), [0]);
  assert.deepEqual(sourceLineStarts('\n'), [0]);
  assert.deepEqual(sourceLineStarts('hello\n'), [0]);
  assert.deepEqual(sourceLineStarts('hello\n\n'), [0, 6]);
  assert.deepEqual(sourceLineStarts('one\n\nthree\n'), [0, 4, 5]);
  assert.deepEqual(sourceLineStarts('one\nlast'), [0, 4]);
  assert.deepEqual(sourceLineStarts('中文\n😀\n'), [0, 3]);
});

test('line numbers are on by default, including for an old settings object', () => {
  assert.equal(isLineNumbersEnabled(undefined), true);
  assert.equal(isLineNumbersEnabled({}), true);
  assert.equal(isLineNumbersEnabled({ dynamicLoading: false }), true);
  assert.equal(isLineNumbersEnabled({ lineNumbers: true }), true);
  assert.equal(isLineNumbersEnabled({ lineNumbers: false }), false);
});

test('the line-number setting follows Sync instead of being device-local', () => {
  assert.ok(!DEFAULT_SYNC_EXCLUDES.includes('lineNumbers'));
  const projection = settingsYamlSvc.projectForSync('colorTheme: dark\nlineNumbers: false\n');
  assert.match(projection, /lineNumbers: false/);
  assert.doesNotMatch(projection, /colorTheme/);
});

test('the toggle sits in the performance group right after the dynamic-loading pair', () => {
  const group = settingsFields.find(g => g.title === '性能');
  assert.deepEqual(group.fields.map(f => f.path.join('.')), [
    'dynamicLoading', 'dynamicLoadingThreshold', 'lineNumbers',
  ]);
  const field = group.fields[2];
  assert.equal(field.type, 'toggle');
  assert.equal(field.label, '显示行号');
});

test('an explicit off value survives merging with the shipped defaults', () => {
  const shipped = yaml.load(readFileSync(new URL('../../src/data/defaults/defaultSettings.yml', import.meta.url), 'utf8'));
  assert.equal(settingsYamlSvc.mergeSettings(shipped, '').lineNumbers, true);
  assert.equal(settingsYamlSvc.mergeSettings(shipped, 'lineNumbers: false').lineNumbers, false);
});
