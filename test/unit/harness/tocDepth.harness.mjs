/**
 * Node harness for shipped tocDepth helpers (no Jest).
 * Run: node test/unit/harness/tocDepth.harness.mjs
 *
 * Covers batch-A #039: after incremental diff refresh, outline depth must be
 * recomputed over the WHOLE TOC in document order (unchanged sections keep
 * stale dataset values and never fed the old in-loop stack).
 */
import assert from 'node:assert/strict';
import {
  collectTocHeadingLevels,
  applyTocOutlineDepths,
} from '../../../src/services/editor/tocDepth.js';

function mockTocSection(headingTagName) {
  const section = {
    firstElementChild: headingTagName
      ? { tagName: headingTagName }
      : null,
    dataset: {},
  };
  return section;
}

function mockTocElt(headingTagNames) {
  return { children: headingTagNames.map(mockTocSection) };
}

// --- collectTocHeadingLevels: heading tag -> level, non-heading/empty -> 0 ---
{
  assert.deepEqual(
    collectTocHeadingLevels(mockTocElt(['H1', 'H2', 'H3', 'H6'])),
    [1, 2, 3, 6],
  );
  // Sections without a heading clone contribute 0 and never disturb the stack
  assert.deepEqual(
    collectTocHeadingLevels(mockTocElt([null, 'H2', null, 'H3'])),
    [0, 2, 0, 3],
  );
  assert.deepEqual(collectTocHeadingLevels(mockTocElt([])), []);
}

// --- applyTocOutlineDepths: writes dataset only where depth changed ---
{
  // Full nesting: h2 > h3 > h4 > h5 — the reference semantics from
  // computeTocOutlineDepths, reasserted through the DOM-writing path
  const tocElt = mockTocElt(['H2', 'H3', 'H4', 'H5']);
  const changed = applyTocOutlineDepths(tocElt);
  assert.deepEqual(
    tocElt.children.map((elt) => elt.dataset.outlineDepth),
    ['0', '1', '2', '3'],
  );
  assert.equal(changed, 4);

  // Orphan h4 with no ancestor starts at the left edge
  const orphan = mockTocElt(['H4']);
  applyTocOutlineDepths(orphan);
  assert.equal(orphan.children[0].dataset.outlineDepth, '0');

  // Unchanged entries are NOT rewritten (no style invalidation churn)
  const stable = mockTocElt(['H1', 'H2', 'H3']);
  applyTocOutlineDepths(stable);
  const datasetsBefore = stable.children.map((elt) => elt.dataset.outlineDepth);
  assert.equal(applyTocOutlineDepths(stable), 0);
  assert.deepEqual(stable.children.map((elt) => elt.dataset.outlineDepth), datasetsBefore);

  // Promote a mid-document heading (h2 -> h1 at index 1): the downstream
  // subtree (stale depth from a previous incremental pass) must be corrected
  const promoted = mockTocElt(['H1', 'H1', 'H3', 'H4']);
  promoted.children[2].dataset.outlineDepth = '2'; // stale: used to sit under the old h2
  applyTocOutlineDepths(promoted);
  assert.deepEqual(
    promoted.children.map((elt) => elt.dataset.outlineDepth),
    ['0', '0', '1', '2'],
  );
}

// --- The incremental-refresh regression, end to end ---
// Doc: `# A` `## B` `### C`. Author demotes B to `# B` -> only B's section is
// re-rendered (fresh element WITHOUT dataset), A and C keep stale datasets.
{
  const tocElt = mockTocElt(['H1', 'H1', 'H3']);
  tocElt.children[0].dataset.outlineDepth = '0'; // A: stale but still correct
  tocElt.children[2].dataset.outlineDepth = '2'; // C: stale, WRONG (should be 1)
  // B's fresh element carries no dataset at all (would render at default 0)
  applyTocOutlineDepths(tocElt);
  assert.deepEqual(
    tocElt.children.map((elt) => elt.dataset.outlineDepth),
    ['0', '0', '1'],
  );
}

// --- Deeper doc after a mid-doc level change (the reported symptom) ---
// `# A` `## B` `### C` `## D` `### E`, then `## B` becomes `### B`:
// only B re-rendered, stack-free path gave B depth 0; C..E kept old depths.
{
  const tocElt = mockTocElt(['H1', 'H3', 'H3', 'H2', 'H3']);
  tocElt.children[0].dataset.outlineDepth = '0';
  tocElt.children[2].dataset.outlineDepth = '2'; // C stale (should be 1)
  tocElt.children[3].dataset.outlineDepth = '1';
  tocElt.children[4].dataset.outlineDepth = '2';
  applyTocOutlineDepths(tocElt);
  assert.deepEqual(
    tocElt.children.map((elt) => elt.dataset.outlineDepth),
    ['0', '1', '1', '1', '2'],
  );
}

console.log('tocDepth.harness: all assertions passed');
