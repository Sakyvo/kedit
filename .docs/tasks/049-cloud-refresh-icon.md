Status: review

## 后台验证记录

- `vite build` + style 子链全部通过（git-bash 下嵌套 npm 会段错误，拆步执行为常态替代）。
- bundle 注册表确认 `iconCloudRefresh` 存在且携带 MDI cloud-refresh 官方路径；`.icon` class 与其他图标同源，颜色随主题。
- 剩余：真机看一眼图标渲染（人工验收项）。

## Parent

`.docs/tasks/048-editor-ui-polish-anchor.md`

## What to build

「强制从远端覆盖」菜单项当前使用未注册的 `<icon-cloud-refresh>`，组件解析失败导致图标位空白。新建 `CloudRefresh.vue`（MDI `cloud-refresh` 图标路径，样式与 `src/icons/` 现有图标一致：currentColor、24×24 viewBox），并在 `src/icons/index.js` 注册表加入 `iconCloudRefresh`。

## Acceptance criteria

- [ ] 主菜单「强制从远端覆盖」条目在浅色/深色主题下均显示云+循环箭头图标，颜色随主题文字色。
- [ ] `npm run build` 通过，无 Vue 未解析组件告警残留（该条目）。

## Blocked by

None - can start immediately.
