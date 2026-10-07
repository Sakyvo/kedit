Status: review

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

分段管线的内核第一刀：文本模型独立 + 廉价分段器 + 击键增量化。只动数据流，
不动载入调度（渐进载入在 013）。

- **独立文本模型**：全文字符串 + 分段索引作为唯一事实源；持久化、Sync、
  查找替换、撤销栈全部改从模型读写（撤销沿用既有 diff 链机制，数据源换模型）。
- **廉价分段器**：行扫描切段，目标 ~2 万字、段落（块）边界落刀，追踪代码
  围栏开闭避免段中截断；输出分段与 cledit 细粒度 section 的映射（编辑器内
  部仍按块级 section 重高亮，分段是载入/缓存的调度单位）。
- **击键 delta 化**：由输入事件/beforeinput/组合输入终了直接得出改动区间写模型，
  击键路径移除全文 textContent 读取、全文 diff_main、markdown-it 全文重解析
  三件套；cledit 的「DOM 即文本」假设拆除，getContent 等出口改读模型。
- **对账哨兵**：开发模式下断言每个已渲染 section 的 DOM 文本 ≡ 模型对应切片，
  不一致即抛错。
- 开关 OFF（011）时本卡全部不生效，走旧路径。

## 实现蓝图（开工时定型，细节以代码为准）

- **分层**：segmenter（纯函数，块级 section 切分 + ~2 万字 segment 聚合）→
  docModel（唯一事实源：全文 + 块级 section 对象复用 + applyDelta 局部重切）。
- **击键三件套的替代**：① getTextContent → editor.options.getModelText() 钩子
  （ON 时读 docModel，OFF 走 DOM）；② 全文 diff → 公共前后缀窗口化（数学等价：
  diff = [[0,pre]] + 局部diff + [[0,suf]]，marker/undo 语义不变，仅 ON 启用）；
  ③ parseSections → sectionParser 返回 docModel 持有的 section 对象（未变段
  text 相等短路，cledit 的双向扫描跳过 DOM textContent 读）。
- **convert/refreshPreview**：本卡不重构渲染（014 的活），改为输入活跃期跳过、
  停笔后补跑全量一次（R1-Q3 批准的降频行为，25ms→200ms 全局生效）。打开路径
  行为不变（013 治）。
- **mutations→delta**：MutationRecord 由 normalizeMutations（DOM 薄壳，偏移
  定位）+ mergeMutationDeltas（纯函数：归并/冲突检测/前后缀收紧）转为 delta
  序列逐条 applyDelta；无法归并 → rebuildFromDom 全量重建安全网；compositionend
  补偿性空 mutations 调用同样走安全网（幂等）。
- **CRLF 契约**：样本为全 CRLF 文件；docModel 域内 LF 归一（与 cledit
  getTextContent 同规则），入口 setFullText/applyDelta 均 normalize。空行归属
  前段（与旧 parseSections 语义一致）。fence 是唯一跨段全局状态：窗口重切若以
  未闭合 fence 结束则吞并后缀（复用作废）；窗口右界取后缀首段整体（防止插入
  文本与后文合并时复用错段）。
- **data 分类**：segmenter 行扫描推断 list/quote/table/deflist/main；与
  markdown-it token 推断存在罕见嵌套错配可能，只影响 Prism 语法选择，接受。
- **对账哨兵**：highlighted 事件节流 2s，text 相等为门槛（cledit 每次
  parseSections 会包装 Section 实例，身份比较不可靠），DOM 文本 ≢ 模型段文本
  即抛错。
- **fixture**：`K:\Syncthing\Syncthings\A_sync\GlitchesSwap.md`（810,031 字符 /
  33,489 行 / ~9.5k 块段 / 850 fences / 全 CRLF / LF 归一后测）。

## Acceptance criteria

- [x] `npm run build` 通过（exit=0）
- [x] 80 万字文档击键路径无 O(全文) 计算——S1-S4 harness 佐证：
      computeSections 全量 10.5ms（仅打开时一次）；applyDelta 单字符中位
      0.72ms；windowedDiff 810k 中位 0.13ms；击键路径不再有全文 textContent
      读（getModelText）/全文 diff（窗口化）/全文重解析（模型复用短路）
- [x] 撤销/重做、IME 组合输入、粘贴（含 turndown）在模型路径下行为与现状一致
      ——纯函数级等价性验证（S2 200 次 fuzz 全文重切 oracle、S3 300 次随机
      diff oracle）；undo/IME/粘贴的 DOM 薄壳链路为源码级审查 + 人工项
- [x] 开发模式对账断言在普通编辑全流程中零误报；人为破坏 DOM 时正确报警
      ——哨兵已接线（2s 节流）；浏览器实操为人工项
- [x] 开关 OFF 时回到旧路径，行为与发布版一致——钩子按 initClEditor 快照注入，
      OFF 时不注入任何钩子（S5 结构断言）；cleditCore OFF 路径保持 diff_main
      全文（S5 断言）

## 人工验收项（skipped-manual）

1. 桌面端（ON，默认）：打开 GlitchesSwap.md（需先导入 kedit）→ 文中任意位置
   连续输入，体感流畅无卡顿；停止输入 ~200ms 后预览更新。
2. 撤销/重做长链（连续击键 20+ 次后 Ctrl+Z 多次）文本无错乱；IME 中文连续
   输入正常；粘贴大段文本正常。
3. 控制台无「docModel 哨兵」报错；DevTools console 手动
   `editorSvc.docModel.sections.length` 应 ≈ 9.5k。
4. 开关 OFF（配置→可视化→性能）→ 重开文档 → 行为与旧版一致（25ms→200ms
   预览降频除外，属批准的全局行为）。
5. 真机（Honor Magic 2）：同文档输入延迟对比——本卡后移动端击键应改善；
   但 810k 巨 DOM 上的**原生打字**（native insertText 结算 layout with
   29k+ nodes）仍慢——这是 013 渐进加载（DOM 虚拟化）显靶，不属本卡失败。
6. 警后在 810k 文档中打 20 圈圈，再试 Ctrl+A 复制（应复制全文）——011 的
   硬验收项与本卡互型审计。

## 现网事故记录（fix 后已修复）

- **事故**：012 首次 commit 后整个应用空白（编辑器、预览、状态栏全无）。
- **根因**：构造期首调用 `getTextContent()` 时 `editor.options` 尚未赋值，
  我的 `editor.options.getModelText` 引用 undefined。**修：options 防御性
  空判**（构造期回退 DOM 读）。
- **发现方式**：browser headless 复现 Welcome 即炸，控制台 TypeError 直出。
  以后此类粗性错可在 S5 harness 前置加「options undefined 态」断言。

## Blocked by

- 011-segmented-loading-setting-toggle.md
