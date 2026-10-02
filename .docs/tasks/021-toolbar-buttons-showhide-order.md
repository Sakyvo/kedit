Status: open

# 可视化 tab「顶栏按钮」组：显隐 + 拖拽排序

## Parent

`.docs/tasks/018-visual-settings-config.md`

## What to build

可视化 tab 的「顶栏按钮」分节，端到端打通 17 个编辑按钮的显隐与顺序：

- schema：新增 `editor.headButtonOrder`（字符串列表）；`NavigationBar` 渲染
  顺序 = `headButtonOrder` ∥ 内置剩余键追加尾部；缺该键 = 现状默认序
  （`pagedownButtons.js` 数组序），老用户零感知。
  分隔符 `{}` 项固定原有相对位置解释：排序 UI 只排真实按钮，分隔符跟随它在
  `pagedownButtons.js` 里的图像/代码块与他的分界语义（首个无前缀分组保持
  头部固定），实现时以「image/inlinecode 之后的 spacer」在排序后仍落在同一对
  相邻按钮之间为准——若该约束实现别扭，退而求其次：spacer 固定插在前 4 个之后
  并在任务交付说明中写明。
- UI：每个按钮一行（图标 + 名称 + 显隐开关 + 拖拽把手 + ↑↓ 按钮），桌面
  HTML5 DnD 拖动排序，触屏/键盘用 ↑↓；顺序即写回 `headButtonOrder`（经 019
  服务），显隐写 `editor.headButtons.<method>`。
- 顶栏实时反映（确认提交后 NavigationBar 重排；撤销=取消弹窗不写）。

## Acceptance criteria

- [ ] 拖动/↑↓ 调整顺序，确认后顶栏按新顺序渲染；刷新后保持。
- [ ] 关闭某按钮显隐后顶栏消失，重新打开回到其在 headButtonOrder 的位置。
- [ ] 已有用户的 `headButtons` 手写 map 继续生效；新键未出现时内置序不变。
- [ ] 可视化写回的 yaml 只影响 `editor.*` 对应行，其余文本不动。
- [ ] `npm run build` 通过。

## Blocked by

- `020-settings-modal-visual-tab-skeleton.md`
