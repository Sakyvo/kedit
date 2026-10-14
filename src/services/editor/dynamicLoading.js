// 动态加载总闸（ADR-0012 Amendment，批 042）。
// 只有显式 true 才走新管线；默认关（现网行为 = 旧全量管线）。
// 旧键 segmentedLoading 已在 043 废弃（不迁移、不兼容）。
export const isDynamicLoadingEnabled = settings =>
  !!settings && settings.dynamicLoading === true;