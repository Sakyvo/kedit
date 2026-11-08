import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { init, parse } from 'es-module-lexer';

await init;
const root = resolve(process.env.BUILD_DIR || 'dist');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const entry = html.match(/<script[^>]+src="([^"]+\.js)"/)[1];
const seen = new Set();
function visit(url, from = resolve(root, 'index.html')) {
  const filename = url.startsWith('/') ? resolve(root, `.${url}`) : resolve(dirname(from), url);
  if (seen.has(filename)) return '';
  seen.add(filename);
  const source = readFileSync(filename, 'utf8');
  return source + parse(source)[0]
    .filter(item => item.n && (item.d === -1 || /\/main[.-]/.test(item.n)))
    .map(item => visit(item.n, filename)).join('\n');
}
const startupJs = visit(entry);

test('ordinary editing does not require the Mermaid engine', () => {
  assert.ok(!startupJs.includes('mermaidAPI'), 'Mermaid engine is reachable by a static startup import');
});

test('ordinary editing does not require the KaTeX engine or CSS', () => {
  assert.ok(!startupJs.includes('KaTeX parse error'), 'KaTeX engine is reachable by a static startup import');
  const styles = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(match => match[1]);
  const entrySource = readFileSync(resolve(root, entry.replace(/^\.\/?|^\//, '')), 'utf8');
  styles.push(...[...entrySource.matchAll(/"(static\/[^"\s]+\.css)"/g)].map(match => match[1]));
  assert.ok(styles.length, 'Application CSS must be checked even with a dynamic bootstrap');
  for (const url of styles) {
    const css = readFileSync(resolve(root, url.replace(/^\.\/?|^\//, '')), 'utf8');
    assert.ok(!css.includes('.katex{'), 'KaTeX CSS blocks the ordinary editor');
  }
});

test('styled exports keep the complete formula styles', () => {
  const css = readFileSync(resolve(root, 'style.css'), 'utf8');
  assert.ok(css.includes('.katex{'));
  assert.ok(css.includes('KaTeX_Main'));
});
