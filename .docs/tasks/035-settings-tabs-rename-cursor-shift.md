Status: done

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

- [x] 三 tab 名为 可视化 / yaml编辑 / 默认预览，aria-label 同步（改模板块内
  文案 + role=tabpanel aria-label）。
- [x] tabs / select / bind 框 hover 均为指针手型（实测三处 computed cursor 均
  pointer）；只读默认预览光标结论：全局 .textfield[disabled] 的 not-allowed
  会误导「禁选」（预览允许选中复制），已在设置模态局部改为 default（箭头）。
- [x] 三个 tab 间切换内容区无水平位移（实测三 tab 首内容元素左缘均 50px；
  右偏根因是旧版 tabs 未全宽铺开，033 的 margin: 0 -50px 全宽方案已顺带
  消解，本任务实测确认）。
- [x] agent_browser 实测光标与切换。
- [x] `npm run build` 通过。

## Blocked by

None - can start immediately
