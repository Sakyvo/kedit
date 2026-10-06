Status: open

## Parent

010-long-doc-segmented-loading.md（决策见 ADR-0012）

## What to build

收官验收：真机实测 + 桌面回归 + 逃生开关演练 + 交付人工验收清单。

- push 触发 Pages 部署后，Author 在 Honor Magic 2 上以真实 80 万字文档验收：
  打开 <1s 可输入、击键流畅、渐进补齐不冻结输入、滚到任意段正常、
  内置查找替换全文可用、Ctrl+A 复制得全文、撤销/IME/同步无回归、
  全载后长期滚动流畅（真机裁决项，不达标则回锚卡评议乙案）。
- 桌面回归：普通小文档全部交互与发布版一致；双栏预览在停笔 ~200ms 内收敛；
  Publish/pdir 直发、导出不受影响（走全量渲染）。
- 开关演练：关闭「长文档分段加载」后全文管线行为与发布版一致；
  再开启后分段管线恢复。
- 产出人工验收清单（上述全部条目），逐项勾选后本卡转 done；
  批次随后归档。

## Acceptance criteria

- [ ] 真机验收清单全部通过（含 1 秒打开与长期滚动两项裁决）
- [ ] 桌面回归零 issue（或另有 issue 卡跟进并降级本卡结论）
- [ ] 开关 OFF/ON 两方向演练通过
- [ ] 人工验收清单文件随卡交付

## Blocked by

- 013-editor-progressive-segment-loading.md
- 014-preview-visible-only-segmented-render.md
