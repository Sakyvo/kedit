// Field descriptors for the visual settings tab. Every entry maps a dot of the
// settings yaml to a control; writing goes through settingsYamlSvc (ADR 0009).
// Paths are arrays so keys containing '.'/spaces stay addressable.

export default [
  {
    title: '常规',
    fields: [
      {
        path: ['colorTheme'],
        type: 'select',
        label: '主题',
        options: [
          { value: 'light', label: '浅色' },
          { value: 'dark', label: '深色' },
        ],
      },
      {
        path: ['fontSizeFactor'],
        type: 'number',
        label: '字号倍数',
        min: 0.5,
        max: 3,
        step: 0.05,
      },
      {
        path: ['maxWidthFactor'],
        type: 'number',
        label: '最大宽度倍数',
        min: 0.5,
        max: 3,
        step: 0.05,
      },
      {
        path: ['autoSyncEvery'],
        type: 'number',
        label: '自动同步间隔（毫秒）',
        min: 60000,
        step: 1000,
      },
    ],
  },
  {
    title: '顶栏按钮',
    type: 'buttonList',
  },
  {
    title: '编辑器',
    fields: [
      { path: ['editor', 'listAutoNumber'], type: 'toggle', label: '自动列表编号' },
      { path: ['editor', 'inlineImages'], type: 'toggle', label: '内嵌图片' },
      { path: ['editor', 'monospacedFontOnly'], type: 'toggle', label: '仅等宽字体' },
      { path: ['editor', 'showInPageButtons'], type: 'toggle', label: '右上角图标' },
    ],
  },
];
