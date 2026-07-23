const origin = `${window.location.protocol}//${window.location.host}`;

export default {
  cleanTrashAfter: 7 * 24 * 60 * 60 * 1000, // 7 days
  origin,
  oauth2RedirectUri: `${origin}/oauth2/callback`,
  types: [
    'contentState',
    'syncedContent',
    'content',
    'file',
    'folder',
    'syncLocation',
    'publishLocation',
    'data',
  ],
  localStorageDataIds: [
    'workspaces',
    'settings',
    'layoutSettings',
    'tokens',
    'serverConf',
    // Device-local: pdir-bound file ids so explorer/navbar icons show before
    // remote .publish tree / token hydration (not synced to git).
    'pdirMarks',
  ],
  textMaxLength: 10000000,
  defaultName: 'Untitled',
};
