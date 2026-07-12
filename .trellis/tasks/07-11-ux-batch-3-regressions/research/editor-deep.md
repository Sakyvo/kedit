# Research: Batch-3 editor mechanics — Z3 TOC jump / Z6 upload-undo / Z7 viewport jump

- **Query**: Z3 TOC 编辑区跳转不准; Z6 上传占位符 Ctrl+Z 残留; Z7 图片行编辑视口跳动
- **Scope**: internal (KEDIT codebase, Vue 3.5 + Vuex 4 StackEdit fork)
- **Date**: 2026-07-11
- **Note**: 工作区 clean; 所有行号对应 commit `ca7a4b67`(batch-2 阶段1, 今日已提交) 之后的当前代码。

---

## Q1 — Z3: TOC jump precision in EDIT mode

### 1.1 Click pipeline today (after 07-05 commit 10bfa2b9)

`src/components/Toc.vue:26-45` — 10bfa2b9 的 R3/R4 改动 = 去掉动画滚动、改为 DOM 精确命中 tocElt 后**一次性直接赋值两个面板的 scrollTop**：

```js
// Toc.vue:33-40
const jumped = editorSvc.previewCtx.sectionDescList.some((sectionDesc) => {
  if (sectionDesc.tocElt !== sectionElt) { return false; }
  editorSvc.editorElt.parentNode.scrollTop = sectionDesc.editorDimension.startOffset;   // :37
  editorSvc.previewElt.parentNode.scrollTop = sectionDesc.previewDimension.startOffset; // :38
  return true;
});
```

- 遍历的是 `editorSvc.previewCtx.sectionDescList`（**不是** `previewCtxMeasured`）。
- 编辑面板滚动目标 = `sectionDesc.editorDimension.startOffset`——一个**缓存的测量值**，不是点击时的实时布局。
- scroller 结构：`editorSvc.editorElt` = `pre.editor__inner`，`parentNode` = `div.editor`（overflow:auto, position:absolute — `src/components/Editor.vue:180-191`），即 offsetTop 的 offsetParent 与 scroller 是同一个元素，量纲一致。

### 1.2 Where dimensions come from

`src/services/editor/sectionUtils.js:44-113` `measureSectionDimensions(editorSvc)`：

- 逐 section 读 `nextSectionDesc.editorElt.offsetTop`（:55-57）与 `previewElt.offsetTop`（:68-70），写入 `sectionDesc.editorDimension / previewDimension`（`SectionDimension{startOffset,endOffset,height}`，:1-7）。
- 最后一个 section 用 `editorSvc.editorElt.scrollHeight` / `previewElt.scrollHeight` 收尾（:93-108）。
- 零高 section 串由 `dimensionNormalizer` 均摊前一个非零段的高度（:9-41）——纯数学，不重新读 DOM。
- **测量对象就是当时的 DOM 快照**；此后 DOM 高度变化（图片加载）不会自动反映。

`SectionDesc.editorElt = section.elt`（`src/services/editorSvc.js:43-51`），并在每次 section 重渲染后被刷新为新元素：

```js
// editorSvc.js:568-584  'highlightedSectionsRefreshed'
this.previewCtx.sectionDescList.forEach((sectionDesc, index) => {
  const section = sectionList[index];
  if (section) { sectionDesc.section = section; sectionDesc.editorElt = section.elt; }
});
this.measureSectionDimensions(false, false, true);
```

→ `sectionDesc.editorElt` 始终指向**活的** `div.cledit-section`，它的 `offsetTop` 在点击瞬间读取即为准确的编辑区偏移。**这就是"直接滚编辑区到 section 自己的偏移"所需的数据源，且已存在。**

### 1.3 When measurement runs (and why it goes stale)

`measureSectionDimensions` 定义于 `editorSvc.js:410-419`，`allowDebounce(fn, 500)` 包装（:25-35）——调用形如 `(doDebounce, restoreScrollPosition, force)`。触发点：

| 触发点 | 位置 | 时机 |
|---|---|---|
| 预览刷新完 | editorSvc.js:404 `measureSectionDimensions(!!previewCtxMeasured)` | 已测过则 **debounce 500ms**；先 `await` 了**预览**图片加载（:376-397） |
| 初始渲染 | editorSvc.js:634 `(false, true, true)` | 立即 + restoreScrollPosition |
| section 重高亮(Prism 语言载入) | editorSvc.js:582 `(false, false, true)` | 立即 |
| 布局样式变化 | editorSvc.js:880-889 rAF 后 `(false, true, true)` | 立即 + restore |
| 打开侧预览 | scrollSync.js:180-184 `(false, true)` | setTimeout 0 |

**关键缺口：编辑区图片的 load 没有任何 re-measure 挂钩。**

编辑区图片生命周期（`editorSvc.js:717-776`，'sectionHighlighted'）：

```js
// editorSvc.js:725-731
const imgElt = document.createElement('img');
imgElt.style.display = 'none';          // 创建即隐藏 → 高度 0
...
imgElt.onload = () => { imgElt.style.display = ''; };   // 加载完才占位
if (isWorkspaceLocalUri(uri)) {
  loadImgs.push({ imgElt, uri: ... });  // 本地图: src 之后异步解析(:761-769 getImgUrl→blob URL)
} else {
  imgElt.src = uri;                     // 远程图: src 立即, load 仍异步
}
```

预览图会被 `await Promise.all(loadedPromises)`（:377-397）等完才测量；**编辑区图不等**——`Promise.all(loadWorkspaceImg)` 只更新 blob 引用计数（:770-772），不触发测量。

**失准链条（长文+图）**：初始渲染/编辑后 500ms 测量时，编辑区里若干 `<img>` 还是 `display:none`（IndexedDB 读 blob、远程下载、大图解码都超过 500ms）→ 测得的 `editorDimension.startOffset` 比真实值**小**（每张未加载图贡献约一张图高的误差，向下累积）→ 点击 TOC 落点偏上，目标标题出现在视口中下部。截图 `research/assets/37-toc-jump-imprecise.png` 正是此表现：编辑区目标标题 `##### II. 配置文件(P)` 落在视口 ~85% 处，其上方全是大截图。

### 1.4 scrollSync 反馈（第二重扰动，侧预览模式）

`src/services/optional/scrollSync.js`：

- 编辑区 scroller 的 scroll 事件（:126-133）→ `isScrollEditor=true` → `doScrollSync()`（:35-110）：按 `editorDimension` 比例把编辑 scrollTop 映射到预览，throttle 50ms（侧预览可见）/500ms（隐藏），`animationSvc.animate(...).duration(!localSkipAnimation && 100)`——duration 0 时立即赋值（animationSvc.js:142-143）。
- **侧预览模式**（双栏，即截图 37 的场景）：Toc 点击先精确设了 `previewDimension.startOffset`（Toc.vue:38），随后编辑区 scroll 事件触发 sync，用**过期的 editorDimension** 反算比例，50ms 后把预览**拖离**刚设好的精确位置 → 双栏一起歪。
- **纯编辑模式**：预览面板 `v-show="styles.showPreview"` 为 false（`src/components/Layout.vue:26`，`showPreview = showSidePreview || !showEditor`，`src/store/layout.js:43`）→ display:none → 所有 `previewElt.offsetTop`/`scrollHeight` 均为 0 → `previewDimension` 全 0 → Toc.vue:38 写 0 是 no-op，sync 把隐藏预览滚到 0 也是 no-op。**纯编辑模式的失准只来自 1.3 的过期 editorDimension**。
- **纯预览模式**：editorDimension 全 0（编辑面板 v-show false, Layout.vue:12）→ Toc.vue:37 写 0 no-op；preview 用的是测量前已 await 图片的 `previewDimension` → 准确。**这解释了"预览模式没问题、无需改动"**。

### 1.5 附带风险：dimension 未测量时点击会抛错

`refreshPreview` 每次生成**新的** SectionDesc（新 section 或 editorElt 变了，editorSvc.js:264-275, 358）；测量在 500ms debounce 之后才补 `editorDimension`。窗口期内点击 TOC → `sectionDesc.editorDimension.startOffset` 直接 TypeError（Toc.vue:37 无保护）。旧 section 复用旧对象则拿到**过期**维度。

### 1.6 修复素材（供设计，不是结论）

1. **点击时读实时偏移**：编辑分支改用 `sectionDesc.editorElt.offsetTop`（活元素，1.2 已证始终新鲜），钳制 `Math.min(offset, scroller.scrollHeight - scroller.clientHeight)`、下限 0。现成钳制样板：`editorSvcUtils.js:139-145`（`scrollToAnchor` 的 maxScrollTop 逻辑）。预览分支保持 `previewDimension.startOffset` 不动（满足"预览模式不变"）。纯预览模式下 `editorElt.offsetTop` 为 0，与现状等价 no-op，不回归。
2. **编辑图加载后补测**：在 `editorSvc.js:729` 的 `imgElt.onload` 里追加 `editorSvc.measureSectionDimensions(true)`（debounced 500ms，聚多次 load 为一次测量）。这同时修正 scrollSync、TOC mask（Toc.vue:48-57 用 `previewCtxMeasured`）、`getScrollPosition/restoreScrollPosition`（editorSvcUtils.js:11-51 保存/恢复滚动锚点）的整条下游。
3. 侧预览模式如仍要求点击后预览精确：需处理 1.4 的 sync 反扑（如点击后短窗抑制，或接受 sync 以编辑区为准的比例位置）。
4. 可选防御：Toc.vue 点击处对 `editorDimension` 缺失做兜底（回退 `editorElt.offsetTop`）。

---

## Q2 — Z6: upload placeholder survives undo

截图 `research/assets/39-upload-undo.png`：Ctrl+Z 后文档残留 `[图片上传中...(image-alXhucePoHEf3prF)]`。

### 2.1 哪条链路产生文档内占位符

- **ImageModal「上传图片」不产生文档内占位符**：`src/components/modals/ImageModal.vue:47-76` 上传期间只在弹窗内显示"(图片上传中...)"（:4），完成后经 `insertImageDialog` 回调一次性插入最终 markdown（editorSvc.js:608-614 → pagedown doLinkOrImage）。对其 Ctrl+Z 一次即可整体消除，无此 bug。
- **产生占位符的是 Editor.vue 粘贴/拖放直传**（用户实际踩中的路径）：`src/components/Editor.vue:66-97 processUpload`，由 `paste`（:149-152）与 `drop`（:145-148）监听触发。

### 2.2 占位符插入机制（两次独立内容变更之一）

```
Editor.vue:80-82   imgId = utils.uid(); dispatch('img/setCurrImgId'); 
                   editorSvc.pagedownEditor.uiManager.doClick('imageUploading')
└ pagedown.js:403-456 doClick → new TextareaState(input) → chunks
  └ pagedown.js:669-678 doImageUploading: hooks.insertImageUploading(cb)
    └ editorSvc.js:623-626 hook 同步回调 currImgId
      → chunk.before += `[图片上传中...(image-${imgId})]` (pagedown.js:672)
      → postProcessing() = fixupInputArea (pagedown.js:437-446)
        → state.setChunks + state.restore()
          → inputArea.setContent(stateObj.text)   // pagedown.js:361-367, 无 noUndo 参数
```

`setContent(value, noUndo)`（cleditCore.js:61-86）此处 noUndo=undefined → DOM 变更被 MutationObserver 捕获 → `checkContentChange`（cleditCore.js:144-193）：

```js
// cleditCore.js:185-189
if (!ignoreUndo) {
  undoMgr.addDiffs(lastTextContent, newTextContent, diffs);
  undoMgr.setDefaultMode('typing');
  undoMgr.saveState();
}
```

undo 模式：粘贴路径下 cledit 自己的 paste 监听（cleditCore.js:377-378）**先**执行 `undoMgr.setCurrentMode('single')`，图片粘贴无文本 data 提前 return（:402-404）但模式已置 → 占位符插入成为独立 undo 态。拖放路径无预置模式 → 默认 'typing'（可能与 1s 内的输入合并，无关紧要）。

### 2.3 替换机制（第二次内容变更）

上传完成/失败后：`Editor.vue:87/91/94` → `editorSvc.clEditor.replaceAll(占位符, 最终文本)`：

```js
// cleditCore.js:99-109
function replaceAll(search, replacement, startOffset = 0) {
  undoMgr.setDefaultMode('single');          // 强制独立 undo 态
  ...
  const offset = editor.setContent(text.slice(0, startOffset) + value);  // 无 noUndo → 记录
  selectionMgr.setSelectionStartEnd(offset.end, offset.end);
  selectionMgr.updateCursorCoordinates(true);
}
```

→ 又走一遍 checkContentChange → `saveState` → **第二个独立 undo 态**。

### 2.4 undo 管理器的分组语义（`src/services/editor/cledit/cleditUndoMgr.js`）

- 栈模型：`saveState`（:101-115，`debounce(fn)` 无 wait = 下一 tick 即执行，cleditUtils.js:42-59 defer 实现）——若 `!isBufferState()` 就 `currentState.addToUndoStack()`；`State.patches = previousPatches`（:71-82），随后 `previousPatches ← currentPatches`（:95-99）。即：**栈顶之后累计的 patches 存于 `previousPatches`+`currentPatches`，一次 undo 全部逆转**：

```js
// cleditUndoMgr.js:144-154
this.undo = () => {
  const state = undoStack.pop();
  saveCurrentPatches();                    // previousPatches += currentPatches
  currentState.addToRedoStack();           // currentState.patches = previousPatches
  restoreState(currentState.patches);      // 逆向应用"自上次入栈以来的全部 patches"
  previousPatches = state.patches;
  currentState = state;
};
```

- 合并（buffer）条件 `isBufferState()`（:48-53）：`currentMode !== 'single' && currentMode === lastMode && 距上次 saveState < options.bufferStateUntilIdle(1000ms)`（:20-23）。**上传耗时 >1s，模式缓冲无法跨越**；且 'single' 模式显式禁止缓冲——replaceAll 与 Enter/粘贴均用 'single'（cleditCore.js:91,100,378; cleditKeystroke.js:113）。
- 公开 API：`setCurrentMode`（:85-87 强设）、`setDefaultMode`（:88, 仅当未设时生效）、`addDiffs(old,new,diffs)`（:90-93 → `patch_make` 后推入 `currentPatches`）、`saveState`、`canUndo/canRedo`。**没有** pop/merge 栈的 API。
- undo 的 Ctrl+Z 入口：cleditKeystroke.js:43-65（setTimeout 10ms 后 `undoMgr.undo()`）。
- `restoreState`（:120-142）还会 `selectionMgr.updateCursorCoordinates(true)` + `editor.adjustCursorPosition()`（与 Z7 的滚动恢复相关，见 3.4）。

### 2.5 使插入+替换合并为一个 undo 条目的机制（基于现有 API 的可行方案）

核心事实：**只要替换那次变更不触发 `saveState`（不新入栈），它的 patches 会与占位符插入的 patches 同批（`previousPatches`+`currentPatches`），一次 Ctrl+Z 同时逆转两者。**

具体做法（改 Editor.vue 的完成分支，不动 UndoMgr）：

1. `const oldContent = clEditor.getContent(); const newContent = oldContent.replace(placeholder, final);` 无变化（占位符已被用户删/撤销）则直接返回——现有 replaceAll 本就有此 no-op 行为（cleditCore.js:104）。
2. `clEditor.setContent(newContent, true)` —— noUndo=true → `ignoreUndo` 置位（cleditCore.js:77-79），checkContentChange 跳过 addDiffs/saveState（:185-190）。
3. 手动补记 patches 但**不** saveState：`clEditor.undoMgr.addDiffs(oldContent, newContent, diffMatchPatch.diff_main(oldContent, newContent))`（cleditUndoMgr.js:90-93）。
4. 光标/选区处理仿 replaceAll（cleditCore.js:106-107）。

推演：插入时入栈 S1（patches=插入前的批次），`previousPatches=[插入]`；替换后 `currentPatches=[替换]`；Ctrl+Z → 逆转 `[插入,替换]` → 文档回到插入前，**一步干净**；Redo 正向重放两者 → 直接是最终图片文本。失败分支（`[图片上传失败...]` 替换，Editor.vue:87/94）应同样处理。

已知边界（需在设计时拍板）：
- **上传期间用户继续输入**：中间态已各自入栈；末次 undo 会把"最近一段输入 + URL 替换"一起逆转、占位符短暂复现（再按一次才消）。常规场景（上传期间不输入）完全正确。
- 跳过 saveState 意味着**不清 redoStack**（清空只发生在 saveState 首行 :102）；若用户在上传期间做过 undo，替换后 redo 栈仍存——DMP patch 模糊定位通常可容忍，需实测。
- `undoStateChange` 事件不触发（canUndo/canRedo 状态钮不刷新）——可视需要手动 `saveState` 以外的方式补发或忽略（插入时已 canUndo=true）。

不可行/放弃项：模式缓冲合并（1s 上限，2.4）；直接改栈（无 API，除非给 UndoMgr 加方法）。

---

## Q3 — Z7: viewport jumps when editing near image lines（换行闪屏）

视频 `research/assets/40-viewport-jump.mp4`。

### 3.1 什么编辑会重建图片

- section 粒度：`markdownConversionSvc.parseSections`（markdownConversionSvc.js:162-214）按 **level-0 块 token** 切分（段落/标题/列表/引用/表格）。图片行与相邻文本行之间**无空行 = 同一段落 = 同一 section**；图片在列表项内亦然。
- cledit 增量重渲染：`cleditHighlighter.parseSections`（cleditHighlighter.js:64-195）从上/下夹逼定位受影响 section（:84-134），对每个 modified section **整体新建** `div.cledit-section` 并 innerHTML 重建（:136-143 `highlight()` → `$trigger('sectionHighlighted')`）。
- 因此：在图片所在 section 内打字/回车（回车还会把 section 一分为二，两半都重建），该 section 里的 `<img>` **每次都是全新元素**。

### 3.2 图片重建 → 高度塌缩 → 回弹（跳动根源）

新 img 的创建（editorSvc.js:718-756）：`display:none` 起步（:726），`onload` 才 `display:''`（:729-731）→ **塌缩期该图完全不占高**（非 visibility），加载完瞬间撑开一张图高。全局 `img { max-width: 100% }`（base.scss:277-279）。显式尺寸 token `=WxH` 会预设 width/height（:738-747），但仅当 markdown 写了尺寸。

imgCache 复用（决定塌缩是否发生）：

```js
// editorSvc.js:675  batch-2 X1 后的 hash（含 markdown URI）
const hashImgElt = imgElt => `${imgElt.getAttribute(imgUriAttr)}:${imgElt.src}:${imgElt.width || -1}:${imgElt.height || -1}`;

// editorSvc.js:778-797  'highlighted'（DOM 换入后）
imgEltsToCache.forEach((imgElt) => {
  if (!imgElt.getAttribute('src')) {
    // batch-2 X1: 空 src(本地图异步解析) 不复用、不入缓存   // :780-784
    return;
  }
  const cachedImgElt = getFromImgCache(imgElt);   // 命中: 已加载的旧元素直接 replaceChild(:785-791)
  ...
});
```

- **远程图**：创建时 src 同步已设 → hash 可命中上一轮渲染留下的已加载分离元素（`getFromImgCache` 只取不在 DOM 中的条目, :687-702）→ `replaceChild` 换入**已解码**元素 → 无塌缩（首次加载除外）。
- **本地图（workspace 图）**：创建时 src 为空 → :780 直接 return → **既不复用也不缓存** → **每次重渲染都经历 display:none → 异步 blob 解析（:761-769 getImgUrl）→ load → 撑开**。batch-2 X1 修的是"串图"（不同本地图共享 `null:...` hash 被错换），代价是本地图彻底失去复用 → **Z7 在本地图场景每次编辑必闪**。
- 塌缩瞬间若 `scrollHeight - clientHeight < scrollTop`，浏览器强制钳 scrollTop；图片撑回后无人补偿 → 视口净位移（"飞屏"）。代码中**不存在任何 section 重渲染时的滚动保持逻辑**——highlighter 换 DOM 后只恢复选区：cleditHighlighter.js:188-191 `restoreSelection() + updateCursorCoordinates()`（无 adjustScroll 参数）。

### 3.3 与光标滚动逻辑的互搏

- 任意按键（window keydown, cleditCore.js:249-256）→ `adjustCursorPosition()` → `saveSelectionState(true, true)`（cleditCore.js:40-42）→ debounce 后 `updateCursorCoordinates(选区变化 && true)`（cleditSelectionMgr.js:310-320）。
- 滚动窗算法（cleditSelectionMgr.js:47-79）：以 `getCursorFocusRatio()`（editorSvc.js:226-231, 常态 0.15/焦点模式 1）计算余量，把 scrollTop 夹进 `[cursorTop-adjustment, cursorTop+adjustment-clientHeight]`。
- 坐标计算 `getCoordinates`（cleditSelectionMgr.js:342-407）遇到不可见容器（`!containerElt.offsetHeight`, :354-369）会**向前兄弟/父级回退**——图片塌缩期光标若在图后，测出的 cursorTop 系统性偏小 → 依据错误坐标滚动；图片随后撑开 → 内容下移，无人重滚 → 二次跳。
- **undo/redo 也走同一逻辑**：`restoreState` → `updateCursorCoordinates(true)` + `adjustCursorPosition()`（cleditUndoMgr.js:130-141）——撤销含图 section 的变更时同样先按塌缩布局滚动、图加载后再位移。

### 3.4 缓解方案素材（均已定位挂钩点）

(a) **尺寸预留（per-URI 记忆）**：
- 记录点：`editorSvc.js:729-731` `imgElt.onload` 闭包内可拿到 `imgElt.naturalWidth/naturalHeight` 与 `imgElt.getAttribute(imgUriAttr)`（batch-2 已加 `data-img-uri`, :748）→ 存模块级 `uriDimensionMap`。
- 应用点：创建处 `editorSvc.js:725-750`——已知尺寸的 URI 直接设 `width/height` 属性并**跳过 `display:none`**（保留占位盒；`max-width:100%` 缩放下浏览器按 width/height 属性推导 aspect-ratio，预留高度仍正确）。显式 `=WxH` token（:738-747）优先。首次加载的图无记忆，仍会塌缩一次（可接受/结合 b）。

(b) **img load 后视口再锚定**：
- 挂钩点：同一 `onload`（editorSvc.js:729）。scroller = `editorSvc.editorElt.parentNode`。翻转 display 前后对比：若 `imgElt.getBoundingClientRect().top` 低于 scroller 视口顶（即图在当前视口上方展开），`scroller.scrollTop += imgElt.offsetHeight`（精确做法：翻转前记录某锚点元素的 viewport 相对位置，翻转后恢复）。预览侧图片因测量前已 await（editorSvc.js:377-397）问题小得多。

(c) **本地图恢复缓存复用（治本）**：
- 创建时**同步查 blob 缓存**：`pathUrlMap`（editorSvc.js:53, 写入 :74-77, 命中即返回 :137-139；条目在 revoke 时同步删除 :79-91, 故查到的 URL 必有效）。在 `editorSvc.js:732-735` 分支前插入：`const abs = getAbsoluteWorkspaceImgPath(decodeURIComponent(uri)); if (pathUrlMap[abs]) { imgElt.src = pathUrlMap[abs]; imgElt.setAttribute(localImagePathAttr, abs); }` → 'highlighted' 时 src 非空 → 绕过 :780 的 batch-2 守卫（守卫语义不破坏：仍禁空 src 复用）→ hash 含真实 blob URL + URI → 命中旧的已加载元素 → 与远程图同等零塌缩。
- 引用计数影响：`countActiveWorkspaceImages` 按 DOM 内 `data-ws-path` 计数、`updateActiveEditorImgPaths` 在 'highlighted' 后重同步（editorSvc.js:101-132, 666-671, 796）——旧元素出 DOM、新元素入 DOM 净值为 0，不触发误 revoke；已加载元素即使 URL 被 revoke 也保持已解码位图（浏览器语义），仅新元素不能用 revoked URL——`pathUrlMap` 查询天然规避。
- 首次加载仍走异步路径（无缓存可查），与 (a)/(b) 互补。

(d) **共享 Z3 的补测钩子**：onload → `measureSectionDimensions(true)`，消除塌缩期测量残留对 scrollSync/TOC 的二次污染。

---

## Related files quick index

| File | Relevance |
|---|---|
| `src/components/Toc.vue:26-45` | Z3 点击处理（10bfa2b9 现状） |
| `src/services/editor/sectionUtils.js:44-113` | 维度测量本体 |
| `src/services/editorSvc.js:404,410-419,568-584,634,880-889` | 测量触发点 |
| `src/services/editorSvc.js:665-797` | 编辑区图片创建/imgCache/refcount（Z7 核心） |
| `src/services/optional/scrollSync.js` | Z3 反馈回路 |
| `src/services/editor/editorSvcUtils.js:11-51,132-146` | scrollPosition 保存/恢复; 钳制样板 |
| `src/components/Layout.vue:12,26` + `src/store/layout.js:41-43` | 面板 v-show（隐藏面板维度全 0） |
| `src/components/Editor.vue:66-97,145-152` | Z6 粘贴/拖放上传流 |
| `src/libs/pagedown.js:332-393,403-456,669-678` | TextareaState/doClick/占位符插入 |
| `src/services/editor/cledit/cleditCore.js:61-109,144-193,377-407` | setContent(noUndo)/replaceAll/checkContentChange/paste 模式 |
| `src/services/editor/cledit/cleditUndoMgr.js` | undo 栈/模式/合并语义（全文 174 行） |
| `src/services/editor/cledit/cleditHighlighter.js:64-195` | section 重渲染 + 选区恢复 |
| `src/services/editor/cledit/cleditSelectionMgr.js:47-79,342-407` | 光标滚动窗/坐标回退 |
| `src/services/editor/cledit/cleditKeystroke.js:43-65,92-117` | Ctrl+Z 入口/Enter 模式 |
| `src/services/markdownConversionSvc.js:162-214` | section 切分粒度 |
| `src/styles/base.scss:277-279` | `img{max-width:100%}`（尺寸预留需配 w/h 属性） |

## Caveats / Not Found

- 未运行程序实测；所有结论为静态代码推演（因果链均有行号支撑，但如"500ms 内图片是否加载完"依环境而异）。
- 截图 37 为**侧预览双栏**场景（非纯编辑单栏），两栏皆偏——与 1.3+1.4 双机制叠加一致；纯编辑模式仅 1.3 生效。
- Z6 的"redoStack 不清空"与"上传期间输入"两个边界行为需在实现后手测确认 DMP 模糊 patch 的实际表现。
- `animationSvc.animate().duration(0)` 立即赋值的结论出自 animationSvc.js:142-143（`if (!this.$end.duration) this.loop(false)`），未逐行核对 loop 内部。
