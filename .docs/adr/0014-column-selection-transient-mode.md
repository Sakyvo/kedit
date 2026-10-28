# 矩形选择采用瞬态列模式，而非多光标

Alt+拖拽的矩形选择落地为**瞬态列模式**：拖拽时自绘矩形 overlay，松开后矩形保持高亮，期间仅支持列复制（Ctrl+C）、列剪切（Ctrl+X）与列删除（Backspace/Delete，各行列段一次性删除、单个可撤销编辑），任何其他输入即退出并恢复普通光标。

## Considered Options

- **完整多光标（Sublime/VSCode 式）**：被否决。cledit fork 的选区（selectionStart/End 偏移对）、undo 栈、IME、diff-patch 全链路均为单光标架构，多光标等于重写编辑器核心，风险与收益不成比例。
- **仅视觉+复制（无列删除）**：被否决。列删除是列操作的第二大高频场景，且在瞬态模式下成本可控。

## Consequences

- 列模式下不支持输入（打字即退出）。
- overlay 语义独立于 cledit 的选区模型，不触碰 selectionStart/End；未来若引入真正的多光标，属全新批次，本模式可整体退役。
