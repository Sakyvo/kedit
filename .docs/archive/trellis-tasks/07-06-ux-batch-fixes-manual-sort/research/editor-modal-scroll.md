# Research: UX batch fixes — new-file template, editor fake heading, modal X, logo assets, scrollbars, mobile scroll shortcut, TOC tap highlight

- **Query**: 7 codebase questions for task 07-06-ux-batch-fixes-manual-sort
- **Scope**: internal
- **Date**: 2026-07-06

All paths relative to repo root `K:\Projects\website\kedit`.

---

## 1. New file template ("> Written with KEDIT.")

Single source of the string: `src/data/defaults/defaultSettings.yml:121-125`

```yaml
# Default content for new files
newFileContent: |



  > Written with KEDIT.
```

(3 empty lines, then the quote line.) Also nearby: git commit message templates `... with KEDIT` at lines 116-118.

Applied in `src/services/workspaceSvc.js:31`:

```js
text: utils.sanitizeText(text ?? store.getters['data/computedSettings'].newFileContent),
```

So the default kicks in whenever `createFile` is called without `text`. `newFileProperties` (yml:128) is applied the same way at line 32-33. Settings are user-overridable: `src/store/data.js:156` loads the yml (`yaml.load(defaultSettings)`) and merges into `computedSettings`, so a user's custom settings can override `newFileContent`.

Creation paths:

| Path | text passed? | Result |
|---|---|---|
| Explorer "new file" — `src/components/ExplorerNode.vue:130` `workspaceSvc.createFile(newChildNode.item)` | no `text` field | gets `newFileContent` default |
| Welcome file — `src/services/localDbSvc.js:442-445` | `text: welcomeFile` from `src/data/welcomeFile.md` (import at localDbSvc.js:3) | own template, NOT newFileContent |
| Temp/light-mode file — `src/services/tempFileSvc.js:37-39` | `text: contentText \|\| '\n'` | empty, NOT newFileContent |
| Imports — `src/components/menus/ImportExportMenu.vue:83,94` | imported text | n/a |
| Provider opens (dropbox/github/gitee/gitcode/gitea/gitlab/gdrive providers, `backupSvc.js:64`) | remote text | n/a |

Welcome-file dedup hashes: `localDbSvc.js:403-412` hashes `welcomeFile.md` content into `welcomeFileHashes`; `syncSvc.js:278-282` treats such files as discardable. Changing `welcomeFile.md` changes its hash (old welcome files stop matching — relevant if editing templates).

---

## 2. Fake heading in edit view (setext misdetection)

### Editor-side grammar (Prism, used by cledit highlighter)

`src/services/markdownGrammarSvc.js` — `makeGrammars(options)` builds 5 grammars: `main`, `list`, `blockquote`, `table`, `deflist` (lines 50-56). Setext rules exist ONLY in `main`, lines 97-108:

```js
grammars.main['h1 alt cn-head'] = {
  pattern: /^.+\n[=]{2,}[ \t]*$/gm,
  inside: { 'cl cl-hash': /=+[ \t]*$/ },
};
grammars.main['h2 alt cn-head'] = {
  pattern: /^.+\n[-]{2,}[ \t]*$/gm,
  inside: { 'cl cl-hash': /-+[ \t]*$/ },
};
```

Key facts:

- **Insertion order = Prism priority.** In `grammars.main` the order is: `pre gfm cn-code` (86) → **h1 alt (97) → h2 alt (103)** → `cn-toc` (109) → ATX `h6..h1` (112-119) → ... → `hr` (152). So the setext-alt patterns win over BOTH the ATX heading patterns and `hr`.
- The pattern is pure regex, **no context checks**: any line (`.+`) directly followed by a `---`/`===` line matches. Concrete divergences vs preview:
  1. `# Title` followed by `---` (intended horizontal rule): preview renders ATX heading + `<hr>` (markdown-it: `heading` consumes the line, then `hr`); editor paints the whole two-line block as a big setext h2 (`h2 alt` matched before the ATX `h1 cn-head` rule).
  2. YAML front matter: `src/extensions/markdownExtension.js:78` registers `frontmatterRule` (`markdown.block.ruler.before('hr', 'frontmatter', frontmatterRule)`) for preview, but `markdownGrammarSvc.js` has **no frontmatter rule at all** (grep `frontmatter|yaml` → no matches). So the last front-matter line + closing `---` is painted as a setext h2 in the editor while the preview hides it.
  3. Multi-line paragraph `line1\nline2\n---`: preview makes the whole paragraph an h2 (lheading); editor only styles `line2` + dashes (regex only grabs one `.+` line). Cosmetic-only divergence.
  4. `[-]{2,}` / `[=]{2,}` require 2+ chars; markdown-it `lheading` accepts a single `-`/`=` (opposite-direction divergence: preview heading, editor plain).
- `hr` grammar (line 152: `/^ {0,3}([*\-_] *){3,}$/gm`) is registered AFTER the setext rules, so it never wins for a `---` preceded by a non-blank line.

### Preview side (markdown-it)

- `src/extensions/markdownExtension.js:23-35`: `blockBaseRules` includes `'lheading'` (line 31), enabled at line 77 (`markdown.block.ruler.enable(blockRules)`).
- Preview/editor share section splitting in `src/services/markdownConversionSvc.js:162-214` (`parseSections`): markdown-it tokens at level 0 decide each section's grammar (`data` = main/list/blockquote/table/deflist, lines 195-213); the editor then highlights each section with `grammars[section.data]` (line 277-278). So sections classified `list`/`table`/etc. can never get the setext styling — the fake heading only occurs inside `main` sections.

Recent related archive tasks (checked, none touch setext): `.trellis/tasks/archive/2026-07/06-06-list-autonumber`, `06-06-preview-frontend`, `06-06-preview-backend`, `06-06-toc-drawer` mention headings only re TOC/preview.

---

## 3. Modal X button behavior

### Store: `src/store/modal.js` (whole file, 42 lines)

- `state.stack` — array of modal configs; `open` (lines 19-32) prepends config with `resolve`/`reject` wired to a Promise, and the getter `config: ({ hidden, stack }) => !hidden && stack[0]` (line 16) shows the **top of stack only**. On settle, `finally` removes that config from the stack (line 29) — if a parent modal is still in the stack it becomes visible again automatically. So stacking support exists in the store.

### X button: `src/components/modals/common/ModalInner.vue:4`

```html
<button class="modal__close-button button not-tabbable" @click="config.reject()" v-title="'关闭窗口'">
```

X = `config.reject()` — rejects only the TOP modal's promise. Same as Esc (`Modal.vue:213-216` `onEscape` → `config.reject()` + refocus editor). `Modal.vue:11-13` simple modals also call `config.reject()/resolve()`.

### Component resolution: `src/components/Modal.vue`

- Rendered once in Layout; `currentModalComponent` (lines 183-193) maps `config.type` → `<Type>Modal` component; otherwise falls back to `simpleModals[config.type]` (`src/data/simpleModals`).

### "Parent menu" semantics

- The side-bar menus are NOT modals. `src/components/SideBar.vue:14-32` renders panels (`main-menu`, `sync-menu`, `publish-menu`, ...) driven by `data/layoutSettings.sideBarPanel` (line 87). Menus open modals via `store.dispatch('modal/open', ...)` — e.g. `MainMenu.vue:201,211,216,221,232` (fileProperties/settings/templates/accountManagement/about), `SyncMenu.vue:240+`, `PublishMenu.vue:254+`, `WorkspacesMenu.vue:72-129`, `ImportExportMenu.vue:108-118`. When X rejects the modal, the sidebar panel is untouched — the user is already "back at the parent menu"; the sidebar never closed.
- **Chained (sequential) modals**: e.g. `SyncMenu.vue:269` awaits `gitlabAccount` modal, then on resolve opens `gitlabWorkspace` (`WorkspacesMenu.vue:100-108` same pattern). These are sequential, not stacked: rejecting the second modal does NOT reopen the first — the caller's `try/catch` swallows the rejection and the whole flow aborts (e.g. `Modal.vue:199-211 sponsor()` pattern `catch (e) { /* cancel */ }`). "X returns to parent menu" would mean re-opening the previous modal type instead of aborting the chain, OR (for truly stacked modals) it already works via the stack.
- `hideUntil` (modal.js:33-40) temporarily hides the whole stack during an async op.

---

## 4. Logo assets

| Asset | Referenced by |
|---|---|
| `src/assets/logo.svg` | `src/styles/app.scss:346-347` `.logo-background { background: no-repeat center url('../assets/logo.svg') }`; used by `src/components/SplashScreen.vue:3` and `src/components/modals/AboutModal.vue:4` (size override at AboutModal.vue:57) |
| `src/assets/favicon.png` | `vite.config.js:12` (`faviconSource`), copied to `static/favicon.png` at build (vite.config.js:32); `vitePluginFaviconsInject('src/assets/favicon.png', ...)` at vite.config.js:111-114 generates favicons/apple-touch icons and injects `<link>` tags into `index.html` at build (root `index.html` has NO favicon link in source); PWA manifest icon `/static/favicon.png` (vite.config.js:128-135, VitePWA `manifest.icons`) |
| `src/assets/iconKedit.svg` | `src/icons/Provider.vue:57` (default provider icon background) |
| `static/landing/logo.svg` | landing page `static/landing/index.html:169` (`.splash-screen__logo`) |
| `static/landing/favicon.ico` | landing page `static/landing/index.html:7-8` |

NavigationBar (`src/components/NavigationBar.vue`) contains no logo image — grep for `logo` matches only app.scss/SplashScreen/AboutModal/MainMenu(`icon-logout`). PWA names: `vite.config.js:112` appName `'StackEdit中文版'` (favicons plugin) vs `vite.config.js:118-119` manifest name `'KEDIT'`.

---

## 5. Editor scrollbar too short

Scroller elements (native browser scrolling, no custom scrollbar component):

- **Editor scroller**: `.editor` div — `src/components/Editor.vue:165-170` (`position: absolute; width/height 100%; overflow: auto`). Content is the `<pre class="editor__inner">` (Editor.vue:3). Throughout the codebase the scroller is addressed as `editorSvc.editorElt.parentNode` (e.g. `src/services/editor/editorSvcUtils.js:16,45`, `src/components/Toc.vue:36,55`).
- **Preview scroller**: `.preview__inner-1` — `src/components/Preview.vue:3` (`@scroll="onScroll"`), style at Preview.vue:230-232 (`overflow: auto`); addressed as `editorSvc.previewElt.parentNode` (`editorSvcUtils.js:48`, `Toc.vue:37,60`).

Custom scrollbar CSS exists but is only styling of the native WebKit scrollbar, global in `src/styles/app.scss:22-47`:

```scss
::-webkit-scrollbar { &:horizontal { height: 8px; } &:vertical { width: 8px; } }
::-webkit-scrollbar-thumb { border-radius: 4px; background-color: #bbb; }  // #666 in .app--dark
```

No `min-height` is set on `::-webkit-scrollbar-thumb`, so thumb size is purely proportional → tiny on long docs. There is NO JS/overlay custom scrollbar anywhere (only other `::-webkit-scrollbar` uses: `NavigationBar.vue:235` hides it, `ChatGptModal.vue:492` styles a pre). Firefox gets fully native scrollbars. Scroll position save/restore: `editorSvcUtils.js` `getScrollPosition` (line 9-33) / `restoreScrollPosition` (36-49) operate on `scrollTop` of the parents, so any custom scrollbar must keep native scrolling of these elements intact.

---

## 6. Mobile browser top/bottom shortcut broken

Confirmed: the page itself never scrolls.

- `src/styles/app.scss:3-16`: `body { position: fixed; top/right/bottom/left: 0; overflow: hidden; -webkit-overflow-scrolling: touch; }` (comment: "Prevent body overscroll on Chrome").
- `index.html:12` — `<body id="app">`; the Vue app mounts into body; no page-level scroller.
- All scrolling happens in inner absolute containers: `.editor` (Editor.vue:165-170), `.preview__inner-1` (Preview.vue:230-232), sidebar `.side-bar__inner` (SideBar.vue:141 `overflow: auto`), modal `.modal` (Modal.vue:270 `overflow: auto`), `Layout.vue:188` overflow hidden.

Because `document`/`body` has zero scroll range, mobile browsers' "tap status bar / scroll-to-top(bottom) gesture" (which drives the window scroller) does nothing. A fix would need in-app top/bottom controls or scrolling the inner scroller programmatically.

---

## 7. TOC blue tap highlight on mobile

Component: `src/components/Toc.vue`.

- Click handler is attached to the WHOLE `.toc__inner` container, not per-entry: Toc.vue:26-40 (`tocElt.addEventListener('click', ...)`, resolves target via `e.target.closest('.cl-toc-section')`). This is why the mobile tap highlight covers the entire TOC panel — WebKit paints its default `-webkit-tap-highlight-color` over the element with the (delegated) click listener / its tap target.
- CSS on `.toc__inner` (Toc.vue:73-83): `cursor: pointer` + `user-select: none` (all vendor prefixes) — but **no `-webkit-tap-highlight-color` anywhere in the repo**: grep for `tap-highlight` across `src/` returns 0 matches (only `user-select` matches at `src/styles/app.scss:155-158`, `src/components/ContextMenu.vue:42`, `Toc.vue:80-83`). Nothing global disables the default blue flash.
- TOC entries are `.cl-toc-section` elements built by editorSvc (`src/services/editorSvc.js:255-298` manages `tocElt` children); highlight mask `.toc__mask` (Toc.vue:3, 129-139).
- TOC lives in the sidebar: `SideBar.vue:28-31` (`side-bar__panel--toc`, kept mounted, hidden via class).

---

## Related specs

- `.trellis/spec/frontend/`, `.trellis/spec/guides/` — not consulted in detail for this research (code-level questions); no spec file mentions setext/scrollbar specifics (grep in archive found only TOC/preview tasks: `.trellis/tasks/archive/2026-07/06-06-toc-drawer/prd.md`, `06-06-preview-frontend/prd.md`).

## Caveats / Not Found

- No existing custom scrollbar implementation to extend — would be new work (Q5).
- No `-webkit-tap-highlight-color` or `touch-action` rules exist anywhere (Q7) — the blue flash is pure browser default.
- Root `index.html` favicon links are build-time injected by `vite-plugin-favicons-inject`; don't look for them in source (Q4).
- The exact user repro for the fake heading wasn't given; the ATX-heading-followed-by-`---` and front-matter cases are the confirmed regex/parser divergences (Q2). CRLF is not a factor: cledit content always uses `\n` (see `parseSections` comment `markdownConversionSvc.js:168-171`).
