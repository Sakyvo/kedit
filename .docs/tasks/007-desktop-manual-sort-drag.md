Status: done

## Parent

批5 UX（grill-with-docs 收敛，无独立 PRD）

## What to build

桌面手动排序无需移动开关即可拖；移动端保持门控。

## Acceptance criteria

- [x] 桌面 + 排序=手动：不点移动开关即可拖文件/文件夹排序（同夹）
- [x] 桌面：移动按钮可见且可点，但状态不改变拖拽能力（纯占位/提示）
- [x] 移动端：须开启移动才可拖；关闭后长按菜单等与现网一致
- [x] 非手动排序模式：桌面也不出现误拖排序

## Blocked by

None - can start immediately

## Implement notes

- `explorerDragGate.js`; ExplorerNode isDraggable/isManualSortDrag; Explorer toggle noop on desktop
