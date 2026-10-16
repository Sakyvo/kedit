import assert from 'node:assert/strict';
import {
  isDynamicLoadingEnabled,
  getDynamicLoadingThreshold,
} from '../../../src/services/editor/dynamicLoading.js';

// --- 总闸:默认开(保页面不卡死是硬要求);显式 false 才关 ---
{
  assert.equal(isDynamicLoadingEnabled({ dynamicLoading: true }), true, 'explicit true => ON');
  assert.equal(isDynamicLoadingEnabled({ dynamicLoading: false }), false, 'explicit false => OFF');
  assert.equal(isDynamicLoadingEnabled(undefined), true, 'no settings => default ON');
  assert.equal(isDynamicLoadingEnabled(null), true, 'null settings => ON');
  assert.equal(isDynamicLoadingEnabled({}), true, 'empty settings => default ON');
  assert.equal(isDynamicLoadingEnabled({ segmentedLoading: true }), true, 'old key ignored, stays ON');
  assert.equal(isDynamicLoadingEnabled(['dynamic']), true, 'garbage => ON (safe default)');
}

// --- 阈值:默认 50000,可自定义;非法值回退默认 ---
{
  assert.equal(getDynamicLoadingThreshold({}), 50000, 'empty => default 50000');
  assert.equal(getDynamicLoadingThreshold(undefined), 50000, 'undefined => default 50000');
  assert.equal(getDynamicLoadingThreshold({ dynamicLoadingThreshold: 80000 }), 80000, 'custom 80000');
  assert.equal(getDynamicLoadingThreshold({ dynamicLoadingThreshold: '120000' }), 120000, 'numeric string ok');
  assert.equal(getDynamicLoadingThreshold({ dynamicLoadingThreshold: 0 }), 50000, '0 => default');
  assert.equal(getDynamicLoadingThreshold({ dynamicLoadingThreshold: -5 }), 50000, 'negative => default');
  assert.equal(getDynamicLoadingThreshold({ dynamicLoadingThreshold: 'abc' }), 50000, 'garbage => default');
  assert.equal(getDynamicLoadingThreshold({ dynamicLoadingThreshold: Infinity }), 50000, 'Infinity => default');
}

// --- 门控/阈值纯函数:与设置 YAML 解析后的布尔/数字投影一致 ---
{
  // settingsYamlSvc 会把 `dynamicLoading: true` 投影为 JS true
  const parsed = { dynamicLoading: true, dynamicLoadingThreshold: 60000 };
  assert.equal(isDynamicLoadingEnabled(parsed), true);
  assert.equal(getDynamicLoadingThreshold(parsed), 60000);
  // 显式关 + 阈值仍在,但门控优先
  const off = { dynamicLoading: false, dynamicLoadingThreshold: 100000 };
  assert.equal(isDynamicLoadingEnabled(off), false);
  assert.equal(getDynamicLoadingThreshold(off), 100000);
}

console.log('dynamicLoadingGate.harness: all assertions passed');