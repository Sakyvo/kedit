Status: review

## Parent

`113-locked-modal-size.md`

## What to build

手机软键盘弹出时，锁定的面板跟随**可视视口**收缩，按钮栏始终留在可视区内；键盘收起后自动恢复。

- 应用根把可视视口高度与上偏移发布成 CSS 自定义属性（与 `breakGapVars` 同一通道，设在 `.app` 上）；无 `visualViewport` 或桌面环境下退化为窗口高度，行为与上一片一致。
- 面板高度与（移动端）上沿消费这两个变量，不再直接写死 `100vh`。
- 订阅 `visualViewport` 的 resize/scroll；不要挂到 `window` 的 scroll 上（触屏滚动代理会高频触发）。
- 不加高度过渡动画。

## Acceptance criteria

- [x] `npm run build` 通过
- [x] 桩一个高度更小的 `visualViewport` 并触发 resize：手机视口下面板高度随之收缩到该值，面板上沿跟随其 offsetTop
- [x] 同一场景下按钮栏仍在面板内（`rect.bottom` ≤ 面板底 ≤ 可视区底）
- [x] 恢复 `visualViewport` 高度后，面板回到满屏高度
- [x] 桌面视口：变量取窗口高度，面板高度与上一片完全一致（无回归）
- [x] 页面滚动/触屏滚动代理期间不产生额外的视口变量更新（只订阅 visualViewport，不订阅 window scroll）
- [x] 面板高度无 transition

自动化证据：`node test/browser/modal-keyboard-viewport.mjs`（真实 `dist/`，桩入 `visualViewport` 后 390×844 / 1280×900）。

- [ ] 真机确认：手机上点进配置里的输入框，软键盘弹出后 `取消/确认` 仍可见（需人工过一遍）

## Blocked by

- `114-locked-modal-size.md`