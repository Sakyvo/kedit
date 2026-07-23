import MD5 from 'crypto-js/md5';
import store from '../../store';
import githubHelper from './helpers/githubHelper';
import Provider from './common/Provider';
import localDbSvc from '../localDbSvc';
import syncSvc from '../syncSvc';
import {
  PDIR_OWNER,
  PDIR_REPO,
  PDIR_BRANCH,
  PDIR_MAIN_FILE,
  PDIR_SITE_URL,
  parsePdirModules,
  replaceModuleBody,
  listPrivateImgRefs,
  stripFrontMatter,
  findForbiddenHeadings,
  computeGitBlobShaFromBase64,
  planImageUploads,
  rewriteImgRefs,
} from './helpers/pdirPublishUtils';

// Private image content (pure base64) by workspace-absolute uri, with git fallback
const loadImgBase64 = async (uri) => {
  const md5Id = MD5(uri).toString();
  let imgItem = await localDbSvc.getImgItem(md5Id);
  if (!imgItem || !imgItem.content) {
    try {
      await syncSvc.syncImg(uri);
    } catch (e) {
      // fall through to the existence check
    }
    imgItem = await localDbSvc.getImgItem(md5Id);
  }
  if (!imgItem || !imgItem.content) {
    throw new Error(`私有图片不存在或尚未同步：${uri}`);
  }
  return imgItem.content;
};

const progress = (mutation, payload) => store.commit(`publishProgress/${mutation}`, payload);

export default new Provider({
  id: 'pdir',
  name: 'pdir',
  getToken({ sub }) {
    return store.getters['data/githubTokensBySub'][sub];
  },
  getLocationUrl() {
    return PDIR_SITE_URL;
  },
  getLocationDescription({ module }) {
    return `pdir › ${module}`;
  },
  async downloadMainMd(token) {
    const { sha, data } = await githubHelper.downloadFile({
      token,
      owner: PDIR_OWNER,
      repo: PDIR_REPO,
      branch: PDIR_BRANCH,
      path: PDIR_MAIN_FILE,
    });
    return { sha, data };
  },
  async publish(token, html, metadata, publishLocation, commitMessage) {
    // plainText template projection = raw markdown
    let text = stripFrontMatter(html);
    const forbidden = findForbiddenHeadings(text);
    if (forbidden.length) {
      const spots = forbidden.slice(0, 3)
        .map(h => `第${h.line + 1}行「${'#'.repeat(h.level)} ${h.title}」`)
        .join('、');
      throw new Error(`pdir 向文档需从 #### 起步：${spots} 会破坏模块结构，请调整后再发布。`);
    }

    progress('start', {
      title: `发布到 pdir › ${publishLocation.module}`,
      steps: [
        { key: 'source', label: '读取内容源', status: 'running' },
        { key: 'body', label: '写入正文' },
      ],
    });
    try {
      const { sha, data } = await this.downloadMainMd(token);
      const module = parsePdirModules(data).find(m => m.title === publishLocation.module);
      if (!module) {
        throw new Error(`pdir 模块「${publishLocation.module}」不存在，请重新选择模块。`);
      }
      const commitMsg = commitMessage || `Publish ${metadata.title} -> ${publishLocation.module}`;

      // Image pipeline: upload images first, then write the body
      const refs = listPrivateImgRefs(text);
      if (refs.length) {
        const shaByUri = {};
        const base64ByUri = {};
        let loadedCount = 0;
        await refs.reduce(async (promise, ref) => {
          await promise;
          if (!base64ByUri[ref.uri]) {
            loadedCount += 1;
            progress('setStep', { key: 'source', detail: `读取图片 ${loadedCount}/${refs.length}` });
            base64ByUri[ref.uri] = await loadImgBase64(ref.uri);
            shaByUri[ref.uri] = computeGitBlobShaFromBase64(base64ByUri[ref.uri]);
          }
        }, Promise.resolve());

        const tree = await githubHelper.getTree({
          token,
          owner: PDIR_OWNER,
          repo: PDIR_REPO,
          branch: PDIR_BRANCH,
        });
        const repoFiles = tree
          .filter(entry => entry.type === 'blob' && entry.path.startsWith('imgs/'))
          .map(entry => ({ name: entry.path.slice('imgs/'.length), sha: entry.sha }));

        const lines = data.split('\n');
        const moduleBody = lines.slice(module.bodyStart, module.bodyEnd).join('\n');
        const plan = planImageUploads({
          refs,
          moduleBody,
          mainMd: data,
          repoFiles,
          shaByUri,
        });

        progress('setSteps', [
          { key: 'source', label: '读取内容源', status: 'done' },
          ...plan.entries.map((entry, idx) => ({
            key: `img-${idx}`,
            label: `图片 ${idx + 1}/${plan.entries.length}`,
            detail: entry.action === 'reuse'
              ? `复用 ${entry.targetName}`
              : `${entry.targetName} ${entry.action === 'overwrite' ? '覆盖' : '上传'}`,
            status: entry.action === 'reuse' ? 'done' : 'pending',
            isImg: true,
          })),
          { key: 'body', label: '写入正文' },
        ]);

        await plan.entries.reduce(async (promise, entry, idx) => {
          await promise;
          if (entry.action === 'reuse') {
            return;
          }
          progress('setStep', { key: `img-${idx}`, status: 'running' });
          await githubHelper.uploadFile({
            token,
            owner: PDIR_OWNER,
            repo: PDIR_REPO,
            branch: PDIR_BRANCH,
            path: `imgs/${entry.targetName}`,
            content: base64ByUri[entry.uri],
            isImg: true,
            sha: entry.repoSha,
            commitMessage: commitMsg,
          });
          progress('setStep', { key: `img-${idx}`, status: 'done' });
        }, Promise.resolve());

        text = rewriteImgRefs(text, plan.replacementByUri);
        store.dispatch('notification/info', `pdir 图片：新传 ${plan.stats.upload}、复用 ${plan.stats.reuse}、覆盖 ${plan.stats.overwrite}。`);
      } else {
        progress('setStep', { key: 'source', status: 'done' });
      }

      progress('setStep', { key: 'body', status: 'running' });
      const newMain = replaceModuleBody(data, publishLocation.module, text);
      await githubHelper.uploadFile({
        token,
        owner: PDIR_OWNER,
        repo: PDIR_REPO,
        branch: PDIR_BRANCH,
        path: PDIR_MAIN_FILE,
        content: newMain,
        sha,
        commitMessage: commitMsg,
      });
      progress('finish');
      if (publishLocation.fileId) {
        store.dispatch('data/setPdirMark', {
          fileId: publishLocation.fileId,
          module: publishLocation.module,
        });
      }
      return publishLocation;
    } catch (err) {
      progress('fail', err && err.message);
      throw err;
    }
  },
  makeLocation(token, module) {
    return {
      providerId: this.id,
      sub: token.sub,
      module,
      templateId: 'plainText',
    };
  },
});
