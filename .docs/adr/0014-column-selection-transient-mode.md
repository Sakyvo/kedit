# 矩形选择照搬 Notepad4 语义

Alt+拖拽的矩形选择按 **Notepad4 / Scintilla 的矩形选区语义**实现，而不是自绘一个选区框。

- **拖拽期实时选区**：Alt 按下即进入，鼠标每次移动立刻逐行重算（Scintilla `SetRectangularRange`）并重绘——画的是被选中的文本，不是空框。
- **边界 = 鼠标像素 x**，逐行独立换算（`SPositionFromLineX`），不做"行尾截断"。
- **虚拟空间**：超出短行行尾的部分照选（`SCVS_RECTANGULARSELECTION`）；短行缺失段以同色实心补齐，视觉为整齐矩形块；在该列打字自动补空格（`RealizeVirtualSpace`）。
- **粘性多行插入**：首键替换各行列段，随后选区收成零宽列光标（`ThinRectangularRange`），继续打字继续逐行插入，直至 Esc / 单击 / 方向键 / Enter 退出。
- **列删除**：Backspace/Delete 删各光标左右一字符；有选区时删各行列段。
- **列粘贴**：自己的列复制 → 逐行带空格补齐贴入；外来文本 → 先清空矩形内真实字符，再在左上角整段插入。
- **拖出视口自动滚动扩选**；Alt 仅在按下时判定，拖拽中松开继续矩形。

高亮由 CSS Custom Highlight API（`::highlight(cl-column)`）承载真实文本段，虚拟空间段用实心矩形补齐；cledit SelectionMgr 在列模式期间 `columnSelectionLocked` 不回首 DOM 选区。

## Considered Options

- **v1 自绘矩形框（无输入语义）**：被否决。拖拽期只画一个边框，不显示"文字被选中"，与 Word/Notepad 观感不符——这正是作者提出的问题。
- **v2 单向插入后退出（ADR 早期版本）**：被否决。打完一个字符即退出不符合 Notepad 的连续逐行输入；作者要求"全部照搬 notepad"。
- **编辑器级真多光标（重写 cledit 选区/undo/IME 全链路）**：仍被否决。多行光标以"列模式内的多次整段字符串变换"实现，cledit 的单光标架构、undo 栈、diff-patch 管线保持不变。

## Consequences

- 列模式是会话内的瞬态态；每次按键/删除以整段一次性变换落盘，连续按键经 `typing` 模式合并为单个 undo 单元。
- 短行补空格是**真实内容变更**（会进入文档与同步），这是照搬 Notepad 的必然代价。
- IME 组成中、非常规按键不进列语义，直接退出交还常规编辑。
- 若未来引入编辑器级多光标，本模式可整体退役。
