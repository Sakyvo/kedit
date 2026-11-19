Status: review

## Parent

`104-mobile-modal-and-menu-copy.md`

## What to build

窄屏（≤600 CSS px）下弹窗与视口四边完全嵌合，并把正文字号降一档，同时保住触控目标大小。

- `.modal__inner-2`：`margin` 归零（不再是 `16px 10px 32px`）、`border-radius` 归零、
  `max-height: 100vh`、内距 20px → 12px。
- 粘顶标题 / tabs 的盖板偏移 `N` 从 20 改为 12，与上面三次出现的位置（box-shadow、
  `.tabs` 的负 margin 与 padding）成对同步；`.modal__button-bar` 的负 margin 与
  `bottom` 也跟着新内距走，保持吸底贴齐。
- 字号：标题 20px、tab `1em`、表单标签 `0.8rem`；按钮与 `textfield` 保持 16px 不缩。
- 宽度 >600px 时以上全部不变。

## Acceptance criteria

自动化证据：`node test/browser/mobile-modal.mjs`（真实 `dist/`，390 / 590 / 601 / 1280 px）。

- [x] `npm run build` 通过
- [x] 弹窗四周无露出暗背景的缝隙，面板边角无圆角，底部按钮栏贴齐屏底（390px 与 590px 几何实测）
- [x] 滚到顶/底时内容不从标题或 tabs 上方透出：内容滚动 400px 后标题仍钉在内距边缘，面板本身不位移
- [x] 按钮与输入框的高、字号与改动前一致（未随字号缩小）
- [x] 标题、tab、表单标签明显小于改动前（20 / 16 / 12.8px）
- [x] 桌面 1280px 与 601px 宽窗口：内距、圆角、宽度上限、字号、盖板偏移全部与改动前一致
- [x] 长内容弹窗（配置）与短内容弹窗（确认框）都无溢出或错位；短弹窗保持自然高度，不被拉成整屏
  （**已被批 113 取代**：面板高度改为锁死视口上限，短弹窗同样满屏；`max-height` 断言改 `height`）
- [ ] 真机手感确认（触摸滚动与吸底按钮栏，需人工在手机上过一遍）

## Blocked by

None - can start immediately