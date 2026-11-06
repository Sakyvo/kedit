import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import settingsYamlSvc, { DEFAULT_SYNC_EXCLUDES } from '../../src/services/settingsYamlSvc.js';

// The real production default, not a fixture copy: store/data.js merges the
// Author's custom yaml over exactly this file.
const defaultsText = readFileSync(
  new URL('../../src/data/defaults/defaultSettings.yml', import.meta.url),
  'utf8',
);
const defaults = yaml.load(defaultsText);
const merge = customText => settingsYamlSvc.mergeSettings(defaults, customText);

test('break-gap offsets default to -2 / +3 when the Author never set them', () => {
  const settings = merge('');
  assert.equal(settings.softWrapOffset, -2);
  assert.equal(settings.hardBreakOffset, 3);
});

test('an Author value overrides its own offset and leaves the other alone', () => {
  const settings = merge('softWrapOffset: 10\n');
  assert.equal(settings.softWrapOffset, 10);
  assert.equal(settings.hardBreakOffset, 3);
});

test('a non-numeric offset keeps the numeric default instead of poisoning the calc', () => {
  const settings = merge('softWrapOffset: "wide"\n');
  assert.equal(settings.softWrapOffset, -2);
});

test('both offsets travel with Sync and survive the projection', () => {
  assert.ok(!DEFAULT_SYNC_EXCLUDES.includes('softWrapOffset'));
  assert.ok(!DEFAULT_SYNC_EXCLUDES.includes('hardBreakOffset'));
  const projected = yaml.load(
    settingsYamlSvc.projectForSync('softWrapOffset: 10\nhardBreakOffset: 20\n'),
  );
  assert.equal(projected.softWrapOffset, 10);
  assert.equal(projected.hardBreakOffset, 20);
});

test('an older settings yaml without the offsets still resolves to the defaults', () => {
  const settings = merge('fontSizeFactor: 1.5\n');
  assert.equal(settings.softWrapOffset, -2);
  assert.equal(settings.hardBreakOffset, 3);
});
