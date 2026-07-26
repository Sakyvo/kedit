/**
 * Node harness for pdir direct-publish pure helpers (batch-6 #009).
 * Run: node test/unit/harness/pdirPublish.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  findPdirToken,
  scanHeadings,
  stripHeadingMarkup,
  parsePdirTargets,
  resolvePdirTarget,
  replacePdirTarget,
  findReplacedPdirTarget,
  listPrivateImgRefs,
  stripFrontMatter,
  validatePdirTargetContent,
  sanitizeImgName,
  computeGitBlobShaFromBase64,
  planImageUploads,
  rewriteImgRefs,
  UNNAMED_ALT,
} from '../../../src/services/providers/helpers/pdirPublishUtils.js';

const MAIN = [
  '## Update Log',
  'log line',
  '',
  '## 序',
  'intro line',
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
  '',
  '## Part 3. Video',
  'video intro',
  '### 3.1. OBS',
  'obs body',
  '### 3.2. Vegas',
  'vegas body',
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
    '序',
    'Part 1. Outra',
    'Part 2. In-Game',
    'Part 3. Video',
  ]);
}

// --- pdir heading labels strip Markdown/HTML markup ---
{
  assert.equal(stripHeadingMarkup('**A** &amp; [B](https://example.com)'), 'A & B');
}

// --- parsePdirTargets mirrors the pdir admin edit-unit order ---
{
  const targets = parsePdirTargets(MAIN);
  assert.deepEqual(targets.map(target => target.label), [
    'ALL IN ONE',
    'main',
    'Update Log',
    '序',
    'Part 1. Outra',
    'Part 2. In-Game',
    '3.1. OBS',
    '3.2. Vegas',
  ]);
  assert.deepEqual(targets.map(target => target.type), [
    'all', 'main', 'h2', 'h2', 'h2', 'h2', 'h3', 'h3',
  ]);
  assert.equal(resolvePdirTarget(targets, { module: '3.1. OBS' }).key, 'h3-3.1.-obs');
  assert.equal(resolvePdirTarget(targets, { targetKey: 'main' }).label, 'main');
}

// --- replacePdirTarget replaces the complete target range ---
{
  const target = parsePdirTargets(MAIN).find(item => item.label === 'Part 1. Outra');
  const out = replacePdirTarget(MAIN, target, '## Part 1. Replaced\n### 1.1. New\nNEW BODY');
  assert.ok(out.includes('## Part 1. Replaced\n### 1.1. New\nNEW BODY\n## Part 2. In-Game'));
  assert.ok(!out.includes('clients body'));
  assert.ok(!out.includes('packs body A'));
  assert.ok(out.includes('tutorial body'));
  const updated = findReplacedPdirTarget(out, target);
  assert.equal(updated.label, 'Part 1. Replaced');
  assert.equal(updated.key, 'h2-part-1.-replaced');
}

// --- all/main boundaries and missing-boundary fallback ---
{
  const targets = parsePdirTargets(MAIN);
  const boundaryLine = MAIN.split('\n').findIndex(line => line === '## Part 3. Video');
  assert.equal(targets.find(target => target.type === 'main').endLine, boundaryLine);
  assert.equal(targets.find(target => target.type === 'all').endLine, MAIN.split('\n').length);
  assert.deepEqual(
    parsePdirTargets('## A\n### nested\nbody').map(target => target.label),
    ['ALL IN ONE', 'main', 'A'],
  );
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

// --- target-aware structural validation and legacy body-only guard ---
{
  const targets = parsePdirTargets(MAIN);
  const obs = targets.find(target => target.label === '3.1. OBS');
  const part1 = targets.find(target => target.label === 'Part 1. Outra');
  const main = targets.find(target => target.type === 'main');
  const all = targets.find(target => target.type === 'all');
  assert.match(validatePdirTargetContent('#### Legacy body', obs), /H3 整段/);
  assert.equal(validatePdirTargetContent('### 3.1. OBS\n#### Child', obs), '');
  assert.match(validatePdirTargetContent('### 3.1. OBS\n### Sibling', obs), /会越出/);
  assert.equal(validatePdirTargetContent('## Renamed\n### Child', part1), '');
  assert.match(validatePdirTargetContent('## Part 3. Video', part1), /固定边界/);
  assert.equal(validatePdirTargetContent('## Part 1\n### Child', main), '');
  assert.match(validatePdirTargetContent('## Part 3. Video', main), /不能包含/);
  assert.equal(validatePdirTargetContent(MAIN, all), '');
  assert.match(validatePdirTargetContent('## No boundary', all), /恰好包含一个/);
}

// --- #011 sanitizeImgName ---
{
  assert.equal(sanitizeImgName('test_img'), 'test_img');
  assert.equal(sanitizeImgName('a/b:c*d'), 'abcd');
  assert.equal(sanitizeImgName('  my shot  '), 'my_shot');
  assert.equal(sanitizeImgName('???'), '');
}

// --- #011 computeGitBlobShaFromBase64 (known git value for "hello\n") ---
{
  assert.equal(
    computeGitBlobShaFromBase64('aGVsbG8K'),
    'ce013625030ba8dba906f756967f9e9ca394464a',
  );
}

// --- #011 planImageUploads ---
{
  const moduleBody = [
    'body text',
    '![](/imgs/137.png)',
    '![old](/imgs/kept_name.png)',
  ].join('\n');
  const mainMd = `### 3.1. OBS\n${moduleBody}\n### 3.2. Vegas\n![](/imgs/223.png)`;
  const repoFiles = [
    { name: '137.png', sha: 'sha-137' },
    { name: '223.png', sha: 'sha-223' },
    { name: 'kept_name.png', sha: 'sha-kept-old' },
    { name: 'other_module.png', sha: 'sha-other' },
  ];
  const refs = [
    { alt: 'test_img', uri: '/imgs/2026-07-20/a.png' },      // named, new file -> upload
    { alt: UNNAMED_ALT, uri: '/imgs/2026-07-20/b.png' },     // unnamed, sha matches 137 -> reuse
    { alt: UNNAMED_ALT, uri: '/imgs/2026-07-20/c.jpg' },     // unnamed, new -> 224.jpg
    { alt: 'kept_name', uri: '/imgs/2026-07-20/d.png' },     // named, module-owned, changed -> overwrite
    { alt: 'other_module', uri: '/imgs/2026-07-20/e.png' },  // named, foreign file -> (1) dodge
    { alt: 'test_img', uri: '/imgs/2026-07-20/f.png' },      // batch dup name -> (1)
    { alt: UNNAMED_ALT, uri: '/imgs/2026-07-20/g.png' },     // unnamed, new -> 225.png
  ];
  const shaByUri = {
    '/imgs/2026-07-20/a.png': 'sha-a',
    '/imgs/2026-07-20/b.png': 'sha-137',
    '/imgs/2026-07-20/c.jpg': 'sha-c',
    '/imgs/2026-07-20/d.png': 'sha-d-new',
    '/imgs/2026-07-20/e.png': 'sha-e-new',
    '/imgs/2026-07-20/f.png': 'sha-f',
    '/imgs/2026-07-20/g.png': 'sha-g',
  };
  const plan = planImageUploads({ refs, moduleBody, mainMd, repoFiles, shaByUri });
  const byUri = Object.fromEntries(plan.entries.map(e => [e.uri, e]));

  assert.deepEqual(
    [byUri['/imgs/2026-07-20/a.png'].targetName, byUri['/imgs/2026-07-20/a.png'].action],
    ['test_img.png', 'upload'],
  );
  assert.deepEqual(
    [byUri['/imgs/2026-07-20/b.png'].targetName, byUri['/imgs/2026-07-20/b.png'].action],
    ['137.png', 'reuse'],
  );
  assert.deepEqual(
    [byUri['/imgs/2026-07-20/c.jpg'].targetName, byUri['/imgs/2026-07-20/c.jpg'].action],
    ['224.jpg', 'upload'],
  );
  const overwriteEntry = byUri['/imgs/2026-07-20/d.png'];
  assert.deepEqual(
    [overwriteEntry.targetName, overwriteEntry.action, overwriteEntry.repoSha],
    ['kept_name.png', 'overwrite', 'sha-kept-old'],
  );
  assert.deepEqual(
    [byUri['/imgs/2026-07-20/e.png'].targetName, byUri['/imgs/2026-07-20/e.png'].action],
    ['other_module(1).png', 'upload'],
  );
  assert.deepEqual(
    [byUri['/imgs/2026-07-20/f.png'].targetName, byUri['/imgs/2026-07-20/f.png'].action],
    ['test_img(1).png', 'upload'],
  );
  assert.deepEqual(
    [byUri['/imgs/2026-07-20/g.png'].targetName, byUri['/imgs/2026-07-20/g.png'].action],
    ['225.png', 'upload'],
  );
  assert.deepEqual(plan.stats, { upload: 5, reuse: 1, overwrite: 1 });
  assert.equal(plan.replacementByUri['/imgs/2026-07-20/b.png'], '/imgs/137.png');
}

// --- #011 rewriteImgRefs ---
{
  const text = '![a](/imgs/2026-07-20/a.png)\ntext\n![b](/imgs/2026-07-20/b.png)';
  const out = rewriteImgRefs(text, {
    '/imgs/2026-07-20/a.png': '/imgs/test_img.png',
    '/imgs/2026-07-20/b.png': '/imgs/137.png',
  });
  assert.equal(out, '![a](/imgs/test_img.png)\ntext\n![b](/imgs/137.png)');
}

console.log('pdirPublish.harness: all assertions passed');
