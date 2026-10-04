Status: open

# 026 v-slot:field 修复 + 默认值提示

## Parent

`.docs/tasks/025-settings-visual-fixes.md`

## What to build

- `SettingsVisualTab.vue` 的 `<template slot="field">` 改为 `<template v-slot:field>`
  （生产/开发下控件被包进真实 `<template>` 元素 display:none 的根因修复）。
- 全仓 grep `<template slot=`，同错一处一修。
- 每行 label 附默认值 hint：select/text/number → `— 默认：<值>`（来源
  `yaml.load(defaultSettings)` 按 path 读取）；toggle → `— 默认：开/关`；textarea
  长值绕过 info 改为 placeholder。已有 info 的字段追加「，默认：X」。
- 号码/text/textarea 空值时 placeholder 显示默认值的文案 ——(026 起只做 label 行尾
  info；placeholder 无效该 key 留在 027-028 统一跟控件序顺做)。

## Acceptance criteria

- [ ] 生产 build（vite preview）可视化 tab 常规/编辑器/导出/其他全部控件可见
  （offsetParent 非 null、offsetWidth > 0），值=合并后的当前设置。
- [ ] 在可见控件上修改依然能正确写回 yaml（回测 020 流）。
- [ ] 每行有 `默认：` 提示；toggle 显示开/关。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately
