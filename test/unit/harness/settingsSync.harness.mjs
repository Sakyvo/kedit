/**
 * Node harness for settings Sync reconciliation (ADR 0013, task #041).
 * Run: node test/unit/harness/settingsSync.harness.mjs
 *
 * The round model mirrors syncSvc.syncDataItem's settings branch: the remote
 * file holds a projection (excluded keys stripped), a round reconciles it into
 * the local yaml text through settingsYamlSvc.reconcileRemote, the per-device
 * baseline then becomes projectForSync(local) (the syncData hash equivalent),
 * and a device uploads when its projection differs from the remote file.
 */
import assert from 'node:assert/strict';
import svc from '../../../src/services/settingsYamlSvc.js';

const project = svc.projectForSync;
const valueOf = (text, key) => svc.get(text, [key]);
const newDevice = (text, baseline = '') => ({ text, baseline });

// Sync every device to a fixpoint. Returns the upload count (a bounded count
// proves the reconciliation does not ping-pong between devices).
function syncDevices(devices, cloud, maxRounds = 12) {
  let uploads = 0;
  for (let round = 0; round < maxRounds; round += 1) {
    let moved = false;
    devices.forEach((dev) => {
      dev.text = svc.reconcileRemote(dev.text, cloud.text, dev.baseline);
      dev.baseline = project(dev.text);
      if (project(dev.text) !== cloud.text) {
        cloud.text = project(dev.text);
        uploads += 1;
        moved = true;
      }
    });
    if (!moved) {
      return uploads;
    }
  }
  throw new Error('settings sync did not converge');
}

// --- 1. Reported bug: a remote default must never discard a local edit ---
{
  const a = newDevice('autoSyncEvery: 120000\neditor:\n  inlineImages: false\n');
  const cloud = { text: 'autoSyncEvery: 90000\n' };
  syncDevices([a], cloud);
  assert.equal(valueOf(a.text, 'autoSyncEvery'), 120000);
  assert.equal(valueOf(a.text, 'editor').inlineImages, false);
  // The surviving local value is pushed back, so the other side gets it too.
  assert.equal(valueOf(cloud.text, 'autoSyncEvery'), 120000);
}

// --- 2. A fresh device still pulls the whole remote config ---
{
  const fresh = newDevice('');
  const cloud = { text: 'autoSyncEvery: 120000\nsegmentedLoading: false\n' };
  syncDevices([fresh], cloud);
  assert.equal(valueOf(fresh.text, 'autoSyncEvery'), 120000);
  assert.equal(valueOf(fresh.text, 'segmentedLoading'), false);
}

// --- 3. Concurrent edits to different keys both survive ---
{
  const a = newDevice('autoSyncEvery: 120000\n');
  const b = newDevice('segmentedLoading: false\n');
  const cloud = { text: '' };
  const uploads = syncDevices([a, b], cloud);
  [a, b].forEach((dev) => {
    assert.equal(valueOf(dev.text, 'autoSyncEvery'), 120000);
    assert.equal(valueOf(dev.text, 'segmentedLoading'), false);
  });
  assert.ok(uploads <= 3, `expected a bounded upload count, got ${uploads}`);
}

// --- 4. Remote changes (including deletions) still reach an untouched local ---
{
  const a = newDevice('segmentedLoading: false\nautoSyncEvery: 120000\n',
    'segmentedLoading: false\nautoSyncEvery: 120000\n');
  const cloud = { text: 'autoSyncEvery: 90000\n' };
  syncDevices([a], cloud);
  assert.equal(valueOf(a.text, 'segmentedLoading'), undefined);
  assert.equal(valueOf(a.text, 'autoSyncEvery'), 90000);
}

// --- 5. A local edit beats a concurrent remote deletion (value re-uploaded) ---
{
  const a = newDevice('segmentedLoading: true\n', 'segmentedLoading: false\n');
  const cloud = { text: '' };
  syncDevices([a], cloud);
  assert.equal(valueOf(a.text, 'segmentedLoading'), true);
  assert.equal(valueOf(cloud.text, 'segmentedLoading'), true);
}

// --- 6. Device-local (excluded) keys stay local while the rest Syncs ---
{
  const a = newDevice('colorTheme: dark\nautoSyncEvery: 120000\n');
  const b = newDevice('colorTheme: light\nautoSyncEvery: 90000\n');
  const cloud = { text: '' };
  syncDevices([a, b], cloud);
  assert.equal(valueOf(a.text, 'colorTheme'), 'dark');
  assert.equal(valueOf(b.text, 'colorTheme'), 'light');
  // First-sync (no baseline) is last-write-wins; both sides must agree after it.
  assert.equal(valueOf(a.text, 'autoSyncEvery'), valueOf(b.text, 'autoSyncEvery'));
  assert.equal(valueOf(a.text, 'autoSyncEvery'), valueOf(cloud.text, 'autoSyncEvery'));
}

// --- 7. A remotely changed multi-line value stays valid yaml; local comments
//        and local edits elsewhere survive ---
{
  const a = newDevice('# 我的注释\nautoSyncEvery: 120000\nnewFileContent: hello\n',
    'autoSyncEvery: 90000\nnewFileContent: hello\n');
  const cloud = { text: 'autoSyncEvery: 90000\nnewFileContent: |-\n  one\n  two\n' };
  syncDevices([a], cloud);
  assert.equal(valueOf(a.text, 'autoSyncEvery'), 120000);
  assert.equal(valueOf(a.text, 'newFileContent'), valueOf(cloud.text, 'newFileContent'));
  assert.ok(a.text.includes('# 我的注释'), 'local comment lost');
}

// --- 8. Reconciliation is idempotent once both sides agree ---
{
  const a = newDevice('autoSyncEvery: 120000\n# 注释\n');
  const cloud = { text: '' };
  syncDevices([a], cloud);
  const stable = a.text;
  assert.equal(svc.reconcileRemote(a.text, cloud.text, a.baseline), stable);
}

console.log('settingsSync: all cases pass');