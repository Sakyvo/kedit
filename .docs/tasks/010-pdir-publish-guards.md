Status: review

## Parent

批6 pdir 直发（grill-with-docs 收敛，无独立 PRD）。

## What to build

发布护栏（源=投影，只拦不改）：

- 标题校验拦截：Document 正文在代码围栏外含行首 `#`/`##`/`###` ATX 标题时拒绝发布，
  错误提示指明 pdir 向文档需从 `####` 起步并给出违规位置；不做自动降级。
- front-matter 剔除：Document 带 YAML properties 块时，发布投影剔除它只发正文；
  源文档不动。

## Acceptance criteria

- [ ] 含围栏外 `##` 的 Document 发布被拦，提示违规标题及位置
- [ ] 代码围栏内的 `#` 行不触发拦截
- [ ] 带 front-matter 的 Document 发布后 pdir 正文无 YAML 块
- [ ] 纯 `####` 起步的 Document 正常发布

## Blocked by

- `009-pdir-publish-minimal.md`

## Resolution notes（2026-10-12 审计补记）

实现已落地：`2de9e0a7`（2026-07-21,feat(pdir): publish guards）。要点：

- 围栏外的 `#`/`##`/`###` ATX 标题拒发，错误提示带违规位置;
  围栏内不触发。
- front-matter YAML properties 在发布投影里剔除（`stripFrontMatter`）,源文档不动。
- 由 `pdirPublish.harness.mjs` 的「guard」段覆盖,当前 19/19 全绿。

### 人工验收（补记）

- [ ] 含围栏外 `##` 的文档发布时被拦截,错误指出位置
- [ ] 围栏内的 `#` 冒头不触发拦截
- [ ] 带 front-matter 的文档发布后 pdir 正文无 YAML 块
- [ ] 纯 `####` 起步的文档正常发出
