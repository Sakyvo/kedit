Status: review

# SettingsModal 可视化 tab 骨架 + 常规/编辑器两组

## Parent

`.docs/tasks/018-visual-settings-config.md`

## What to build

`SettingsModal` 新增首 tab「可视化」并默认选中，原「自定义配置」「默认配置」
yaml tab 原样殿后：

- 可视化 tab = 单页滚动 + 分节标题；本卡先落「常规」（colorTheme 单选、
  fontSizeFactor/maxWidthFactor/autoSyncEvery 数字输入）与「编辑器」
  （listAutoNumber/inlineImages/monospacedFontOnly/showInPageButtons 开关）。
- 三个 tab 共享一份 draft：可视化改动立即反映到自定义 yaml 文本（经 019 的
  行级手术服务），在 yaml tab 手改后切回可视化 tab 也能正确回读；「确认」
  统一提交 `data/setSettings`，「取消」丢弃全部。
- 控件为三个可复用小组件（单选/数字输入+范围校验/布尔开关），值默认读
  computedSettings（合并默认值后的现状）。
- 校验失败：行内红字 + 确认按钮禁用；不自动 clamp。范围：字号/宽度 0.5–3.0，
  自动同步 ≥60000。
- 沿用 Options API + Vuex 模式；控件样式融入现有 form-entry/Tab 组件风格，
  浮层 z-index 走 `.docs/spec/frontend-conventions.md`（本卡应无新浮层）。

## Acceptance criteria

- [x] 打开配置默认看到可视化 tab；常规+编辑器共 8 个键全部可编辑。
- [x] 可视化改动后切到自定义 yaml tab 可见对应行被更新、注释保留。
- [x] yaml tab 手改后切回可视化 tab，控件显示新值。
- [x] 非法值内联报错且确认禁用；取消不落地任何改动。
- [x] `npm run build` 通过。

备注：色 Theme 选「深色」会被 App.vue 既有的 light-only 归一化立即回写为
light（`switchThemeSetting` 现有项目决策，不属于本批）；真机夜色显示验收
留给人工。

## Blocked by

- `019-settings-yaml-line-surgery-svc.md`
