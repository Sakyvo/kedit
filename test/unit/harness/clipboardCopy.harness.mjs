/**
 * Node harness for clipboard copy/paste pure helpers (batch copy-original-image #014).
 * Run: node test/unit/harness/clipboardCopy.harness.mjs
 */
import assert from 'node:assert/strict';
import {
  encodeMarkerPayload,
  decodeMarkedHtml,
  listImgRefSpans,
  singleLocalImageRef,
  buildCopyHtml,
  extractDataUrls,
  pickRecoveryDataUrl,
} from '../../../src/services/clipboardCopy.js';

// --- marker payload roundtrip ---
{
  const md = '前文 ![图a](/imgs/2025-01-02/a.png) 后文\n第二行 --> 注释杀手 -->\n中文与 emoji 🎉';
  const html = `${encodeMarkerPayload(md)}<p>whatever</p>`;
  assert.equal(decodeMarkedHtml(html), md, 'marker roundtrip preserves markdown verbatim');
}
{
  assert.equal(decodeMarkedHtml('<p>foreign html</p>'), null, 'foreign html has no marker');
  assert.equal(decodeMarkedHtml(''), null, 'empty html has no marker');
  assert.equal(decodeMarkedHtml('<!--kedit:copy:!!!bad base64!!!-->'), null, 'corrupt payload rejected');
}

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
}

// --- singleLocalImageRef ---
{
  assert.deepEqual(
    singleLocalImageRef('  ![截图](/imgs/2025-01-02/a.png)\n'),
    { alt: '截图', uri: '/imgs/2025-01-02/a.png' },
    'trimmed single local ref qualifies',
  );
  assert.equal(singleLocalImageRef('text ![a](/imgs/a.png)'), null, 'text+image is not single-image');
  assert.equal(singleLocalImageRef('![a](/imgs/a.png) ![b](/imgs/b.png)'), null, 'two images not single');
  assert.equal(singleLocalImageRef('![a](https://cdn/a.png)'), null, 'remote image not single-local');
  assert.equal(singleLocalImageRef('plain text'), null, 'plain text not single');
}

// --- buildCopyHtml ---
{
  const text = '前 <b> ![图](/imgs/a.png) 后\n![远](https://cdn/b.jpg)';
  const html = buildCopyHtml(text, { '/imgs/a.png': 'data:image/png;base64,QUJD' });
  assert.equal(decodeMarkedHtml(html), text, 'html carries marker with original markdown');
  assert.ok(html.includes('src="data:image/png;base64,QUJD"'), 'local image inlined as data URL');
  assert.ok(html.includes('data-kedit-uri="%2Fimgs%2Fa.png"'), 'local img carries uri attr');
  assert.ok(html.includes('src="https://cdn/b.jpg"'), 'remote image kept as-is');
  assert.ok(html.includes('前 &lt;b&gt; '), 'text segment escaped');
  assert.ok(!html.includes('![图]'), 'markdown syntax not leaked into html body');
}
{
  const html = buildCopyHtml('![missing](/imgs/gone.png)', {});
  assert.ok(html.includes('src="/imgs/gone.png"'), 'missing local image falls back to uri src');
}

// --- extractDataUrls ---
{
  const html = '<!--kedit:copy:eA--><p>t</p>'
    + '<img src="data:image/png;base64,AAA" data-kedit-uri="%2Fimgs%2Fa.png">'
    + '<img src="https://cdn/b.jpg">'
    + '<img src="data:image/jpeg;base64,BBB">';
  const urls = extractDataUrls(html);
  assert.equal(urls.length, 2, 'only data URLs collected');
  assert.equal(urls[0].dataUrl, 'data:image/png;base64,AAA');
  assert.equal(urls[0].uri, '/imgs/a.png', 'uri attr decoded');
  assert.equal(urls[1].dataUrl, 'data:image/jpeg;base64,BBB');
  assert.equal(urls[1].uri, null, 'missing uri attr → null');
}

// --- pickRecoveryDataUrl ---
{
  const urls = [
    { dataUrl: 'data:image/png;base64,AAA', uri: '/imgs/a.png' },
    { dataUrl: 'data:image/png;base64,BBB', uri: null },
    { dataUrl: 'data:image/png;base64,CCC', uri: null },
  ];
  assert.equal(pickRecoveryDataUrl(urls, '/imgs/a.png', 0).dataUrl, 'data:image/png;base64,AAA', 'uri match wins');
  assert.equal(pickRecoveryDataUrl(urls, '/imgs/other.png', 0).dataUrl, 'data:image/png;base64,BBB', 'index fallback');
  assert.equal(pickRecoveryDataUrl(urls, '/imgs/other.png', 1).dataUrl, 'data:image/png;base64,CCC', 'index fallback second');
  assert.equal(pickRecoveryDataUrl(urls, '/imgs/other.png', 5), null, 'out of range → null');
  assert.equal(pickRecoveryDataUrl([], '/imgs/a.png', 0), null, 'empty → null');
}

console.log('clipboardCopy.harness: all assertions passed');
