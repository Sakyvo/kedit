Status: open

## Parent

038-toc-batch-a.md

## What to build

「自动跳转」更名「自动收起」并按设备形态分叉行为。

- 存储键 `tocAutoJump` → `tocAutoCollapse`（默认 `true` 不变），action
  `toggleTocAutoJump` → `toggleTocAutoCollapse`，全部引用点联动（默认值文件、
  store action、SideBar 面板标题按钮、Toc.vue 消费点）。
- 装载时一次性迁移：读到旧键且新键未写入 → 搬值过新键 + 删旧键（幂等；迁移点放
  装载路径，如 localDbSvc 读 layoutSettings 之后或 store 初始化处，实现时取最贴近
  现有装载链路的方案）。
- 面板标题按钮 tooltip 改「自动收起：开/关」，图标 CrosshairsGps 不动。
- Toc.vue 点击目录项：跳转逻辑不变（含失败 early-return 不收起）；跳转成功后按
  开关 + `styles.layoutOverflow` 分叉——
  - 桌面（假）：`setSideBarPanel('menu')`，侧栏保持打开（回主菜单，不 `toggleSideBar`）；
  - 窄屏（真）：`toggleSideBar(false)`，侧栏整体收起回文档；
  - 开关关闭：两种形态目录界面均不变。

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 桌面（`layoutOverflow` 假）× 开：点目录项 → 跳转 + 面板回主菜单、侧栏仍开、
      编辑区宽度不变
- [ ] 桌面 × 关：点目录项 → 跳转、目录面板不动
- [ ] 窄屏（`layoutOverflow` 真，含桌面拖窄窗口）× 开：点目录项 → 跳转 + 侧栏整体
      收起、回到文档
- [ ] 窄屏 × 关：点目录项 → 跳转、界面不动
- [ ] 跳转目标为空（如空锚点）时早退，不触发收起/回退
- [ ] 迁移：手工在 localStorage 注入含 `tocAutoJump: false` 的旧 layoutSettings →
      刷新后开关为关、JSON 中旧键消失、新键为 false；新设备/清库回落 `true`
- [ ] 按钮开关本体仍可正常切换（tooltip 与高亮态随动）

## Blocked by

None - can start immediately（与 039 无依赖，可并行）
