Status: done

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

内置主题文件里那些已经不生效的分割线外观规则清掉：7 个预览主题的 `hr { … }` 及配套的「分隔线」提示注释、15 个编辑主题里 `.hr` 这一项（编辑主题中 `.hr` 与 `.link` / `.linkref` 同组，只摘掉 `.hr`，链接配色保留）。清理后逐个主题回归一遍，确认档位不变形、其余样式零变化。

这些规则在 ADR 0017 的防火墙之后已彻底失效，留着等于给后来人示范一个不生效的写法，注释里那句 `border-top:1px solid …` 更是直接教错。

## Acceptance criteria

- [x] 7 个预览主题文件不再有 `hr` 选择器，也不再残留「分隔线」提示注释。
- [x] 15 个编辑主题文件中 `.hr` 不再出现在任何选择器列表里，被摘项后的规则其余选择器（`.cl` / `.link` / `.linkref` / `.linkdef .url`）与声明保持原样。
- [x] 每个主题清理后回归：三档分割线的颜色、粗细、盒模型与清理前一致（档位由 KEDIT 独占，主题本来就不该影响它）；所有主题脚本语法有效。
- [x] 用户自定义主题（`edit-theme-custom` / `preview-theme-custom`）的编辑与保存路径不受影响；在其中写 `hr { … }` 仍然无效但不报错。
- [x] `.docs/spec/frontend-conventions.md` 的主题约束与新代码一致（主题不得写 `hr` / `.hr` 外观）。
- [x] `npm run build` 通过。

## Evidence

- passed：`test/node/themeDividerRules.test.js` —— 7 个预览主题无 `hr` 规则、无「分隔线」注释；15 个编辑主题无 `.editor__inner .hr`，且 `.link` / `.linkref` 仍在（防止误删）。
- passed：改动为纯删除 —— `git diff --stat static/themes` 共 22 个文件、74 行删除、0 行新增；`node --check` 对全部 22 个主题脚本通过。
- passed：`node test/browser/divider-tiers.mjs` 在清理后重跑仍全绿（3 档 × 7 预览主题 × 15 编辑主题 × 亮/暗），即清理没有改变任何档位表现。
- passed：`node test/browser/divider-app.mjs` 在真实 `dist/` 上仍全绿。
- passed：`npm run build` 与 `test/build/*.mjs`（fonts / startup / precache / optional-renderers / startup-icons）全部通过。
