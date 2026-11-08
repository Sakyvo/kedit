import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const exe = fileURLToPath(new URL('../.target/release/KeditFolderPaste.exe', import.meta.url));
const origin = `chrome-extension://${'a'.repeat(32)}/`;
const run = (input, args = [origin]) => spawnSync(exe, args, {
  input, windowsHide: true, timeout: 5000, maxBuffer: 1048576,
});
const frame = text => {
  const bytes = Buffer.from(text, 'utf8');
  const header = Buffer.alloc(4); header.writeUInt32LE(bytes.length);
  return Buffer.concat([header, bytes]);
};

test('Release self-test exercises real Windows DROPFILES and UTF-8 framing without clipboard writes', () => {
  const result = run(Buffer.alloc(0), ['--self-test']);
  assert.equal(result.status, 0, result.error?.message);
  assert.equal(result.stdout.length, 0);
});

test('native host rejects unauthorized origins before reading the clipboard', () => {
  assert.equal(run(frame('{}'), ['https://kedit.cc.cd/']).status, 2);
  assert.equal(run(frame('{}'), []).status, 2);
});

test('invalid request receives a correctly framed response with no paths', () => {
  for (const request of [{}, { version: 1, action: 'write', requestId: 'one', names: [] },
    { version: 1, action: 'readFolders', requestId: 'one', names: null }]) {
    const result = run(frame(JSON.stringify(request)));
    assert.equal(result.status, 0);
    const size = result.stdout.readUInt32LE(0);
    assert.equal(size, result.stdout.length - 4);
    const reply = JSON.parse(result.stdout.subarray(4).toString('utf8'));
    assert.equal(reply.status, 'invalid');
    assert.equal(reply.paths, null);
  }
});

test('malformed or truncated frames terminate without output or unbounded reads', () => {
  for (const input of [Buffer.from([0xff, 0xff, 0xff, 0x7f]), Buffer.alloc(4), Buffer.from([4, 0]), frame('{'),
    Buffer.concat([Buffer.from([4, 0, 0, 0]), Buffer.from('a')])]) {
    const result = run(input);
    assert.ok(result.status === 1 || result.status === 3);
    assert.equal(result.stdout.length, 0);
  }
});
