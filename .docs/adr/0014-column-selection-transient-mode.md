# 矩形选择采用瞬态列模式，而非多光标

Alt+拖拽的矩形选择落地为**瞬态列模式**：松开后激活列选区——多区高亮由 CSS Custom Highlight API（`::highlight(cl-column)`）承载，cledit SelectionMgr 在锁定期间不回读 DOM 选区（`columnSelectionLocked`），编辑器光标状态仍是单光标。激活期间支持：

- **VSCode 式逐行输入**：可打印字符/粘贴在各行列段处做同构替换（行数匹配的粘贴逐行各异），一次性字符串变换、单次可撤销；
- 列删除（Backspace/Delete）、列复制（Ctrl+C）、列剪切（Ctrl+X），均为单次可撤销编辑；
- 复制后选区保持；其余任何按键/点击/外部内容变更即退出并恢复常规单光标。

无 Highlight API 的环境降级为持久矩形 overlay（行为等同，仅高亮形态不同）。

## Considered Options

- **完整多光标（Sublime/VSCode 式编辑器状态）**：被否决。cledit fork 的选区（selectionStart/End 偏移对）、undo 栈、IME、diff-patch 全链路均为单光标架构，多光标等于重写编辑器核心，风险与收益不成比例。
- **v1 纯 overlay 瞬态模式**（自绘矩形、仅复制/删除、无输入语义）：被否决。打字即退出不符合预期——作者要求 Word 式观感 + VSCode 式输入。重做为 Word 式列选区（2026-10）：高亮用原生机制、输入用一次性变换，仍是单光标架构。

## Consequences

- 列选区是**编辑器会话内的瞬态渲染态**，不进 undo/选区模型；逐行输入/删除以整段一次性变换落盘（单 undo 单元）。
- IME 组成中、方向键、Enter 等非常规输入不进列语义，直接退出交还常规编辑。
- 未来若引入真正的多光标，属全新批次，本模式可整体退役。
