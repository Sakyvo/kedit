import store from '../../store';
import githubHelper from './helpers/githubHelper';
import Provider from './common/Provider';
import {
  PDIR_OWNER,
  PDIR_REPO,
  PDIR_BRANCH,
  PDIR_MAIN_FILE,
  PDIR_SITE_URL,
  replaceModuleBody,
  listPrivateImgRefs,
  stripFrontMatter,
  findForbiddenHeadings,
} from './helpers/pdirPublishUtils';

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
    const text = stripFrontMatter(html);
    const forbidden = findForbiddenHeadings(text);
    if (forbidden.length) {
      const spots = forbidden.slice(0, 3)
        .map(h => `第${h.line + 1}行「${'#'.repeat(h.level)} ${h.title}」`)
        .join('、');
      throw new Error(`pdir 向文档需从 #### 起步：${spots} 会破坏模块结构，请调整后再发布。`);
    }
    if (listPrivateImgRefs(text).length) {
      throw new Error('文档引用了私有图片，图片管线尚未就绪，暂无法发布到 pdir。');
    }
    const { sha, data } = await this.downloadMainMd(token);
    const newMain = replaceModuleBody(data, publishLocation.module, text);
    if (newMain == null) {
      throw new Error(`pdir 模块「${publishLocation.module}」不存在，请重新选择模块。`);
    }
    await githubHelper.uploadFile({
      token,
      owner: PDIR_OWNER,
      repo: PDIR_REPO,
      branch: PDIR_BRANCH,
      path: PDIR_MAIN_FILE,
      content: newMain,
      sha,
      commitMessage: commitMessage || `Publish ${metadata.title} -> ${publishLocation.module}`,
    });
    return publishLocation;
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
