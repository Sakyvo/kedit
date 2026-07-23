<template>
  <div class="explorer-node" :class="{'explorer-node--selected': isSelected, 'explorer-node--folder': node.isFolder, 'explorer-node--open': isOpen, 'explorer-node--trash': node.isTrash, 'explorer-node--temp': node.isTemp, 'explorer-node--imgs': node.isImgs, 'explorer-node--drag-target': isDragTargetFolder}" :data-id="node.item.id" @dragover.prevent @dragenter.stop="node.noDrop || setDragTarget({ node })" @dragleave.stop="isDragTarget && setDragTarget()" @drop.prevent.stop="onDrop" @contextmenu="onContextMenu">
    <div class="explorer-node__item-editor" v-if="isEditing" :style="{paddingLeft: leftPadding}" draggable="true" @dragstart.stop.prevent>
      <input type="text" ref="editInput" class="text-input" @blur="submitEdit()" @keydown.stop @keydown.enter="submitEdit()" @keydown.esc.stop="submitEdit(true)" v-model="editingValue">
    </div>
    <div class="explorer-node__item" v-else :class="{'explorer-node__item--drop-above': dropPosition === 'above', 'explorer-node__item--drop-below': dropPosition === 'below'}" :style="{paddingLeft: leftPadding}" @click="onItemClick" :draggable="isDraggable" @dragstart.stop="setDragSourceId" @dragend.stop="setDragTarget()" @dragover.prevent.stop="onItemDragOver" @touchstart.passive="onTouchStart" @touchend="onTouchEnd" @touchmove="onTouchMove" @touchcancel="onTouchCancel">
      {{node.item.name}}
      <icon-provider class="explorer-node__location" v-for="location in node.locations" :key="location.id" :provider-id="location.providerId"></icon-provider>
    </div>
    <div class="explorer-node__children" v-if="node.isFolder && isOpen && !node.isImgs">
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
import providerRegistry from '../services/providers/common/providerRegistry';
import store from '../store';
import utils from '../services/utils';
import { isExplorerNodeDraggable } from '../services/explorerDragGate';

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
      // In positional mode the whole-folder highlight only applies to "drop into"
      const { dragTargetPosition } = store.state.explorer;
      if (dragTargetPosition && dragTargetPosition !== 'inside') {
        return false;
      }
      return this.equalNode(store.getters['explorer/dragTargetNodeFolder'], this.node);
    },
    isManualSortDrag() {
      const { sortBy, manualSortEnabled } = store.state.explorer;
      // Desktop: manual sort always positional; touch still needs move mode
      if (sortBy !== 'manual') {
        return false;
      }
      if (!('ontouchstart' in window)) {
        return true;
      }
      return !!manualSortEnabled;
    },
    isDraggable() {
      // Desktop: manual sort always draggable; touch still gated by move mode
      return isExplorerNodeDraggable({
        sortBy: store.state.explorer.sortBy,
        manualSortEnabled: store.state.explorer.manualSortEnabled,
        noDrag: this.node.noDrag,
        isTouch: 'ontouchstart' in window,
      });
    },
    dropPosition() {
      return this.isDragTarget ? store.state.explorer.dragTargetPosition : null;
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
      const targetNode = store.getters['explorer/dragTargetNode'];
      const targetFolderNode = store.getters['explorer/dragTargetNodeFolder'];
      const position = store.state.explorer.dragTargetPosition;
      const positional = this.isManualSortDrag;
      this.setDragTarget();
      if (sourceNode.isNil) {
        return;
      }
      if (positional) {
        this.executeManualDrop(sourceNode, targetNode, position);
        return;
      }
      // Legacy behavior: drop re-parents into the target folder
      if (!targetFolderNode.isNil
        && sourceNode.item.id !== targetFolderNode.item.id
      ) {
        workspaceSvc.storeItem({
          ...sourceNode.item,
          parentId: targetFolderNode.item.id,
        });
      }
    },
    getDropPosition(node, clientY, rect) {
      // Positional intent from the pointer Y within the item row
      if (node.isRoot || node.isTrash || node.item.id === 'fake'
        || (node.parentNode && node.parentNode.isTrash)
      ) {
        return 'inside';
      }
      const offset = (clientY - rect.top) / (rect.height || 1);
      if (node.isFolder) {
        if (offset < 1 / 3) {
          return 'above';
        }
        return offset > 2 / 3 ? 'below' : 'inside';
      }
      return offset < 0.5 ? 'above' : 'below';
    },
    onItemDragOver(evt) {
      if (!this.isManualSortDrag || this.node.noDrop) {
        return;
      }
      const position = this
        .getDropPosition(this.node, evt.clientY, evt.currentTarget.getBoundingClientRect());
      if (this.isDragTarget && store.state.explorer.dragTargetPosition === position) {
        return;
      }
      this.setDragTarget({ node: this.node, position });
    },
    async executeManualDrop(sourceNode, targetNode, position) {
      if (targetNode.isNil || sourceNode.item.id === targetNode.item.id) {
        return;
      }
      const rootNode = store.getters['explorer/rootNode'];
      const sourceId = sourceNode.item.id;

      // Resolve the destination parent
      let pos = position || 'inside';
      let parentNode;
      if (targetNode.item.id === 'fake') {
        parentNode = rootNode;
        pos = 'inside';
      } else if (targetNode.isTrash || targetNode.isTemp) {
        parentNode = targetNode;
      } else if (pos === 'inside') {
        parentNode = targetNode.isFolder ? targetNode : (targetNode.parentNode || rootNode);
        if (!targetNode.isFolder) {
          pos = 'below';
        }
      } else {
        parentNode = targetNode.parentNode || rootNode;
      }
      if (parentNode.isTrash) {
        // Keep the legacy "drop onto trash deletes" behavior; no reordering inside
        if (sourceNode.item.parentId !== 'trash') {
          workspaceSvc.storeItem({
            ...sourceNode.item,
            parentId: 'trash',
          });
        }
        return;
      }
      if (parentNode.isTemp) {
        return;
      }

      const newParentId = parentNode.isRoot ? null : parentNode.item.id;
      const crossParent = (sourceNode.item.parentId || null) !== newParentId;

      // Rebuild the destination parent's entry from its rendered order
      const folderIds = parentNode.folders
        .filter(child => !child.isTrash && !child.isTemp && !child.isImgs
          && child.item.id !== sourceId)
        .map(child => child.item.id);
      const fileIds = parentNode.files
        .filter(child => child.item.id !== 'fake' && child.item.id !== sourceId)
        .map(child => child.item.id);
      const group = sourceNode.isFolder ? folderIds : fileIds;
      let insertIdx = group.length;
      if (pos !== 'inside') {
        const idxInGroup = group.indexOf(targetNode.item.id);
        if (idxInGroup !== -1) {
          insertIdx = pos === 'above' ? idxInGroup : idxInGroup + 1;
        } else {
          // Target belongs to the other group: clamp to the folders/files boundary
          insertIdx = sourceNode.isFolder ? folderIds.length : 0;
        }
      }
      group.splice(insertIdx, 0, sourceId);

      const oldParentNode = sourceNode.parentNode;
      if (crossParent) {
        try {
          await workspaceSvc.storeItem({
            ...sourceNode.item,
            parentId: newParentId,
          });
        } catch (e) {
          return; // Canceled (e.g. path conflict dialog)
        }
      }

      // explorerOrder v2 entries store git paths: translate ids AFTER the
      // potential move so the source maps to its new path
      const gitPaths = store.getters.gitPathsByItemId;
      const toPaths = ids => ids.map(id => gitPaths[id]).filter(path => path);
      const parentKey = parentNode.isRoot ? 'root' : gitPaths[parentNode.item.id];
      if (!parentKey) {
        return;
      }
      const orderPatch = {
        [parentKey]: toPaths([...folderIds, ...fileIds]),
      };
      if (crossParent && oldParentNode
        && !oldParentNode.isTrash && !oldParentNode.isTemp
      ) {
        const oldParentKey = oldParentNode.isRoot ? 'root' : gitPaths[oldParentNode.item.id];
        if (oldParentKey && oldParentKey !== parentKey) {
          orderPatch[oldParentKey] = toPaths([
            ...oldParentNode.folders
              .filter(child => !child.isTrash && !child.isTemp && !child.isImgs),
            ...oldParentNode.files.filter(child => child.item.id !== 'fake'),
          ]
            .map(child => child.item.id)
            .filter(id => id !== sourceId));
        }
      }
      store.dispatch('data/patchExplorerOrder', orderPatch);
    },
    onContextMenu(evt) {
      evt.preventDefault();
      evt.stopPropagation();
      // Native long-press contextmenu (Android) while a touch drag is pending
      // or active would stack the menu overlay on top of the drag: suppress it
      if (this.touchGhost || (this.longPressTimer && this.touchStart)) {
        return;
      }
      this.openContextMenu({ left: evt.clientX, top: evt.clientY });
    },
    async openContextMenu(coordinates) {
      if (this.node.isImgs) {
        // The imgs placeholder is not a managed folder: no context menu
        return;
      }
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
          perform: () => this.openFolderPicker(),
        }, {
          name: '复制副本',
          disabled: !isFile || locked,
          perform: () => workspaceSvc.duplicateFile(this.node.item.id),
        }, {
          name: '导出 .md',
          disabled: !isFile || locked,
          perform: () => workspaceSvc.exportMarkdown(this.node.item.id),
        }, ...(isFile && this.node.item.parentId === 'trash' ? [{
          name: '永久删除',
          className: 'context-menu__item--danger',
          perform: () => explorerSvc.permanentlyDeleteItem(),
        }] : [{
          name: '删除',
          perform: () => explorerSvc.deleteItem(),
        }]), {
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
    async openFolderPicker() {
      try {
        const target = await store.dispatch('modal/open', {
          type: 'folderPicker',
          item: this.node.item,
        });
        const parentId = (target && target.id) || null;
        workspaceSvc.moveItem(this.node.item.id, parentId);
      } catch (e) {
        // Cancel
      }
    },
    async openImgsRepo() {
      const workspace = store.getters['workspace/currentWorkspace'];
      const provider = providerRegistry.providersById[workspace.providerId];
      const url = provider && provider.getFilePathUrl && provider.getFilePathUrl('/imgs');
      if (!url) {
        this.info('登录后才能访问数据仓库的图片目录。');
        return;
      }
      try {
        await store.dispatch('modal/open', 'imgsFolderJump');
        window.open(url, '_blank');
      } catch (e) {
        // Cancel
      }
    },
    onItemClick() {
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      if (this.node.isImgs) {
        // Placeholder node: never expands, offers a jump to the git repo instead
        this.openImgsRepo();
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
      if (this.isManualSortDrag && !this.node.noDrag && !this.node.isRoot) {
        // Long-press starts a positional touch drag (context menu suppressed)
        this.touchStart = { x: coordinates.left, y: coordinates.top };
        this.longPressTimer = setTimeout(() => {
          this.longPressTimer = null;
          this.startTouchDrag(coordinates.left, coordinates.top);
        }, 350);
        return;
      }
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        this.suppressClick = true;
        this.openContextMenu(coordinates);
      }, 500);
    },
    onTouchMove(evt) {
      const touch = evt.touches && evt.touches[0];
      if (!touch) {
        return;
      }
      if (this.touchGhost) {
        // Dragging: track the finger and keep the page from scrolling
        evt.preventDefault();
        this.lastTouch = { x: touch.clientX, y: touch.clientY };
        this.moveTouchGhost(touch.clientX, touch.clientY);
        this.updateTouchTarget(touch.clientX, touch.clientY);
        return;
      }
      if (this.longPressTimer && this.touchStart) {
        // Waiting for the drag long press: tolerate small jitter
        const dx = touch.clientX - this.touchStart.x;
        const dy = touch.clientY - this.touchStart.y;
        if ((dx * dx) + (dy * dy) > 64) {
          this.clearLongPress();
        } else {
          // Keep native scrolling from taking over (it would fire touchcancel
          // and kill the upcoming drag)
          evt.preventDefault();
        }
        return;
      }
      this.clearLongPress();
    },
    onTouchEnd() {
      if (this.touchGhost) {
        const sourceNode = store.getters['explorer/dragSourceNode'];
        const targetNode = store.getters['explorer/dragTargetNode'];
        const position = store.state.explorer.dragTargetPosition;
        this.stopTouchDrag();
        if (!sourceNode.isNil) {
          this.executeManualDrop(sourceNode, targetNode, position);
        }
        return;
      }
      this.clearLongPress();
    },
    onTouchCancel() {
      if (this.touchGhost) {
        this.stopTouchDrag();
        return;
      }
      this.clearLongPress();
    },
    startTouchDrag(x, y) {
      this.suppressClick = true;
      store.commit('explorer/setDragSourceId', this.node.item.id);
      const ghost = document.createElement('div');
      ghost.className = 'explorer-node__touch-ghost';
      ghost.textContent = this.node.item.name;
      document.body.appendChild(ghost);
      this.touchGhost = ghost;
      this.lastTouch = { x, y };
      this.moveTouchGhost(x, y);
      this.touchScroller = this.$el.closest('.explorer__tree');
      // Auto-scroll while the finger stays near the scroller edges
      this.touchScrollTimer = setInterval(() => this.touchEdgeScroll(), 50);
    },
    moveTouchGhost(x, y) {
      this.touchGhost.style.left = `${x}px`;
      this.touchGhost.style.top = `${y - 10}px`;
    },
    updateTouchTarget(x, y) {
      const elt = document.elementFromPoint(x, y);
      if (elt && elt.closest && elt.closest('.context-menu')) {
        // An overlay backdrop poisons hit testing: keep the previous target
        return;
      }
      const itemElt = elt && elt.closest && elt.closest('.explorer-node__item');
      const nodeElt = itemElt && itemElt.closest('.explorer-node');
      const nodeId = nodeElt && nodeElt.dataset.id;
      if (!nodeId) {
        return;
      }
      if (nodeId === 'fake') {
        store.commit('explorer/setDragTargetId', 'fake');
        store.commit('explorer/setDragTargetPosition', 'inside');
        return;
      }
      const node = store.getters['explorer/nodeMap'][nodeId];
      if (!node || node.noDrop) {
        return;
      }
      const position = this.getDropPosition(node, y, itemElt.getBoundingClientRect());
      if (store.state.explorer.dragTargetId === nodeId
        && store.state.explorer.dragTargetPosition === position
      ) {
        return;
      }
      this.setDragTarget({ node, position });
    },
    touchEdgeScroll() {
      if (!this.touchScroller || !this.lastTouch) {
        return;
      }
      const rect = this.touchScroller.getBoundingClientRect();
      let delta = 0;
      if (this.lastTouch.y < rect.top + 40) {
        delta = -10;
      } else if (this.lastTouch.y > rect.bottom - 40) {
        delta = 10;
      }
      if (delta) {
        this.touchScroller.scrollTop += delta;
        this.updateTouchTarget(this.lastTouch.x, this.lastTouch.y);
      }
    },
    stopTouchDrag() {
      clearInterval(this.touchScrollTimer);
      this.touchScrollTimer = null;
      if (this.touchGhost && this.touchGhost.parentNode) {
        this.touchGhost.parentNode.removeChild(this.touchGhost);
      }
      this.touchGhost = null;
      this.lastTouch = null;
      this.touchScroller = null;
      this.setDragTarget();
      store.commit('explorer/setDragSourceId', null);
      // A synthetic click may follow touchend; stop suppressing right after
      setTimeout(() => {
        this.suppressClick = false;
      }, 100);
    },
    clearLongPress() {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.touchStart = null;
    },
  },
  created() {
    // Non-reactive touch drag state
    this.touchStart = null;
    this.touchGhost = null;
    this.lastTouch = null;
    this.touchScroller = null;
    this.touchScrollTimer = null;
  },
  beforeUnmount() {
    this.clearLongPress();
    if (this.touchGhost) {
      this.stopTouchDrag();
    }
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
  /* long-press drag on touch devices must not trigger text selection */
  user-select: none;
  -webkit-touch-callout: none;

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
    /* equal gaps between multi-provider badges; pdir asset sits slightly left */
    margin: 2px 2px;
  }

  .explorer-node__location.icon-provider--pdir {
    transform: translateX(-1px);
  }
}

/* insertion indicators for positional (manual) drag */
.explorer-node__item--drop-above {
  box-shadow: inset 0 2px 0 0 #338dfc;
}

.explorer-node__item--drop-below {
  box-shadow: inset 0 -2px 0 0 #338dfc;
}

.explorer-node__touch-ghost {
  position: fixed;
  z-index: 1000;
  max-width: 240px;
  padding: 2px 10px;
  font-size: $item-font-size;
  background-color: rgba(51, 141, 252, 0.85);
  color: #fff;
  border-radius: 3px;
  pointer-events: none;
  transform: translate(-50%, -100%);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.explorer-node--trash,
.explorer-node--temp {
  color: rgba(0, 0, 0, 0.5);

  .app--dark & {
    color: rgba(255, 255, 255, 0.5);
  }
}

/* special node labels: trash red, temp yellow */
.explorer-node--trash > .explorer-node__item {
  color: #d32f2f;

  .app--dark & {
    color: #ef5350;
  }
}

.explorer-node--temp > .explorer-node__item {
  color: #a67c00;

  .app--dark & {
    color: #f8bb39;
  }
}

/* imgs placeholder: blue, jump-to-repo only */
.explorer-node--imgs > .explorer-node__item {
  color: #1565c0;

  .app--dark & {
    color: #64b5f6;
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
