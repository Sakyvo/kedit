Status: review

## Parent

`104-mobile-modal-and-menu-copy.md`

## What to build

窄屏（`styles.layoutOverflow` 为真，侧栏是覆盖文档的全宽面板）下，在「文件历史」面板里
点选一个历史版本后关闭侧边栏，让已经打上 diff 的文档立刻可见。

- diff 的加载与高亮逻辑不动；只在修订对比出现之后隐藏侧栏（不是 `toggleSideBar(false)`——
  那个动作会把面板重置回主菜单，`HistoryMenu` 随 `v-if` 卸载并清空修订对比，diff 会跟着消失）。
- 桌面端（`layoutOverflow` 为假）完全不改：点版本后侧栏照旧开着。
- 侧栏只是隐藏（`showSideBar: false`），面板仍停在 `history`；但经 KEDIT 按钮重新打开侧栏
  会按全应用既有语义回到主菜单。
- Esc 清除版本对比的既有行为不变。

## Acceptance criteria

自动化证据：`node test/browser/mobile-history.mjs`（真实 `dist/`，390 / 1280 px）。

- [x] `npm run build` 通过
- [x] 窄屏：修订对比到达后侧栏隐藏、文档区显示该版本 diff（增行高亮）
- [x] 窄屏：侧栏只隐藏不清场——`HistoryMenu` 仍在、面板仍为 `history`、diff 不被卸载钩子清除
- [x] 窄屏：Esc / 关闭修订清除对比后侧栏状态不再变化
- [x] 桌面：点版本后侧栏不关闭，diff 照旧显示
- [x] 窄屏判定就是 `styles.layoutOverflow`（同一份状态在同一次 dispatch 下一关一开）
- [x] 不回归批 016 切片 2：窄屏目录面板的 ✕ 仍然关闭整个侧栏（真实点击验证）
- [ ] 真机确认：手指点选历史版本后直接看到 diff（需人工在手机上过一遍）

## Blocked by

None - can start immediately