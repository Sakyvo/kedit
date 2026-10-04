Status: done

# 029 模态全局吸顶/吸底（顶栏 tabs/title 吸顶、按钮栏吸底）

## Parent

`.docs/tasks/025-settings-visual-fixes.md`

## What to build

`.modal__inner-2` 当前 `margin: 40px 10px 100px` 无高度约束，内容高 3310px 越屏
（实测），确认按钮不可达。全局修复（`src/components/Modal.vue` 的 scss）：

- `.modal__inner-2` → `max-height: calc(100vh - 60px)`，`overflow-y: auto`
  （原 `overflow:hidden` 改为 y-auto）。
- `.modal__button-bar` → `position: sticky; bottom: 0` + 背景补齐（`inherit`
  处理亮/暗主题）、上边界 1px divider。
- `.modal__inner-2 > .tabs` 与 `.modal__inner-2 > .modal__title` →
  `position: sticky; top: -50px`（抵消 inner-2 padding-top: 50px，峦位在可视顶）。
- 渐变装饰条 `.modal__inner-2::before/::after` 保持原位滚动（不做 sticky），
  滚动初期滚走不为问题。
- 审查 Modal.vue 里其他模态（链接/图片/同步清理/发布管理…）不需逐文件改动：
  它们都走 modal__inner-2 + modal__button-bar 共享 CSS 巢本，uzn 变体由顶部
  sticky 和底部 sticky 同时兜住。

## Acceptance criteria

- [x] 长内容模态（配置/默认配置）顶 tabs 滚动时锁顶、底按钮锁底、中间动。
  实测：max-height=100vh-60px 限高 565px、tab 吸顶（贴内容区顶）、按钮栏吸底 0 隙。
- [x] 短模态不受影（max-height 不影响小内容；sticky 不作用于无微视量冗余）。
- [x] 亮色/暗色背景 sticky 栏显式背景（#f8f8f8 / #383c4a）不穿帮。
- [x] `npm run build` 通过。

## Blocked by

None - can start immediately
