Status: open

## Parent

`.docs/tasks/048-editor-ui-polish-anchor.md`

## What to build

编辑器 Alt+拖拽瞬态矩形选择（决策背景见 ADR 0014）。端到端行为：

1. **进入**：编辑器内容区 mousedown 且 `altKey`（非 Mac 亦用 Alt，本作者 Windows）→ `preventDefault`，锚点=按下位置；随 mousemove 以锚点与当前点为对角画半透明矩形 overlay（自绘绝对定位 div，随滚动跟随）；期间 cledit 原生选区不动（不触碰 `selectionStart/End`）。
2. **列段计算**：矩形按像素 x 边界换算成每行的字符区间（编辑器等宽、无软换行，行 = DOM 行；用 caretRangeFromPoint/Range 像素定位，右边界超行尾截到行尾）。
3. **操作**（矩形激活期间，键盘/剪贴板钩子拦截）：
   - `Ctrl+C`：复制各行段按行拼接的文本（覆盖 clipboard，不注入 HTML）；
   - `Ctrl+X`：复制 + 执行列删除；
   - `Backspace`/`Delete`：删除各行对应列段，**作为单次可撤销编辑**（走 cledit 既有 undo 栈，一次 undo 完整回滚）。
4. **退出**：任何其他按键、mousedown、滚轮引起的列区失效或焦点离开 → 撤除 overlay，恢复普通光标（落点为退出位置）。
5. 普通选择、拖拽移动文本、触屏行为完全不变。

实现落点建议在 cledit fork 侧新增独立模块（如 `cleditColumnSelection.js`），通过现有事件钩子接入，避免侵入 `cleditCore` 主流程；列删除以一次性的多段删除包装成单个 undo 单元。

## Acceptance criteria

- [ ] Alt+拖拽出现随鼠标更新的半透明矩形；松开后矩形保持。
- [ ] 3+ 行、每行长度不一的文本上 Alt 拖矩形：Ctrl+C 粘贴结果逐行列段对齐；短行选到行尾不跨行。
- [ ] Backspace/Delete 后各行对应段消失、行合并为单次编辑；一次 Ctrl+Z 完整恢复。
- [ ] Ctrl+X = 复制 + 删除。
- [ ] 随意键入/单击任意处立即退出列模式；之后普通编辑、选区、undo/redo 一切如常。
- [ ] 不按 Alt 的拖拽选择/拖拽移动文本行为不变；触屏不受影响。
- [ ] 深色/浅色主题下 overlay 均可见。
- [ ] `npm run build` 通过；超大文档（动态加载模式）下进入/退出列模式无异常。
- [ ] 真机验收后可人工接受项列清后置 review。

## Blocked by

None - can start immediately.
