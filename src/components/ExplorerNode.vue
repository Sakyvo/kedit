<template>
  <div class="explorer-node" :class="{'explorer-node--selected': isSelected, 'explorer-node--folder': node.isFolder, 'explorer-node--open': isOpen, 'explorer-node--trash': node.isTrash, 'explorer-node--temp': node.isTemp, 'explorer-node--drag-target': isDragTargetFolder}" @dragover.prevent @dragenter.stop="node.noDrop || setDragTarget(node)" @dragleave.stop="isDragTarget && setDragTarget()" @drop.prevent.stop="onDrop" @contextmenu="onContextMenu">
    <div class="explorer-node__item-editor" v-if="isEditing" :style="{paddingLeft: leftPadding}" draggable="true" @dragstart.stop.prevent>
      <input type="text" ref="editInput" class="text-input" @blur="submitEdit()" @keydown.stop @keydown.enter="submitEdit()" @keydown.esc.stop="submitEdit(true)" v-model="editingValue">
    </div>
    <div class="explorer-node__item" v-else :style="{paddingLeft: leftPadding}" @click="onItemClick" draggable="true" @dragstart.stop="setDragSourceId" @dragend.stop="setDragTarget()" @touchstart.passive="onTouchStart" @touchend="clearLongPress" @touchmove="clearLongPress" @touchcancel="clearLongPress">
      {{node.item.name}}
      <icon-provider class="explorer-node__location" v-for="location in node.locations" :key="location.id" :provider-id="location.providerId"></icon-provider>
    </div>
    <div class="explorer-node__children" v-if="node.isFolder && isOpen">
      <explorer-node v-for="node in node.folders" :key="node.item.id" :node="node" :depth="depth + 1"></explorer-node>
      <div v-if="newChild" class="explorer-node__new-child" :class="{'explorer-node__new-child--folder': newChild.isFolder}" :style="{paddingLeft: childLeftPadding}">
        <input type="text" class="text-input" v-focus @blur="submitNewChild()" @keydown.stop @keydown.enter="submitNewChild()" @keydown.esc.stop="submitNewChild(true)" v-model.trim="newChildName">
      </div>
      <explorer-node v-for="node in node.files" :key="node.item.id" :node="node" :depth="depth + 1"></explorer-node>
    </div>
    <button ref="copyId" v-clipboard="copyPath()" @click="info('路径已复制到剪切板!')" style="display: none;"></button>
  </div>
</template>

<script>
import { mapMutations, mapActions } from 'vuex';
import workspaceSvc from '../services/workspaceSvc';
import explorerSvc from '../services/explorerSvc';
import store from '../store';
import utils from '../services/utils';

export default {
  name: 'explorer-node', // Required for recursivity
  props: ['node', 'depth'],
  data: () => ({
    editingValue: '',
    longPressTimer: null,
    suppressClick: false,
  }),
  computed: {
    leftPadding() {
      return `${this.depth * 15}px`;
    },
    childLeftPadding() {
      return `${(this.depth + 1) * 15}px`;
    },
    isSelected() {
      return this.equalNode(store.getters['explorer/selectedNode'] , this.node);
    },
    isEditing() {
      return this.equalNode(store.getters['explorer/editingNode'], this.node);
    },
    isDragTarget() {
      return this.equalNode(store.getters['explorer/dragTargetNode'], this.node);
    },
    isDragTargetFolder() {
      return this.equalNode(store.getters['explorer/dragTargetNodeFolder'], this.node);
    },
    isOpen() {
      return store.state.explorer.openNodes[this.node.item.id] || this.node.isRoot;
    },
    newChild() {
      return this.equalNode(store.getters['explorer/newChildNodeParent'], this.node)
        && store.state.explorer.newChildNode;
    },
    newChildName: {
      get() {
        return store.state.explorer.newChildNode.item.name;
      },
      set(value) {
        store.commit('explorer/setNewItemName', value);
      },
    },
  },
  watch: {
    isEditing(editing) {
      if (editing) {
        this.editingValue = store.getters['explorer/editingNode'].item.name;
        this.$nextTick(() => {
          const input = this.$refs.editInput;
          if (input) {
            input.focus();
            input.select();
          }
        });
      }
    },
  },
  methods: {
    ...mapMutations('explorer', [
      'setEditingId',
    ]),
    ...mapActions('explorer', [
      'setDragTarget',
    ]),
    ...mapActions('notification', [
      'info',
    ]),
    equalNode(node1, node2) {
      if (!node1 || !node2) {
        return false;
      }
      if (node1.isRoot && node2.isRoot) {
        return true;
      }
      return node1.item && node2.item && node1.item.id && node1.item.id === node2.item.id;
    },
    select(id = this.node.item.id, doOpen = true) {
      const node = store.getters['explorer/nodeMap'][id];
      if (!node) {
        return false;
      }
      store.commit('explorer/setSelectedId', id);
      if (doOpen) {
        // Prevent from freezing the UI while loading the file
        setTimeout(() => {
          if (node.isFolder) {
            store.commit('explorer/toggleOpenNode', id);
          } else if (store.state.file.currentId !== id) {
            store.commit('file/setCurrentId', id);
          }
        }, 10);
      }
      return true;
    },
    async submitNewChild(cancel) {
      const { newChildNode } = store.state.explorer;
      if (!cancel && !newChildNode.isNil && newChildNode.item.name) {
        try {
          if (newChildNode.isFolder) {
            const item = await workspaceSvc.storeItem(newChildNode.item);
            this.select(item.id);
          } else {
            const item = await workspaceSvc.createFile(newChildNode.item);
            this.select(item.id);
          }
        } catch (e) {
          // Cancel
        }
      }
      store.commit('explorer/setNewItem', null);
    },
    async submitEdit(cancel) {
      const { item, isFolder } = store.getters['explorer/editingNode'];
      const value = this.editingValue;
      this.setEditingId(null);
      if (!cancel && item.id && value && item.name !== value) {
        try {
          await workspaceSvc.storeItem({
            ...item,
            name: value,
          });
        } catch (e) {
          // Cancel
        }
      }
    },
    setDragSourceId(evt) {
      if (this.node.noDrag) {
        evt.preventDefault();
        return;
      }
      store.commit('explorer/setDragSourceId', this.node.item.id);
      // Fix for Firefox
      // See https://stackoverflow.com/a/3977637/1333165
      evt.dataTransfer.setData('Text', '');
    },
    copyPath() {
      let path = utils.getAbsoluteDir(this.node).replaceAll(' ', '%20');
      path = path.indexOf('/') === 0 ? path : `/${path}`;
      return this.node.isFolder ? path : `${path}.md`;
    },
    onDrop() {
      const sourceNode = store.getters['explorer/dragSourceNode'];
      const targetNode = store.getters['explorer/dragTargetNodeFolder'];
      this.setDragTarget();
      if (!sourceNode.isNil
        && !targetNode.isNil
        && sourceNode.item.id !== targetNode.item.id
      ) {
        workspaceSvc.storeItem({
          ...sourceNode.item,
          parentId: targetNode.item.id,
        });
      }
    },
    onContextMenu(evt) {
      evt.preventDefault();
      evt.stopPropagation();
      this.openContextMenu({ left: evt.clientX, top: evt.clientY });
    },
    async openContextMenu(coordinates) {
      if (!this.select(undefined, false)) {
        return;
      }
      const isFile = !this.node.isFolder;
      const locked = this.node.isTrash || this.node.isTemp;
      const item = await store.dispatch('contextMenu/open', {
        coordinates,
        items: [{
          name: '新建文件',
          disabled: !this.node.isFolder || this.node.isTrash,
          perform: () => explorerSvc.newItem(false),
        }, {
          name: '新建文件夹',
          disabled: !this.node.isFolder || this.node.isTrash || this.node.isTemp,
          perform: () => explorerSvc.newItem(true),
        }, {
          type: 'separator',
        }, {
          name: '重命名',
          disabled: locked,
          perform: () => this.setEditingId(this.node.item.id),
        }, {
          name: '移动到…',
          disabled: locked || this.node.noDrag,
          perform: () => this.openMovePicker(coordinates),
        }, {
          name: '复制副本',
          disabled: !isFile || locked,
          perform: () => workspaceSvc.duplicateFile(this.node.item.id),
        }, {
          name: '导出 .md',
          disabled: !isFile || locked,
          perform: () => workspaceSvc.exportMarkdown(this.node.item.id),
        }, {
          name: '删除',
          perform: () => explorerSvc.deleteItem(),
        }, {
          type: 'separator',
        }, {
          name: '复制路径',
          disabled: locked,
          perform: () => this.$refs.copyId.click(),
        }],
      });
      if (item) {
        item.perform();
      }
    },
    async openMovePicker(coordinates) {
      const target = await store.dispatch('contextMenu/open', {
        coordinates,
        items: this.buildMoveTargets(),
      });
      if (target) {
        target.perform();
      }
    },
    buildMoveTargets() {
      const sourceId = this.node.item.id;
      const currentParentId = this.node.item.parentId || null;
      const targets = [{
        name: '根目录',
        disabled: currentParentId === null,
        perform: () => workspaceSvc.moveItem(sourceId, null),
      }];
      const walk = (folderNode, depth) => {
        folderNode.folders.forEach((folder) => {
          if (folder.isTrash || folder.isTemp || folder.item.id === sourceId) {
            return;
          }
          targets.push({
            name: `${'　'.repeat(depth + 1)}${folder.item.name}`,
            disabled: folder.item.id === currentParentId,
            perform: () => workspaceSvc.moveItem(sourceId, folder.item.id),
          });
          walk(folder, depth + 1);
        });
      };
      walk(store.getters['explorer/rootNode'], 0);
      return targets;
    },
    onItemClick() {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      this.select();
    },
    onTouchStart(evt) {
      this.clearLongPress();
      const touch = evt.touches && evt.touches[0];
      const coordinates = touch
        ? { left: touch.clientX, top: touch.clientY }
        : { left: 0, top: 0 };
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        this.suppressClick = true;
        this.openContextMenu(coordinates);
      }, 500);
    },
    clearLongPress() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    },
  },
};
</script>

<style lang="scss">
$item-font-size: 14px;

.explorer-node--drag-target {
  background-color: rgba(0, 128, 255, 0.2);
}

.explorer-node__item {
  position: relative;
  cursor: pointer;
  font-size: $item-font-size;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding-right: 5px;

  .explorer-node--selected > & {
    background-color: rgba(0, 0, 0, 0.2);

    .app--dark & {
      background-color: rgba(0, 0, 0, 0.4);
    }

    .explorer__tree:focus & {
      background-color: #39f;
      color: #fff;
    }
  }

  .explorer__tree--new-item & {
    opacity: 0.33;
  }

  .explorer-node__location {
    float: right;
    width: 18px;
    height: 18px;
    margin: 2px 1px;
  }
}

.explorer-node--trash,
.explorer-node--temp {
  color: rgba(0, 0, 0, 0.5);

  .app--dark & {
    color: rgba(255, 255, 255, 0.5);
  }
}

.explorer-node--folder > .explorer-node__item,
.explorer-node--folder > .explorer-node__item-editor,
.explorer-node__new-child--folder {
  &::before {
    content: '▹';
    position: absolute;
    margin-left: -13px;
  }
}

.explorer-node--folder.explorer-node--open > .explorer-node__item,
.explorer-node--folder.explorer-node--open > .explorer-node__item-editor {
  &::before {
    content: '▾';
  }
}

$new-child-height: 25px;

.explorer-node__item-editor,
.explorer-node__new-child {
  padding: 1px 10px;

  .text-input {
    font-size: $item-font-size;
    padding: 2px;
    height: $new-child-height;
  }
}
</style>
