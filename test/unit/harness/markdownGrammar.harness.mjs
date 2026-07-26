/**
 * Node harness for editor markdown grammar emphasis rules.
 * Run: node test/unit/harness/markdownGrammar.harness.mjs
 */
import assert from 'node:assert/strict';
import Prism from 'prismjs';
import grammarSvc from '../../../src/services/markdownGrammarSvc.js';

const grammars = grammarSvc.makeGrammars({});

const flatTypes = (tokens, out = []) => {
  tokens.forEach((token) => {
    if (typeof token === 'string') {
      return;
    }
    out.push(token.type);
    const content = Array.isArray(token.content) ? token.content : [token.content];
    flatTypes(content.filter(item => item != null && typeof item !== 'string'), out);
  });
  return out;
};

const tokenize = text => Prism.tokenize(text, grammars.main);
const firstOfType = (tokens, type) => tokens.find(t => typeof t !== 'string' && t.type === type);
const tokenText = (token) => {
  if (typeof token === 'string') {
    return token;
  }
  const content = Array.isArray(token.content) ? token.content : [token.content];
  return content.map(tokenText).join('');
};

// --- regression: leading literal star `**X*` = literal `*` + em(X) (CommonMark) ---
{
  const tokens = tokenize('**星号开头斜体*');
  const em = firstOfType(tokens, 'em cn-em');
  assert.ok(em, 'em token must exist for **X*');
  assert.equal(tokenText(em), '*星号开头斜体*');
  // Leading literal star stays outside the em token (plain text / p)
  const before = tokens.slice(0, tokens.indexOf(em));
  assert.equal(before.map(tokenText).join(''), '*');
}

// --- mid-line variant `foo **X*` ---
{
  const tokens = tokenize('foo **斜体*');
  const em = firstOfType(tokens, 'em cn-em');
  assert.ok(em, 'em token must exist for foo **X*');
  assert.equal(tokenText(em), '*斜体*');
}

// --- controls stay intact ---
{
  // plain em
  const em = firstOfType(tokenize('*斜体*'), 'em cn-em');
  assert.ok(em);
  assert.equal(tokenText(em), '*斜体*');
  // strong
  const strong = firstOfType(tokenize('**粗体**'), 'strong cn-strong');
  assert.ok(strong);
  assert.equal(tokenText(strong), '**粗体**');
  // strong-em
  const strongEm = firstOfType(tokenize('***粗斜***'), 'strong em');
  assert.ok(strongEm);
  assert.equal(tokenText(strongEm), '***粗斜***');
  // dot boundary guards (see grammar comment: `*v1.0*` / `a.*b*` history)
  assert.ok(firstOfType(tokenize('*v1.0*'), 'em cn-em'));
  assert.ok(firstOfType(tokenize('a.*b*'), 'em cn-em'));
  // consecutive `*a* *b*` stay two tokens
  const two = tokenize('*a* *b*').filter(t => typeof t !== 'string' && t.type === 'em cn-em');
  assert.equal(two.length, 2);
  // underscore variants stay plain
  assert.equal(flatTypes(tokenize('_x_ __y__')).filter(t => /em|strong/.test(t)).length, 0);
}

console.log('markdownGrammar.harness: all assertions passed');
