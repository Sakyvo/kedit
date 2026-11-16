import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// ADR 0017: divider appearance is owned by KEDIT. Once that is pinned with
// !important, a theme's hr / .hr rule is dead code — and worse, it teaches the
// next theme author a pattern that no longer works.
const themeFiles = readdirSync('static/themes');
const previewThemes = themeFiles.filter(name => name.startsWith('preview-theme-'));
const editThemes = themeFiles.filter(name => name.startsWith('edit-theme-'));
const read = name => readFileSync(`static/themes/${name}`, 'utf8');

test('the batch sees the theme files it is supposed to clean', () => {
  assert.ok(previewThemes.length >= 7, `only ${previewThemes.length} preview themes`);
  assert.ok(editThemes.length >= 15, `only ${editThemes.length} edit themes`);
});

test('no built-in preview theme styles the divider any more', () => {
  for (const name of previewThemes) {
    const css = read(name);
    // e.g. `.preview-theme--jikebrack hr {` / `.preview-theme--jikebrack hr {`
    assert.doesNotMatch(css, /\.preview-theme--[\w-]+ hr\s*\{/, `${name} still styles hr`);
  }
});

test('no built-in edit theme lists .hr among its muted-token selectors', () => {
  for (const name of editThemes) {
    const css = read(name);
    assert.doesNotMatch(css, /\.editor__inner \.hr\b/, `${name} still styles .hr`);
  }
});

test('no built-in preview theme keeps a divider hint that no longer works', () => {
  for (const name of previewThemes) {
    const css = read(name);
    // `border-top` alone is legitimate on blockquotes / headings / code blocks,
    // so the check is the orphaned divider hint itself.
    assert.doesNotMatch(css, /分隔线/, `${name} still hints at a divider rule`);
  }
});

test('the neighbouring link tokens survive the removal', () => {
  for (const name of editThemes) {
    const css = read(name);
    assert.match(css, /\.editor__inner \.link\b/, `${name} lost .link`);
    assert.match(css, /\.editor__inner \.linkref\b/, `${name} lost .linkref`);
  }
});
