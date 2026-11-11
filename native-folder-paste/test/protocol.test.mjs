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
// The host answers with a ready frame first, then one frame per request.
const frames = buffer => {
  const decoded = [];
  for (let offset = 0; offset + 4 <= buffer.length;) {
    const size = buffer.readUInt32LE(offset);
    offset += 4;
    decoded.push(JSON.parse(buffer.subarray(offset, offset + size).toString('utf8')));
    offset += size;
  }
  return decoded;
};
const session = (...requests) => frames(run(Buffer.concat(requests.map(request => frame(JSON.stringify(request))))).stdout);
const request = (requestId, names = []) => ({ version: 1, action: 'readFolders', requestId, names });

test('Release self-test exercises real Windows DROPFILES and UTF-8 framing without clipboard writes', () => {
  const result = run(Buffer.alloc(0), ['--self-test']);
  assert.equal(result.status, 0, result.error?.message);
  assert.equal(result.stdout.length, 0);
});

test('native host rejects unauthorized origins before reading the clipboard', () => {
  assert.equal(run(frame('{}'), ['https://kedit.cc.cd/']).status, 2);
  assert.equal(run(frame('{}'), []).status, 2);
  assert.equal(run(frame('{}'), ['https://kedit.cc.cd/']).stdout.length, 0);
});

test('a warm session announces readiness before any request arrives', () => {
  const reply = session();
  assert.deepEqual(reply, [{ version: 1, type: 'ready' }]);
});

test('one process serves several requests and correlates each reply', () => {
  const messages = session(request('one'), request('two', ['alpha']), request('three'));
  assert.deepEqual(messages[0], { version: 1, type: 'ready' });
  assert.equal(messages.length, 4);
  assert.deepEqual(messages.slice(1).map(message => message.requestId), ['one', 'two', 'three']);
  // Nothing here writes the clipboard, so each read ends in a definite status
  // rather than a hang; the exact status depends on what the Author has copied.
  assert.ok(messages.slice(1).every(message => typeof message.status === 'string'));
  assert.ok(messages.slice(1).every(message => 'paths' in message));
});

test('an invalid request is answered and the session stays usable', () => {
  const messages = session({ version: 1, action: 'write', requestId: 'bad', names: [] }, request('good'));
  assert.equal(messages[0].type, 'ready');
  assert.equal(messages[1].status, 'invalid');
  assert.equal(messages[1].paths, null);
  assert.equal(messages[2].requestId, 'good');
});

test('malformed or truncated frames terminate after the ready frame', () => {
  for (const input of [Buffer.from([0xff, 0xff, 0xff, 0x7f]), Buffer.alloc(4), Buffer.from([4, 0]),
    frame('{'), Buffer.concat([Buffer.from([4, 0, 0, 0]), Buffer.from('a')])]) {
    const result = run(input);
    assert.ok(result.status === 1 || result.status === 3, `exit ${result.status}`);
    assert.deepEqual(frames(result.stdout), [{ version: 1, type: 'ready' }]);
  }
});

test('the host exits cleanly on EOF so the idle process has no lifetime cap', () => {
  const single = run(frame(JSON.stringify(request('last'))));
  assert.equal(single.status, 0);
  const messages = frames(single.stdout);
  assert.equal(messages[0].type, 'ready');
  assert.equal(messages[1].requestId, 'last');
});
