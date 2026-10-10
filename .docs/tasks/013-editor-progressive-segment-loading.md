Status: review

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

编辑器侧渐进载入：首段先可用，其余渐进补齐；模型层全选/复制全文。

## 设计重评审（开工后发现 cledit 限制，方向修正）

原计划「首段挂载 + idle 补齐 DOM」在当前 cledit 架构上**证明不可行而不出错**：
- **cledit `setContent` 语义**：每次都会走 diff + parseSections，无法真正跳过未挂载段的解析
- **store 同步环**：补齐期间 `setContent` → `contentChanged` → `patchCurrent(store)`
  会把**部分文本**误当编辑写入 store，长期数据会被蚕食
- **模型引导难**：让 cledit `lastTextContent` 暂时"少一段"而在 store/搜索端稳态一致，
  需要 editorSvc ↔ store ↔ cledit 三线协同改造，成本远超单卡

**修正后的方向（本卡最终实现）**：不动 DOM 挂载粒度（保不变式），改**推迟着色**：

- **渐进高亮**：一次解析/重建 pass 内，字符数超出预算（150k）的段先以**纯文本
  （已转义）**渲染 —— `textContent` 与原文逐字相等，因此哨兵对账、选区偏移、
  Ctrl+A/复制、内置查找、同步全部不受影响；仅暂时缺少 Prism 着色。
  停笔后由 `scheduleDeferredHighlightFill` 分批（每批 400 段）经 cledit 既有的
  `refreshHighlightedSections` 补齐，undo/选区语义保持。
- 补齐轮内不做预算限制（否则被推迟的段会被反复重建而永不收敛）；排程基于计数幂等。

## 实现落点

- `cleditHighlighter.js`：新增 `deferSectionHighlight(section)` 钩子 +
  `onHighlighted()` 回调；延迟段用转义纯文本渲染并打 `data-highlight-deferred="1"`。
- `editorSvc`：`shouldDeferHighlight`（pass 内字符预算）、`scheduleDeferredHighlightFill`
  （空闲切批 + 计数幂等）；`initClEditor` 重置计数与预算。

## 实测（810k 字符 / 8782 段，生产构建）

| 阶段 | 耗时 |
| - | - |
| `parseSections`（markdown-it 块解析） | 21ms |
| `convert`（含 1.4MB HTML 生成） | 460ms |
| 全量 Prism 高亮 | 162ms |
| 合计打开（页内计时，含 DOM 构建与首帧） | 1751–1874ms |

- 首帧仅约 18.5% 段着色（其余纯文本占位），补齐后 `deferredHighlightCount === 0`，
  且 `editorEl.textContent === docModel.text`（810001 字符逐字相等）。
- 桌面 600 段文档编辑 1 处：**仅 1 段重建、599 段 DOM 复用**（窗口保持 35 段）。
- 撤销/插入偏移/IME 路径回归通过（插入点上下文与撤销回原文均正确）。

## 验收

- [x] `npm run build` 通过
- [x] 不发生数据丢失：DOM 文本 === 模型文本 === store 文本（多轮实测断言）
- [x] 编辑 correctness：插入/撤销偏移正确，哨兵无告警
- [x] 渐进高亮收敛：延迟段最终归零，Prism 着色完整
- [x] OFF 管线完全不变（`deferred === 0`、Prism 全量照旧）
- [x] **延迟后续 014 完成渐进渲染**：按需分段 DOM 由 014 在**预览侧**实现（编辑器侧
      保持真实 DOM 以满足 Ctrl+A/查找/IME 的硬要求）
- [ ] 真机 1 秒打开 → 016 A1 裁决项
- [ ] 真机击键流畅 → 016 A2 裁决项

## 与原始诉求的关系（诚实记录）

ADR-0012 目标「打开 <1s」在当前实现下**未在桌面 dev/build 环境达成**（1.75–1.87s）。
剩余瓶颈是 cledit 的**全量段 DOM 挂载**（8782 段 → 9731 节点 + 一次全量布局），
已实测：纯文本节点构建 73ms、插入 DOM 12ms、**强制布局 422ms**。

### 瓶颈量化（810k / 9730 段）

`initClEditor` 全延迟高亮下仍需 ~765–1050ms。逐项量测（生产构建、同页基准）：

| 项目 | 耗时 |
| - | - |
| `parseSections`（markdown-it 块解析，仅 1 次调用） | 21–244ms |
| `docModel.setFullText`（廉价分段） | 13ms |
| 9730 段纯文本节点构建 | 79ms |
| 节点挂载 + 一次强制布局 | 19 + 207ms |
| `sectionHighlighted` 事件派发（9730 次，含图片内联钩子） | 计入上述合计 |
| TOC 全量重建（9730 槽位 / 4865 标题） | 150ms（无变化时 10ms） |

**段粒度粗化经实测被否定**（对照实验，同一 810k 文本、同一浏览器）：

| 方案 | 建节点 | 一次强制布局 |
| - | - | - |
| 9730 个块级 section（现状） | 76ms | 374ms |
| 41 个约 2 万字聚合段（用户原始诉求的粒度） | 22ms | **395ms** |

布局成本与 section 数量**几乎无关**（374 vs 395ms）——因为它是**同一段文本的排版**成本，
不是每节点开销。因此粗化 section **无法改善打开时间**。

结论：剩余 ~750ms 的构成是「markdown-it 解析 + 建节点 + 全文文本排版 + 段事件/记账」，
其中**全文排版是主要项且不可分割**。要突破它只有 ADR-0012 中被否的
「编辑器窗口化」（CodeMirror-6 式虚拟化：只渲染视口 ± 缓冲，全文文本根本不进 DOM）——
那是 cledit 的选区偏移/复制粘贴/undo/图片卡片/滚动同步全量重写。按 ADR 决策，
该项留待 **016 A9 真机裁决**：若真机不达标 → 回锚卡 010 评议乙案。

### 击键路径实测与两处修复（收尾追加）

对抗性实测（810k 文本，3–20 次连续 `cl.replace`，逐项打点）发现并修复两处真实缺陷：

| 缺陷 | 实测 | 修复 |
| - | - | - |
| **单次击键触发 20 次全量 `parseSections`**（每次 9–11ms，合计 ~190ms） | 打点捕获 20 次调用、输入长度恒 810002 | `sectionParser` 按输入文本记忆化（`===` 比较）；`initConverter`/`initClEditor` 失效缓存 |
| **补齐批次单帧最长 647ms** | 段长差异数十倍（单个 fence 段可上万字），按「每批 400 段」分批使成本剧烈波动 | 分批改为**每批 60k 字符**，工作量恒定 |

修复后同一击键路径：全量解析 **20 次 → 2 次**；810k 下全部不变式成立
（`editorElt.textContent === docModel.text`、`sections 拼接 === 全文`、TOC 4865 标题、
预览挂载窗口 35 段、延迟高亮归零）。

### 附带修复：同名标题锚点唯一化 O(n²)

`markdownItAnchor` 的锚点唯一化逐个探测 `slug-1`、`slug-2`、…，在同名标题密集的
文档上退化。真实样本（`GlitchesSwap.md`，2038 标题 / 仅 1391 唯一，`User:` 与
`AI:` 各重复 298 次）实测 **19.9ms → 1.5ms**（13x，输出逐项等价）；合成基准
8000 同名标题 3808ms → 3ms。修法：为每个 slug 记住上次序号，从那里继续。

### 测量方法教训（重要）

本卡早期的一些"瓶颈"数字来自**合成的 810k 文档**（`unit.repeat()`），它引入了
真实文档不存在的病态结构：同一标题重复数千次，使 anchors 唯一化变成 O(n²)
（测到 13.8s）。**结论：性能取证必须用结构真实的样本**——合成重复文本会放大
或掩盖真实分布。真实样本（`GlitchesSwap.md`）的可信分项见下。

## Blocked by

- 012-text-model-and-delta-typing.md