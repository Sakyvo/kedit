// Node 断言：037 第三波修复源码契约
// 运行：node .docs/tasks/assert-037.cjs（从仓库根）
const assert = require('assert');
const fs = require('fs');

// 1) shortcutCapture：null 删除语义 + 最后一个绑定胜出
const sc = fs.readFileSync('src/services/shortcutCapture.js', 'utf8');
assert.ok(/hit === null \|\| hit === false/.test(sc), 'comboOwner 忽略 null/false');
assert.ok(/entries\[entries\.length - 1\]/.test(sc), 'comboOfMethod 取最后一个');
assert.ok(/v === null \|\| v === false/.test(sc), 'comboOfMethod 忽略 null/false');

// 2) VisualTab：onShortcutKey 清旧绑定（custom remove / defaults set null）
const tab = fs.readFileSync('src/components/modals/settings/SettingsVisualTab.vue', 'utf8');
assert.ok(/customDraftShortcuts/.test(tab), 'customDraftShortcuts computed 存在');
assert.ok(/value: null/.test(tab), 'defaults 旧组合写 null 覆盖');
assert.ok(/prevCombo !== combo/.test(tab), '同方法旧绑定清除逻辑存在');

// 3) FormEntry inline prop + VisualTab toggle 接入
const fe = fs.readFileSync('src/components/modals/common/FormEntry.vue', 'utf8');
assert.ok(/props: \['label', 'info', 'error', 'inline'\]/.test(fe), 'FormEntry inline prop');
assert.ok(/form-entry--inline/.test(fe), 'inline 类名');
assert.ok(/:inline="field\.type === 'toggle'"/.test(tab), 'VisualTab toggle 用 inline');

// 4) SettingsSelect 组件 + pointer option
const ss = fs.readFileSync('src/components/modals/settings/SettingsSelect.vue', 'utf8');
assert.ok(/cursor: pointer/.test(ss), 'option pointer');
assert.ok(/role="combobox"/.test(ss) && /role="listbox"/.test(ss), 'a11y roles');
assert.ok(/@mousedown\.prevent/.test(ss), 'mousedown 选中（先于 blur）');
assert.ok(/SettingsSelect/.test(tab), 'VisualTab 接入');

// 5) 默认预览 text 光标
const modal = fs.readFileSync('src/components/modals/SettingsModal.vue', 'utf8');
assert.ok(/cursor: text/.test(modal), '默认预览 text 光标');

// 6) Modal 滚动治理
const mv = fs.readFileSync('src/components/Modal.vue', 'utf8');
assert.ok(/scrollbar-gutter: stable/.test(mv), 'scrollbar-gutter stable');
assert.ok(/overflow: hidden/.test(mv), 'modal 层 overflow hidden');

console.log('037 assertions: all passed');
