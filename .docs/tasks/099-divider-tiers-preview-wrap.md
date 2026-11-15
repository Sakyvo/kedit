Status: anchor

# 预览长串折行与分割线三档

## Problem

Author 报了两件事，都落在「预览与编辑区行为不一致」这同一根骨头上：

1. **预览不折行长串**。行内 `code` 里的 `sk-…` 密钥串冲出色块、横向溢出屏幕。编辑区早有 `.editor__inner { white-space: pre-wrap; word-break: break-word }`，预览侧一条断词声明都没有（全仓只有 `a`、`blockquote`、`.kedit-frontmatter__content` 三处做了断词）。这是两面不对称，不是 `code` 单独的问题。
2. **分割线只有"加重/不加重"两档，且加重档被主题抹平**。`STRONG_HR_MIN_MARKERS = 6` 让 ≥6 个标记变成"加重分割线"：编辑区标记串染色、预览 2px。但编辑主题 `.edit-theme--X .editor__inner .hr`（3 个类）压过 `.hr-strong`（1 个类），预览主题 `.preview-theme--X hr`（1 类 1 元素）压过 `.kedit-hr-strong`（1 个类）。Author 在自己的主题下看到编辑区一串红 `-`、预览画主题色的线，且多数主题里 3 个与 9 个标记的分割线长得一模一样。

## Decisions

Author 逐轮确认（Q1 接受推荐；Q2 给出档位表；第 3 轮起"其他接受推荐"；第 4 轮定"主题不管分割线颜色"）：

1. **断词写容器根**：预览与导出容器 `.cl-preview-section, .stackedit__html` 加 `overflow-wrap: anywhere`（可继承到 `code`/`p`/`li`/`td`；`pre > code` 因 `white-space: pre` 不受影响）。连带影响导出 HTML，Author 接受。拒绝：只给行内 `code` 加（正文长串仍溢出）、预览改横向滚动（与编辑区行为分叉）。编辑区现有规则不动。
2. **三档按标记字符数**，空格不计（`- - - - - -` = 6），`-` / `*` / `_` 同权——沿用 markdown-it `token.markup` 与编辑区语法现有口径：3~5 原色 1px ／ 6~8 蓝 2px ／ 9+ 红 2px。粗细只在第 1 与第 2 档之间变化，第 2、3 档只差颜色。
3. **两面同色同粗**：蓝 `#2e86c8` / 深 `#6fb5e6`，红 `#c0392b` / 深 `#e5735f`，预览线也做 `.app--dark` 配对，`#333` 退役。拒绝：预览线固定单色（深色主题下发闷）、只编辑区配对。
4. **防火墙锁整条线**：预览/导出容器内 `hr` 的 `border`、`border-top`、`background`、`height`、`padding`、`margin` 全声明 + `!important`（`markdownHighlighting.scss` 的 `.em` 已有先例）；第一档原色也一并硬锁。拒绝：只锁颜色（主题仍能改粗细，内置 `allblue`/`caoyuangreen`/`ningyezi` 正是 `height: 1px; padding: 0; border: none`）、堆选择器特异性（主题是运行时注入的用户 CSS，平手归主题）。
5. **命名**：保留既有对外类名 `.kedit-hr-strong`（6~8 加重档）+ 子变体 `.kedit-hr-strong--red`（9+）；`STRONG_HR_MIN_MARKERS` 换成档位表 `HR_TIERS`（3 / 6 / 9）。
6. **工具栏 `doHorizontalRule` 插 `"---\n"`**（原色档），不再插 `"----------\n"`——否则一点按钮就落一条红线。
7. **内置主题清理**：选用整条线归 KEDIT 后，`static/themes/` 里 8 个预览主题的 `hr` 规则与 15 个编辑主题的 `.hr` 项全部失效，删除之（编辑主题里 `.hr` 与 `.link` / `.linkref` 同组，只摘 `.hr` 一项）。

架构背景与拒绝理由见 `.docs/adr/0017-divider-tiers-owned-by-kedit.md`；术语见 `CONTEXT.md` 的「分割线档位（Divider tier）」；样式约定见 `.docs/spec/frontend-conventions.md` 的 Styling Patterns。

## Out of scope

- 编辑区断词规则（已正确，不改）。
- pdir 侧 CSS（pdir 用自己的样式表，**Publish** 后不受影响，验收只看 KEDIT 的预览与导出 HTML）。
- "用户可调分割线颜色"的设置项（`!important` 的存在就是为了挡用户 CSS，两者不能并存；真有需求再升级成 CSS 自定义属性并同步改写本决策）。
- `-` / `*` / `_` 之外的标记字符，以及新增加第四档。
- 表格、代码块、Mermaid/KaTeX 的既有横向滚动行为。

## Testing strategy

- `npm run build` 是唯一 CI 门槛（Jest 链已断，不要依赖）。
- 断词可自动化的部分靠导出 HTML 文本/DOM 断言（导出产物里 `overflow-wrap` 落在 `.stackedit__html` 上）；折行的最终判断必须在真机真浏览器里看，不接受"合成段落宽度"这种替代证据。
- 三档的验收姿势固定为**切主题实测**：每个内置预览主题 + 每个内置编辑主题各切一遍，三档的颜色/粗细/盒模型不得变形；再手写一段最强特异性的自定义主题 CSS（例如 `.preview-theme--x hr { border-top: 3px solid #f00 !important }` 之类）确认档位仍然成立。
- 每片都要给出可复现的源片段（3/6/9 个 `-`，以及 `- - - - - -`、`***`、`___` 各一行）与截图证据。
