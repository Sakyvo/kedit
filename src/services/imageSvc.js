import MD5 from 'crypto-js/md5';
import store from '../store';
import utils from './utils';
import localDbSvc from './localDbSvc';
import { getImageExt } from './imageTypeUtils';

const defaultWorkspaceImagePath = '/imgs/{YYYY}-{MM}-{DD}';

const getImagePath = (confPath, imgType) => {
  const time = new Date();
  const date = time.getDate();
  const month = time.getMonth() + 1;
  const year = time.getFullYear();
  const path = confPath.replace('{YYYY}', year).replace('{MM}', `0${month}`.slice(-2))
    .replace('{DD}', `0${date}`.slice(-2)).replace('{MDNAME}', store.getters['file/current'].name);
  return `${path}${path.endsWith('/') ? '' : '/'}${utils.uid()}.${getImageExt(imgType)}`;
};

export default {
  // 上传图片 返回图片链接
  // { url: 'http://xxxx', error: 'xxxxxx'}
  async updateImg(imgFile) {
    if (!store.getters['workspace/currentWorkspaceIsGit']) {
      return { error: '暂无已选择的图床！' };
    }
    const currStorage = store.getters['img/getCheckedStorage'];
    const workspaceImgPath = store.getters['img/getWorkspaceImgPath'] || {};
    const workspacePath = currStorage && currStorage.type === 'workspace' && currStorage.sub
      ? currStorage.sub
      : Object.keys(workspaceImgPath)[0] || defaultWorkspaceImagePath;
    const path = getImagePath(workspacePath, imgFile);
    const base64 = await utils.encodeFiletoBase64(imgFile);
    const currDirNode = store.getters['explorer/selectedNodeFolder'];
    const absolutePath = utils.getAbsoluteFilePath(currDirNode, path);
    await localDbSvc.saveImg({
      id: MD5(absolutePath).toString(),
      path: absolutePath,
      content: base64,
    });
    return { url: path.replaceAll(' ', '%20') };
  },
};
