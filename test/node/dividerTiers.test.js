import test from 'node:test';
import assert from 'node:assert/strict';
import grammarSvc, { DIVIDER_TIERS, DIVIDER_TIER_IDS } from '../../src/services/markdownGrammarSvc.js';
import {
  dividerTierForLine,
  dividerTierForMarkers,
  TOOLBAR_DIVIDER_SNIPPET,
} from '../../src/services/dividerSvc.js';

const tierOf = line => dividerTierForLine(line).id;
const stateless = pattern => new RegExp(pattern.source);

test('a divider is graded by how many marker characters its line carries', () => {
  assert.equal(tierOf('---'), 'plain');
  assert.equal(tierOf('----'), 'plain');
  assert.equal(tierOf('-----'), 'plain');
  assert.equal(tierOf('------'), 'blue');
  assert.equal(tierOf('-------'), 'blue');
  assert.equal(tierOf('--------'), 'blue');
  assert.equal(tierOf('---------'), 'red');
  assert.equal(tierOf('-------------'), 'red');
});

test('spaces between markers do not count, and the three marker characters are equivalent', () => {
  assert.equal(tierOf('- - - - - -'), 'blue');
  assert.equal(tierOf('- - - - - - - - -'), 'red');
  assert.equal(tierOf('******'), 'blue');
  assert.equal(tierOf('_________'), 'red');
});

test('a line that is not a divider has no tier at all', () => {
  assert.equal(tierOf('text ---'), 'none');
  assert.equal(tierOf('--'), 'none');
  assert.equal(tierOf(''), 'none');
  assert.equal(tierOf('***bold***'), 'none');
  assert.equal(tierOf('--- x'), 'none');
});

test('the tier table is the single place the thresholds live', () => {
  assert.deepEqual(DIVIDER_TIER_IDS, ['red', 'blue', 'plain']);
  assert.deepEqual(DIVIDER_TIERS.map(tier => tier.minMarkers), [9, 6, 3]);
  assert.equal(dividerTierForMarkers(8).id, 'blue');
  assert.equal(dividerTierForMarkers(2).id, 'none');
});

test('the editor grammar colours exactly the tiers the preview renders', () => {
  const grammar = grammarSvc.makeGrammars({}).main.hr;
  assert.match('----', stateless(grammar.pattern));
  assert.doesNotMatch('text --- text', stateless(grammar.pattern));
  const strong = grammar.inside[DIVIDER_TIERS.find(tier => tier.id === 'blue').editorToken];
  assert.ok(strong, 'the blue tier is an inside rule of the hr grammar');
  assert.match('------', stateless(strong.pattern));
  assert.match('--------', stateless(strong.pattern));
  assert.doesNotMatch('-----', stateless(strong.pattern));
  const redToken = DIVIDER_TIERS.find(tier => tier.id === 'red').editorToken;
  const red = strong.inside[redToken.replace('hr hr-strong ', '')];
  assert.ok(red, 'the red tier refines the blue run');
  assert.match('---------', stateless(red.pattern));
  assert.doesNotMatch('--------', stateless(red.pattern));
});

test('the toolbar inserts a plain divider, not the loudest tier', () => {
  assert.equal(TOOLBAR_DIVIDER_SNIPPET.trim(), '---');
  assert.equal(tierOf(TOOLBAR_DIVIDER_SNIPPET.trim()), 'plain');
});
