import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { isTextAboveImages, IMAGE_ABOVE, TEXT_ABOVE } from '../../src/services/editor/inlineImageOrder.js';
import settingsYamlSvc, { DEFAULT_SYNC_EXCLUDES } from '../../src/services/settingsYamlSvc.js';
import settingsFields from '../../src/components/modals/settings/settingsFields.js';

const shipped = yaml.load(readFileSync(new URL('../../src/data/defaults/defaultSettings.yml', import.meta.url), 'utf8'));

test('images stay above their source text by default, including for old settings', () => {
  assert.equal(isTextAboveImages(undefined), false);
  assert.equal(isTextAboveImages({}), false);
  assert.equal(isTextAboveImages({ editor: {} }), false);
  assert.equal(isTextAboveImages({ editor: { inlineImageOrder: 'image-above' } }), false);
  assert.equal(isTextAboveImages({ editor: { inlineImageOrder: 'text-above' } }), true);
  assert.equal(isTextAboveImages({ editor: { inlineImageOrder: 'bogus' } }), false);
});

test('the shipped default is image-above and survives merging with an old custom yaml', () => {
  assert.equal(shipped.editor.inlineImageOrder, IMAGE_ABOVE);
  assert.equal(settingsYamlSvc.mergeSettings(shipped, '').editor.inlineImageOrder, IMAGE_ABOVE);
  assert.equal(
    settingsYamlSvc.mergeSettings(shipped, 'editor:\n  inlineImages: true\n').editor.inlineImageOrder,
    IMAGE_ABOVE,
  );
  assert.equal(
    settingsYamlSvc.mergeSettings(shipped, `editor:\n  inlineImageOrder: ${TEXT_ABOVE}\n`).editor.inlineImageOrder,
    TEXT_ABOVE,
  );
});

test('the image order follows Sync instead of being device-local', () => {
  assert.ok(!DEFAULT_SYNC_EXCLUDES.includes('editor.inlineImageOrder'));
  const projection = settingsYamlSvc.projectForSync(`colorTheme: dark\neditor:\n  inlineImageOrder: ${TEXT_ABOVE}\n`);
  assert.match(projection, /inlineImageOrder: text-above/);
  assert.doesNotMatch(projection, /colorTheme/);
});

test('the setting sits in the performance group right below 显示行号', () => {
  const group = settingsFields.find(g => g.title === '性能');
  assert.deepEqual(group.fields.map(f => f.path.join('.')), [
    'dynamicLoading', 'dynamicLoadingThreshold', 'lineNumbers', 'editor.inlineImageOrder',
  ]);
  const field = group.fields[3];
  assert.equal(field.type, 'select');
  assert.equal(field.label, '图片显示');
  assert.deepEqual(field.options, [
    { value: 'image-above', label: '图片在上' },
    { value: 'text-above', label: '文本在上' },
  ]);
});
