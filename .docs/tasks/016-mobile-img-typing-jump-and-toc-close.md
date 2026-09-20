Status: review

## Parent

批 016(直接指令,两处独立小修,共用一次构建与一次人工验收;无独立 PRD)。

## What to build

### 切片 1 — 移动端(真机触摸)图片下一行输入时编辑区小幅上下弹动

现象:仅在图片后那行输入文字时出现,任意文档位置可复现;普通段落下一行不出现。

根因:每次输入触发所在 section 重渲染,`.img-wrapper` 卡片被整块重建;上一帧算出的
行内 `max-width` 上限随旧 wrapper 一起丢失。新卡片先以「整行容器宽」参与一帧布局
(窄屏下明显更高),待 rAF 里的 `fitImgWrapper` 重新写上限后被压回 —— 一帧高一帧低。

修复:把每个图片 URI 上次算出的行内上限记进 `imgLineFit` 的模块级表,新建 wrapper 时
**同步内联带上**(纯赋值,不测量、不强制布局),卡片第一帧即为压好的宽度。

### 切片 2 — 桌面端关闭目录回退语义

现象:关闭目录(面板 ✕ / 导航栏「目录」二次点击)直接收掉侧栏。

期望:所有窗口尺寸下都回退到侧栏主菜单,侧栏保持打开;侧栏只在主菜单面板 ✕
或导航栏 KEDIT(菜单)按钮时关闭。

## Acceptance criteria

- [x] `npm run build` 通过
- [ ] 真机触摸:图片下一行连续输入全程不弹动/不闪屏;图片后同段与下一段两种写法均稳定
- [ ] 窄屏贴行缩放、4em 下限回退整行宽不回归;拖动改变编辑区宽度/字号后重新 fit 一次即恢复稳定
- [ ] 切换文档再切回、刷新页面:图片尺寸与位置无异常跳动
- [ ] 对照组:普通段落下一行输入本就不跳动,不回归
- [ ] 桌面:目录面板 ✕ → 回主菜单且侧栏仍开;导航栏「目录」二次点击 → 同样回主菜单
- [ ] 桌面:主菜单面板 ✕ → 关闭侧栏;导航栏 KEDIT(菜单)按钮开关语义不变
- [ ] 窄屏 / `layoutOverflow`(侧栏全宽)下行为与宽屏一致
- [ ] 「自动跳转」开着时点目录项:仍按现行为跳转并收起侧栏,不回归

## Implement notes

- `src/services/editor/imgLineFit.js`:`uriInlineMaxWidthMap`(key = 图片 URI)+ `setInlineMaxWidth`
  收口全部 `maxWidth` 写入并在每条分支同步记忆;新增 `applyRememberedCap(wrapper)`
  (只读 `data-img-uri`,无 URI 时不动)。
- `src/services/editorSvc.js`:`sectionHighlighted` 内 wrapper 组装完成后调用 `applyRememberedCap`;
  既有 `scheduleImgLineFit` / `fitAllImgWrappers` / `createLayoutRemeasure` 路径未改。
- `src/components/SideBar.vue` ✕ 由 `panel === 'menu' || panel === 'toc' ? toggleSideBar(false) : setPanel('menu')`
  收窄为只按 `panel === 'menu'` 区分。
- `src/components/NavigationBar.vue` `toggleToc()` 二次点击 `toggleSideBar(false)` → `setSideBarPanel('menu')`。
- `Toc.vue` 的 `tocAutoJump` 跳转后收侧栏属跳转流程,未触碰。

## 显式取舍 / 范围外

- 记忆表按 URI 记忆:同一 URI 出现在两种行内上下文时,新卡片可能先套用另一处上限一帧,
  同一 rAF 遍内纠正 —— 一帧宽度偏差,自愈,接受。
- 文档首次渲染时表中无记录,仍有一帧未压宽(既有行为,一次性,非本次上报现象)。
- 不做触摸专属分支:两处均与输入设备无关,只在窄屏布局下更可见。

## Testing strategy

Jest 链已断(`npm run build` 是唯一 CI 门槛)。切片 1 依赖真实布局测量与 rAF,走真机验收
矩阵(见 Acceptance);切片 2 为纯状态回退,走桌面交互验收。

## Blocked by

None - 两切片自包含
