Status: done

# settings yaml 行级手术服务（prefactor）

## Parent

`.docs/tasks/018-visual-settings-config.md`

## What to build

一个纯 JS 服务（放 `src/services/`），让后续所有可视化写入共用同一套
「保真写回」机制：

- 输入：当前自定义 settings yaml 文本 + 键路径（如 `editor.headButtons.bold`）
  + 新值。
- 读：js-yaml 解析（沿用 computedSettings 路径）。
- 写：在原文本中定位该键路径所在行区间，替换值；键不存在则追加到对应父节点
  （父节点也不存在则连父节点一并追加到文末）。
- 注释、未知键、用户排版原样保留；tab 统一按两个空格缩进输出。
- 辅助能力：按排除键列表从文本中**剥除**键（生成同步投影）、以及把远端文本
  合并回本机文本时**保留本机排除键值**（ADR 0010 的投影层同样复用本服务）。

不建 UI；本卡只做服务 + vm 沙盒验证脚本（不进仓库的临时验证可以，若要留档放
`.docs/` 下注明）。

## Acceptance criteria

- [x] 替换已存在的顶层键 / 嵌套键，行级保真（注释、无关键、排版不变）。
- [x] 追加缺失键（含中间父节点缺失）不破坏既有文本。
- [x] 剥除指定键得到合法 yaml（剥除后语义=原值删键），多空行不增生。
- [x] Node vm/单文件脚本驱动服务的各 case 打印断言通过。
- [x] `npm run build` 通过。

## Blocked by

None - can start immediately
