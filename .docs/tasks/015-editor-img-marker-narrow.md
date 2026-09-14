Status: done

## Parent

已归档批次 `.docs/archive/000-editor-img-marker-attach.md` + `014-editor-img-marker-attach.md` 的窄屏缺陷追加；决策延续 `.docs/adr/0006-editor-image-card-attaches-marker-line-pure-prefix.md`。

## What to build

窄屏下 `- ![输入图片说明](长 URL)` 的图片卡（img + 源码文本，inline-block）贴在标记行后，
因 inline-block 默认 baseline 对齐，`-` 与卡内**最后一行文字**的基线对齐——视觉上
`-` 落在 URL 折行后的第二行前。修复：`-` 必须始终与卡的第一视觉行
（`![输入图片说明]` 所在行）同行。贴行/缩放/不问上限不缩/4em 下限等 ADR-0006 语义不变。

## Acceptance criteria

- [x] 窄屏（section 宽 < 图片自然宽）：`-` 与 `![输入图片说明]` 同第一视觉行，且图片仍贴行缩放。
- [x] 宽屏原有场景回归：贴行、文字前缀回退、4em 回退全部不变。
- [x] 预览区渲染不变（未触碰预览样式）。
- [x] `npm run build` 通过。

## Verification

- 修复：`src/styles/markdownHighlighting.scss` `.img-wrapper` 加 `vertical-align: top`
  ——inline-block 默认 baseline 对齐会把行内标记对齐到卡内最后一个 line box 的基线
  （窄屏 URL 折行时即最后一段 URL），top 对齐使标记落在卡的第一视觉行。
- Harness（无头 Chrome，重建于 .tmp-imgfit，验证后删除）：N1 红灯复现
  （markerTop 164.5 vs wrapperTop 13.0，gap 151.5px → 修复后 gap 3.0px），
  N1–N4 全绿（窄屏首行贴行、4em 回退、宽屏贴行回归、文字前缀回退）。
- 真机窄屏（CDP，380×800 窗口）：marker 与 card 第一行 gap=5.0px（<1.5em），
  maxW=405px 贴行缩放，prefix 纯 `- `，全绿。

## Blocked by

None - can start immediately
