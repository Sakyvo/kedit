/**
 * Node harness for the segmented-loading gate (task 011 / ADR-0012).
 * Run: node test/unit/harness/segmentedLoadingGate.harness.mjs
 *
 * The gate decides whether the segmented pipeline is used at all. Its contract
 * is deliberately forgiving: anything except an explicit `false` means ON, so a
 * missing/blank settings file keeps the feature enabled after an upgrade.
 *
 * Why this harness exists: the 011 bug was NOT in this function's logic but in
 * *when* it was consulted (editorSvc.init() ran the content watcher before the
 * settings watcher had projected the setting, so a stored OFF was ignored at
 * startup). Pure logic tests cannot catch an ordering bug; what they CAN do is
 * pin the contract so the projection code has a single unambiguous source of
 * truth to consult. The startup path itself is covered by the manual item D0
 * in 016-manual-acceptance-checklist.md.
 */
import assert from 'node:assert/strict';
import { isSegmentedLoadingEnabled } from '../../../src/services/editor/segmentedLoading.js';

// --- explicit OFF is the only way to disable ---
{
  assert.equal(isSegmentedLoadingEnabled({ segmentedLoading: false }), false, 'explicit false => OFF');
}

// --- everything else keeps it ON ---
{
  assert.equal(isSegmentedLoadingEnabled({ segmentedLoading: true }), true, 'explicit true => ON');
  assert.equal(isSegmentedLoadingEnabled({ segmentedLoading: 'false' }), true,
    'string "false" is not an explicit false => ON (YAML would parse it as a string)');
  assert.equal(isSegmentedLoadingEnabled({ segmentedLoading: null }), true, 'null => ON');
  assert.equal(isSegmentedLoadingEnabled({ segmentedLoading: 0 }), true, '0 => ON (not === false)');
}

// --- missing settings / missing key default to ON (fresh install, upgrade) ---
{
  assert.equal(isSegmentedLoadingEnabled(undefined), true, 'no settings => ON');
  assert.equal(isSegmentedLoadingEnabled(null), true, 'null settings => ON');
  assert.equal(isSegmentedLoadingEnabled({}), true, 'settings without the key => ON');
  assert.equal(isSegmentedLoadingEnabled({ autoSyncEvery: 120000 }), true, 'unrelated keys only => ON');
}

// --- the gate never mutates its input ---
{
  const settings = { segmentedLoading: false, other: 1 };
  const snapshot = JSON.stringify(settings);
  isSegmentedLoadingEnabled(settings);
  assert.equal(JSON.stringify(settings), snapshot, 'input must not be mutated');
}

// --- OFF survives a settings round-trip through the YAML-shaped text ---
{
  // Mirrors what settingsYamlSvc produces/parses: `segmentedLoading: false`
  // must project to the JS boolean false, not the string "false".
  const parseSettings = (text) => {
    const out = {};
    `${text}`.split('\n').forEach((line) => {
      const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line.trim());
      if (!m) {
        return;
      }
      const raw = m[2].trim();
      if (raw === 'true') {
        out[m[1]] = true;
      } else if (raw === 'false') {
        out[m[1]] = false;
      } else if (raw !== '') {
        out[m[1]] = raw;
      }
    });
    return out;
  };
  assert.equal(
    isSegmentedLoadingEnabled(parseSettings('segmentedLoading: false\n')),
    false,
    'OFF must survive the text round-trip as a boolean',
  );
  assert.equal(
    isSegmentedLoadingEnabled(parseSettings('')),
    true,
    'blank settings text => ON',
  );
}

console.log('segmentedLoadingGate.harness: all assertions passed');