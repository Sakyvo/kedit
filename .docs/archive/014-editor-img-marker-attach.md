Status: done

## Parent

`000-editor-img-marker-attach.md`（决策见 `.docs/adr/0006-editor-image-card-attaches-marker-line-pure-prefix.md`）

## What to build

让编辑区的图片卡按"纯标记前缀"贴行：测量图片卡之前、同一行内的前缀内容，
若前缀只含列表标记（含缩进与 checkbox）、引用标记与空白，则将图片卡的行宽上限
设为"前缀末尾到编辑区右缘"的剩余宽度——图片等比缩入该宽度，保持在标记后方同一行。
前缀含任何普通文字、或剩余宽度低于 4em 下限、或自然宽本来就放得下时，都维持现状
（不写死缩放，由所在行宽度自然截断）。

测量必须只依赖标记宽度，不得耦合前缀之外的文本长度（这正是 f749889e  Range 方案
被 3671d542 回退的根因：Range 取到的是前文末行末尾，图片尺寸随无关文字抖动）。
打字、窗口缩放、字体变更后需要重测的场景沿用现有 scheduleImgLineFit 接线点。

## Acceptance criteria

- [x] `- ![img]`（图片为标记后第一内容）：图片贴在 `- ` 后同行显示，无需缩放时保持自然尺寸。
- [x] 图片自然宽超出标记后剩余宽度：等比缩小至恰好放下，仍与 `- ` 同行。
- [x] 在图片卡后方继续打字、增删文字：图片尺寸不变。
- [x] `- 前文 ![img]`（前缀含普通文字）：维持现状，图片卡独占行，不缩放。
- [x] 深层嵌套列表 / 窄屏使剩余宽度 < 4em：图片卡回退独占行。
- [x] `- [ ] ![img]` 与 `> ![img]`：同样贴行生效。
- [x] 行首无标记的普通行 `![img]`：行为与现状一致。
- [x] 预览区渲染无任何变化。
- [x] `npm run build` 通过。

## Verification

- 实现：`src/services/editor/imgLineFit.js` 重写 fitImgWrapper —— 新增
  `measureMarkerPrefixRoom`：Range(section → wrapper) 提取光标前文本，
  仅当末行前缀匹配纯标记（`PURE_MARKER_LINE` + `HAS_MARKER_GLYPH`）时，
  用该 Range 的最后一个 client rect 右缘作为前缀末端，cap = 右缘→内容右缘距离；
  标记前缀一旦被识别，图片卡**总是**带 inline max-width（保证卡不再被源码文本
  顶出标记行），但内层 img 仅在超宽时才随 `max-width:100%`/`height:auto` 等比缩，
  自然宽放得下就不缩（不问上限不缩在 img 层保持）。
- 单元 harness（无头 Chrome + dump-dom，真实排版引擎）：S1-S8 + S6b 全绿，
  覆盖贴行、缩放、比例保持、文字前缀回退、4em 回退、checkbox/引用/有序列表、
  行首现状、打字稳定性。harness 为临时验证产物，验证后已删除。
- 真机验证（无头 Chrome 驱动 dev server，真实压缩 highlight 管线）：
  `- img` 贴行缩放（left 36.3 > secLeft 25）、文字前缀回退、
  `- 前文` 前缀回退、`> ` 贴行、`  - [ ] ` 贴行且自然宽不缩、行首不变 —— 全绿，
  截图以此为证。
- `npm run build` 通过。

## Blocked by

None - can start immediately
