Status: open

# 可视化 tab「快捷键」组：捕获式设定 + 冲突抢断

## Parent

`.docs/tasks/018-visual-settings-config.md`

## What to build

16 个 pagedown 编辑按钮的快捷键可视化设定（与「顶栏按钮」组相邻成节或合节，
按 UI 草稿定）：

- 捕获式输入框：聚焦后按组合键即录入并显示（Ctrl+Shift+B 风格，Mac 显示
  Cmd）；Backspace/Delete 清除；失焦未录入则不改动。
- 冲突=抢断：新键冲突时旧按钮快捷键被清空并在该行给出提示文本（不弹窗）。
- 补齐 `shortcuts.js` methods map：`codeblock`/`inlinecode`/`deleteSelection`
  映射到对应 pagedown 命令；现有 16 键全覆盖。
- 写回：修改/删除走 019 行级手术更新 `shortcuts` map 对应行（`mod+shift+x:
  method` 形态）；`'= = > space'` 这类 expand 序列键不在可视化列出、写回时
  原样保留。
- 导航栏 tooltip 自动展示新快捷键（`getShortcut` 已有反查，无需改）。

## Acceptance criteria

- [ ] 录入/清除/改写均即时生效（确认提交后 Mousetrap 按 watcher 重绑）。
- [ ] 冲突抢断后旧按钮不再响应旧组合键，且 tooltip 不再显示。
- [ ] yaml 中手写 expand 序列在多次可视化保存后原样保留。
- [ ] `codeblock`/`inlinecode`/`deleteSelection` 快捷键真实触发对应编辑动作。
- [ ] `npm run build` 通过。

## Blocked by

- `020-settings-modal-visual-tab-skeleton.md`
