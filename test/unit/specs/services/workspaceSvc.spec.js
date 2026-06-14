import store from '../../../../src/store';
import workspaceSvc from '../../../../src/services/workspaceSvc';

const clone = object => JSON.parse(JSON.stringify(object));

const deepAssign = (target, origin) => {
  Object.entries(origin).forEach(([key, value]) => {
    const type = Object.prototype.toString.call(value);
    if (type === '[object Object]' && Object.keys(value).length) {
      deepAssign(target[key], value);
    } else {
      target[key] = value;
    }
  });
};

const freshState = clone(store.state);

const restoreState = (target, origin) => {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  deepAssign(target, origin);
};

const mockNow = (value) => {
  const spy = jest.spyOn(Date, 'now');
  spy.mockReturnValue(value);
  return spy;
};

const visibleFileNames = () => store.getters['explorer/rootNode'].files
  .filter(node => !node.noDrag)
  .map(node => node.item.name);

const setFile = ({
  id,
  name,
  createdOn,
  updatedOn,
}) => store.commit('file/setItem', {
  id,
  type: 'file',
  name,
  parentId: null,
  createdOn,
  updatedOn,
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  restoreState(store.state, clone(freshState));
});

describe('workspaceSvc', () => {
  it('should stamp files on creation and metadata save', async () => {
    const dateSpy = mockNow(1000);
    const file = await workspaceSvc.createFile({ name: 'Doc' }, true);

    expect(file).toMatchObject({
      createdOn: 1000,
      updatedOn: 1000,
    });

    dateSpy.mockReturnValue(2000);
    const renamedFile = await workspaceSvc.storeItem({
      ...file,
      name: 'Renamed',
    });

    expect(renamedFile).toMatchObject({
      name: 'Renamed',
      createdOn: 1000,
      updatedOn: 2000,
    });
  });

  it('should update modified stamps on content saves', async () => {
    const dateSpy = mockNow(1000);
    const file = await workspaceSvc.createFile({ name: 'Doc' }, true);
    store.commit('file/setCurrentId', file.id);

    dateSpy.mockReturnValue(2000);
    await store.dispatch('content/patchCurrent', {
      text: 'Changed',
    });

    expect(store.state.file.itemsById[file.id]).toMatchObject({
      createdOn: 1000,
      updatedOn: 2000,
    });

    store.commit('file/setItem', {
      id: 'legacy',
      type: 'file',
      name: 'Legacy',
      parentId: null,
    });
    store.commit('content/setItem', {
      id: 'legacy/content',
      text: 'Legacy',
    });
    store.commit('file/setCurrentId', 'legacy');

    dateSpy.mockReturnValue(3000);
    await store.dispatch('content/patchCurrent', {
      text: 'Legacy changed',
    });

    expect(store.state.file.itemsById.legacy).toMatchObject({
      createdOn: 0,
      updatedOn: 3000,
    });
  });

  it('should move, duplicate, and export markdown files through service methods', async () => {
    const dateSpy = mockNow(1000);
    const folder = await workspaceSvc.storeItem({
      type: 'folder',
      name: 'Folder',
    });
    const file = await workspaceSvc.createFile({
      name: 'Doc',
      text: 'Text',
      properties: 'title: Doc',
      discussions: {
        d1: { start: 0, end: 4 },
      },
      comments: {
        c1: { discussionId: 'd1', content: 'Comment' },
      },
    }, true);

    const movedFile = await workspaceSvc.moveItem(file.id, folder.id);
    expect(movedFile.parentId).toEqual(folder.id);

    dateSpy.mockReturnValue(2000);
    const duplicate = await workspaceSvc.duplicateFile(file.id, null);
    const duplicateContent = store.state.content.itemsById[`${duplicate.id}/content`];

    expect(duplicate).toMatchObject({
      parentId: null,
      createdOn: 2000,
      updatedOn: 2000,
    });
    expect(duplicateContent).toMatchObject({
      text: 'Text\n',
      properties: 'title: Doc\n',
      discussions: {
        d1: { start: 0, end: 4 },
      },
      comments: {
        c1: { discussionId: 'd1', content: 'Comment' },
      },
    });
    expect(typeof workspaceSvc.exportMarkdown).toEqual('function');
  });

  it('should preserve empty content when duplicating files', async () => {
    mockNow(1000);
    const file = await workspaceSvc.createFile({
      name: 'Empty',
      text: '',
      properties: '',
    }, true);

    const duplicate = await workspaceSvc.duplicateFile(file.id);

    expect(store.state.content.itemsById[`${duplicate.id}/content`]).toMatchObject({
      text: '\n',
      properties: '\n',
    });
  });
});

describe('explorer sorting', () => {
  it('should sort files by configured field and direction', () => {
    setFile({
      id: 'legacy',
      name: 'Legacy',
    });
    setFile({
      id: 'old',
      name: 'Old',
      createdOn: 100,
      updatedOn: 100,
    });
    setFile({
      id: 'new',
      name: 'New',
      createdOn: 50,
      updatedOn: 200,
    });

    expect(visibleFileNames()).toEqual(['New', 'Old', 'Legacy']);

    store.commit('explorer/setSortBy', 'createdOn');
    store.commit('explorer/setSortDirection', 'asc');
    expect(visibleFileNames()).toEqual(['Legacy', 'New', 'Old']);

    store.commit('explorer/setSortBy', 'name');
    store.commit('explorer/setSortDirection', 'desc');
    expect(visibleFileNames()).toEqual(['Old', 'New', 'Legacy']);
  });
});
