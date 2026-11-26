import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import yaml from 'js-yaml';
import settingsYamlSvc from '../../src/services/settingsYamlSvc.js';

const DAY = 86400000;
const NOW = new Date('2026-08-20T12:00:00').getTime();
const source = readFileSync(new URL('../../src/services/imgCleanupSvc.js', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '')
  .replace('export default {', 'globalThis.service = {')
  .replace("await import('./editorSvc')", 'await loadEditor()');
const defaults = yaml.load(readFileSync(new URL('../../src/data/defaults/defaultSettings.yml', import.meta.url), 'utf8'));

function fixture({ settings = '', inventory = {}, clocks = {}, referenced = {}, failures = [], main = true } = {}) {
  const removed = [];
  const localRemoved = [];
  const released = [];
  const notifications = [];
  const errors = [];
  const getters = {
    'data/settings': settings,
    'data/imgCleanup': { version: 1, unreferencedSince: { ...clocks }, log: [] },
    'workspace/currentWorkspace': { id: main ? 'main' : 'other', providerId: 'test' },
    'workspace/currentWorkspaceIsGit': true,
    'workspace/syncToken': 'fixture-token',
    'img/getWorkspaceImgPath': {},
    'img/getCheckedStorage': null,
  };
  Object.defineProperty(getters, 'data/computedSettings', {
    get: () => settingsYamlSvc.mergeSettings(defaults, getters['data/settings']),
  });
  const context = {
    MD5: value => ({ toString: () => value }),
    settingsYamlSvc,
    store: {
      getters,
      async dispatch(type, payload) {
        if (type === 'data/setImgCleanup') getters['data/imgCleanup'] = { version: 1, ...payload };
        else if (type === 'data/setSettings') getters['data/settings'] = payload;
        else notifications.push({ type, payload });
      },
    },
    utils: {
      serializeObject: JSON.stringify,
      awaitSequence: async (entries, run) => { for (const entry of entries) await run(entry); },
    },
    localDbSvc: { removeImgItem: async path => localRemoved.push(path) },
    gitWorkspaceSvc: { shaByPath: { ...inventory } },
    workspaceBackupSvc: { collectReferencedImagePaths: async () => referenced },
    providerRegistry: { providersById: { test: {
      getToken: () => 'fixture-token',
      async removeWorkspaceItem({ syncData }) {
        if (failures.includes(syncData.id)) throw new Error('Fixture deletion failure');
        removed.push(syncData.id);
      },
    } } },
    loadEditor: async () => ({ default: { releaseImgCache: path => released.push(path) } }),
    Date: class extends Date { static now() { return NOW; } },
    console: { error: error => errors.push(error) },
  };
  runInNewContext(source, context, { filename: 'imgCleanupSvc.js' });
  return { svc: context.service, getters, removed, localRemoved, released, notifications, errors,
    inventory: context.gitWorkspaceSvc.shaByPath, referenced };
}

test('the shipped default is automatic cleanup after three days', async () => {
  assert.deepEqual(defaults.imageCleanup, { enabled: true, days: 3 });
  const f = fixture({ inventory: { 'imgs/old.png': 'sha', 'imgs/recent.png': 'new' }, clocks: {
    'imgs/old.png': NOW - 3 * DAY, 'imgs/recent.png': NOW - 3 * DAY + 1,
  } });
  await f.svc.sweepAfterSync();
  assert.deepEqual(f.removed, ['imgs/old.png']);
  assert.deepEqual(f.localRemoved, ['/imgs/old.png']);
  assert.deepEqual(f.released, ['/imgs/old.png']);
  assert.match(f.notifications[0].payload, /连续 3 天/);
});

test('custom days are evaluated against existing clocks without resetting them', async () => {
  const f = fixture({ settings: 'imageCleanup:\n  days: 7\n', inventory: { 'imgs/a.png': 'a' }, clocks: { 'imgs/a.png': NOW - 6 * DAY } });
  await f.svc.sweepAfterSync();
  assert.deepEqual(f.removed, []);
  await f.svc.savePolicy({ enabled: true, days: 3 });
  assert.equal(f.getters['data/imgCleanup'].unreferencedSince['imgs/a.png'], NOW - 6 * DAY);
  assert.deepEqual(f.removed, [], 'saving alone never deletes');
  await f.svc.sweepAfterSync();
  assert.deepEqual(f.removed, ['imgs/a.png']);
});

test('disabled cleanup still tracks references and retains time for re-enabling', async () => {
  const f = fixture({ settings: 'imageCleanup:\n  enabled: false\n', inventory: { 'imgs/a.png': 'a', 'imgs/b.png': 'b', 'imgs/new.png': 'n' },
    clocks: { 'imgs/a.png': NOW - 6 * DAY, 'imgs/b.png': NOW - 8 * DAY, 'imgs/gone.png': NOW - 8 * DAY }, referenced: { 'imgs/b.png': true } });
  await f.svc.sweepAfterSync();
  assert.deepEqual(f.removed, []);
  assert.deepEqual(JSON.parse(JSON.stringify(f.getters['data/imgCleanup'].unreferencedSince)), { 'imgs/a.png': NOW - 6 * DAY, 'imgs/new.png': NOW });
  await f.svc.savePolicy({ enabled: true, days: 3 });
  await f.svc.sweepAfterSync();
  assert.deepEqual(f.removed, ['imgs/a.png']);
});

test('new uploads retain the existing date-based grace period', async () => {
  const f = fixture({ inventory: { 'imgs/2026-08-20/a.png': 'a', 'imgs/2026-08-19/b.png': 'b', 'imgs/2026-08-18/c.png': 'c' } });
  await f.svc.sweepAfterSync();
  assert.deepEqual(JSON.parse(JSON.stringify(f.getters['data/imgCleanup'].unreferencedSince)), { 'imgs/2026-08-18/c.png': NOW });
  assert.deepEqual(f.removed, []);
});

for (const days of [0, -1, 1.5, NaN, Infinity, '', '3', null, Number.MAX_SAFE_INTEGER]) {
  test(`invalid policy ${JSON.stringify(days)} cannot be saved or delete images`, async () => {
    const f = fixture({ inventory: { 'imgs/a.png': 'a' }, clocks: { 'imgs/a.png': NOW - 20 * DAY } });
    await assert.rejects(f.svc.savePolicy({ enabled: true, days }), /整数/);
    assert.equal(f.getters['data/settings'], '');
    f.getters['data/settings'] = yaml.dump({ imageCleanup: { enabled: true, days } });
    await f.svc.sweepAfterSync();
    assert.deepEqual(f.removed, []);
    assert.equal(f.notifications.at(-1).type, 'notification/error');
  });
}

test('settings edits preserve comments, unknown keys and Sync projection', async () => {
  const f = fixture({ settings: '# mine\nfontSizeFactor: 1.2\ncustomThing: keep\nimageCleanup:\n  days: 7 # note\n  future: keep\n' });
  await f.svc.savePolicy({ enabled: false, days: 12 });
  const text = f.getters['data/settings'];
  assert.match(text, /# mine/);
  assert.match(text, /days: 12 # note/);
  assert.match(text, /future: keep/);
  assert.match(text, /customThing: keep/);
  const remote = settingsYamlSvc.projectForSync(text);
  assert.equal(yaml.load(remote).imageCleanup.enabled, false);
  assert.equal(yaml.load(remote).imageCleanup.days, 12);
  const received = settingsYamlSvc.reconcileRemote('', remote);
  assert.deepEqual(settingsYamlSvc.mergeSettings(defaults, received).imageCleanup, { enabled: false, days: 12 });
});

test('manual cleanup still works while automatic cleanup is disabled', async () => {
  const f = fixture({ settings: 'imageCleanup:\n  enabled: false\n', inventory: { 'imgs/a.png': 'a' } });
  const result = await f.svc.deleteImgs([{ path: 'imgs/a.png', sha: 'a' }]);
  assert.deepEqual(Array.from(result.removedPaths), ['imgs/a.png']);
  assert.equal(f.getters['data/imgCleanup'].log[0].path, 'imgs/a.png');
});

test('partial deletion failures retain the failed clock and only log success', async () => {
  const f = fixture({ inventory: { 'imgs/a.png': 'a', 'imgs/b.png': 'b' }, clocks: { 'imgs/a.png': NOW - 5 * DAY, 'imgs/b.png': NOW - 5 * DAY }, failures: ['imgs/b.png'] });
  await f.svc.sweepAfterSync();
  assert.deepEqual(f.removed, ['imgs/a.png']);
  assert.equal(f.getters['data/imgCleanup'].unreferencedSince['imgs/b.png'], NOW - 5 * DAY);
  assert.equal(f.getters['data/imgCleanup'].log.length, 1);
  assert.match(f.notifications.at(-1).payload, /下轮同步重试/);
});

test('path, SHA and workspace guards still protect non-image content', async () => {
  const f = fixture({ inventory: { 'imgs/a.png': 'a', 'document.md': 'd', '.stackedit-data/settings.json': 's', 'imgs/note.md': 'n' } });
  for (const [path, sha] of [['imgs/a.png', 'stale'], ['document.md', 'd'], ['.stackedit-data/settings.json', 's'], ['imgs/note.md', 'n']]) {
    await assert.rejects(f.svc.removeImg(path, sha), /拒绝删除/);
  }
  assert.deepEqual(f.removed, []);
  const other = fixture({ main: false, inventory: { 'imgs/a.png': 'a' }, clocks: { 'imgs/a.png': NOW - 20 * DAY } });
  await other.svc.sweepAfterSync();
  assert.deepEqual(other.removed, []);
});

for (const policy of [null, false, 'off', [], { enabled: 'false', days: 3 }]) {
  test(`malformed YAML policy ${JSON.stringify(policy)} never deletes`, async () => {
    const f = fixture({ settings: yaml.dump({ imageCleanup: policy }), inventory: { 'imgs/a.png': 'a' }, clocks: { 'imgs/a.png': NOW - 20 * DAY } });
    await f.svc.sweepAfterSync();
    assert.deepEqual(f.removed, []);
    assert.equal(f.notifications.at(-1).type, 'notification/error');
    await f.svc.savePolicy({ enabled: true, days: 5 });
    assert.deepEqual(yaml.load(f.getters['data/settings']).imageCleanup, { enabled: true, days: 5 });
    assert.equal(f.svc.getPolicy().days, 5);
  });
}

test('entry status uses saved policy and distinguishes grace from unstarted clocks', async () => {
  const f = fixture({ inventory: { 'imgs/2026-08-20/a.png': 'a', 'imgs/b.png': 'b', 'imgs/c.png': 'c' }, clocks: { 'imgs/c.png': NOW - 3 * DAY } });
  const entries = await f.svc.scanUnreferenced();
  const status = path => JSON.parse(JSON.stringify(f.svc.describeEntry(entries.find(e => e.path === path))));
  assert.deepEqual(status('imgs/2026-08-20/a.png'), { ageLabel: '上传保护期', cleanupLabel: '', due: false });
  assert.deepEqual(status('imgs/b.png'), { ageLabel: '待同步开始计时', cleanupLabel: '', due: false });
  assert.deepEqual(status('imgs/c.png'), { ageLabel: '未引用 3 天', cleanupLabel: '下次同步清理', due: true });
  await f.svc.savePolicy({ enabled: true, days: 7 });
  assert.equal(status('imgs/c.png').cleanupLabel, '距清理约 4 天');
  await f.svc.savePolicy({ enabled: false, days: 7 });
  assert.equal(status('imgs/c.png').cleanupLabel, '自动清理已关闭');
});

test('manual scan is read-only, filters references and never starts clocks', async () => {
  const f = fixture({ inventory: { 'imgs/a.png': 'a', 'imgs/b.png': 'b', 'docs/a.md': 'd' }, referenced: { 'imgs/b.png': true } });
  const entries = await f.svc.scanUnreferenced();
  assert.deepEqual(Array.from(entries, e => e.path), ['imgs/a.png']);
  assert.deepEqual(f.getters['data/imgCleanup'].unreferencedSince, {});
  assert.deepEqual(f.removed, []);
});

test('reconciled policy takes effect on another device before its next sweep', async () => {
  const a = fixture();
  await a.svc.savePolicy({ enabled: false, days: 10 });
  const b = fixture({ inventory: { 'imgs/a.png': 'a' }, clocks: { 'imgs/a.png': NOW - 20 * DAY } });
  b.getters['data/settings'] = settingsYamlSvc.reconcileRemote('', settingsYamlSvc.projectForSync(a.getters['data/settings']));
  await b.svc.sweepAfterSync();
  assert.deepEqual(b.removed, []);
  assert.equal(b.svc.getPolicy().days, 10);
});
