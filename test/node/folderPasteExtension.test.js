import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../../native-folder-paste/extension/${name}`, import.meta.url), 'utf8');

function contentFixture({ trusted = true, text = '', html = '', type = '', accepted = true, active = true, status = 'ok' } = {}) {
  let paste;
  const requests = [];
  const events = [];
  const editor = { focus: () => {}, dispatchEvent: e => {
    events.push(e);
    if (e.type === 'kedit-folder-paste-begin' && accepted) e.defaultPrevented = true;
  } };
  const window = { addEventListener: (name, fn) => { assert.equal(name, 'paste'); paste = fn; } };
  window.top = window;
  const inserted = [];
  const documentElement = { dataset: {} };
  vm.runInNewContext(source('content.js'), {
    window,
    document: {
      activeElement: active ? editor : null,
      documentElement,
      execCommand: (command, _ui, value) => { inserted.push({ command, value }); return true; },
    },
    crypto: { randomUUID: () => 'request-1' },
    CustomEvent: class { constructor(name, options) { this.type = name; Object.assign(this, options); } },
    chrome: { runtime: { sendMessage: async request => {
      requests.push(request);
      return { version: 1, requestId: request.requestId, status,
        paths: status === 'ok' ? ['C:\\one'] : null };
    } } },
  });
  let prevented = 0;
  const run = () => paste({ isTrusted: trusted, target: { closest: () => editor },
    clipboardData: {
      getData: format => (format === 'text/plain' ? text : html),
      items: type ? [{ type, kind: 'file' }] : [],
      files: [],
      types: type ? ['Files'] : [],
    },
    preventDefault: () => { prevented++; }, stopImmediatePropagation() {},
  });
  return { run, requests, events, inserted, documentElement, prevented: () => prevented };
}

test('extension requests paths only on trusted, accepted, active empty/file paste', async () => {
  const f = contentFixture(); await f.run();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].action, 'readFolders');
  assert.equal(f.prevented(), 1);
  assert.deepEqual(JSON.parse(f.events[1].detail).paths, ['C:\\one']);
  assert.equal(f.inserted.length, 0, 'page handled the reply');
  assert.equal(f.documentElement.dataset.keditFolderPaste, '1');
});

test('stale page bundle still gets paths via the extension fallback', async () => {
  const f = contentFixture({ accepted: false }); await f.run();
  assert.equal(f.requests.length, 1);
  assert.equal(f.prevented(), 1);
  assert.deepEqual(f.inserted, [{ command: 'insertText', value: 'C:\\one' }]);
  assert.equal(f.events.length, 1, 'no end event without a page handler');
});

test('fallback never inserts when the clipboard is not a folder', async () => {
  for (const status of ['not-folders', 'empty', 'unavailable', 'busy']) {
    const f = contentFixture({ accepted: false, status }); await f.run();
    assert.equal(f.inserted.length, 0, status);
    assert.equal(f.prevented(), 1);
  }
});

test('stale page bundle leaves ordinary text paste to the browser', async () => {
  const f = contentFixture({ accepted: false, text: 'hi' }); await f.run();
  assert.equal(f.requests.length, 0);
  assert.equal(f.prevented(), 0);
});

for (const options of [{ trusted: false }, { text: 'hi' }, { html: '<b>hi</b>' }, { type: 'image/png' }, { active: false }]) {
  test(`existing paste is untouched: ${JSON.stringify(options)}`, async () => {
    const f = contentFixture(options); await f.run();
    assert.equal(f.requests.length, 0);
    assert.equal(f.prevented(), 0);
  });
}

function backgroundFixture() {
  let listener;
  const calls = [];
  const runtime = { id: 'test-extension', onMessage: { addListener: fn => { listener = fn; } },
    sendNativeMessage: (host, request, callback) => {
      calls.push({ host, request });
      callback({ version: 1, requestId: request.requestId, status: 'ok', paths: ['C:\\one'] });
    },
  };
  vm.runInNewContext(source('background.js'), { chrome: { runtime } });
  const request = { version: 1, action: 'readFolders', requestId: 'id-1', names: [] };
  const sender = { id: runtime.id, frameId: 0, origin: 'https://kedit.cc.cd', url: 'https://kedit.cc.cd/', tab: {} };
  return { listener, request, sender, calls, runtime };
}

test('service worker restricts caller, protocol and payload', () => {
  for (const patch of [{ origin: 'https://evil.test' }, { frameId: 1 }, { id: 'other' }, { tab: null },
    { url: 'https://kedit.cc.cd.evil.test/' }, { url: 'https://evil.test/', tab: { url: 'https://evil.test/' } }]) {
    const f = backgroundFixture();
    assert.equal(f.listener(f.request, { ...f.sender, ...patch }, () => {}), false);
    assert.equal(f.calls.length, 0);
  }
  for (const patch of [{ action: 'writeClipboard' }, { version: 2 }, { names: 'bad' }, { requestId: '\n' }, { names: Array(257).fill('a') }]) {
    const f = backgroundFixture();
    assert.equal(f.listener({ ...f.request, ...patch }, f.sender, () => {}), false);
    assert.equal(f.calls.length, 0);
  }
  const f = backgroundFixture(); let reply;
  assert.equal(f.listener(f.request, f.sender, value => { reply = value; }), true);
  assert.equal(f.calls[0].host, 'cc.cd.kedit.folder_paste');
  assert.equal(reply.status, 'ok');
  // Vivaldi (and other Chromium forks) may omit sender.origin entirely.
  const noOrigin = backgroundFixture();
  const { origin: _origin, ...withoutOrigin } = noOrigin.sender;
  assert.equal(noOrigin.listener(noOrigin.request, withoutOrigin, () => {}), true);
  assert.equal(noOrigin.calls.length, 1);
  // sender.url missing: fall back to the tab URL of a KEDIT tab.
  const noUrl = backgroundFixture();
  const { url: _url, ...withoutUrl } = noUrl.sender;
  assert.equal(noUrl.listener(noUrl.request, { ...withoutUrl, tab: { url: 'https://kedit.cc.cd/' } }, () => {}), true);
  const noUrlEvil = backgroundFixture();
  assert.equal(noUrlEvil.listener(noUrlEvil.request, { ...withoutUrl, tab: { url: 'https://evil.test/' } }, () => {}), false);
  f.runtime.lastError = { message: 'missing host' };
  f.listener(f.request, f.sender, value => { reply = value; });
  assert.equal(reply.status, 'unavailable');
});

test('production manifest is confined to KEDIT and requires only nativeMessaging', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.deepEqual(manifest.permissions, ['nativeMessaging']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://kedit.cc.cd/*']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.ok(manifest.key);
});
