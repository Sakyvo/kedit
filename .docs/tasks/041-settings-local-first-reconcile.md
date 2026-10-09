Status: done

# settings 同步改「本地优先」三路调和

## Parent

`024-settings-sync-syncexclude-projection.md`

## Problem

作者报:本地改了配置文件,触发远端同步后变回远端默认配置,本地改动失效。
根因 = ADR 0010 的 settings 分支:`applyRemote(local, remote, excludes)` 把
**远端投影文本当底板**,只把本机排除键盖回去 —— 远端未携带的每个键(另一台
设备推过默认值的键、远端删掉的键)都静默替换本机值;基线只存 hash 不存文本,
两端都改时本地改动同样被丢弃。

## What to build

按 ADR 0013 改成**本地优先三路调和**:

- 新增 `localSettings.settingsProjectionBaseline`(设备本地,`gitTombstones`
  先例):本机上次调和认定的投影文本,用作三路合并基线。
- `settingsYamlSvc.reconcileRemote(localText, remoteText, baselineText)` 替代
  `applyRemote`:以**本机文本为输出底板**(注释/格式保留),按键递归判定:
  本机值 ≠ 基线 → 本机改动胜(保留并回传);本机值 = 基线 → 采用远端值(远端
  删除则删键);排除键(`syncExclude`,ADR 0010)恒本机、不读不写。
- `settingsYamlSvc.projectForSync` 改为**规范化投影**:解析后剔除排除的顶层键,
  `sortKeys` + `lineWidth:-1` 落回文本。同值两端必产同字节 → 上传体/hash 双向
  一致(旧行手术投影做不到,三路调和会无限来回);非法 yaml 原样透传不重写。
- `syncSvc.syncDataItem` settings 分支:用 `reconcileRemote` + 基线,回合末把
  `projectForSync(mergedItem.data)` 写回基线(无论本轮是否上传)。
- ADR 0013；`.docs/spec/state-management.md` 契约节改写。

## Acceptance criteria

- [x] 远端默认不再覆盖本机改动:本机值保留且回推(`settingsSync.harness.mjs` 用例 1)。
- [x] 新设备仍能整份拉取远端配置(用例 2)。
- [x] 两端并发改不同键,双方都保留,且同步轮次收敛(用例 3、8)。
- [x] 远端改动(含删除、多行值)仍能下达到未改动的本机(用例 4、7)。
- [x] 排除键两端保持各自本机值,非排除键最终一致(用例 6)。
- [x] `npm run build` 通过。
- [ ] 真机双端验收:本机改 yaml → 触发同步 → 值不再回退(需线上 GitHub workbench)。

## Blocked by

None - 已完成
## 追加(实现中发现的必要性)

无基线场景(本次上线后的首次同步、或清缓存后)也必须本地优先——否则本卡上线
本身又会把作者本机配置再抹一次。故 `reconcileRemote` 在 `baselineText` 缺失时
按「本地值全胜、远端只补本机没有的键」处理(空文本的新设备仍能整份拉取);
本轮的采纳结果随即成为基线。用例 2b 覆盖。
