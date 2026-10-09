// S1 红：referenceDefs —— 引用式链接定义检测（卡 014 回退闸）
import assert from 'node:assert/strict';
import { hasReferenceDefinitions } from '../../../src/services/editor/referenceDefs.js';

let phase = 'init';
try {
  phase = '普通文档';
  assert.equal(hasReferenceDefinitions('# H\n\npara\n'), false);
  assert.equal(hasReferenceDefinitions(''), false);

  phase = '内联链接不算';
  assert.equal(hasReferenceDefinitions('see [text](http://x)\n'), false);

  phase = '引用定义';
  assert.equal(hasReferenceDefinitions('[ref]: http://example.com\n'), true);
  assert.equal(hasReferenceDefinitions('para\n\n[ref]: http://example.com\n'), true);
  assert.equal(hasReferenceDefinitions('[a]: /path\n[b]: other\n'), true);
  assert.equal(hasReferenceDefinitions('   [ind]: url\n'), true, '最多 3 空格缩进仍是定义');

  phase = '围栏内不算';
  assert.equal(hasReferenceDefinitions('```\n[ref]: http://x\n```\n'), false);
  assert.equal(hasReferenceDefinitions('~~~\n[ref]: http://x\n~~~\n'), false);

  phase = 'frontmatter 内不算';
  assert.equal(hasReferenceDefinitions('---\n[ref]: http://x\n---\npara\n'), false);
  assert.equal(hasReferenceDefinitions('---\ntitle: t\n---\n[ref]: http://x\n'), true, '正文中的定义仍算');

  phase = '缩进代码不算';
  assert.equal(hasReferenceDefinitions('    [ref]: http://x\n'), false);

  phase = '非定义形态';
  assert.equal(hasReferenceDefinitions('[a]\n'), false);
  assert.equal(hasReferenceDefinitions('para [b]: x\n'), false);
  assert.equal(hasReferenceDefinitions('[]: x\n'), false, '空 label 不是定义');

  console.log('PASS S1 referenceDefs');
  process.exit(0);
} catch (err) {
  console.error(`FAIL S1 [${phase}]: ${err.message}`);
  process.exit(1);
}