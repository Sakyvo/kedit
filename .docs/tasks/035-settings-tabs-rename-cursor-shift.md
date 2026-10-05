Status: open

# tabs 改名 + 光标三连 + 切 tab 右偏修复

## Parent

`031-dark-revival-settings-fixes.md`

## What to build

设置模态三 tab 文案改为「可视化 / yaml编辑 / 默认预览」（aria-label 同步；
内部 tab id `visual/custom/default` 与 yaml 键一律不动）。三处光标统一食指
（pointer）：tabs hover、select 选框、快捷键 bind 框；顺带查证「默认预览」
只读编辑器的 I 光标是否误导并给结论。修复切到 yaml编辑 tab 时配置框右偏
（宽度/滚动条沟槽差异实测定因）。

## Acceptance criteria

- [ ] 三 tab 名为 可视化 / yaml编辑 / 默认预览，aria-label 同步。
- [ ] tabs / select / bind 框 hover 均为指针手型；只读默认预览光标结论记录
  在任务里。
- [ ] 三个 tab 间切换内容区无水平位移。
- [ ] agent_browser 实测光标与切换。
- [ ] `npm run build` 通过。

## Blocked by

None - can start immediately
