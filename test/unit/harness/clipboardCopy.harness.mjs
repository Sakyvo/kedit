/**
 * Node harness for selection-copy image detection (batch copy-original-image #014/#015).
 * Run: node test/unit/harness/clipboardCopy.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  listImgRefSpans,
  singleLocalImageRef,
  bridgeRefsFor,
  buildBridgePayload,
} from '../../../src/services/clipboardCopy.js';

// --- listImgRefSpans ---
{
  const text = 'a ![one](/imgs/x.png) b ![two](https://cdn/y.jpg) c';
  const spans = listImgRefSpans(text);
  assert.equal(spans.length, 2, 'finds both refs');
  assert.deepEqual(
    spans.map(s => [s.alt, s.uri, s.local]),
    [['one', '/imgs/x.png', true], ['two', 'https://cdn/y.jpg', false]],
  );
  assert.equal(text.slice(spans[0].start, spans[0].end), '![one](/imgs/x.png)', 'span offsets exact');
  assert.equal(text.slice(spans[1].start, spans[1].end), '![two](https://cdn/y.jpg)', 'span offsets exact');
}
{
  const fenced = '```\n![in fence](/imgs/nope.png)\n```\n![out](/imgs/yes.png)';
  const spans = listImgRefSpans(fenced);
  assert.equal(spans.length, 1, 'fence content skipped');
  assert.equal(spans[0].uri, '/imgs/yes.png');
}
{
  assert.equal(listImgRefSpans('no images here').length, 0, 'no refs → empty');
  assert.equal(listImgRefSpans('').length, 0, 'empty text → empty');
}

// --- singleLocalImageRef ---
{
  assert.deepEqual(
    singleLocalImageRef('  ![截图](/imgs/2025-01-02/a.png)\n'),
    { alt: '截图', uri: '/imgs/2025-01-02/a.png', refText: '![截图](/imgs/2025-01-02/a.png)' },
    'trimmed single local ref qualifies, refText is the trimmed selection',
  );
  assert.equal(singleLocalImageRef('text ![a](/imgs/a.png)'), null, 'text+image is not single-image');
  assert.equal(singleLocalImageRef('![a](/imgs/a.png) ![b](/imgs/b.png)'), null, 'two images not single');
  assert.equal(singleLocalImageRef('![a](https://cdn/a.png)'), null, 'remote image not single-local');
  assert.equal(singleLocalImageRef('plain text'), null, 'plain text not single');
  assert.equal(singleLocalImageRef(''), null, 'empty not single');
}

// --- bridgeRefsFor (np420 对接) ---
{
  const none = bridgeRefsFor('plain text');
  assert.equal(none.shouldBridge, false);

  const multi = bridgeRefsFor('![a](/imgs/a.png)\ntext');
  assert.equal(multi.shouldBridge, true, '图片+文本进桥');
  assert.deepEqual(multi.refs.map(r => r.uri), ['/imgs/a.png']);

  const dup = bridgeRefsFor('![a](/imgs/a.png) ![a2](/imgs/a.png)');
  assert.equal(dup.shouldBridge, true);
  assert.equal(dup.refs.length, 2, '同一张图出现两次也记入两次');

  const remote = bridgeRefsFor('![a](https://cdn/a.png) b');
  assert.equal(remote.shouldBridge, false, '外链图不进桥');

  const single = bridgeRefsFor('  ![one](/imgs/x.png)');
  assert.equal(single.shouldBridge, false, '单图走 image/png 通道不进桥');

  const fenced = bridgeRefsFor('```\n![f](/imgs/f.png)\n```');
  assert.equal(fenced.shouldBridge, false, '阻断内不进桥');
}

// --- buildBridgePayload ---
{
  const p = buildBridgePayload('![a](/imgs/a.png)', [
    { uri: '/imgs/a.png', mime: 'image/png', dataBase64: 'aGk=' },
  ]);
  const obj = JSON.parse(p);
  assert.equal(obj.v, 1);
  assert.equal(obj.text, '![a](/imgs/a.png)');
  assert.equal(obj.images.length, 1);
  assert.equal(obj.images[0].uri, '/imgs/a.png');
  assert.equal(obj.images[0].mime, 'image/png');
  assert.equal(obj.images[0].dataBase64, 'aGk=');
}

console.log('clipboardCopy.harness: all assertions passed');
