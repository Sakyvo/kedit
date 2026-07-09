import emptyFile from '../data/empties/emptyFile';
import emptyFolder from '../data/empties/emptyFolder';

const setter = propertyName => (state, value) => {
  state[propertyName] = value;
};

function debounceAction(action, wait) {
  let timeoutId;
  return (context) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => action(context), wait);
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const sortFields = ['manual', 'name', 'updatedOn', 'createdOn'];
const sortDirections = ['asc', 'desc'];
const normalizeSortField = value => (sortFields.includes(value) ? value : 'manual');
const normalizeSortDirection = value => (sortDirections.includes(value) ? value : 'desc');
const compareNames = (node1, node2) => collator.compare(node1.item.name, node2.item.name);
const getStamp = (item, field) => {
  const value = Number(item[field]);
  return Number.isFinite(value) ? value : 0;
};
const compare = ({ sortBy, sortDirection }) => (node1, node2) => {
  const field = normalizeSortField(sortBy);
  const direction = normalizeSortDirection(sortDirection);
  let result = field === 'name'
    ? compareNames(node1, node2)
    : getStamp(node1.item, field) - getStamp(node2.item, field);
  if (direction === 'desc') {
    result *= -1;
  }
  return result || compareNames(node1, node2);
};
const compareCreatedAsc = (node1, node2) =>
  (getStamp(node1.item, 'createdOn') - getStamp(node2.item, 'createdOn'))
    || compareNames(node1, node2);
// Manual mode: order by index in the explorerOrder entry,
// ids missing from the entry go to the end, oldest first
const sortNodesManually = (nodes, orderList) => {
  const indexById = {};
  orderList.forEach((id, index) => {
    indexById[id] = index;
  });
  nodes.sort((node1, node2) => {
    const index1 = indexById[node1.item.id];
    const index2 = indexById[node2.item.id];
    if (index1 !== undefined && index2 !== undefined) {
      return index1 - index2;
    }
    if (index1 !== undefined) {
      return -1;
    }
    if (index2 !== undefined) {
      return 1;
    }
    return compareCreatedAsc(node1, node2);
  });
};

class Node {
  constructor(item, locations = [], isFolder = false) {
    this.item = item;
    this.locations = locations;
    this.isFolder = isFolder;
    if (isFolder) {
      this.folders = [];
      this.files = [];
    }
  }

  sortChildren(sortOptions) {
    if (this.isFolder) {
      if (sortOptions.sortBy === 'manual' && !this.isTrash && !this.isTemp) {
        const orderList = sortOptions.explorerOrder[this.isRoot ? 'root' : this.item.id] || [];
        // Folders always render above files; each group follows the entry's relative order
        sortNodesManually(this.folders, orderList);
        sortNodesManually(this.files, orderList);
      } else {
        const compareNodes = compare(sortOptions);
        this.folders.sort(compareNodes);
        this.files.sort(compareNodes);
      }
      this.folders.forEach(child => child.sortChildren(sortOptions));
    }
  }
}

const nilFileNode = new Node(emptyFile());
nilFileNode.isNil = true;
const fakeFileNode = new Node(emptyFile());
fakeFileNode.item.id = 'fake';
fakeFileNode.noDrag = true;

function getParent({ item, isNil }, { nodeMap, rootNode }) {
  if (isNil) {
    return nilFileNode;
  }
  return nodeMap[item.parentId] || rootNode;
}

function getFolder(node, getters) {
  return node.item.type === 'folder' ?
    node :
    getParent(node, getters);
}

export default {
  namespaced: true,
  state: {
    selectedId: null,
    editingId: null,
    dragSourceId: null,
    dragTargetId: null,
    dragTargetPosition: null,
    newChildNode: nilFileNode,
    openNodes: {},
    sortBy: 'manual',
    sortDirection: 'desc',
    // In-memory only, defaults to locked on each session to prevent accidental drags
    manualSortEnabled: false,
  },
  mutations: {
    setSelectedId: setter('selectedId'),
    setEditingId: setter('editingId'),
    setDragSourceId: setter('dragSourceId'),
    setDragTargetId: setter('dragTargetId'),
    setDragTargetPosition: setter('dragTargetPosition'),
    setManualSortEnabled: setter('manualSortEnabled'),
    setSortBy(state, value) {
      state.sortBy = normalizeSortField(value);
    },
    setSortDirection(state, value) {
      state.sortDirection = normalizeSortDirection(value);
    },
    setNewItem(state, item) {
      state.newChildNode = item ? new Node(item, [], item.type === 'folder') : nilFileNode;
    },
    setNewItemName(state, name) {
      state.newChildNode.item.name = name;
    },
    toggleOpenNode(state, id) {
      state.openNodes[id] = !state.openNodes[id];
    },
  },
  getters: {
    nodeStructure: (state, getters, rootState, rootGetters) => {
      const rootNode = new Node(emptyFolder(), [], true);
      rootNode.isRoot = true;

      // Create Trash node
      const trashFolderNode = new Node(emptyFolder(), [], true);
      trashFolderNode.item.id = 'trash';
      trashFolderNode.item.name = '回收站';
      trashFolderNode.noDrag = true;
      trashFolderNode.isTrash = true;
      trashFolderNode.parentNode = rootNode;

      // Create Temp node
      const tempFolderNode = new Node(emptyFolder(), [], true);
      tempFolderNode.item.id = 'temp';
      tempFolderNode.item.name = '临时目录';
      tempFolderNode.noDrag = true;
      tempFolderNode.noDrop = true;
      tempFolderNode.isTemp = true;
      tempFolderNode.parentNode = rootNode;

      // Fill nodeMap with all file and folder nodes
      const nodeMap = {
        trash: trashFolderNode,
        temp: tempFolderNode,
      };
      rootGetters['folder/items'].forEach((item) => {
        nodeMap[item.id] = new Node(item, [], true);
      });
      const syncLocationsByFileId = rootGetters['syncLocation/filteredGroupedByFileId'];
      const publishLocationsByFileId = rootGetters['publishLocation/filteredGroupedByFileId'];
      rootGetters['file/items'].forEach((item) => {
        const locations = [
          ...syncLocationsByFileId[item.id] || [],
          ...publishLocationsByFileId[item.id] || [],
        ];
        nodeMap[item.id] = new Node(item, locations);
      });

      // Build the tree
      Object.entries(nodeMap).forEach(([, node]) => {
        let parentNode = nodeMap[node.item.parentId];
        if (!parentNode || !parentNode.isFolder) {
          if (node.isTrash || node.isTemp) {
            return;
          }
          parentNode = rootNode;
        }
        if (node.isFolder) {
          parentNode.folders.push(node);
        } else {
          parentNode.files.push(node);
        }
        node.parentNode = parentNode;
      });
      rootNode.sortChildren({
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        explorerOrder: rootGetters['data/explorerOrder'],
      });

      // Add Trash and Temp nodes
      rootNode.folders.unshift(tempFolderNode);
      tempFolderNode.files.forEach((node) => {
        node.noDrop = true;
      });
      rootNode.folders.unshift(trashFolderNode);

      // Add a fake file at the end of the root folder to allow drag and drop into it
      rootNode.files.push(fakeFileNode);
      return {
        nodeMap,
        rootNode,
      };
    },
    nodeMap: (state, { nodeStructure }) => nodeStructure.nodeMap,
    rootNode: (state, { nodeStructure }) => nodeStructure.rootNode,
    newChildNodeParent: (state, getters) => getParent(state.newChildNode, getters),
    selectedNode: ({ selectedId }, { nodeMap }) => nodeMap[selectedId] || nilFileNode,
    selectedNodeFolder: (state, getters) => getFolder(getters.selectedNode, getters),
    editingNode: ({ editingId }, { nodeMap }) => nodeMap[editingId] || nilFileNode,
    dragSourceNode: ({ dragSourceId }, { nodeMap }) => nodeMap[dragSourceId] || nilFileNode,
    dragTargetNode: ({ dragTargetId }, { nodeMap }) => {
      if (dragTargetId === 'fake') {
        return fakeFileNode;
      }
      return nodeMap[dragTargetId] || nilFileNode;
    },
    dragTargetNodeFolder: ({ dragTargetId }, getters) => {
      if (dragTargetId === 'fake') {
        return getters.rootNode;
      }
      return getFolder(getters.dragTargetNode, getters);
    },
  },
  actions: {
    init({ commit, rootGetters }) {
      // Sort mode is persisted per device in localSettings
      const localSettings = rootGetters['data/localSettings'];
      commit('setSortBy', localSettings.explorerSortBy);
      commit('setSortDirection', localSettings.explorerSortDirection);
    },
    setSortMode({ state, commit, dispatch }, { sortBy, sortDirection }) {
      commit('setSortBy', sortBy);
      if (sortDirection) {
        commit('setSortDirection', sortDirection);
      }
      dispatch('data/patchLocalSettings', {
        explorerSortBy: state.sortBy,
        explorerSortDirection: state.sortDirection,
      }, { root: true });
    },
    materializeOrder({
      state,
      getters,
      dispatch,
      rootGetters,
    }) {
      if (state.sortBy !== 'manual') {
        return;
      }
      const oldOrder = rootGetters['data/explorerOrder'];
      const newOrder = {};
      let changed = false;
      const walk = (node) => {
        if (node.isTrash || node.isTemp) {
          return;
        }
        const key = node.isRoot ? 'root' : node.item.id;
        const childIds = [
          ...node.folders.filter(child => !child.isTrash && !child.isTemp),
          ...node.files.filter(child => child.item.id !== 'fake'),
        ].map(child => child.item.id);
        const entry = oldOrder[key];
        if (!entry) {
          if (childIds.length) {
            // Snapshot the current rendered order (createdOn asc for unmapped ids)
            newOrder[key] = childIds;
            changed = true;
          }
        } else {
          // Compact: drop ids that are no longer children of this parent
          const childIdSet = new Set(childIds);
          const compacted = entry.filter(id => childIdSet.has(id));
          newOrder[key] = compacted;
          if (compacted.length !== entry.length) {
            changed = true;
          }
        }
        node.folders.forEach(walk);
      };
      walk(getters.rootNode);
      if (!changed) {
        // Entries for parents that no longer exist
        changed = Object.keys(oldOrder).some(key => !(key in newOrder));
      }
      if (changed) {
        dispatch('data/setExplorerOrder', newOrder, { root: true });
      }
    },
    openNode({
      state,
      getters,
      commit,
      dispatch,
    }, id) {
      const node = getters.nodeMap[id];
      if (node) {
        if (node.isFolder && !state.openNodes[id]) {
          commit('toggleOpenNode', id);
        }
        dispatch('openNode', node.item.parentId);
      }
    },
    openDragTarget: debounceAction(({ state, dispatch }) => {
      dispatch('openNode', state.dragTargetId);
    }, 1000),
    setDragTarget({ commit, getters, dispatch }, { node, position } = {}) {
      if (!node) {
        commit('setDragTargetId');
        commit('setDragTargetPosition', null);
      } else {
        // Make sure target node is not a child of source node
        const folderNode = getFolder(node, getters);
        const sourceId = getters.dragSourceNode.item.id;
        const { nodeMap } = getters;
        for (let parentNode = folderNode;
          parentNode;
          parentNode = nodeMap[parentNode.item.parentId]
        ) {
          if (parentNode.item.id === sourceId) {
            commit('setDragTargetId');
            commit('setDragTargetPosition', null);
            return;
          }
        }

        commit('setDragTargetId', node.item.id);
        commit('setDragTargetPosition', position || 'inside');
        if (!position || position === 'inside') {
          dispatch('openDragTarget');
        }
      }
    },
  },
};
