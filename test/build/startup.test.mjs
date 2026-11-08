import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.BUILD_DIR || 'dist');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');

test('startup is visible without loading application scripts, images or fonts', () => {
  assert.match(html, /id="startup"/);
  assert.match(html, /<svg[^>]+viewBox=/);
  assert.match(html, /<style[^>]*>[\s\S]*#startup[\s\S]*<\/style>/);
  const shell = html.slice(html.indexOf('id="startup"'), html.indexOf('id="app"'));
  assert.doesNotMatch(shell, /<img|url\(https?:|src=/);
  assert.match(shell, /KEDIT/);
});

test('static hosting emits the application and auxiliary route documents', () => {
  assert.equal(readFileSync(resolve(root, 'app/index.html'), 'utf8'), html);
  for (const [route, source] of [
    ['oauth2/callback/index.html', 'static/oauth2/callback.html'],
    ['share.html', 'static/landing/share.html'],
    ['gistshare.html', 'static/landing/gistshare.html'],
  ]) {
    assert.equal(readFileSync(resolve(root, route), 'utf8'), readFileSync(resolve(root, source), 'utf8'));
  }
});

test('all application entry URLs resolve their script and stylesheet resources', () => {
  const urls = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map(m => m[1]);
  assert.ok(urls.length);
  for (const entry of ['/', '/app', '/app/']) {
    for (const url of urls) {
      const pathname = new URL(url, `https://kedit.cc.cd${entry}`).pathname;
      assert.ok(existsSync(resolve(root, `.${pathname}`)), `${entry}: ${pathname}`);
    }
  }
});
