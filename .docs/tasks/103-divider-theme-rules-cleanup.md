Status: open

## Parent

[预览长串折行与分割线三档](099-divider-tiers-preview-wrap.md)

## What to build

内置主题文件里那些已经不生效的分割线外观规则清掉：8 个预览主题的 `hr { … }` 与 15 个编辑主题里 `.hr` 这一项（编辑主题中 `.hr` 与 `.link` / `.linkref` 同组，只摘掉 `.hr`，链接配色保留）。清理后逐个主题回归一遍，确认档位不变形、其余样式零变化。

这些规则在 ADR 0017 的防火墙之后已彻底失效，留着等于给后来人示范一个不生效的写法。

## Acceptance criteria

- [ ] 8 个预览主题文件中不再有 `hr` 选择器；15 个编辑主题文件中 `.hr` 不再出现在任何选择器列表里，被摘项后的规则其余选择器与声明保持原样。
- [ ] 每个主题清理前后各截一张同位置对比图（含一条 3 个、一条 6 个、一条 9 个标记的分割线），肉眼无差异——证明删的是死代码。
- [ ] 用户自定义主题（`edit-theme-custom` / `preview-theme-custom`）的编辑与保存路径不受影响；在其中写 `hr { … }` 仍然无效但不报错。
- [ ] `.docs/spec/frontend-conventions.md` 里的主题约束与新代码一致（主题不得写 `hr` / `.hr` 外观），没有互相矛盾的残留说法。
- [ ] `npm run build` 通过。

## Blocked by

- `102-divider-tier-preview-export.md`
