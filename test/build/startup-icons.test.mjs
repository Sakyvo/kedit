import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.BUILD_DIR || 'dist');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const links = [...html.matchAll(/<link\b[^>]+>/g)].map(([tag]) => Object.fromEntries(
  [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
));
const localFile = url => readFileSync(resolve(root, `.${new URL(url, 'https://kedit.cc.cd').pathname}`));

test('startup has three useful icons and one install manifest, not a device-image catalog', () => {
  const icons = links.filter(link => /^(icon|shortcut icon|apple-touch-icon)$/.test(link.rel));
  assert.equal(icons.length, 3);
  assert.equal(links.filter(link => link.rel === 'manifest').length, 1);
  assert.equal(links.filter(link => link.rel === 'apple-touch-startup-image').length, 0);
  const pngSizes = icons.filter(link => link.href.endsWith('.png')).map(link => {
    const bytes = localFile(link.href);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  });
  assert.deepEqual(pngSizes.sort((a, b) => a[0] - b[0]), [[32, 32], [180, 180]]);
  assert.ok(icons.some(link => link.href.endsWith('.ico') && localFile(link.href).length > 0));
  assert.ok(!readdirSync(resolve(root, 'static')).some(name => name.startsWith('apple-touch-startup-image')));
  const manifest = JSON.parse(localFile(links.find(link => link.rel === 'manifest').href));
  assert.equal(manifest.name, 'KEDIT');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  for (const icon of manifest.icons) {
    const bytes = localFile(icon.src);
    assert.equal(icon.sizes, `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`);
  }
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
});
