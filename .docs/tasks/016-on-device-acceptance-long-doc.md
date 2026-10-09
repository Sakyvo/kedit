Status: review

## Parent

010-long-doc-segmented-loading.md(决策见 ADR-0012)

## What to build

收官验收:真机实测 + 桌面回归 + 逃生开关演练 + 交付人工验收清单。

- push 触发 Pages 部署后,Author 在 Honor Magic 2 上以真实 80 万字文档验收:
  打开 <1s 可输入、击键流畅、渐进补齐不冻结输入、滚到任意段正常、
  内置查找替换全文可用、Ctrl+A 复制得全文、撤销/IME/同步无回归、
  全载后长期滚动流畅(真机裁决项,不达标则回锚卡评议乙案)。
- 桌面回归:普通小文档全部交互与发布版一致;双栏预览在停笔 ~200ms 内收敛;
  Publish/pdir 直发、导出不受影响(走全量渲染)。
- 开关演练:关闭「长文档分段加载」后全文管线行为与发布版一致;
  再开启后分段管线恢复。
- 产出人工验收清单(上述全部条目),逐项勾选后本卡转 done;
  批次随后归档。

## 本卡在自动侧已完成的部分

- **开关 OFF/ON 双向演练（自动取证）**：关闸后 `pipeline:false`、`tocKeys` 为空、
  预览/目录走旧路径且不空白；恢复后 `pipeline:true`、窗口恢复、预览/目录正常。
  期间修复一处真缺陷：OFF 旧管线的可见性短路误伤（预览与 TOC 全空）——已修
  （`12c4ab8a`），门控改为只属分段管线。
- **Ctrl+A 全文由模型供文本**：200 段文档 `getSelectedText()` 长度 = 模型长度
  = 编辑器文本长度，`equalFull: true`（ADR-0012 硬验收项）。
- **16 个 harness 全绿**（含本批次新增 headingsScan / tocModel / previewWindow /
  referenceDefs）。
- **桌面回归关键路径**：TOC 打开即完整、围栏隔离、跳转、增量更新、引用定义回退、
  预览隐藏零渲染、可见按需换窗——均在 Chromium 实测取证（见 014/015 卡）。

## 交付物

- `.docs/tasks/016-manual-acceptance-checklist.md` — 人工验收清单（A 真机 / B 移动端 /
  C 桌面回归 / D 开关演练 / E 结论），共 25 项，逐项勾选后可转 done。

## Acceptance criteria

- [x] 人工验收清单文件随卡交付（25 项，含真机裁决项 A9 与开关演练 D1–D5）
- [ ] 真机验收清单全部通过（含 1 秒打开与长期滚动两项裁决）→ 需真机
- [ ] 桌面回归零 issue（或另有 issue 卡跟进并降级本卡结论）→ 需真人确认
- [ ] 开关 OFF/ON 两方向演练通过 → 自动侧已通过，真机侧随清单

## Blocked by

- 013-editor-progressive-segment-loading.md
- 014-preview-visible-only-segmented-render.md