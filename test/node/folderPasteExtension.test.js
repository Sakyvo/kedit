import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../../native-folder-paste/extension/${name}`, import.meta.url), 'utf8');
const KEDIT = 'https://kedit.cc.cd/';
const HOST = 'cc.cd.kedit.folder_paste';

function fakeClock() {
  let now = 0;
  let sequence = 0;
  const timers = [];
  const clock = {
    get now() { return now; },
    setTimeout: (fn, ms) => {
      const id = ++sequence;
      timers.push({ id, at: now + (ms || 0), fn });
      return id;
    },
    clearTimeout: id => {
      const index = timers.findIndex(timer => timer.id === id);
      if (index !== -1) timers.splice(index, 1);
    },
    advance: ms => {
      now += ms;
      for (;;) {
        const due = timers.filter(timer => timer.at <= now).sort((a, b) => a.at - b.at);
        if (!due.length) return;
        const next = due[0];
        timers.splice(timers.indexOf(next), 1);
        next.fn();
      }
    },
    get pending() { return timers.length; },
  };
  return clock;
}

function contentFixture({ trusted = true, text = '', html = '', type = '', accepted = true,
  active = true, status = 'ok', top = true, reply = null, paths = ['C:\\one'],
  hold = null, editsDuringWait = null, deactivateDuringWait = false } = {}) {
  const clock = fakeClock();
  let paste;
  const requests = [];
  const events = [];
  const listeners = new Map();
  const editor = {
    textContent: 'sediment',
    isConnected: true,
    focus: () => {},
    addEventListener: (name, fn) => {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
    },
    removeEventListener: (name, fn) => {
      const list = listeners.get(name) || [];
      const index = list.indexOf(fn);
      if (index !== -1) list.splice(index, 1);
    },
    emit: name => (listeners.get(name) || []).slice().forEach(fn => fn({ type: name })),
    dispatchEvent: e => {
      events.push(e);
      if (e.type === 'kedit-folder-paste-begin' && accepted) e.defaultPrevented = true;
    },
  };
  const handlers = {};
  const window = { addEventListener: (name, fn) => {
    (handlers[name] ||= []).push(fn);
    if (name === 'paste') paste = fn;
  } };
  window.top = top ? window : {};
  const inserted = [];
  const documentElement = { dataset: {} };
  const document = {
    activeElement: active ? editor : null,
    documentElement,
    execCommand: (command, _ui, value) => { inserted.push({ command, value }); return true; },
  };
  const pagePorts = [];
  const makeChannel = () => {
    const portListeners = [];
    const port = {
      name: null,
      disconnected: false,
      onDisconnect: { addListener: fn => portListeners.push(fn) },
      drop: () => portListeners.forEach(fn => fn()),
      disconnect: () => { port.disconnected = true; },
    };
    pagePorts.push(port);
    return port;
  };
  vm.runInNewContext(source('content.js'), {
    window,
    document,
    crypto: { randomUUID: () => 'request-1' },
    CustomEvent: class { constructor(name, options) { this.type = name; Object.assign(this, options); } },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    chrome: {
      runtime: {
        connect: options => {
          const port = makeChannel();
          port.name = options?.name;
          return port;
        },
        sendMessage: async request => {
          requests.push(request);
          if (hold) await hold();
          if (editsDuringWait) editor.textContent = `${editor.textContent}!`;
          if (deactivateDuringWait) document.activeElement = null;
          if (reply) return reply;
          return { version: 1, requestId: request.requestId, status,
            paths: status === 'ok' ? paths : null };
        },
      },
    },
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
  const fire = (name, event) => (handlers[name] || []).forEach(fn => fn(event));
  return { run, requests, events, inserted, documentElement, document, editor, clock, pagePorts, fire,
    get channel() { return pagePorts[pagePorts.length - 1]; },
    prevented: () => prevented };
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

test('fallback refuses paths the page bridge would reject', async () => {
  for (const paths of [['"C:\\quoted"'], ['relative'], ['C:\\a\nb'], ['\\fake'], [], ['C:\\ok', 7]]) {
    const f = contentFixture({ accepted: false, paths }); await f.run();
    assert.equal(f.inserted.length, 0, JSON.stringify(paths));
  }
});

test('fallback drops a reply once the document changed while waiting', async () => {
  const f = contentFixture({ accepted: false, editsDuringWait: true }); await f.run();
  assert.equal(f.requests.length, 1);
  assert.equal(f.inserted.length, 0);
});

test('fallback drops a reply once the editor lost focus while waiting', async () => {
  const f = contentFixture({ accepted: false, deactivateDuringWait: true }); await f.run();
  assert.equal(f.inserted.length, 0);
});

test('fallback stops waiting when the author keeps typing', async () => {
  let release;
  const f = contentFixture({ accepted: false, hold: () => new Promise(r => { release = r; }) });
  const running = f.run();
  await Promise.resolve();
  f.editor.emit('keydown');
  release();
  await running;
  assert.equal(f.inserted.length, 0, 'a cancelled transaction never lands');
});

test('fallback times out instead of applying a late reply', async () => {
  let release;
  const f = contentFixture({ accepted: false, hold: () => new Promise(r => { release = r; }) });
  const running = f.run();
  await Promise.resolve();
  f.clock.advance(4000);
  release();
  await running;
  assert.equal(f.inserted.length, 0);
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

test('a top-level KEDIT page opens one channel so the host is prewarmed', () => {
  const f = contentFixture();
  assert.equal(f.pagePorts.length, 1);
  assert.equal(f.channel.name, 'kedit-page');
  assert.equal(f.requests.length, 0, 'warmup never reads the clipboard');
});

test('an iframe does not prewarm the host', () => {
  const f = contentFixture({ top: false });
  assert.equal(f.pagePorts.length, 0);
});

test('the page channel is reopened when the service worker restarts', () => {
  const f = contentFixture();
  f.channel.drop();
  assert.equal(f.pagePorts.length, 1, 'no immediate reconnect storm');
  f.clock.advance(250);
  assert.equal(f.pagePorts.length, 2);
  f.channel.drop();
  f.clock.advance(250);
  assert.equal(f.pagePorts.length, 2, 'backoff grows before the next retry');
  f.clock.advance(750);
  assert.equal(f.pagePorts.length, 3);
});

test('leaving a page closes its channel so the host can be released', () => {
  const f = contentFixture();
  f.fire('pagehide', { persisted: false });
  assert.equal(f.channel.disconnected, true);
  f.clock.advance(5000);
  assert.equal(f.pagePorts.length, 1, 'no reconnect after the page is gone');
});

test('a restored page rejoins the host session', () => {
  const f = contentFixture();
  f.fire('pagehide', { persisted: true });
  assert.equal(f.pagePorts.length, 1, 'bfcache keeps the channel without a new one');
  f.fire('pageshow', { persisted: true });
  assert.equal(f.pagePorts.length, 1);
  f.fire('pagehide', { persisted: false });
  f.fire('pageshow', { persisted: true });
  assert.equal(f.pagePorts.length, 2);
  assert.equal(f.clock.pending > 0, true);
});

function backgroundFixture() {
  const clock = fakeClock();
  const sockets = [];
  const pages = [];
  let messageListener;
  let connectListener;
  const runtime = {
    id: 'test-extension',
    onMessage: { addListener: fn => { messageListener = fn; } },
    onConnect: { addListener: fn => { connectListener = fn; } },
    connectNative: host => {
      const listeners = { message: [], disconnect: [] };
      const port = {
        host,
        posted: [],
        disconnected: false,
        postMessage(message) { this.posted.push(message); },
        disconnect() { this.disconnected = true; listeners.disconnect.forEach(fn => fn()); },
        onMessage: { addListener: fn => listeners.message.push(fn) },
        onDisconnect: { addListener: fn => listeners.disconnect.push(fn) },
        emit: message => listeners.message.forEach(fn => fn(message)),
        drop: () => listeners.disconnect.forEach(fn => fn()),
      };
      sockets.push(port);
      return port;
    },
  };
  vm.runInNewContext(source('background.js'), { chrome: { runtime }, setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout });
  const pageSender = (overrides = {}) => ({ id: runtime.id, frameId: 0, origin: 'https://kedit.cc.cd',
    url: KEDIT, tab: { url: KEDIT }, ...overrides });
  const openPage = (sender = pageSender()) => {
    const up = (fn => { const handlers = [];
      return { name: 'kedit-page', sender, onDisconnect: { addListener: fn2 => handlers.push(fn2) },
        postMessage() {}, disconnect() { handlers.forEach(fn2 => fn2()); },
        drop() { handlers.forEach(fn2 => fn2()); } }; })();
    pages.push(up);
    connectListener(up);
    return up;
  };
  const ask = (message, sender = pageSender()) => {
    const state = { handled: null, replies: [] };
    state.handled = messageListener(message, sender, reply => state.replies.push(reply));
    const wait = () => state.replies[0];
    return { state, wait, get reply() { return state.replies[0]; } };
  };
  const request = (requestId, names = []) => ({ version: 1, action: 'readFolders', requestId, names });
  return { clock, sockets, openPage, ask, request, pageSender, runtime,
    get socket() { return sockets[sockets.length - 1]; } };
}

test('one prewarmed host serves every paste without starting again', () => {
  const f = backgroundFixture();
  f.openPage();
  assert.equal(f.sockets.length, 1);
  f.socket.emit({ version: 1, type: 'ready' });
  const first = f.ask(f.request('one'));
  const second = f.ask(f.request('two', ['alpha']), f.pageSender({ url: `${KEDIT}#doc-2` }));
  assert.equal(first.state.handled, true);
  assert.equal(f.sockets.length, 1, 'a second page reuses the same host');
  assert.deepEqual(f.socket.posted.map(message => message.requestId), ['one', 'two']);
  assert.equal(f.socket.posted[1].names[0], 'alpha');
  f.socket.emit({ version: 1, requestId: 'one', status: 'ok', paths: ['C:\\one'] });
  f.socket.emit({ version: 1, requestId: 'two', status: 'ok', paths: ['D:\\two'] });
  assert.deepEqual(first.reply.paths, ['C:\\one']);
  assert.deepEqual(second.reply.paths, ['D:\\two']);
  assert.equal(f.socket.host, HOST);
});

test('a paste waits for readiness instead of assuming the port is up', () => {
  const f = backgroundFixture();
  f.openPage();
  const paste = f.ask(f.request('early'));
  assert.equal(f.socket.posted.length, 0, 'nothing is sent before the host is ready');
  f.clock.advance(1500);
  f.socket.emit({ version: 1, type: 'ready' });
  assert.deepEqual(f.socket.posted.map(message => message.requestId), ['early']);
  assert.equal(paste.state.replies.length, 0);
  f.socket.emit({ version: 1, requestId: 'early', status: 'ok', paths: ['C:\\one'] });
  assert.equal(paste.reply.status, 'ok');
});

test('an unreachable host fails the paste after the wait instead of hanging', () => {
  const f = backgroundFixture();
  f.openPage();
  const paste = f.ask(f.request('never'));
  f.clock.advance(3999);
  assert.equal(paste.state.replies.length, 0);
  f.clock.advance(1);
  assert.equal(paste.reply.status, 'unavailable');
  // A late readiness must not resurrect the abandoned paste.
  f.socket.emit({ version: 1, type: 'ready' });
  assert.deepEqual(f.socket.posted, []);
});

test('the last page closing releases the host while other pages keep it', () => {
  const f = backgroundFixture();
  const left = f.openPage();
  const right = f.openPage(f.pageSender({ url: `${KEDIT}#two` }));
  f.socket.emit({ version: 1, type: 'ready' });
  left.drop();
  assert.equal(f.sockets.length, 1);
  assert.equal(f.socket.disconnected, false, 'one page still needs the host');
  right.drop();
  assert.equal(f.socket.disconnected, true);
});

test('a dropped host fails in-flight work once and never replays it', () => {
  const f = backgroundFixture();
  f.openPage();
  f.socket.emit({ version: 1, type: 'ready' });
  const paste = f.ask(f.request('in-flight'));
  assert.equal(f.socket.posted.length, 1);
  f.socket.drop();
  assert.equal(paste.reply.status, 'unavailable');
  f.clock.advance(250);
  assert.equal(f.sockets.length, 2, 'the page is still open, so the host is retried');
  f.socket.emit({ version: 1, type: 'ready' });
  assert.deepEqual(f.socket.posted, [], 'the failed paste is never replayed');
  assert.equal(paste.state.replies.length, 1);
});

test('reconnects stop after repeated failures so a missing host cannot spin', () => {
  const f = backgroundFixture();
  f.openPage();
  f.socket.emit({ version: 1, type: 'ready' });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    f.socket.drop();
    f.clock.advance(30000);
  }
  const created = f.sockets.length;
  assert.ok(created <= 5, `created ${created} host processes`);
  f.clock.advance(600000);
  assert.equal(f.sockets.length, created, 'no further attempts once the budget is spent');
});

test('page control traffic and other callers never reach the host', () => {
  const f = backgroundFixture();
  f.openPage();
  f.socket.emit({ version: 1, type: 'ready' });
  assert.equal(f.ask({ version: 1, action: 'writeClipboard', requestId: 'x', names: [] }).state.handled, false);
  assert.equal(f.ask(f.request('bad'), f.pageSender({ url: 'https://evil.test/' })).state.handled, false);
  assert.equal(f.ask(f.request('bad'), f.pageSender({ origin: 'https://evil.test' })).state.handled, false);
  assert.equal(f.ask(f.request('bad'), f.pageSender({ frameId: 3 })).state.handled, false);
  assert.equal(f.ask(f.request('bad'), f.pageSender({ id: 'other' })).state.handled, false);
  assert.deepEqual(f.socket.posted, []);
});

test('unknown, duplicate and cross-page replies are dropped', () => {
  const f = backgroundFixture();
  f.openPage();
  f.socket.emit({ version: 1, type: 'ready' });
  const first = f.ask(f.request('one'));
  f.socket.emit({ version: 1, requestId: 'stranger', status: 'ok', paths: ['C:\\x'] });
  f.socket.emit({ version: 1, requestId: 'one', status: 'ok', paths: ['C:\\one'] });
  f.socket.emit({ version: 1, requestId: 'one', status: 'ok', paths: ['C:\\again'] });
  assert.equal(first.state.replies.length, 1);
  assert.deepEqual(first.reply.paths, ['C:\\one']);
});

test('a reply from another protocol version is never trusted', () => {
  const f = backgroundFixture();
  f.openPage();
  f.socket.emit({ version: 1, type: 'ready' });
  const paste = f.ask(f.request('v2'));
  f.socket.emit({ version: 2, requestId: 'v2', status: 'ok', paths: ['C:\\one'] });
  f.clock.advance(1000);
  assert.equal(paste.state.replies.length, 0, 'an unknown version cannot answer a paste');
  f.clock.advance(3000);
  assert.equal(paste.reply.status, 'unavailable', 'the paste fails instead of hanging');
  assert.equal(paste.reply.paths, undefined);
  assert.deepEqual(f.socket.posted.map(message => message.requestId), ['v2'], 'it is never re-sent');
});

test('mixed or shifted clipboard results never insert a partial path', () => {
  const f = backgroundFixture();
  f.openPage();
  f.socket.emit({ version: 1, type: 'ready' });
  const paste = f.ask(f.request('mixed'));
  for (const status of ['not-folders', 'changed']) {
    f.socket.emit({ version: 1, requestId: 'mixed', status, paths: null });
  }
  assert.equal(paste.state.replies.length, 1, 'only the first reply settles the paste');
  assert.equal(paste.reply.status, 'not-folders');
  assert.equal(paste.reply.paths, null);
});

test('production manifest is confined to KEDIT and requires only nativeMessaging', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.deepEqual(manifest.permissions, ['nativeMessaging']);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://kedit.cc.cd/*']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.ok(manifest.key);
});