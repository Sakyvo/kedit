import MD5 from 'crypto-js/md5';
import store from '../store';
import utils from './utils';
import localDbSvc from './localDbSvc';
import gitWorkspaceSvc from './gitWorkspaceSvc';
import workspaceBackupSvc from './workspaceBackupSvc';
import providerRegistry from './providers/common/providerRegistry';
import settingsYamlSvc from './settingsYamlSvc';

const dayMs = 24 * 60 * 60 * 1000;
const uploadGraceDelay = 24 * 60 * 60 * 1000; // 24 hours
const logMaxEntries = 50;
const pathDateMatcher = /(\d{4})-(\d{2})-(\d{2})/;
const forbiddenPathMatcher = /^\.stackedit-|\.md$|\.sync$|\.publish$/;

/**
 * Git path prefixes images live under, derived from the configured image
 * path templates ('/imgs/{YYYY}-{MM}-{DD}' → 'imgs/'). The default prefix
 * is always included.
 */
const getImgPrefixes = () => {
  const templates = {
    ...store.getters['img/getWorkspaceImgPath'],
  };
  const checkedStorage = store.getters['img/getCheckedStorage'];
  if (checkedStorage && checkedStorage.type === 'workspace' && checkedStorage.sub) {
    templates[checkedStorage.sub] = true;
  }
  const prefixes = { 'imgs/': true };
  Object.keys(templates).forEach((template) => {
    const staticPart = template.replace(/^\//, '').split('{')[0];
    const prefix = staticPart.slice(0, staticPart.lastIndexOf('/') + 1);
    if (prefix && !forbiddenPathMatcher.test(prefix)) {
      prefixes[prefix] = true;
    }
  });
  return Object.keys(prefixes);
};

/**
 * Hard guard: only image blobs under a configured prefix are ever touched,
 * never .md, never .stackedit-data or location files.
 */
const isImgBlobPath = path => !!path
  && !forbiddenPathMatcher.test(path)
  && getImgPrefixes().some(prefix => path.indexOf(prefix) === 0);

/**
 * 24h upload grace: paths carrying a YYYY-MM-DD segment dated today or
 * yesterday don't enter the zero-reference clock yet.
 */
const isWithinUploadGrace = (path, now) => {
  const match = path.match(pathDateMatcher);
  if (!match) {
    return false;
  }
  const uploadDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
  if (Number.isNaN(uploadDate.getTime())) {
    return false;
  }
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return uploadDate.getTime() >= startOfToday.getTime() - uploadGraceDelay;
};

const isMainGitWorkspace = () => store.getters['workspace/currentWorkspace'].id === 'main'
  && store.getters['workspace/currentWorkspaceIsGit']
  && !!store.getters['workspace/syncToken'];

export default {
  getPolicy() {
    const custom = settingsYamlSvc.get(store.getters['data/settings'], ['imageCleanup']);
    if (custom !== undefined && (custom === null || typeof custom !== 'object' || Array.isArray(custom))) {
      return custom;
    }
    // Do not let the generic settings merge hide an invalid destructive policy.
    return { ...store.getters['data/computedSettings'].imageCleanup, ...custom };
  },

  validatePolicy(policy) {
    if (!policy || typeof policy.enabled !== 'boolean' || !Number.isSafeInteger(policy.days)
      || policy.days < 1 || !Number.isSafeInteger(policy.days * dayMs)) {
      return '清理天数必须是大于等于 1 的整数。';
    }
    return '';
  },

  async savePolicy(policy) {
    const error = this.validatePolicy(policy);
    if (error) throw new Error(error);
    let settings = store.getters['data/settings'];
    const custom = settingsYamlSvc.get(settings, ['imageCleanup']);
    if (custom !== undefined && (custom === null || typeof custom !== 'object' || Array.isArray(custom))) {
      settings = settingsYamlSvc.set(settings, ['imageCleanup'], policy);
    } else {
      settings = settingsYamlSvc.set(settings, ['imageCleanup', 'enabled'], policy.enabled);
      settings = settingsYamlSvc.set(settings, ['imageCleanup', 'days'], policy.days);
    }
    await store.dispatch('data/setSettings', settings);
  },

  /**
   * Absolute img-store form ('/imgs/…', %20-escaped) of a git path.
   */
  getAbsolutePath(path) {
    return `/${path}`.replaceAll(' ', '%20');
  },

  /**
   * Repo image inventory ({ [gitPath]: sha }) from the latest tree scan.
   */
  getInventory() {
    const inventory = Object.create(null);
    Object.entries(gitWorkspaceSvc.shaByPath).forEach(([path, sha]) => {
      if (isImgBlobPath(path)) {
        inventory[path] = sha;
      }
    });
    return inventory;
  },

  /**
   * Inventory minus referenced set → [{ path, sha, since, uploadGrace }].
   */
  async scanUnreferenced() {
    const inventory = this.getInventory();
    const referenced = await workspaceBackupSvc
      .collectReferencedImagePaths(store.getters['workspace/currentWorkspace'].id);
    const { unreferencedSince } = store.getters['data/imgCleanup'];
    return Object.keys(inventory)
      .filter(path => !referenced[path])
      .map(path => ({
        path,
        sha: inventory[path],
        since: unreferencedSince[path],
        uploadGrace: !unreferencedSince[path] && isWithinUploadGrace(path, Date.now()),
      }));
  },

  describeEntry(entry, now = Date.now(), policy = this.getPolicy()) {
    const age = entry.since ? Math.max(0, now - entry.since) : 0;
    const days = Math.floor(age / dayMs);
    const ageLabel = entry.since
      ? (days < 1 ? '未引用不足 1 天' : `未引用 ${days} 天`)
      : (entry.uploadGrace ? '上传保护期' : '待同步开始计时');
    if (this.validatePolicy(policy)) return { ageLabel, cleanupLabel: '清理设置无效', due: false };
    if (!policy.enabled) return { ageLabel, cleanupLabel: '自动清理已关闭', due: false };
    if (!entry.since) return { ageLabel, cleanupLabel: '', due: false };
    const remaining = policy.days * dayMs - age;
    return {
      ageLabel,
      cleanupLabel: remaining <= 0 ? '下次同步清理' : `距清理约 ${Math.ceil(remaining / dayMs)} 天`,
      due: remaining <= 0,
    };
  },

  /**
   * Delete one image blob: same primitive as the permanent-delete flow
   * (githubHelper.removeFile via the workspace provider), then clean the
   * local img store and the blob URL cache. Hard-guarded to image paths
   * whose sha still matches the latest tree scan.
   */
  async removeImg(path, sha) {
    if (!isImgBlobPath(path) || !sha || gitWorkspaceSvc.shaByPath[path] !== sha) {
      throw new Error(`拒绝删除图片路径：${path}`);
    }
    const provider = providerRegistry
      .providersById[store.getters['workspace/currentWorkspace'].providerId];
    if (!provider || !provider.removeWorkspaceItem || !provider.getToken()) {
      throw new Error('无法删除图片：文档空间未同步。');
    }
    await provider.removeWorkspaceItem({ syncData: { id: path } });
    delete gitWorkspaceSvc.shaByPath[path];
    const absolutePath = this.getAbsolutePath(path);
    await localDbSvc.removeImgItem(MD5(absolutePath).toString());
    const { default: editorSvc } = await import('./editorSvc');
    editorSvc.releaseImgCache(absolutePath);
  },

  /**
   * Shared by the auto sweep and the manual modal: delete images then
   * update the synced tracker (drop clock entries, append log rows).
   */
  async deleteImgs(entries) {
    const removedPaths = [];
    const failedPaths = [];
    await utils.awaitSequence(entries, async ({ path, sha }) => {
      try {
        await this.removeImg(path, sha);
        removedPaths.push(path);
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        failedPaths.push(path);
      }
    });
    if (removedPaths.length) {
      const now = Date.now();
      const imgCleanup = store.getters['data/imgCleanup'];
      const unreferencedSince = { ...imgCleanup.unreferencedSince };
      removedPaths.forEach((path) => {
        delete unreferencedSince[path];
      });
      const log = [
        ...removedPaths.map(path => ({ path, ts: now })),
        ...(imgCleanup.log || []),
      ].slice(0, logMaxEntries);
      store.dispatch('data/setImgCleanup', { unreferencedSince, log });
    }
    return { removedPaths, failedPaths };
  },

  /**
   * Post-sync sweep: refresh zero-reference clocks (24h upload grace,
   * re-referenced paths reset, gone paths dropped) and auto-delete images
   * unreferenced for the configured duration. Failures must not break Sync.
   */
  async sweepAfterSync() {
    try {
      if (!isMainGitWorkspace()) {
        return;
      }
      const inventory = this.getInventory();
      const referenced = await workspaceBackupSvc
        .collectReferencedImagePaths(store.getters['workspace/currentWorkspace'].id);
      const imgCleanup = store.getters['data/imgCleanup'];
      const now = Date.now();
      const unreferencedSince = {};
      Object.keys(inventory).forEach((path) => {
        if (referenced[path]) {
          // Referenced again: clock entry not carried over
          return;
        }
        if (imgCleanup.unreferencedSince[path]) {
          unreferencedSince[path] = imgCleanup.unreferencedSince[path];
        } else if (!isWithinUploadGrace(path, now)) {
          unreferencedSince[path] = now;
        }
      });
      // Entries for paths no longer in the inventory are dropped implicitly
      if (utils.serializeObject(unreferencedSince)
        !== utils.serializeObject(imgCleanup.unreferencedSince)
      ) {
        store.dispatch('data/setImgCleanup', {
          unreferencedSince,
          log: imgCleanup.log,
        });
      }

      const policy = this.getPolicy();
      const policyError = this.validatePolicy(policy);
      if (policyError) {
        store.dispatch('notification/error', `自动清理未执行：${policyError}`);
        return;
      }
      if (!policy.enabled) return;
      const dueEntries = Object.keys(unreferencedSince)
        .filter(path => now - unreferencedSince[path] >= policy.days * dayMs)
        .map(path => ({ path, sha: inventory[path] }));
      if (dueEntries.length) {
        const { removedPaths, failedPaths } = await this.deleteImgs(dueEntries);
        if (removedPaths.length) {
          store.dispatch('notification/info', `已自动清理 ${removedPaths.length} 张连续 ${policy.days} 天未引用的图片。`);
        }
        if (failedPaths.length) {
          // Entries were kept, retried on next sync
          store.dispatch('notification/error', `${failedPaths.length} 张未引用图片自动清理失败，将在下轮同步重试。`);
        }
      }
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
    }
  },
};
