/**
 * Node harness for pdir direct-publish pure helpers (batch-6 #009).
 * Run: node test/unit/harness/pdirPublish.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  findPdirToken,
  scanHeadings,
  parsePdirModules,
  replaceModuleBody,
  listPrivateImgRefs,
  stripFrontMatter,
  findForbiddenHeadings,
} from '../../../src/services/providers/helpers/pdirPublishUtils.js';

const MAIN = [
  '## Update Log',
  'log line',
  '',
  '## Part 1. Outra',
  '### 1.1. Clients',
  'clients body',
  '',
  '```',
  '### fake heading in fence',
  '```',
  '### 1.2. Packs',
  'packs body A',
  'packs body B',
  '',
  '## Part 2. In-Game',
  '### 2.1. Tutorial',
  'tutorial body',
].join('\n');

// --- findPdirToken ---
{
  const tokens = { a: { name: 'Sakyvo', sub: 'a' }, b: { name: 'other', sub: 'b' } };
  assert.equal(findPdirToken(tokens).sub, 'a');
  assert.equal(findPdirToken({ b: { name: 'other' } }), null);
  assert.equal(findPdirToken({}), null);
  assert.equal(findPdirToken(null), null);
}

// --- scanHeadings is fence-aware ---
{
  const headings = scanHeadings(MAIN);
  const titles = headings.map(h => h.title);
  assert.ok(titles.includes('1.2. Packs'));
  assert.ok(!titles.includes('fake heading in fence'));
  assert.deepEqual(headings.filter(h => h.level === 2).map(h => h.title), [
    'Update Log',
    'Part 1. Outra',
    'Part 2. In-Game',
  ]);
}

// --- parsePdirModules lists H3 modules only ---
{
  const modules = parsePdirModules(MAIN);
  assert.deepEqual(modules.map(m => m.title), ['1.1. Clients', '1.2. Packs', '2.1. Tutorial']);
}

// --- replaceModuleBody keeps heading, replaces body up to next H2/H3 ---
{
  const out = replaceModuleBody(MAIN, '1.2. Packs', 'NEW BODY');
  assert.ok(out.includes('### 1.2. Packs\n\nNEW BODY\n\n## Part 2. In-Game'));
  // Other modules untouched
  assert.ok(out.includes('clients body'));
  assert.ok(out.includes('tutorial body'));
  assert.ok(!out.includes('packs body A'));
  // Fenced fake heading stays in the clients module body
  assert.ok(out.includes('### fake heading in fence'));
}

// --- replaceModuleBody: last module runs to EOF ---
{
  const out = replaceModuleBody(MAIN, '2.1. Tutorial', 'TAIL');
  assert.ok(out.endsWith('### 2.1. Tutorial\n\nTAIL\n'));
}

// --- replaceModuleBody: unknown module -> null ---
{
  assert.equal(replaceModuleBody(MAIN, '9.9. Nope', 'X'), null);
}

// --- listPrivateImgRefs: only real /imgs/ image refs, fence-aware ---
{
  const doc = [
    '#### Title',
    '![test_img](/imgs/2026-07-20/a.png)',
    '![ext](https://example.com/x.png)',
    '```',
    '![fenced](/imgs/2026-07-20/b.png)',
    '```',
    '![输入图片说明](/imgs/2026-07-20/c.jpg)',
  ].join('\n');
  const refs = listPrivateImgRefs(doc);
  assert.deepEqual(refs.map(r => r.uri), ['/imgs/2026-07-20/a.png', '/imgs/2026-07-20/c.jpg']);
  assert.deepEqual(refs.map(r => r.alt), ['test_img', '输入图片说明']);
  assert.deepEqual(listPrivateImgRefs('no imgs here'), []);
}

// --- #010 stripFrontMatter ---
{
  const doc = '---\ntitle: x\ntags: a\n---\n\n#### Body\ntext';
  assert.equal(stripFrontMatter(doc), '#### Body\ntext');
  // No front matter -> unchanged
  assert.equal(stripFrontMatter('#### Body\n---\nnot fm\n---'), '#### Body\n---\nnot fm\n---');
  // Unclosed front matter -> unchanged
  assert.equal(stripFrontMatter('---\ntitle: x\nno close'), '---\ntitle: x\nno close');
  // Closing with dots
  assert.equal(stripFrontMatter('---\na: 1\n...\nBody'), 'Body');
}

// --- #010 findForbiddenHeadings: level<=3 outside fences ---
{
  const doc = [
    '#### ok',
    '## bad part',
    '```',
    '# fenced fine',
    '```',
    '### bad module',
    '##### ok deep',
  ].join('\n');
  const violations = findForbiddenHeadings(doc);
  assert.deepEqual(violations.map(v => [v.line, v.level, v.title]), [
    [1, 2, 'bad part'],
    [5, 3, 'bad module'],
  ]);
  assert.deepEqual(findForbiddenHeadings('#### a\n##### b'), []);
}

console.log('pdirPublish.harness: all assertions passed');
