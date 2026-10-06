// 长文档分段加载总闸（ADR-0012）：未设置/默认 = 开；显式 false = 回退旧全量管线。
export const isSegmentedLoadingEnabled = settings =>
  !settings || settings.segmentedLoading !== false;
