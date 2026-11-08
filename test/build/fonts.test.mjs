import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.BUILD_DIR || 'dist');
const styles = readdirSync(resolve(root, 'static')).filter(name => /^main\..*\.css$/.test(name))
  .map(name => readFileSync(resolve(root, 'static', name), 'utf8'));
styles.push(readFileSync(resolve(root, 'style.css'), 'utf8'));

test('app and export fonts stay readable while downloading and use lightweight Latin assets', () => {
  assert.equal(styles.length, 2);
  for (const css of styles) {
    const faces = [...css.matchAll(/@font-face\{([^}]+)\}/g)].map(match => match[1]);
    const latin = faces.filter(face => face.includes('Kedit Latin'));
    assert.equal(latin.length, 4);
    for (const face of [...latin, ...faces.filter(face => face.includes('Roboto Mono'))]) {
      assert.match(face, /font-display:swap/);
    }
    assert.doesNotMatch(css, /lato-[\w.-]+\.woff\b/);
    assert.match(css, /Kedit Latin[^;]+Helvetica[^;]+sans-serif/);
  }
  const fonts = readdirSync(resolve(root, 'static/fonts')).filter(name => /^kedit-latin-.*\.woff2$/.test(name));
  assert.equal(fonts.length, 4);
  for (const font of fonts) assert.ok(statSync(resolve(root, 'static/fonts', font)).size < 100000, font);
});
