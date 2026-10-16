// 动态加载总闸（ADR-0012 Amendment，批 042/048）。
// 默认开（保页面不卡死是硬要求）；用户可显式关掉回到旧全量管线。
// 旧键 segmentedLoading 已在 043 废弃（不迁移、不兼容）。
export const isDynamicLoadingEnabled = settings =>
  !settings || settings.dynamicLoading !== false;

/**
 * 启用分片构建的字符阈值（默认 50000，可自定义）。
 * 文档字符数超过该值才走分片 + 进度条；否则同步秒开。
 */
export const getDynamicLoadingThreshold = (settings) => {
  const raw = settings && settings.dynamicLoadingThreshold;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 50000;
};