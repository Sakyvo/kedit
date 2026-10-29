Status: review

## 后台验证记录

- defaultSettings.yml：mod+shift+s→sync、mod+s 无绑定、删除线无默认键（js-yaml 断言通过）。
- SettingsVisualTab：钉尾「同步」行（无拖拽/无启用框/非拖放目标，占位对齐，捕获/清除/抢断复用既有语义，抢断提示含「同步」名）。
- vite build 通过。
- 剩余（人工验收）：真机改键/拖拽排序不带动同步行、默认 Ctrl+Shift+S 触发同步。

## Parent

`.docs/tasks/048-editor-ui-polish-anchor.md`

## What to build

「立即同步」的默认快捷键从 `mod+s` 改为 `mod+shift+s`，并首次把同步快捷键纳入配置 UI 调控：

1. `defaultSettings.yml`：`shortcuts` 区 `mod+s: sync` 改为 `mod+shift+s: sync`；原占用 `mod+shift+s` 的删除线默认绑定**取消**（不另配默认键，配置里可自行绑定）。
2. 配置弹窗可视化 tab「顶栏按钮」小节末尾追加「同步」行：icon-sync + 标签「同步」+ 快捷键捕获输入框，复用现有捕获/抢断/移除语义（`shortcutCapture`）；**无**拖拽手柄、**无**启用 checkbox（同步不是格式化按钮，不参与 `headButtons`/`headButtonOrder`），且不可作为其他按钮拖放的插入目标——`onButtonDrop` 逻辑显式排除，保证该行永远钉在列表末尾。

既有用户自定义 yaml 中显式绑定过的快捷键（如有）按现行 merge 语义保持不变。

## Acceptance criteria

- [ ] 默认状态下 Ctrl+Shift+S（Mac Cmd+Shift+S）触发立即同步；Ctrl+S 不再有默认绑定。
- [ ] 删除线默认无快捷键；顶栏删除线按钮仍可用，配置里可为它捕获新键。
- [ ] 「同步」行出现在快捷键列表最末；拖拽任意格式化按钮，同步行位置不动。
- [ ] 对「同步」行捕获改键、Backspace 清除、抢断提示均正常；修改在点击「确认」后生效。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately.
