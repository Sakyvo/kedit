Status: anchor

## Problem

作者（Author）在编辑区写 `- ![alt](uri)` 时，图片卡（渲染图 + `![alt](uri)` 源码文本组成的
inline-block 整体）因宽度超过标记后剩余空间而整体另起一行，图片与列表标记视觉脱钩，
读起来像是下一行的内容，引起歧义。预览区无此问题（圆点与图片已正确对齐）。

## Decisions

见 `.docs/adr/0006-editor-image-card-attaches-marker-line-pure-prefix.md`。要点：

- 仅当图片是标记后第一个实质内容（前缀只含列表标记 `- `/`* `/`+ `/`1. `、缩进、
  checkbox、引用 `> `、空白）时，图片卡缩放到"标记后剩余宽度"贴在标记行。
  前缀含普通文字（如 `- 前文 ![图]`）维持现状：独占行、按所在行宽截断。
- 剩余宽度 < 4em 时回退独占行（复用现有 MIN_FIT_EM 机制）。
- 自然宽 ≤ 剩余宽度时不缩放（"不问上限不缩"）；缩放必须等比（height:auto）。
- 预览区不改。

## Out of scope

- 预览区/pdir 侧任何渲染改动。
- `- ![图1] ![图2]` 同一行第二张图的贴行（图2 前缀含图1 源码，按规则回退独占行）。
- inlineImages 设置项、图片存储/同步/Publish 投影链路。
- 行首无标记的图片（维持现状）。

## Testing strategy

Jest 测试链已断（见 AGENTS.md），本批次以 `npm run build` 为唯一 CI 门槛，
行为验收走部署后真机人验（push 即触发 Pages 部署）。验收场景清单写在任务卡的
Acceptance criteria 里，逐条目检：贴行、打字尺寸稳定、文字前缀回退、4em 回退、
嵌套/引用、预览回归。
