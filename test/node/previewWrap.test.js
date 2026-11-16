import test from 'node:test';
import assert from 'node:assert/strict';
import sass from 'sass';
import { parseRules, declarationFor } from './support/cssRules.mjs';

const css = sass.compile('src/styles/base.scss', {
  loadPaths: ['src/styles'],
  logger: sass.Logger.silent,
}).css;
const rules = parseRules(css);

test('preview and exported content wrap a string that has no soft-break opportunity', () => {
  for (const selector of ['.cl-preview-section', '.stackedit__html']) {
    assert.equal(
      declarationFor(rules, selector, 'overflow-wrap'),
      'anywhere',
      `${selector} must carry the same break rule as the editor's .editor__inner`,
    );
  }
});

test('code blocks keep their own horizontal scroll instead of being broken mid-token', () => {
  assert.equal(declarationFor(rules, 'pre > code', 'white-space'), 'pre');
});
