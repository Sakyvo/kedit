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

结论：**耗时与段数线性相关**（9730 段 ≈ 每次打开近万次「建节点 + 派发事件 + 记账」），
Prism 只占其中 162–240ms。因此**单纯推迟着色无法突破 ~1s 地板**。

要真正消除它需要 ADR-0012 中被否的「编辑器窗口化」（CodeMirror-6 式虚拟化）——
或在保持不变式的前提下**粗化 section 粒度**（9730 → 数十段），后者需重新审视
cledit 分节对高亮/含图片卡片/undo 的依赖。两者都是架构级选择。按 ADR 决策，
该项留待 **016 A9 真机裁决**：若真机不达标 → 回锚卡 010 评议乙案。

## Blocked by

- 012-text-model-and-delta-typing.md