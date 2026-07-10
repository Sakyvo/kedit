# Research: 图片对话框/编辑区图片组件/下划线斜体/TOC/标题字号/列表/同步按钮

- **Query**: batch-2 UX 修复前期调研（I1-I5, X1, U1, T1/T2, H1, N1/N2, S3）
- **Scope**: internal（KEDIT 代码库，Vue 3.5 + Vuex 4 StackEdit fork）
- **Date**: 2026-07-10
- **Screenshots**: `research/assets/001-010.png`（001 图片 URL 对话框；002/007 编辑区图片组件；003 TOC 面板；008/009 编辑区与预览区图片不一致；010 列表缩进）

---

## 1. I1-I4 图片对话框与上传流程

### 完整调用链

| 环节 | 位置 |
|---|---|
| 工具栏按钮定义 | `src/data/pagedownButtons.js:1-4`（method: 'image'） |
| 工具栏点击 | `src/components/NavigationBar.vue:38` → `pagedownClick` → `NavigationBar.vue:193-195` `editorSvc.pagedownEditor.uiManager.doClick(name)` |
| 快捷键 | `src/services/optional/shortcuts.js:38` `image: pagedownHandler('image')` |
| pagedown doClick | `src/libs/pagedown.js:403-456`：构造 `TextareaState`+chunks，`fixupInputArea`（437-446）负责把 chunks 写回编辑器并恢复焦点；link/image 命令返回 true 表示异步收尾（等对话框回调） |
| image 命令 | `pagedown.js:478-480` → `doLinkOrImage(chunk, postProcessing, true)`（772-849） |
| 弹对话框 hook | `src/services/editorSvc.js:605-611`：`hooks.set('insertImageDialog', (callback) => { store.dispatch('modal/open', { type: 'image', callback }); return true; })` |
| 对话框组件 | `src/components/modals/ImageModal.vue`（文案"请为您的图像提供 url"在第 4 行） |

### (a) 按钮接线（ImageModal.vue）

- **确认**（L13 → `resolve` L29-38）：url 为空 → `setError('url')`；否则 `config.resolve()` 关闭弹窗 + `callback(this.url)`（即 pagedown 的 `linkEnteredCallback`）。`:disabled="uploading"` 上传期间禁用。
- **取消**（L12 → `reject` L39-43）：`config.reject()` + `callback(null)` → pagedown 收到 null，不插入，但会执行 `postProcessing()`（= `fixupInputArea`，恢复编辑器焦点/选区）。
- **X 关闭**（`src/components/modals/common/ModalInner.vue:4`）：`@click="config.reject()"`——**只 reject 了 modal promise，没有调用 `callback(null)`**。后果：(1) pagedown 的 `fixupInputArea` 永不执行，编辑器焦点/选区不恢复；(2) `editorSvc.js:606` 的 `store.dispatch('modal/open',…)` 返回的 promise 无人 catch → unhandled rejection。与"取消"行为不一致（I1 的根源）。modal store 见 `src/store/modal.js:19-32`（open 的 finally 只做出栈）。
- **上传图片**（L10-11）：`<input class="hidden-file" id="upload-image-file-input" type="file" accept="image/*" :disabled="uploading" @change="uploadImage">` + `<label for=…><a class="button">上传图片</a></label>`。`.hidden-file` 样式（fixed, top:-999px）在 `src/components/menus/common/MenuEntry.vue:62-65` 等处定义。

### (b) 上传路径（选文件之后）

`ImageModal.vue:44-64 uploadImage()`：
```js
const imgFile = evt.target.files[0];          // 只取第一个文件
const { url, error } = await imageSvc.updateImg(imgFile);
...
this.url = url;                                // 只回填 URL 输入框，不插入、不关窗
```
即：上传成功后**仅把返回的相对路径填进 URL 输入框**，仍需用户点"确认"才插入（I2 现状确认）。

`src/services/imageSvc.js:22-41 updateImg()`：
- L23-25：非 git 工作区直接报错 `'暂无已选择的图床！'`（`workspace/currentWorkspaceIsGit`）。
- 路径模板 `/imgs/{YYYY}-{MM}-{DD}`（L7），生成 `path/{uid}.{ext}`（L9-17）。
- L32-39：文件转 base64，**只存本地 IndexedDB**（`localDbSvc.saveImg`，id=MD5(绝对路径)），真正推到 git 由后续 sync 完成。
- L40：返回相对路径（空格转 %20）。

### (c) 确认后 URL 如何变成 markdown

`pagedown.js:772-849 doLinkOrImage`，回调 `linkEnteredCallback(link)`（L799-840）：
```js
chunk.selection = (" " + chunk.selection).replace(...);   // 转义中括号
chunk.startTag = "![";
chunk.endTag = "](" + properlyEncoded(link) + ")";        // L827-829
if (!chunk.selection) chunk.selection = that.getString("imagedescription");  // '输入图片说明', pagedown.js:28
postProcessing();                                          // = fixupInputArea, 写回文本+恢复焦点
```
- `properlyEncoded`（L755-769）会 decodeURIComponent → encodeURI，并转义 `'()`。
- **回调协议是"一次一个 URL 字符串"**，产物固定为单个 `![说明](url)` 包裹当前选区。
- **多图插入**：URL 走 `](…)` 内部且会被 encode，无法塞多段 markdown。可行改法是扩展 `linkEnteredCallback`（pagedown.js:799-840）：`Array.isArray(link)` 时置空 start/end tag，`chunk.selection = urls.map(u => '![输入图片说明](' + properlyEncoded(u) + ')').join('\n')`。
- **不推荐**在 modal 里绕过回调直接操作 `editorSvc.clEditor` 插入：pagedown 的 `fixupInputArea`（L437-446）会 `state.setChunks(chunks); state.restore()` 把旧 chunks 写回，存在互相覆盖风险（Editor.vue:84 的 `replaceAll` 占位符方案是拖拽/粘贴专用路径，不经 doClick chunk 机制，不可类比）。

### (d) 文件选择器 multiple

- 唯一的 `<input type=file>` 在 `ImageModal.vue:10`，目前无 `multiple` 属性；加 `multiple` 后在 `uploadImage` 里循环 `evt.target.files` 逐个 `imageSvc.updateImg`（该函数单文件粒度，可直接循环调用）收集 urls 即可。
- 相关但本次未要求：拖拽/粘贴入口 `src/components/Editor.vue:59-90 processUpload` 也只取第一张图（L64-69 `break`）。

---

## 2. I5 + X1 编辑区图片组件

### 编辑区内联图片渲染机制

`src/services/editorSvc.js:711-771`，由设置 `computedSettings.editor.inlineImages` 开关（L712）。在 `sectionHighlighted` 事件（`src/services/editor/cledit/cleditHighlighter.js:136-143`，highlight() 内同步触发）中：

```js
// editorSvc.js:715-749（节选）
section.elt.getElementsByClassName('token img').cl_each((imgTokenElt) => {
  const srcElt = imgTokenElt.querySelector('.token.cl-src');
  const imgElt = document.createElement('img');
  imgElt.style.display = 'none';
  if (isWorkspaceLocalUri(uri)) { loadImgs.push({ imgElt, uri: ... }); }  // L727-728 本地图：src 稍后异步赋值
  else { imgElt.src = uri; }                                              // L730 远程图：立即赋值
  imgEltsToCache.push(imgElt);                                            // L743
  const imgTokenWrapper = document.createElement('span');
  imgTokenWrapper.className = 'token img-wrapper';                        // L745-749
  imgTokenWrapper.appendChild(imgElt);      // 渲染的图片
  imgTokenWrapper.appendChild(imgTokenElt); // 原始 markdown 文本 token
});
```
即 `.token.img-wrapper` 同时包住 `<img>` 和灰色原文 `![...](url)`。灰底样式：`src/styles/markdownHighlighting.scss:130-142`（`.img`、`.img-wrapper` 共用 `background-color: $code-bg`），wrapper 细节 L144-158。002.png 中图片下方的灰色 URL 文本即 wrapper 内的 `.token.img`。

本地图片异步加载：`getImgUrl`（editorSvc.js:133-159，IndexedDB → blob URL，`pathUrlMap` 记忆化 L53/73-76/136-139），在 promise 里才 `imgElt.src = newUrl` 并设 `data-ws-path`（L756-762）。

### I5：点击灰色区域也会放大

- 编辑区点击监听：`src/components/Editor.vue:124-131`（绑在整个 `editorElt` 上，委托）。
- 命中判断 `findZoomableImage`（Editor.vue:47-58）：从 target 向上爬，`elt.tagName === 'IMG'` 命中之外，**只要祖先带 `img-wrapper` class 就返回 `elt.querySelector('img')`（L52-54）**——因此点 wrapper 内的灰色 markdown 文本同样触发放大。
- 光标样式也一致暗示可点：`Editor.vue:192-195` `.img-wrapper, img { cursor: zoom-in; }`。
- 对照组（正确行为）：预览区 `src/components/Preview.vue:125-148 onClick` 只匹配 `elt.tagName === 'IMG'`（L134），不认 wrapper。
- 修法方向：删掉 findZoomableImage 的 img-wrapper 分支（只保留 IMG 命中），并把 `cursor: zoom-in` 限定到 `img`。
- 放大链路：`openZoomedImage` → `$emit('open-image')` → `src/components/Layout.vue:16/30` → `ImageLightbox`。

### X1：编辑区随机显示错误图片（预览正确，刷新恢复）— 根因

罪魁是 **imgCache 的 hash 在本地图片未加载完成时全部碰撞**：

1. cache 结构与 key：`editorSvc.js:662-697`
   ```js
   const hashImgElt = imgElt => `${imgElt.src}:${imgElt.width || -1}:${imgElt.height || -1}`;  // L670
   ```
2. 时序（全同步）：`cleditHighlighter.js` 的一次高亮 pass 中，L142 逐 section 触发 `sectionHighlighted`（创建新 imgElt），L160-167 把旧 section 的 DOM（含旧 img）摘除，L186 触发 `highlighted`——**此时本地图片的异步 `getImgUrl` promise 还没 resolve，新 imgElt 的 src 为空串**。
3. 于是在 `highlighted` 处理器（editorSvc.js:772-786）里，所有"待加载本地图"的 hash 一律是 `":-1:-1"`（带 `=WxH` 尺寸时为 `":W:H"`，同尺寸仍碰撞）。`addToImgCache` 用这个过期 key 入库；之后元素的 src 被异步改成某张图的 blob URL，**但 cache key 永不更新**。
4. 编辑触发 section 重渲染时，`getFromImgCache`（L682-697）按同样的空 hash 命中**任意一个已脱离 DOM 的旧 img**（`entries.some` 取第一个未挂载的），`replaceChild` 换进 DOM（L773-781）——旧元素当前 src 指向哪张图就显示哪张 → **错图**。新 imgElt 稍后被 promise 正确赋值，但已被换出 DOM，无人可见。
5. GC `triggerImgCacheGc`（L699-709）是 100ms debounce，晚于同步的换入操作，拦不住。
6. 为什么只有编辑区错、预览区对：预览管线（`refreshPreview` L303-315、L376-395）每次渲染独立加载，无"元素复用池"；远程 http(s) 图片 src 同步赋值（L730）hash 唯一，不受影响——**bug 仅命中工作区本地图（`/imgs/...`），与 008/009 截图一致**。刷新页面清空 imgCache 故恢复。

修复方向（二选一，供规划）：
- **按 markdown URI 参与 hash**：创建时（~L722）`imgElt.dataset.wsUri = uri`，`hashImgElt`（L670）改用 `dataset.wsUri || src`——保留防闪烁复用，修正碰撞（推荐）。
- **空 src 不进缓存**：在 L772-781 对 `!imgElt.getAttribute('src')` 的元素跳过 getFromImgCache/addToImgCache——最简单；因 blob URL 有 `pathUrlMap` 记忆化，重载几乎无代价，仅轻微闪烁。
- 引用计数注意点：`updateActiveEditorImgPaths`/`pathUrlRefCountMap`（L100-131、663-668）按 DOM 中带 `data-ws-path` 的 img 计数，两种修法下换入/保留的元素都携带该属性，计数自洽。

---

## 3. U1 下划线斜体移除

### 预览侧（markdown-it ^14.1.0，package.json:28）

- 规则启用：`src/extensions/markdownExtension.js` `inlineBaseRules` 含 `'emphasis'`（L42），`inlineBaseRules2` 含 `'emphasis'`（L52），L86-87 enable。
- markdown-it **无内置选项**只关 `_`：`node_modules/markdown-it/lib/rules_inline/emphasis.mjs:12` 单个 tokenizer 同时处理两种 marker：
  ```js
  if (marker !== 0x5F /* _ */ && marker !== 0x2A /* * */) { return false }
  ```
- 可行改法：在 `markdownExtension.js` 的 `onInitConverter`（L59 起）里 `markdown.inline.ruler.at('emphasis', wrapped)` 替换 tokenize——`state.src.charCodeAt(state.pos) === 0x5F` 时直接 `return false`（`_` 落回 text token），否则委托原实现。原实现可深层导入：markdown-it 的 exports 含 `"./*"` 通配（`node_modules/markdown-it/package.json:21-24`），即 `import emphasis from 'markdown-it/lib/rules_inline/emphasis.mjs'` 后调 `emphasis.tokenize`。ruler2 的 postProcess 无需动（不产生 `_` delimiter 就不会配对）。
- **重要边界**：该做法把 `_em_` 和 `__strong__` 一起禁掉（同一 tokenizer、同一 marker）。若要"只禁 `_em_` 保留 `__strong__`"需自写 tokenizer 只在连跑长度>=2 时入 delimiter，且 postProcess 的相邻合并逻辑会把 `___x___` 之类搞出边角案例——复杂度高。用户原话只提 `_` 斜体；**建议决策：`_`/`__` 一并禁用（写作用 `*`/`**`）或仅禁 `_`+复杂实现**，两个代码点都在下面列出。

### 编辑器语法高亮侧（src/services/markdownGrammarSvc.js）

含下划线的 inline 强调规则（全部清单）：

| 规则 | 行号 | pattern（节选） | 含义 |
|---|---|---|---|
| `rest.em` | 331-338 | `(^|[^.*])(_|\*)(?![_*])[\s\S]*?\2…`，inside `cl-em`: `/^(_|\*)/`、`/(_|\*)$/` | `_x_` / `*x*` 斜体 → 只留 `\*` 即移除 `_` 斜体 |
| `rest['strong cn-strong']` | 323-330 | `(__|\*\*)(?![_*])…`，inside `cl-strong`: `/^(__|\*\*)/` 等 | `__x__` / `**x**` 加粗（是否保留 `__` 待决策） |
| `rest['strong em']` | 339-346 | `(__|\*\*)(_|\*)…` | `___x___`/`**_x_**` 混合 |
| `rest['strong em inv']` | 347-354 | `(_|\*)(__|\*\*)…` | 反序混合 |

需保留的 `_`（勿误伤）：
- L164 hr 规则 `/^ {0,3}([*\-_] *){3,}$/gm`（`___` 水平线）。
- L1-2 `charInsideUrl`/`charEndingUrl` 中的 `_`（URL 合法字符）。

工具栏加粗/斜体只产出星号（`pagedown.js:531-536` doBold/doItalic 用 nStars 星号包裹），不受影响。

---

## 4. T1/T2 TOC 面板

### DOM 结构

- TOC 条目生成：`src/services/editorSvc.js:326-354`——每个 section 一个 `div.cl-toc-section`，内含该 section 首个 h1-h6 的 **cloneNode**（L329-333）。容器 `editorSvc.tocElt` = `.toc__inner`（Toc.vue:23 绑定）。

### (a) 字号与缩进（src/components/Toc.vue:70-127）

```scss
.toc__inner {
  font-size: 13px;            // L77 ← 整体字号基准（调大入口）
  padding: 10px 20px 40px;    // L78 ← 左右 20px 边距（缩小入口）
  .cl-toc-section {
    h1 { margin: 1rem 0; }                      // L98-100，无 margin-left
    h2 { margin: .5rem 0;  margin-left: 8px; }  // L102-105
    h3 { margin: .33rem 0; margin-left: 16px; } // L107-110
    h4 { margin: .22rem 0; margin-left: 24px; } // L112-115
    h5 { margin: .11rem 0; margin-left: 32px; } // L117-120
    h6 { margin: 0;        margin-left: 40px; } // L122-125
  }
}
```
- 各级**字号并未显式定义**，是 UA 默认相对倍数作用在 13px 上（h1≈26px … h6≈8.7px），003.png 中深层条目过小即由此来。调大整体 = 提高 L77；或按级显式给 font-size。
- 点击跳转 handler：Toc.vue:26-40（`click` → 命中 `.cl-toc-section` → 设 editor/preview 两个 scrollTop，L36-37）。

### (b) X 按钮特例（TOC 面板直接关闭）

- 现状：`src/components/SideBar.vue:7`
  ```html
  <button class="side-title__button button"
    @click="panel === 'menu' ? toggleSideBar(false) : setPanel('menu')"
    v-title="panel === 'menu' ? '关闭侧边栏' : '返回主菜单'">
  ```
  （上一批 C9 改的"非 menu 面板 X 回主菜单"）。特例化：条件改为 `panel === 'menu' || panel === 'toc'` → `toggleSideBar(false)`，v-title 同步分支。
- 注意 `toggleSideBar` action 本身会先把 panel 重置回 'menu'（`src/store/data.js:261-266`，L263 `dispatch('setSideBarPanel')`；setSideBarPanel L290-292）；下次经导航栏 TOC 按钮打开时 `toggleToc`（`NavigationBar.vue:184-191`）会重新 `setSideBarPanel('toc')`，行为闭环无碍。
- TOC 面板挂载点：SideBar.vue:25-28（`.side-bar__panel--toc`，用 `--hidden` 位移隐藏而非 v-if，L147-149）。

### (c) "自动跳转"开关按钮位置与状态存储

- 摆放：SideBar.vue:3-10 的 `.side-title` 标题栏内、X 按钮（L7）之前，`v-if="panel === 'toc'"`。
- 按钮样式基类：`src/styles/app.scss:346-364` `.side-title__button`（38x36）。**按压态先例**：Explorer 手动排序开关 `src/components/Explorer.vue:23`（`:class="{'side-title__button--on': manualSortEnabled}"`）+ 样式 `Explorer.vue:233-242`（`--on`: opacity 1 + 深底色）。
- 状态存储两个先例：
  1. **layoutSettings**（推荐，设备本地 UI 行为）：localStorage 持久（`src/data/constants.js:17-23` 含 'layoutSettings'，不参与同步）；默认值加在 `src/data/defaults/defaultLayoutSettings.js:1-14`；toggler 工厂 `src/store/data.js:70-81`，注册先例 L255-260（如 `toggleScrollSync: layoutSettingsToggler('scrollSync')`）。
  2. localSettings（跨设备同步的数据项，**不在** localStorageDataIds）：`src/data/defaults/defaultLocalSettings.js:4` `explorerSortBy: 'manual'` 先例；读写见 `src/store/explorer.js:248/257`（patchLocalSettings）。
- "跳转后自动收起侧栏"挂点：Toc.vue:32-39 的 `some` 回调内、两个 scrollTop 赋值（L36-37）之后，开关开启时 `store.dispatch('data/toggleSideBar', false)`（Toc.vue 目前只 import editorSvc，需补 store 引用或 mapActions）。

---

## 5. H1 标题字号平衡

### 编辑区（src/styles/markdownHighlighting.scss:173-213）

```scss
.h1, .h11 { font-size: 1.7em; }   // L189-192（.h11/.h22 为 setext 变体）
.h2, .h22 { font-size: 1.4em; }   // L194-197
.h3 { font-size: 1.2em; }         // L199-201
.h4 { font-size: 1.1em; }         // L203-205
.h5 { font-size: 1em; }           // L207-209
.h6 { font-size: 0.9em; }         // L211-213  ← 已小于正文
```
另：L173-187 各级加粗 + `$line-height-title`；`.markdown-highlighting--inline`（L343-355）把 h 系列重置为 inherit（侧栏帮助等内联场景），改字号时勿破坏。

### 预览区（无显式定义，UA 默认）

- `src/styles/base.scss:45-53` 只定义 h1-h6 的 margin 和 line-height，**没有 font-size**；body 16px（base.scss:9）。
- normalize-scss 只给 h1: 2em；h2-h6 走浏览器 UA 默认：约 h2 1.5 / h3 1.17 / **h4 1.0（=正文）/ h5 0.83 / h6 0.67**——正是 007 描述的"h1 巨大、h6 比正文还小"的来源。
- 预览主题机制：默认主题无额外 CSS（`src/store/theme.js:87-99`，'default' 不加载任何样式；自定义主题运行时注入 `/themes/preview-theme-*.js`），所以在 base.scss（或限定 `.cl-preview-section`/`.preview__inner-2` 作用域）显式给 h1-h6 字号即可定义默认梯度。
- 现值汇总（供新梯度提案，目标：h6 > 正文、h1 略大于 h2）：

| 级别 | 编辑区现值 | 预览区现值(UA) |
|---|---|---|
| h1 | 1.7em | 2em |
| h2 | 1.4em | 1.5em |
| h3 | 1.2em | 1.17em |
| h4 | 1.1em | 1.0em |
| h5 | 1.0em | 0.83em |
| h6 | 0.9em | 0.67em |
| 正文 | 1em | 1em (16px) |

- 落点：编辑区改 markdownHighlighting.scss L189-213；预览改 base.scss（新增显式 h1-h6 font-size；注意 base.scss 是全局样式，`.side-bar__panel--help` 的 markdown 帮助等也用 `.markdown-highlighting`，而 h 标签规则会影响所有面板——建议预览侧限定选择器）。导出 HTML 模板的样式是否内嵌同一份需实现时核对（exportSvc.js:59 只挂 themeClass）。

---

## 6. N1/N2 列表缩进与项目符号

### 编辑区：纯文本，无真实列表

- 语法高亮只是给行首 marker 上色：`src/services/markdownGrammarSvc.js:132` `const list = /^[ \t]*([*+-]|\d+\.)[ \t]/gm;` → `'cl cl-li'`（L137/143-145）。缩进就是用户敲的空格，**编辑区不存在 ul/li，符号/缩进改动仅需做预览区**（确认）。

### 预览区：真实 ul/ol/li

- DOM：markdown-it 输出，包在 `div.cl-preview-section`（editorSvc.js:294-296）内，容器 `.preview__inner-2`（Preview.vue:4）。
- 缩进现值：`src/styles/base.scss:40-43`
  ```scss
  ul, ol { padding-left: 30px; }   // ≈1.875em ≈ 2 个中文字宽 → 目标 ~1em/16px
  ```
  嵌套列表 margin：base.scss:55-60。**该规则是全局的**（侧栏帮助、菜单外的任何 ul/ol 均受影响），收窄时建议限定 `.cl-preview-section` 作用域（现有 `list-style-type:none` 特例仅 `.preview-toc ul`/`.toc ul`/`.task-list-item`，base.scss:26-29/166-169/225-227，互不冲突）。
- 符号现状：无自定义 `list-style-type` → UA 默认 disc → circle → square，深度≥3 一直 square（010 所示 3 级循环）。
- 6 级符号方案（L4 空心方 □、L5 实心菱 ◆、L6 空心菱 ◇）：
  - CSS `list-style-type` **支持字符串值**（Chrome 79+ / Firefox 39+ / Safari 11.1+），如 `list-style-type: '□ '`；或 `li::marker { content: '□ '; }`（::marker 同代浏览器均支持，可控 content/color/font-size 等有限属性）。CSS 关键字 `square` 是实心的，空心方/菱形**必须**走字符串或 ::marker content。
  - 选择器按嵌套深度：`.cl-preview-section ul ul ul ul > li { list-style-type: '□ '; }`（4 层）以此类推到 6 层；1-3 层维持 disc/circle/square 关键字即可。
  - 注意：字符串 marker 不随 UA 圆点渲染规则缩放，视觉大小需实测微调（可用 ::marker font-size）；仅作用于 ul，ol 不动；导出 HTML 模板若不含这段 CSS 则导出侧无 6 级符号（待实现时决定是否同步模板）。

---

## 7. S3 同步按钮状态类尺寸核查（NavigationBar.vue）

- 状态计算：`src/components/NavigationBar.vue:128-139` `syncStatus` → 'syncing' | 'unsynced' | 'synced'；按钮 `:class="'navigation-bar__button--' + syncStatus"`（快捷同步钮 L11，位置栏同步钮 L24）。
- 状态类 CSS（L346-363）：
  ```scss
  .navigation-bar__button--unsynced:not([disabled]) { &, &:active, &:focus, &:hover { color: $error-color; } }
  .navigation-bar__button--synced:not([disabled])   { …  { color: #5cb85c; } }
  ```
  `--syncing` 无任何 CSS 规则（走默认色）。disabled 规则（L365-372）也只改 color。
- 基础尺寸：`.navigation-bar__button--sync, --publish { padding: 0 6px; margin: 0 5px; }`（L340-344）；快捷钮 `--sync-quick { width: 34px; padding: 0 7px; }`（L294-304）。
- **结论：三个状态 modifier 只改 color，无 border/padding/size 差异**；红/绿两态若观察到几像素高度差，不来自这些类（两态渲染同一个 `<icon-sync>`，L11/24）。CSS 侧未找到可疑来源；相邻的 `.navigation-bar__spinner`（L17-20）在另一容器，不影响按钮盒模型。

---

## Caveats / Not Found

- `public/themes/` 目录在本仓库不存在（主题 js 是运行时按 `/themes/edit|preview-theme-*.js` 路径加载，theme.js:62-81/112-131；default 主题不注入任何 CSS）——预览默认样式完全由 base.scss + UA 决定，本次改动即"默认主题"。
- assets/007.png 实际内容是移动端编辑区图片组件截图（非 H1-H6 字号图），004-006 未逐一核对；标题字号/列表结论均直接来自代码，与截图编号无依赖。
- 导出 HTML/PDF 模板（styledHtml 等）是否复用 base.scss 未深挖：预览侧的新标题梯度、6 级列表符号在导出产物中的生效范围需实现阶段核对（`src/services/exportSvc.js:59` 仅追加 themeClass）。
- "只禁 `_em_` 保留 `__strong__`" 在 markdown-it 侧实现复杂（同一 tokenizer + delimiter 合并逻辑），建议规划时先做取舍决策。
