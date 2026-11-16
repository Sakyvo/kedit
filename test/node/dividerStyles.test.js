import test from 'node:test';
import assert from 'node:assert/strict';
import sass from 'sass';
import { parseRules, declarationFor, selectorsMentioning } from './support/cssRules.mjs';

const compile = path => parseRules(sass.compile(path, {
  loadPaths: ['src/styles'],
  logger: sass.Logger.silent,
}).css);

const editorRules = compile('src/styles/markdownHighlighting.scss');
const previewRules = compile('src/styles/base.scss');

// The tier palette is fixed by ADR 0017; these literals are the independent
// source of truth the stylesheets must agree with.
const BLUE = { light: '#2e86c8', dark: '#6fb5e6' };
const RED = { light: '#c0392b', dark: '#e5735f' };
const NEUTRAL = { light: 'rgba(0, 0, 0, 0.28)', dark: 'rgba(255, 255, 255, 0.28)' };

test('the editor marker run is coloured per tier and cannot be recoloured by a theme', () => {
  assert.equal(
    declarationFor(editorRules, '.markdown-highlighting .hr', 'color'),
    `${NEUTRAL.light} !important`,
  );
  assert.equal(
    declarationFor(editorRules, '.app--dark .markdown-highlighting .hr', 'color'),
    `${NEUTRAL.dark} !important`,
  );
  assert.equal(
    declarationFor(editorRules, '.markdown-highlighting .hr-strong', 'color'),
    `${BLUE.light} !important`,
  );
  assert.equal(
    declarationFor(editorRules, '.app--dark .markdown-highlighting .hr-strong', 'color'),
    `${BLUE.dark} !important`,
  );
  assert.equal(
    declarationFor(editorRules, '.markdown-highlighting .hr-strong--red', 'color'),
    `${RED.light} !important`,
  );
  assert.equal(
    declarationFor(editorRules, '.app--dark .markdown-highlighting .hr-strong--red', 'color'),
    `${RED.dark} !important`,
  );
});

test('the preview and exported rule is coloured per tier, pinned against themes', () => {
  const scope = ['.cl-preview-section hr', '.stackedit__html hr'];
  for (const selector of scope) {
    assert.equal(declarationFor(previewRules, selector, 'border-top'), '1px solid rgba(128, 128, 128, 0.33) !important');
    assert.equal(declarationFor(previewRules, selector, 'margin'), '2em 0 !important');
    assert.equal(declarationFor(previewRules, selector, 'padding'), '0 !important');
    assert.equal(declarationFor(previewRules, selector, 'background'), 'none !important');
    assert.equal(declarationFor(previewRules, selector, 'height'), '0 !important');
  }
  assert.equal(
    declarationFor(previewRules, '.cl-preview-section hr.kedit-hr-strong', 'border-top'),
    `2px solid ${BLUE.light} !important`,
  );
  assert.equal(
    declarationFor(previewRules, '.app--dark .cl-preview-section hr.kedit-hr-strong', 'border-top-color'),
    `${BLUE.dark} !important`,
  );
  assert.equal(
    declarationFor(previewRules, '.cl-preview-section hr.kedit-hr-strong--red', 'border-top'),
    `2px solid ${RED.light} !important`,
  );
  assert.equal(
    declarationFor(previewRules, '.app--dark .cl-preview-section hr.kedit-hr-strong--red', 'border-top-color'),
    `${RED.dark} !important`,
  );
  assert.equal(
    declarationFor(previewRules, '.stackedit__html hr.kedit-hr-strong--red', 'border-top'),
    `2px solid ${RED.light} !important`,
  );
});

test('the divider firewall stays scoped to preview and export containers', () => {
  // The app's own chrome (menus, side bar, about modal) keeps its own hr style:
  // no global hr rule may carry the pinned declarations.
  const globalHrSelectors = selectorsMentioning(previewRules, 'hr')
    .filter(selector => selector.split(', ').includes('hr'));
  assert.ok(globalHrSelectors.length > 0, 'a bare hr rule still exists for app chrome');
  assert.notEqual(declarationFor(previewRules, 'hr', 'border-top'), '1px solid rgba(128, 128, 128, 0.33) !important');
  assert.equal(declarationFor(previewRules, 'hr', 'border-top'), '1px solid rgba(128, 128, 128, 0.33)');
});
