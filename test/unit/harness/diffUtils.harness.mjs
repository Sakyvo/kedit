// Real merge implementation and utilities, bundled in memory for Node.
// Run: node test/unit/harness/diffUtils.harness.mjs
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';

const bundle = await build({
  entryPoints: ['src/services/diffUtils.js'], bundle: true, write: false,
  platform: 'node', format: 'cjs', logLevel: 'silent',
});
const module = { exports: {} };
new Function('module', 'exports', 'window', 'document', 'HTMLCollection', 'NodeList', bundle.outputFiles[0].text)(
  module, module.exports,
  { crypto: webcrypto, location: { hash: '', protocol: 'https:', host: 'fixture.invalid' } },
  { createElement: () => ({}) }, class {}, class {},
);
const { mergeContent } = module.exports.default;
const content = (text, properties = '\n') => ({ text, properties, discussions: {}, comments: {} });
const base = content('Status: pending.\n');
const remote = content('Status: complete.\n');

assert.equal(mergeContent(remote, base, base).text, remote.text);
assert.equal(mergeContent(remote, base, base).mergeFlag, false);
assert.equal(mergeContent(base, remote, base).text, remote.text);
assert.equal(mergeContent(base, remote, base).mergeFlag, false);

const overlapping = mergeContent(content('Status: remote.\n'), content('Status: local.\n'), base);
assert.equal(overlapping.text, 'Status: remotelocal.\n');
assert.equal(overlapping.mergeFlag, true);

const identical = mergeContent(remote, content(remote.text, 'title: local\n'));
assert.equal(identical.text, remote.text);
assert.equal(identical.properties, '\n', 'retain the existing no-baseline server-first property behavior');
assert.equal(identical.mergeFlag, false, 'equal bodies are not a body conflict');

const identicalWithBase = mergeContent(remote, content(remote.text, 'title: local\n'), base);
assert.equal(identicalWithBase.properties, 'title: local\n');
assert.equal(identicalWithBase.mergeFlag, false);
console.log('diffUtils: one-sided, overlapping and identical-body cases passed');
