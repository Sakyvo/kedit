import store from '../store';
import utils from '../services/utils';

const endsWith = (str, suffix) => str.slice(-suffix.length) === suffix;

// W4: safety net, tombstones older than that are ignored and pruned
const tombstoneMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

export default {
  shaByPath: Object.create(null),

  /**
   * W4 rename/delete tombstones ({ [gitPath]: { sha, ts } }), stored in
   * localSettings: per-device by design, the delete obligation belongs to
   * the device that renamed/deleted the item. Expired entries are filtered.
   */
  getTombstones() {
    const tombstones = store.getters['data/localSettings'].gitTombstones || {};
    const minTs = Date.now() - tombstoneMaxAge;
    const result = {};
    Object.entries(tombstones).forEach(([path, tombstone]) => {
      if (tombstone && tombstone.ts > minTs) {
        result[path] = tombstone;
      }
    });
    return result;
  },

  /**
   * Record tombstones ({ [gitPath]: sha }). The whole map is rewritten as
   * the localSettings patcher only merges top level keys.
   */
  recordTombstones(shaByTombstonePath) {
    const paths = Object.keys(shaByTombstonePath);
    if (!paths.length) {
      return;
    }
    const now = Date.now();
    const gitTombstones = this.getTombstones();
    paths.forEach((path) => {
      gitTombstones[path] = { sha: shaByTombstonePath[path] || null, ts: now };
    });
    store.dispatch('data/patchLocalSettings', { gitTombstones });
  },

  /**
   * Clear tombstones once the remote path has been deleted (or the
   * tombstone turned out to be stale). Also prunes expired entries.
   */
  clearTombstones(paths) {
    const rawTombstones = store.getters['data/localSettings'].gitTombstones || {};
    const gitTombstones = this.getTombstones();
    paths.forEach((path) => {
      delete gitTombstones[path];
    });
    if (Object.keys(rawTombstones).length !== Object.keys(gitTombstones).length) {
      store.dispatch('data/patchLocalSettings', { gitTombstones });
    }
  },

  makeChanges(tree) {
    const workspacePath = store.getters['workspace/currentWorkspace'].path || '';

    // Store all blobs sha
    this.shaByPath = Object.create(null);
    // Store interesting paths
    const treeFolderMap = Object.create(null);
    const treeFileMap = Object.create(null);
    const treeDataMap = Object.create(null);
    const treeSyncLocationMap = Object.create(null);
    const treePublishLocationMap = Object.create(null);

    tree.filter(({ type, path }) => type === 'blob' && path.indexOf(workspacePath) === 0)
      .forEach((blobEntry) => {
        // Make path relative
        const path = blobEntry.path.slice(workspacePath.length);
        // Collect blob sha
        this.shaByPath[path] = blobEntry.sha;
        if (path.indexOf('.stackedit-data/') === 0) {
          treeDataMap[path] = true;
        } else {
          // Collect parents path
          let parentPath = '';
          path.split('/').slice(0, -1).forEach((folderName) => {
            const folderPath = `${parentPath}${folderName}/`;
            treeFolderMap[folderPath] = parentPath;
            parentPath = folderPath;
          });
          // Collect file path
          if (endsWith(path, '.md')) {
            treeFileMap[path] = parentPath;
          } else if (endsWith(path, '.sync')) {
            treeSyncLocationMap[path] = true;
          } else if (endsWith(path, '.publish')) {
            treePublishLocationMap[path] = true;
          }
        }
      });

    // Collect changes
    const changes = [];
    const idsByPath = {};
    const syncDataByPath = store.getters['data/syncDataById'];
    const { itemIdsByGitPath } = store.getters;
    const getIdFromPath = (path, isFile) => {
      let itemId = idsByPath[path];
      if (!itemId) {
        const existingItemId = itemIdsByGitPath[path];
        if (existingItemId
          // Reuse a file ID only if it has already been synced
          && (!isFile || syncDataByPath[path]
          // Content may have already been synced
          || syncDataByPath[`/${path}`])
        ) {
          itemId = existingItemId;
        } else {
          // Otherwise, make a new ID for a new item
          itemId = utils.uid();
        }
        // If it's a file path, add the content path as well
        if (isFile) {
          idsByPath[`/${path}`] = `${itemId}/content`;
        }
        idsByPath[path] = itemId;
      }
      return itemId;
    };

    // Folder creations/updates
    // Assume map entries are sorted from top to bottom
    Object.entries(treeFolderMap).forEach(([path, parentPath]) => {
      if (path === '.stackedit-trash/') {
        idsByPath[path] = 'trash';
      } else {
        const item = utils.addItemHash({
          id: getIdFromPath(path),
          type: 'folder',
          name: path.slice(parentPath.length, -1),
          parentId: idsByPath[parentPath] || null,
        });

        const folderSyncData = syncDataByPath[path];
        if (!folderSyncData || folderSyncData.hash !== item.hash) {
          changes.push({
            syncDataId: path,
            item,
            syncData: {
              id: path,
              type: item.type,
              hash: item.hash,
            },
          });
        }
      }
    });

    // File/content creations/updates
    // W4: paths renamed/deleted locally must not resurrect from the tree
    // scan (path + sha double match). Skipping their changes before any
    // getIdFromPath registration keeps their stale syncData alive so the
    // sync remove loop deletes the remote blob in the same round.
    const gitTombstones = this.getTombstones();
    const tombstonedPaths = Object.create(null);
    const staleTombstonePaths = [];
    Object.entries(treeFileMap).forEach(([path, parentPath]) => {
      const tombstone = gitTombstones[path];
      if (tombstone) {
        if (!store.getters.itemsByGitPath[path] && tombstone.sha === this.shaByPath[path]) {
          tombstonedPaths[path] = true;
          return;
        }
        // Path re-occupied locally or rewritten remotely (foreign new
        // content): never block it, drop the tombstone and download
        staleTombstonePaths.push(path);
      }
      const fileId = getIdFromPath(path, true);
      const contentPath = `/${path}`;
      const contentId = idsByPath[contentPath];

      // File creations/updates
      const existingItem = store.getters.itemsByGitPath[path] || {};
      const item = utils.addItemHash({
        id: fileId,
        type: 'file',
        name: path.slice(parentPath.length, -'.md'.length),
        parentId: idsByPath[parentPath] || null,
        createdOn: existingItem.createdOn || 0,
        updatedOn: existingItem.updatedOn || 0,
      });

      const fileSyncData = syncDataByPath[path];
      if (!fileSyncData || fileSyncData.hash !== item.hash) {
        changes.push({
          syncDataId: path,
          item,
          syncData: {
            id: path,
            type: item.type,
            hash: item.hash,
          },
        });
      }

      // Content creations/updates
      const contentSyncData = syncDataByPath[contentPath];
      if (!contentSyncData || contentSyncData.sha !== this.shaByPath[path]) {
        const type = 'content';
        // Use `/` as a prefix to get a unique syncData id
        changes.push({
          syncDataId: contentPath,
          item: {
            id: contentId,
            type,
            // Need a truthy value to force downloading the content
            hash: 1,
          },
          syncData: {
            id: contentPath,
            type,
            // Need a truthy value to force downloading the content
            hash: 1,
          },
        });
      }
    });

    // Data creations/updates
    const syncDataById = store.getters['data/syncDataById'];
    Object.keys(treeDataMap).forEach((path) => {
      // Only settings、workspaces、template、explorerOrder、imgCleanup data are stored
      const [, id] = path.match(/^\.stackedit-data\/(settings|workspaces|badgeCreations|templates|explorerOrder|imgCleanup)\.json$/) || [];
      if (id) {
        idsByPath[path] = id;
        idsByPath[id] = id;
        const syncData = syncDataById[id];
        if (!syncData || syncData.sha !== this.shaByPath[path]) {
          const type = 'data';
          changes.push({
            syncDataId: id,
            item: {
              id,
              type,
              // Need a truthy value to force saving sync data
              hash: 1,
            },
            syncData: {
              id,
              type,
              // Need a truthy value to force downloading the content
              hash: 1,
            },
          });
        }
      }
    });

    // Location creations/updates
    [{
      type: 'syncLocation',
      map: treeSyncLocationMap,
      pathMatcher: /^([\s\S]+)\.([\w-]+)\.sync$/,
    }, {
      type: 'publishLocation',
      map: treePublishLocationMap,
      pathMatcher: /^([\s\S]+)\.([\w-]+)\.publish$/,
    }]
      .forEach(({ type, map, pathMatcher }) => Object.keys(map).forEach((path) => {
        const [, filePath, data] = path.match(pathMatcher) || [];
        if (filePath) {
          // If there is a corresponding md file in the tree
          const fileId = idsByPath[`${filePath}.md`];
          if (fileId) {
            // Reuse existing ID or create a new one
            const id = itemIdsByGitPath[path] || utils.uid();
            idsByPath[path] = id;

            const item = utils.addItemHash({
              ...JSON.parse(utils.decodeBase64(data)),
              id,
              type,
              fileId,
            });

            const locationSyncData = syncDataByPath[path];
            if (!locationSyncData || locationSyncData.hash !== item.hash) {
              changes.push({
                syncDataId: path,
                item,
                syncData: {
                  id: path,
                  type: item.type,
                  hash: item.hash,
                },
              });
            }
          }
        }
      }));

    // Deletions
    // W4: keep the stale syncData of tombstoned paths (file, content and
    // location forms) so the remove loop deletes the remote blobs instead
    // of leaking them once their syncData is dropped
    const locationOfTombstoneMatcher = /^([\s\S]+)\.[\w-]+\.(?:sync|publish)$/;
    const isTombstonedPath = (path) => {
      if (tombstonedPaths[path]) {
        return true;
      }
      if (path[0] === '/' && tombstonedPaths[path.slice(1)]) {
        return true;
      }
      const [, filePath] = path.match(locationOfTombstoneMatcher) || [];
      return !!filePath && !!tombstonedPaths[`${filePath}.md`];
    };
    Object.keys(syncDataByPath).forEach((path) => {
      if (!idsByPath[path] && !isTombstonedPath(path)) {
        changes.push({ syncDataId: path });
      }
    });

    // W4: drop tombstones proven stale during this scan
    if (staleTombstonePaths.length) {
      this.clearTombstones(staleTombstonePaths);
    }

    return changes;
  },
};
