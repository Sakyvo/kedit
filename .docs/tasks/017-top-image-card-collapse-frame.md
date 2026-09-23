Status: review

## Parent

批 017(直接指令:同一现象的第二轮定位 —— 016 修的是「行内上限丢失」,本次是「首帧塌陷」,
不同根因;共用一次构建与一次人工验收)。

## What to build

现象:文档**最顶部**是图片、且图片下一行(同一 section,中间无空行)输入或删除时,
屏幕被拉动一下/闪屏;顶部若是空行或纯文字则不出现。

根因(运行时取证):`.img-wrapper` 卡片在每次输入时被整块重建,而新建 `<img>`
带 `style.display = 'none'`,要等**异步** `onload` 才 `display: ''` 显示。
同步路径上原本有一处「预设已知自然尺寸」来提前显示,其守卫是
`shouldApplyNaturalSize({ hasExplicitWidth: !!imgElt.width, ... })`。

`imgElt.width` 是 **IDL 属性**,一旦赋 `src` 就同步返回自然宽度;工作区本地图
(`/imgs/...`)命中 blob 缓存时 `imgElt.src = cachedUrl` 同步完成,于是
`imgElt.width` 立刻等于自然宽(实测 800),守卫把它**误判成「作者写了 `=WxH`」**,
跳过预设分支 → `display` 停在 `none` → 卡片塌陷一帧(实测 section 高度
1459 → 1260 → 1459),下一帧 onload 才恢复。

这解释了 016 为何没修掉:当时只用 HTTP 图验证,首帧 `imgElt.width === 0`,
守卫通过、预设生效,天然复现不到;而用户文档里全是工作区本地图,走的是
「同步命中的 blob 缓存」这条不同路径。

修复:显式尺寸必须从 **markdown 文本**(`.token.cl-size` 的 `=WxH`)判定,
不得从元素实测值判定。

## Acceptance criteria

- [x] `npm run build` 通过
- [x] 图片在文档顶部 + 下一行输入:重建卡到达即带非空 `src` 且可见(无 `display:none` 帧)
- [x] 删除同位置字符:section 高度与 scrollTop 全程恒定,无塌陷帧
- [x] `=WxH` 声明尺寸语法未被误伤(`=400x` → attr width=400,正常渲染)
- [x] 无声明尺寸时不写死 width,仍按自然宽 + CSS 收缩
- [ ] 真机触摸:顶部图片后连续输入/删除全程不闪屏
- [ ] 刷新页面、切换文档往返:顶部图片卡尺寸位置无异常跳动

## Implement notes

- `src/services/editor/imgSizeGuard.js`:新增纯函数 `parseDeclaredImgSize(sizeText)`,
  从 markdown 尺寸 token 文本解析 `=WxH` / `=800x` / `=x600`,无声明返回 `null`。
  注释写明「必须读文本、不得读 `imgElt.width`」的因果。
- `src/services/editorSvc.js`:`sectionHighlighted` 内改为先用 `parseDeclaredImgSize`
  解析声明尺寸再赋 `imgElt.width/height`,并把 `hasExplicitWidth/hasExplicitHeight`
  改为由**解析结果**推导,不再读 `imgElt.width`。预设分支本身未改。
- 未触碰:016 的 `imgLineFit` 记忆表与 `applyRememberedCap`;
  `imgSizeGuard.shouldRecordNaturalSize`(onload 记录路径,语义本就正确)。

## 显式取舍 / 范围外

- 只修正守卫的输入来源;`display:none` → onload 显示的既有机制不变(首帧预设失败时
  仍有一帧隐藏,那属于别的成因,本次未上报)。
- 未做触摸专属分支:与输入设备无关,只在窄屏更可见。

## Testing strategy

Jest 链已断(`npm run build` 是唯一 CI 门槛)。`parseDeclaredImgSize` 是纯函数,
进 `batch5.harness.mjs`(含「缓存 blob 让 `imgElt.width` 提前为真」这一回归断言);
首帧塌陷走真机运行时矩阵(MutationObserver 追踪重建 img 的 `display` 与 section 高度),
并用反事实对照(去掉预设分支 → 塌陷复现)坐实因果。

## Blocked by

None
