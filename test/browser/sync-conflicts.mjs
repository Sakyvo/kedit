// Two isolated devices, real Sync/store/IndexedDB; only GitHub HTTP is simulated.
// Run: node test/browser/sync-conflicts.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { withBrowser, navigate, waitFor } from './cdp.mjs';

const FILE = 'Sync regression.md';
const initial = '# Notes\n\nStatus: initial.\n';
const pending = '# Notes\n\nStatus: pending.\n';
const complete = '# Notes\n\nStatus: complete.\n';
const blobs = new Map();
const uploads = [];
const shaOf = text => createHash('sha1').update(text).digest('hex');
const put = (path, text) => blobs.set(path, { text, sha: shaOf(text) });
put(FILE, initial);
let failUpload = false;

async function intercept(cdp, device) {
  cdp.listeners.set('Fetch.requestPaused', [async ({ requestId, request }) => {
    const url = new URL(request.url);
    let status = 200;
    let body;
    if (url.pathname === '/conf') {
      body = {};
    } else if (url.hostname === 'api.github.com') {
      const route = decodeURIComponent(url.pathname).replace('/repos/sync-fixture/kedit-app-data/', '');
      if (request.method === 'OPTIONS') body = {};
      else if (route.startsWith('commits/')) body = { commit: { tree: { sha: 'fixture-tree' } } };
      else if (route.startsWith('git/trees/')) {
        body = { tree: [...blobs].map(([path, blob]) => ({ path, sha: blob.sha, type: 'blob' })), truncated: false };
      } else if (route.startsWith('contents/')) {
        const path = route.slice('contents/'.length);
        const old = blobs.get(path);
        if (request.method === 'GET') {
          status = old ? 200 : 404;
          body = old ? { sha: old.sha, encoding: 'base64', content: Buffer.from(old.text).toString('base64') } : { message: 'Not Found' };
        } else if (request.method === 'PUT') {
          const input = JSON.parse(request.postData);
          if ((path === FILE && failUpload) || (old && input.sha !== old.sha)) {
            status = 409;
            body = { message: 'Fixture upload rejected' };
          } else {
            const text = Buffer.from(input.content, 'base64').toString('utf8');
            put(path, text);
            uploads.push({ device, path, text });
            body = { content: { sha: blobs.get(path).sha } };
          }
        } else {
          status = 400;
          body = { message: `Unexpected fixture method ${request.method}` };
        }
      } else {
        status = 400;
        body = { message: `Unexpected fixture route ${route}` };
      }
    } else {
      await cdp.send('Fetch.continueRequest', { requestId });
      return;
    }
    await cdp.send('Fetch.fulfillRequest', {
      requestId, responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
        { name: 'Access-Control-Allow-Methods', value: 'GET,PUT,OPTIONS' },
      ],
      body: Buffer.from(JSON.stringify(body)).toString('base64'),
    });
  }]);
  await cdp.send('Fetch.enable', { patterns: [
    { urlPattern: '*api.github.com/*' }, { urlPattern: '*/conf*' },
  ] });
}

const setup = async (cdp, url, name) => {
  await intercept(cdp, name);
  await navigate(cdp, url);
  await waitFor(cdp, 'window.fixtureReady || window.fixtureError', { timeout: 60000 });
  await cdp.evaluate(`
    if (window.fixtureError) throw new Error(fixtureError);
    window.fixtureNotices = [];
    fixtureStore.subscribeAction(({ type, payload }) => {
      if (type.startsWith('notification/')) fixtureNotices.push({ type, text: String(payload) });
    });
    await fixtureStore.dispatch('data/setSettings', 'autoSyncEvery: 2147483647\\n');
    await fixtureStore.dispatch('data/addGithubToken', {
      sub: 'sync-fixture', name: 'sync-fixture', accessToken: 'synthetic-token', isLogin: true,
      providerId: 'githubAppData',
    });
    await fixtureSync.afterSignIn();
  `);
};

async function sync(cdp) {
  await cdp.evaluate(`
    fixtureNotices.length = 0;
    window.fixturePreviousSync = fixtureStore.state.lastSyncSuccess;
    window.dispatchEvent(new Event('focus'));
    fixtureSync.requestSync();
  `);
  await waitFor(cdp, 'fixtureStore.state.lastSyncSuccess !== fixturePreviousSync && !fixtureStore.state.queue.isSyncRequested && fixtureStore.state.queue.isEmpty', { timeout: 30000, label: 'Sync round finished' });
  return cdp.evaluate(`
    await fixtureDb.sync();
    const file = fixtureStore.getters['file/items'].find(item => item.name === 'Sync regression');
    let content;
    try { content = file && await fixtureDb.loadItem(file.id + '/content'); }
    catch (error) { throw new Error(error.message + ': ' + JSON.stringify(fixtureNotices)); }
    return { content: content && JSON.parse(JSON.stringify(content)), notices: fixtureNotices.slice() };
  `);
}

async function edit(cdp, text) {
  await cdp.evaluate(`
    const file = fixtureStore.getters['file/items'].find(item => item.name === 'Sync regression');
    await fixtureDb.loadItem(file.id + '/content');
    fixtureStore.commit('file/setCurrentId', file.id);
  `);
  await waitFor(cdp, `fixtureStore.getters['content/current'].id`);
  await cdp.evaluate(`
    await fixtureStore.dispatch('content/patchCurrent', { text: ${JSON.stringify(text)} });
    await fixtureDb.sync();
  `);
}

const noConflict = result => assert.equal(result.notices.filter(note => note.text.includes('存在冲突')).length, 0, JSON.stringify(result.notices));
const noError = result => assert.deepEqual(result.notices.filter(note => note.type === 'notification/error'), []);
const remoteText = cdp => cdp.evaluate(`return fixtureProvider.parseContent(${JSON.stringify(blobs.get(FILE).text)}, 'remote/content').text;`);

const server = await createServer({
  configFile: false,
  optimizeDeps: { entries: ['src/services/syncSvc.js'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [vue(), {
    name: 'sync-fixture-entry',
    configureServer(vite) {
      vite.middlewares.use('/sync-fixture', (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(`<html><body><script type="module">
          try {
            window.fixtureStore = (await import('/src/store/index.js')).default;
            window.fixtureSync = (await import('/src/services/syncSvc.js')).default;
            window.fixtureDb = (await import('/src/services/localDbSvc.js')).default;
            window.fixtureProvider = (await import('/src/services/providers/common/Provider.js')).default;
            await (await import('/src/services/networkSvc.js')).default.init();
            await fixtureSync.init();
            window.fixtureReady = true;
          } catch (error) { window.fixtureError = error.stack; }
        </script></body></html>`);
      });
    },
  }],
  resolve: { alias: { '@': `${process.cwd()}/src` }, extensions: ['.js', '.vue', '.json'] },
  server: { port: 0, host: '127.0.0.1', watch: null },
  logLevel: 'error',
});
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/sync-fixture`;
try {
  await withBrowser(async (a) => withBrowser(async (b) => {
    await setup(a, url, 'A');
    const first = await sync(a);
    noError(first);
    assert.equal(first.content?.text, initial, 'first Sync downloads the fixture');
    await edit(a, pending);
    noError(await sync(a));
    await setup(b, url, 'B');
    const downloaded = await sync(b);
    noError(downloaded);
    assert.equal(downloaded.content.text, pending);
    await edit(a, complete);
    noError(await sync(a));
    const result = await sync(b);
    noError(result);
    assert.equal(result.content.text, complete, 'untouched B must adopt the remote body, not fuse it');
    noConflict(result);
    assert.equal(await remoteText(b), complete, 'B must not upload damaged text');
    assert.equal(uploads.filter(entry => entry.device === 'B' && entry.path === FILE).length, 0);
    const stable = blobs.get(FILE).text;
    noConflict(await sync(b));
    assert.equal(blobs.get(FILE).text, stable, 'no-op Sync must not churn the remote');
    console.log('PASS remote-only update on an untouched device');

    // Local-only upload, followed by a genuine overlapping edit on both devices.
    const shared = '# Notes\n\nStatus: shared.\n';
    await edit(b, shared);
    const localOnly = await sync(b);
    noError(localOnly);
    noConflict(localOnly);
    assert.equal(await remoteText(b), shared);
    noConflict(await sync(a));
    await edit(a, '# Notes\n\nStatus: remote.\n');
    await edit(b, '# Notes\n\nStatus: local.\n');
    noError(await sync(a));
    const merged = await sync(b);
    noError(merged);
    assert.equal(merged.content.text, '# Notes\n\nStatus: remotelocal.\n');
    assert.equal(merged.notices.filter(note => note.text.includes('存在冲突')).length, 1);
    assert.equal(await remoteText(b), merged.content.text);
    console.log('PASS local-only upload and existing overlapping merge');

    // The failed B upload must remain an edit when A changes the remote next.
    noError(await sync(a));
    const baseline = merged.content.text;
    const offlineEdit = baseline + '\nLocal addition.\n';
    const remoteEdit = '# Remote heading\n\nStatus: remotelocal.\n';
    await edit(b, offlineEdit);
    failUpload = true;
    const failed = await sync(b);
    failUpload = false;
    assert.ok(failed.notices.some(note => note.type === 'notification/error'));
    assert.equal(failed.content.text, offlineEdit);
    assert.equal(await remoteText(b), baseline);
    await edit(a, remoteEdit);
    noError(await sync(a));
    const retried = await sync(b);
    noError(retried);
    assert.equal(retried.content.text, remoteEdit + '\nLocal addition.\n');
    assert.equal(retried.notices.filter(note => note.text.includes('存在冲突')).length, 1);
    assert.equal(await remoteText(b), retried.content.text);
    console.log('PASS failed upload preserves pending edits');

    // Equal bodies with different metadata must not report a body conflict.
    noError(await sync(a));
    const equalBody = '# Equal bodies\n';
    await edit(a, equalBody);
    await a.evaluate(`await fixtureStore.dispatch('content/patchCurrent', { properties: 'title: remote\\n' });`);
    noError(await sync(a));
    await edit(b, equalBody);
    await b.evaluate(`
      await fixtureStore.dispatch('content/patchCurrent', { properties: 'title: local\\n' });
      const file = fixtureStore.getters['file/current'];
      fixtureStore.commit('syncedContent/setItem', { id: file.id + '/syncedContent', v: 1 });
    `);
    const equalWithoutBase = await sync(b);
    noError(equalWithoutBase);
    assert.equal(equalWithoutBase.content.text, equalBody);
    assert.equal(equalWithoutBase.content.properties, 'title: remote\n');
    noConflict(equalWithoutBase);
    assert.equal(await remoteText(b), equalBody);

    const changedEqualBody = '# Still equal\n';
    await edit(a, changedEqualBody);
    await edit(b, changedEqualBody);
    await b.evaluate(`await fixtureStore.dispatch('content/patchCurrent', { properties: 'title: local next\\n' });`);
    noError(await sync(a));
    const equalWithBase = await sync(b);
    noError(equalWithBase);
    noConflict(equalWithBase);
    assert.equal(equalWithBase.content.text, changedEqualBody);
    assert.equal(equalWithBase.content.properties, 'title: local next\n');
    const serialized = blobs.get(FILE).text;
    noConflict(await sync(b));
    assert.equal(blobs.get(FILE).text, serialized);
    console.log('PASS equal bodies with and without a baseline retain metadata behavior');

    // Reopening must preserve the confirmed baseline in IndexedDB.
    noError(await sync(a));
    await setup(b, url, 'B');
    await edit(a, '# After reopen\n');
    noError(await sync(a));
    const reopened = await sync(b);
    noError(reopened);
    noConflict(reopened);
    assert.equal(reopened.content.text, '# After reopen\n');
    assert.equal(await remoteText(b), '# After reopen\n');
    console.log('PASS confirmed baseline survives page reopen');

    // Old releases saved a successful first download as [seen, null, null].
    await edit(a, pending);
    noError(await sync(a));
    noError(await sync(b));
    await b.evaluate(`
      const file = fixtureStore.getters['file/items'].find(item => item.name === 'Sync regression');
      const content = JSON.parse(JSON.stringify(await fixtureDb.loadItem(file.id + '/content')));
      fixtureStore.commit('syncedContent/setItem', {
        id: file.id + '/syncedContent', v: 1,
        historyData: { [content.hash]: content }, syncHistory: { main: [content.hash, null, null] },
      });
      await fixtureDb.sync();
      await new Promise(resolve => fixtureDb.connection.createTx(tx => { tx.oncomplete = resolve; }));
    `);
    await setup(b, url, 'B');
    await edit(a, complete);
    noError(await sync(a));
    const legacy = await sync(b);
    noError(legacy);
    assert.equal(legacy.content.text, complete, 'legacy downloaded evidence must not become a competing edit');
    noConflict(legacy);
    assert.equal(await remoteText(b), complete);
    console.log('PASS legacy first-download state survives reopen without fusion');

    // The same legacy state is not permission to discard a later local edit.
    await b.evaluate(`
      const file = fixtureStore.getters['file/items'].find(item => item.name === 'Sync regression');
      const content = JSON.parse(JSON.stringify(await fixtureDb.loadItem(file.id + '/content')));
      fixtureStore.commit('syncedContent/setItem', {
        id: file.id + '/syncedContent', v: 1,
        historyData: { [content.hash]: content }, syncHistory: { main: [content.hash, null, null] },
      });
    `);
    await edit(b, complete + '\nUnsynced local paragraph.\n');
    await b.evaluate(`
      await fixtureDb.sync();
      await new Promise(resolve => fixtureDb.connection.createTx(tx => { tx.oncomplete = resolve; }));
    `);
    await setup(b, url, 'B');
    const remoteChange = '# Remote title\n\nStatus: complete.\n';
    await edit(a, remoteChange);
    noError(await sync(a));
    const legacyEdited = await sync(b);
    noError(legacyEdited);
    assert.equal(legacyEdited.content.text, remoteChange + '\nUnsynced local paragraph.\n');
    assert.equal(legacyEdited.notices.filter(note => note.text.includes('存在冲突')).length, 1);
    assert.equal(await remoteText(b), legacyEdited.content.text);
    console.log('PASS real local edits survive legacy-state reopen');

    noError(await sync(a));
    for (let round = 1; round <= 3; round += 1) {
      const text = `# Revision ${round}\n\nPreserved paragraph.\n`;
      await setup(b, url, 'B');
      await edit(a, text);
      noError(await sync(a));
      const received = await sync(b);
      noError(received);
      noConflict(received);
      assert.equal(received.content.text, text);
      assert.equal(await remoteText(b), text);
      const saved = blobs.get(FILE).text;
      noConflict(await sync(b));
      assert.equal(blobs.get(FILE).text, saved);
    }
    console.log('PASS repeated remote updates and no-op rounds after reopen');

    // A legacy upload attempt is NOT confirmed evidence, unlike a download.
    const current = '# Revision 3\n\nPreserved paragraph.\n';
    await edit(b, current + '\nPending local edit.\n');
    await b.evaluate(`
      const content = JSON.parse(JSON.stringify(fixtureStore.getters['content/current']));
      const file = fixtureStore.getters['file/current'];
      fixtureStore.commit('syncedContent/setItem', {
        id: file.id + '/syncedContent', v: 1,
        historyData: { [content.hash]: content }, syncHistory: { main: [content.hash, null, content.hash] },
      });
      await fixtureDb.sync();
      await new Promise(resolve => fixtureDb.connection.createTx(tx => { tx.oncomplete = resolve; }));
    `);
    await setup(b, url, 'B');
    const differentRemote = current + '\nNew remote edit.\n';
    await edit(a, differentRemote);
    noError(await sync(a));
    const unconfirmed = await sync(b);
    noError(unconfirmed);
    // Character-level fusion is intentionally unchanged for a genuine no-base conflict.
    assert.equal(unconfirmed.content.text, current + '\nNew remotePending local edit.\n');
    assert.equal(unconfirmed.notices.filter(note => note.text.includes('存在冲突')).length, 1);
    assert.equal(await remoteText(b), unconfirmed.content.text);
    console.log('PASS missing baseline never turns an attempted upload into an untouched copy');
  }));
} finally {
  await server.close();
}
