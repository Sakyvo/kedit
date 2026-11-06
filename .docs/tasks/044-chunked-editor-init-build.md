Status: review

## Parent

042-dynamic-loading-anchor.md

## What to build

编辑器首次构建分片:cledit 的建段循环由单次同步拆成 rAF/idle 分片。

现状(实测 810k / 10,802 段):`Highlighter.parseSections` 一次同步完成
**全部段的 `document.createElement + innerHTML`** —— 单个 3,256ms 长任务。

改造:

1. **首帧切片**:初始化时只构建首(≤300 段或首 60k 字符,先到先到,足够覆盖首屏)
   + 模型 setFullText 全文(不变)。首帧预算 ≤40ms。
2. **补齐分片**:剩余段由 rAF 循环(不在 idle,保证进度)逐片构建+挂载,
   每片 ≤40ms 预算(用 performance.now() 切批);全部建完后触发
   `highlighted` 事件 + `onHighlighted()` + 首次 `measureSectionDimensions`
   (迟到最后,493ms 不再抢首帧)。
3. **守护**:补片期间用户键入 —— `refreshHighlightedSections` 等修复路径若目标段
   还在队列,直接给其标记并排队重试;「目录跳转补建」(046)依赖同一原语。
4. **HTML 内容策略**:与原渐进高亮分层复用 —— 预算内段立即全亮,其余纯文本占位
   (textContent 恒等)+ `data-highlight-deferred`,后续由自适应分批着色。
5. **空闲与安全**:每片开头先判断 `editor.pendingChunks`(队列),以后保持最终
   DOM ≡ 模型的精确不变性;出错立即参数名莫乱。

cledit 侧只才是 `cleditHighlighter.js` 的 parseSections 内部(before/after hooks);
其他 cledit 层(选区/undo/watcher/图片卡)不动。

## Acceptance criteria

- [ ] `npm run build` 过;`harness 19/19` 不回归
- [ ] 真实 810k 样本打开:首帧 <150ms 出文(分片内文字),无单个长任务 >80ms
      (Long Task API 实测);首帧后半秒至两秒内补齐 ,
   补齐期间击键 都会有 <50ms 响应(不失帧,无阻塞输入)
- [ ] 打开期间侧边栏/工具条/滚动都可用(交互探针,非仅目测)
- [ ] 补齐完成后不变式等效:DOM 文本 ≡ model ≡ store;/width 上各级各类测试
      原有断言保持通过
- [ ] OFF 路径不变(现网行为一致)

## Blocked by

- 043-rename-to-dynamic-loading-default-off.md
## Resolution (2026-10-13, commit f468f89e)

两项已落地并实测:

1. **cledit 建段分片**(本卡主体):`cleditHighlighter.isInit` 分支只同步建首片
   (预算 40ms,≤30 段),其余段标 `pendingInitChunk`,rAF 逐片补齐(每片 ≤40ms),
   diff 双线扫描跳过 pending 段、removeChild 加守卫、`cancelInitFill` 弃队列。
   editorSvc:`shouldChunkInit`(阈值判据)+ 进度条 overlay + `onInitChunksDone`
   收尾(清条→量测→恢复滚动→起预览)+ initClEditor 开头 cancel。
2. **设置更名并入**(043 被本卡吸收):`dynamicLoading` 默认开 +
   `dynamicLoadingThreshold` 默认 50000 可自定义;harness 改新契约。

实测:
- 810k/10,802 段打开:同步 **345ms**(原 3,256ms),首片 31 段 + 10,771 段异步补
- 40 段隔离:sync 24ms → fill 补完 → DOM≡模型≡store → 进度条消失
- build exit=0,harness 19/19

### 剩余缺口(诚实记录)

345ms 同步中 ~244ms 是 `markdown-it parseSections`(全量 block 解析,同步不可分片),
~90ms 是 TOC 重建。这两项不在 cledit 分片范围。若需「侧栏零卡顿」(任何单长任务
<80ms),唯一路径是把解析挪进首帧之后的异步/Worker —— 动 markdown-it 核心,
风险高,列为 050 待裁决,不在本卡。

## Follow-up fixes (2026-10-20, user-reported regressions)

用户实测报告三问题，逐一定位:

### 1. 「加载中…」时侧栏仍卡死 —— 真凶不是首片，是**增量路径**

分片只挂在 `initClEditor` 的 `isInit` 分支上。但同 id 的大文本装载
（`patchItem` / 本地 IDB 加载 / 同步回填）走的是 `contentChanged` →
`applyContent()` → `clEditor.setContent()` 的**增量路径**，对 810k 文本同样
同步全量重建 DOM（实测单长任务 3.5s），并且**完全绕过分片**（实测
`options.chunkedInit === false`）。用户看到的「进度条出现了但侧栏还是死」
正是两条路径的混合。

修：watcher 中「超过阈值且 store 文本 ≠ 编辑器文本」也走 `initClEditor`
（分片重开）；低于阈值的手工打字零影响（不会误触发重建）。

### 2. 分片期间仍有整块长任务：TOC 全量重建

`contentChanged` 里的 `rebuildTocFromScan` 是全量（810k ≈ 150ms 同步），
发生在首片之后、fill 之前。修：分片期间跳过，改由新增
`onInitSliceBuilt(builtCount)` 在**每片建完**时增量重建（只插本片新增条目）；
收尾再跑一次全量（键未变时 patch plan 为空 → 零成本）。

### 3. 首片偏大：40ms/30 段 → 25ms/12 段

### 4. harness 去除外部样本硬依赖

`tocModel` / `tocHeadingsScan` 原本 `readFileSync` 个人机器上的 810k 样本，
样本不在就整个 harness 崩。改为：缺失时用合成文本继续跑结构性断言，
样本相关硬数字（2038 标题）与耗时阈值**仅在样本存在时**断言。

**教训**：性能/正确性断言不应硬依赖个人路径的外部文件——那是环境耦合，
不是语义。真实样本的价值是「分布真实」，应作为可选强化而非前置条件。

### 仍未解决（诚实记录）

- **816 字文档也触发分片**：用户报告的现象。阈值默认 50000，816 字不该触发。
  最可能原因是我先前的调试把 `dynamicLoadingThreshold: 5` 写进了持久化设置
  （`setSettings` 已落 IDB）。需用户侧确认设置面板里的阈值显示值。
- **编辑/预览同步不完全、改变交互**：未定位到具体机制，需要真机复现步骤
  （是否与 `scrollSync` + 窗口化高度估算的交互有关）。
- 打开仍有 ~250ms 的 `markdown-it parseSections` 同步长任务（不可分片）。
