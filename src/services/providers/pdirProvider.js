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
  parsePdirTargets,
  resolvePdirTarget,
  replacePdirTarget,
  findReplacedPdirTarget,
  listPrivateImgRefs,
  stripFrontMatter,
  validatePdirTargetContent,
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
    let text = `${stripFrontMatter(html)}`
      .replace(/^(?:[ \t]*\n)+/, '')
      .replace(/\s+$/, '');

    progress('start', {
      title: `发布到 pdir › ${publishLocation.module}`,
      steps: [
        { key: 'source', label: '读取内容源', status: 'running' },
        { key: 'body', label: '写入整段' },
      ],
    });
    try {
      const { sha, data } = await this.downloadMainMd(token);
      const target = resolvePdirTarget(parsePdirTargets(data), publishLocation);
      if (!target) {
        throw new Error(`pdir 目标「${publishLocation.module}」不存在，请重新选择。`);
      }
      const validationError = validatePdirTargetContent(text, target);
      if (validationError) {
        throw new Error(validationError);
      }
      const commitMsg = commitMessage || `Publish ${metadata.title} -> ${target.label}`;

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
        const targetBody = lines.slice(target.startLine, target.endLine).join('\n');
        const plan = planImageUploads({
          refs,
          moduleBody: targetBody,
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
          { key: 'body', label: '写入整段' },
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
      const newMain = replacePdirTarget(data, target, text);
      const updatedTarget = findReplacedPdirTarget(newMain, target);
      if (!updatedTarget) {
        throw new Error('发布内容无法形成有效的 pdir 编辑单元，请检查根标题。');
      }
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
      const updatedLocation = {
        ...publishLocation,
        module: updatedTarget.label,
        targetKey: updatedTarget.key,
        targetType: updatedTarget.type,
      };
      if (publishLocation.fileId) {
        store.dispatch('data/setPdirMark', {
          fileId: publishLocation.fileId,
          module: updatedTarget.label,
        });
      }
      return updatedLocation;
    } catch (err) {
      progress('fail', err && err.message);
      throw err;
    }
  },
  makeLocation(token, target) {
    return {
      providerId: this.id,
      sub: token.sub,
      module: target.label,
      targetKey: target.key,
      targetType: target.type,
      templateId: 'plainText',
    };
  },
});
