import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.BUILD_DIR || 'dist');
const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
const manifest = [...sw.matchAll(/url:\s*["']([^"']+)["']/g)].map(([, url]) => url);
const has = fragment => manifest.some(url => url.includes(fragment));

test('service-worker precache contains only the startup shell, not optional renderers or lazy images', () => {
  assert.ok(manifest.length > 0);
  assert.equal(has('mermaid'), false);
  assert.equal(has('katex'), false);
  assert.equal(has('abc'), false);
  assert.equal(has('logo.'), false);
  assert.equal(has('apple-touch-startup'), false);
  assert.equal(has('favicon.png'), false);
  assert.ok(has('index-') || has('startup'));
  assert.ok(has('main.'));
});

test('service worker runtime-caches same-origin static chunks only', () => {
  assert.match(sw, /registerRoute\(/);
  assert.match(sw, /CacheFirst/);
  assert.match(sw, /static/);
  assert.match(sw, /cacheName/);
  assert.doesNotMatch(sw, /pathname\.startsWith\(["']\/(?:conf|oauth2|api|sync)/i);
});
