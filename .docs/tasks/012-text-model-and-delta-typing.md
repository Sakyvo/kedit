Status: open

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

## Acceptance criteria

- [ ] `npm run build` 通过
- [ ] 80 万字文档击键路径无 O(全文) 计算（打点开销佐证：不再出现全文读取/
      全文 diff/全文重解析计时）
- [ ] 撤销/重做、IME 组合输入、粘贴（含 turndown）、查找替换在模型路径下
      行为与现状一致
- [ ] 开发模式对账断言在普通编辑全流程中零误报；人为破坏 DOM 时正确报警
- [ ] 开关 OFF 时回到旧路径，行为与发布版一致

## Blocked by

- 011-segmented-loading-setting-toggle.md
