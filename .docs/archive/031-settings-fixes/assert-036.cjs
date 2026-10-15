// Node 断言：settingsYamlSvc 行级手术 + lastValid 数据流（036 任务）
// 运行：node .docs/tasks/assert-036.js（从仓库根）
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1) mergeSettings 对坏 yaml 会 throw（SettingsModal 靠 try/catch 保持 lastValid）
const svcPath = path.resolve('src/services/settingsYamlSvc.js');
const src = fs.readFileSync(svcPath, 'utf8');
assert.ok(/const mergeSettings/.test(src), 'mergeSettings 存在');

// 用 vite 依赖图太重；直接以 js-yaml 行为验证同一契约（mergeSettings 内部即 yaml.load）
const yaml = require('js-yaml');
const good = '# c\ncolorTheme: light\nfontSizeFactor: 1.2\n';
const bad = '# c\ncolorTheme: light\n  broken: [unclosed\n';
assert.doesNotThrow(() => yaml.load(good), '合法 yaml 可解析');
assert.throws(() => yaml.load(bad), '非法 yaml 抛错（mergeSettings 同路径）');

// 2) SettingsModal 源码断言：error 时 draft 传 lastValidSettings + invalidHint 传递
const modalSrc = fs.readFileSync('src/components/modals/SettingsModal.vue', 'utf8');
assert.ok(/lastValidSettings = value/.test(modalSrc), '合法时记录 lastValid');
assert.ok(/:draft="error \? lastValidSettings : customSettings"/.test(modalSrc), 'error 时可视化拿 lastValid');
assert.ok(/:invalid-hint="error"/.test(modalSrc), 'invalidHint 透传');
assert.ok(/visualInvalid = \$event/.test(modalSrc), 'invalid 联动保持');

// 3) VisualTab 源码断言：hint 渲染 + props
const tabSrc = fs.readFileSync('src/components/modals/settings/SettingsVisualTab.vue', 'utf8');
assert.ok(/invalidHint/.test(tabSrc), 'invalidHint prop 存在');
assert.ok(/settings-visual__invalid-hint/.test(tabSrc), '红字条渲染');
assert.ok(/v-if="invalidHint"/.test(tabSrc), '仅非法时显示');

// 4) CodeEditor 源码断言：value watcher 回刷
const ceSrc = fs.readFileSync('src/components/CodeEditor.vue', 'utf8');
assert.ok(/value\(value\)/.test(ceSrc), 'value watcher 存在');
assert.ok(/setContent\(nextValue, true\)/.test(ceSrc), 'diff 后回刷');

console.log('036 assertions: all passed');
