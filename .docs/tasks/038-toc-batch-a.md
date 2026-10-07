Status: anchor

## Problem

批 A（grill-with-docs 收敛，2025-07-24）两处目录（TOC）问题：

1. **横向错位（bug）**：编辑中改标题层级（输入/删 `#`）后，目录各条目缩进错位且**粘滞**——
   后续编辑不再自愈，直到切换文档或刷新。根因：`editorSvc.refreshPreview()` 用 diff 增量
   更新 TOC DOM，但 `outlineDepth`（缩进层级）的语义是全文档顺序扫描；增量循环里
   `tocHeadingStack` 每次从空栈起步、只覆盖本次重渲染的 section，未变化 section 沿用
   旧 `dataset.outlineDepth`，新旧值错配。
2. **「自动跳转」名实不符（改名+行为分叉）**：现状开关实际只控制「跳转后是否收侧栏」，
   跳转本身永远发生。更名为「自动收起」，并按设备形态分叉行为。

## Decisions

- **错位修复：全量重算替代增量栈**。diff 循环结束后对 `tocElt` 全部 `.cl-toc-section`
  按文档序做一遍全量 depth 重算（O(标题数)，纯 `dataset` 写，不动 DOM 结构）；删除
  循环内局部栈计算，单一事实源。Toc.vue 的 `data-outline-depth` CSS 零改动。
  - 拒绝「在 diff 循环里修补增量栈」（未变化 section 的旧 depth 仍需失效处理，等于
    两套逻辑并存）；拒绝「等 015 行扫描 TOC 一起做」（015 是大文档专项，错位是当前
  活跃路径上的实际痛感；015 落地后本段被整体取代，两修复不冲突）。
- **自动收起的桌面/窄屏分叉与 016 收敛的 ✕ 语义同构**，判据同用
  `styles.layoutOverflow`（窄布局即算，不探测触摸）：
  - 桌面（`layoutOverflow` 假）：启用时跳转后**侧栏保持打开，面板从「目录」回退
    「主菜单」**；禁用时目录界面不变。
  - 窄屏/移动端（`layoutOverflow` 真）：启用时跳转后**侧栏整体收起回文档**；禁用时
    界面不变。
  - 跳转失败（目标为空 early-return）不触发收起。
- **改名连存储键一起改**：`tocAutoJump` → `tocAutoCollapse`，action
  `toggleTocAutoJump` → `toggleTocAutoCollapse`；文案「自动收起：开/关」；默认 `true`
  不变；图标 CrosshairsGps 保留。
- **一次性键迁移**：装载时读到旧键且新键未写入 → 搬值过新键 + 删旧键（幂等）。
  `layoutSettings` 是 localStorage 本机条目（`constants.localStorageDataIds`），
  从不上 git、不跨设备，迁移仅涉本机一个 JSON。
- 本批**取代** 016 卡验收项「‘自动跳转’开着时点目录项：仍按现行为跳转并收起侧栏，
  不回归」——桌面分支行为改变（收起→回主菜单）。

## Out of scope

- 015 行扫描 TOC 的构建路径（独立任务，落地后取代本批的 depth 重算段）。
- 图标更换（CrosshairsGps 保留）。
- 设置模态等其他 UI（已查证：开关仅存在于目录面板标题按钮，消费点仅 Toc.vue）。

## Testing strategy

Jest 链已断，`npm run build` 是唯一 CI 门槛。两切片均走真机/浏览器人工验收矩阵：

- 切片 1（错位）：多级标题文档，逐项改层级（升/降/中间标题升降），观察目录缩进
  即时正确且不粘滞；对照未编辑路径（打开、滚动、跳转）无回归。
- 切片 2（自动收起）：桌面/窄宽两形态 × 开/关两态的四象限矩阵；旧键迁移用
  localStorage 手工注入旧值验证。
