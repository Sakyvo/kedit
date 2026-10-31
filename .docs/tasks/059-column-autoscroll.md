Status: open

## Parent

`.docs/tasks/054-notepad-column-selection-anchor.md`

## Depends on

056

## What to build

1. **拖出视口自动滚动扩选**：拖拽中指针超出滚动容器上下边缘时，按 rAF 匀速滚动（越界越多略快，设上限），滚动时持续以当前指针位置重算选区——选区随滚动延长/收缩，与 Notepad4 一致。
2. **Alt 粘性判定**：矩形模式只在 `mousedown` 时按 `altKey` 判定；拖拽过程中松开 Alt 仍然继续矩形选区（Scintilla 的 `selType` 粘性），不因修饰键变化中断。
3. 拖拽结束（mouseup）清除滚动循环与监听，无泄漏；`destroy` 时同样清理。

## 验收

- 后台：`vite build` 通过；静态确认 rAF 循环有取消路径、监听成对解绑。
- 真机：向上/向下拖出视口自动滚动并持续扩选；滚动中拖动方向变化选区正确；松开 Alt 不中断；松手后不再滚动。

## Definition of done

长文档可从顶部拖选到屏幕外的远处，无卡死或残留滚动。
