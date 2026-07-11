# Mobile UX fixes: light-only theme, sync button, browser-tab title, instant precise TOC

> **Track: 🟦 FE / Claude Code** · standalone (post editor-ux-overhaul follow-up)
> Grilled inline by the Author on 2026-07-05 — requirements below are decided, not proposals.

## Goal

修掉移动端实测暴露的四组问题：主题固定日间并腾出位置给同步按钮；页内标题让位（防止顶栏被覆盖）；目录与页内跳转去动画且精确命中。

## Requirements

- **R1 — 固定日间模式 + 同步按钮**：移除导航栏的夜间模式切换按钮；应用**固定为日间主题**（启动时归一化已存的 dark 设置）。原按钮位置改放**同步按钮**（`requestSync`）——修复移动端窄屏下标题区同步按钮随 `hideLocations` 消失、无法手动同步的问题。
- **R2 — 取消页内标题，改浏览器标签页标题**：移除导航栏内嵌的文档标题显示/编辑（其在移动端编辑时覆盖顶部操作栏）；改为把当前文档名写入 `document.title`（如 `文档名 - KEDIT`）。**后果（已接受）**：导航栏改名入口消失，重命名走资源管理器（头部按钮/右键/长按菜单均已有）。
- **R3 — 瞬间跳转**：目录点击跳转去掉平滑动画（`behavior:'smooth'` → 直接定位）；**页内同理**（预览锚点/滚动同步定位不加动画）。
- **R4 — 目录精确命中**：点击判定从"y 坐标 ↔ 比例区间"改为 **DOM 命中**（`event.target.closest('.cl-toc-section')` → 对应 section）；"当前所在"高亮从 35px 比例浮动带改为**吸附对齐当前 section 的条目**（`offsetTop/offsetHeight`），不再落在两个标题之间。

## Acceptance Criteria

- [ ] 导航栏无主题切换按钮；深色设置残留的浏览器打开后仍是日间；原位置为同步按钮且窄屏可见可用。
- [ ] 导航栏不再渲染文档标题；切换文档时浏览器标签页标题随之更新；移动端编辑时顶部操作栏不再被覆盖。
- [ ] 目录点击立即定位（无滚动动画），编辑器与预览两栏一致。
- [ ] 点击目录任意条目精确跳到该标题；高亮与条目对齐，不再出现在两条目之间。
- [ ] 资源管理器重命名路径可用（R2 后果的兜底验证）。

## Code anchors

- R1: `NavigationBar.vue` 主题按钮(:10, `switchTheme`)；`data/switchThemeSetting`；`app--dark` 类绑定源（App.vue/主题 getter，实现时定位）；同步按钮逻辑复用 `requestSync`(:184)。
- R2: `NavigationBar.vue` title fake/text/input(:21-23) + `titleWidth/titleScrolling/editTitle/submitTitle`；`document.title` 写入点：watch `file/current`（App 层或 NavigationBar created）。
- R3: `Toc.vue` click handler（上轮改为 `scrollTo({behavior:'smooth'})` → 改回直接赋值）；预览锚点/滚动同步如有动画路径一并排查（`animationSvc` 调用点）。
- R4: `Toc.vue` click → `closest('.cl-toc-section')` + `sectionDescList` 元素映射；mask 定位 `updateMaskY` 改为条目对齐。

## Out of Scope

- 主题系统整体移除（设置深处的编辑区/预览主题配置保留，休眠）。
- 桌面端标题区 sync/publish 位置按钮的去留（保持现状）。

## Domain & Decisions

- ADR: `docs/adr/0001-*`（实用主义优先——同步按钮常驻优于装饰性主题切换；标题让位于操作栏）。
- 前置：`editor-ux-overhaul` 已全档；本任务为移动端实测反馈的后续。

## Pre-execution Review Checklist

- [x] Requirements 已由 Author 当面敲定（无待决歧义）
- [x] 验收可测；范围明确；与 CONTEXT/ADR 无冲突
- [x] 可行性基于现有代码锚点
