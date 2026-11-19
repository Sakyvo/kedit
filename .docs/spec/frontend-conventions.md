# Frontend Conventions

> 由 Trellis spec 迁移合并：component-guidelines + hook-guidelines + type-safety + quality-guidelines（2026-07-14）。

### Components (SFC)

### Overview

Components are Vue single-file components using the Options API. They commonly
read from the shared Vuex store, call services for side effects, and keep
transient UI-only state in `data()`.

### Component Structure

The usual order is:

```text
<template>
<script>
<style lang="scss">
```

Use the existing style in nearby components. `ExplorerNode.vue` is a typical
recursive component with:

- `props` for caller-provided node/depth data.
- `computed` getters that derive display state from Vuex.
- `methods` that call Vuex mutations/actions and services.
- BEM-like SCSS classes under a component root class.

### Props Conventions

- Existing older components often use array props such as
  `props: ['node', 'depth']`.
- New or significantly edited shared components should prefer object prop
  declarations with `type` and defaults, as in `DropdownMenu.vue`.
- Keep prop names aligned with domain terms (`node`, `file`, `workspace`,
  `location`, `providerId`) instead of generic names.
- Do not mutate props directly; update Vuex state or emit events.

### Store and Service Interaction

- Use Vuex for shared application state. Existing components mix direct
  `store.commit(...)` calls with `mapActions` / `mapMutations`.
- Use services for side effects: `workspaceSvc`, `explorerSvc`, `badgeSvc`,
  provider helpers, etc.
- Keep expensive or cross-component logic out of template expressions.
- Preserve async UI behavior that avoids blocking the editor. For example,
  `ExplorerNode.vue` uses a short timeout before opening files/folders.

### Styling Patterns

- Component styles use SCSS in the SFC unless the style is global.
- Global app/theme styles live in `src/styles/`.
- Existing classes are BEM-like: `explorer-node__item`,
  `explorer-node--selected`.
- Use existing theme hooks such as `.app--dark &` when adding dark-mode
  variants.
- Avoid new styling systems or dependencies.
- 预览与编辑区排版同源：断词/换行类声明（`overflow-wrap` / `white-space` /
  `word-break`）两侧成对；预览与导出 HTML 的容器根（`.cl-preview-section`,
  `.stackedit__html`）用 `overflow-wrap: anywhere`，对应编辑区 `.editor__inner`
  的 `word-break: break-word`。改一侧必须同步另一侧。
- 分割线外观归 KEDIT：预览与导出容器内 `hr` 的三档外观（颜色 + 粗细 + 盒模型）
  由 KEDIT 独占并 `!important` 声明；`static/themes/*.js` 不得再写 `hr` / `.hr`
  外观规则（用户自定义主题同理无效，见 ADR 0017）。

### Startup Loading

- 启动画面不依赖主 JS、外部图片或字体；保持到 Layout 可显示，
  不因 Vue 挂载提前移除，不设置人为最短停留时间。
- 非基础编辑必需的重型渲染器按内容需要加载；失败不得阻塞编辑。
  调整加载时机须回归预览、导出及 SW 预缓存行为。
- 启动性能区分无缓存冷访问与缓存回访；记录测试条件，
  同时比较首屏必需资源总量、首次可见和文档可编辑时间。

### First Paint and Precache Boundaries

- 保留不依赖外部资源的 HTML 启动画面；预加载只提前发现基础编辑所需的
  生产资源，不执行应用或提前开放编辑。URL 从当次构建依赖关系取得，
  不硬编码 hash，不把可选渲染器重新塞入首屏预加载链。
- 首装 precache 只包含可启动、可基础编辑的外壳及其必要依赖；
  Mermaid、KaTeX、ABC 等可选渲染资源按使用缓存，覆盖各自 chunk、CSS、字体依赖。
  首次未使用的功能不承诺离线可用；成功缓存后的功能须验证离线重开。
- 非基础编辑所需的 About Logo、成套设备启动图不进入首装 precache。
  删除资源或规则前核对所有调用者；精简 HTML 图标声明须保留桌面/iOS 图标
  和一个有效 PWA manifest，不能把声明数量当成实际下载数量。
- 运行时缓存限定为 KEDIT 自有静态资源；不得兜底缓存 OAuth、API、Sync、
  Document 或 Private image。缓存安装/更新失败不得破坏可用版本或未保存编辑。
- 改加载/缓存策略须同时记录首次进入编辑与 SW 安装完成的时序，区分
  HTTP 缓存、SW CacheStorage 和部署版本。不能由 max-age、CDN HIT/MISS、
  文件体积或 precache 清单推断 Author 设备的缓存命中、安装失败或网络根因。

### Accessibility

- Reuse the global `v-title` directive when an element needs both `title` and
  `aria-label`; it is registered in `src/main.js`.
- Preserve keyboard handlers on editable controls, such as Enter/Escape flows
  in `ExplorerNode.vue`.
- Icon-only controls need accessible labels through existing directives or
  attributes.

### Common Mistakes

- Duplicating service logic inside a component instead of extending
  `src/services/`.
- Adding local component state for data already owned by Vuex.
- Introducing Composition API style into an area that otherwise uses Options
  API without a task-level reason.
- Renaming visible StackEdit strings together with persisted identifiers. Only
  user-visible branding was rebranded to KEDIT.

### Selection Colors (single source)

Editor selection colours live in exactly one place: the `--selection-bg` /
`--selection-fg` pair (light and dark theme values). `::selection`,
`::highlight(...)` and any editor-drawn selection fill block must all reference
that pair — never restate a literal colour in one channel only. A column/block
selection must be indistinguishable in colour from an ordinary text selection.

Editor overlays that mark a selection must never paint where there is no text:
no full-band rectangle, no decorative block over trailing whitespace or empty
paragraphs. Fill only the parts of a real text row (line-height bounded) that
the selection actually covers, and let the gesture not start at all when the
press point has no text row.

### Configurable Visual Sizes (CSS variables)

A visual size the Author can configure (line-height offsets, future spacing
knobs) flows one way: `defaultSettings.yml` key → `computedSettings` → a CSS
custom property set once on the app root (`.app`, inline style from `App.vue`)
→ SCSS consumes it. Do not hardcode the value in a component style, and do not
bind the same value separately in two components.

Always give `var()` a fallback equal to the default, e.g.
`var(--kedit-soft-wrap-offset, -2px)`: `src/styles/base.scss` is reachable from
templates that never render under `.app` (export / self-contained HTML), where
an unresolved `var()` drops the whole declaration and silently falls back to the
browser default line-height.

Contexts with different bases (prose `1.67em` vs code blocks `1.33em`) need
their own override of every derived property (`line-height`, `vertical-align`,
spacer height) — one variable does not flatten them.

### Editor Line Numbers

- Number Markdown source lines from 1, including empty lines; show 1 for an
  empty Document. Soft-wrapped continuations have no number or wrap marker.
- Reserve a compact, fixed gutter for four monospaced digits plus minimal
  padding. Right-align numbers without leading zeroes. Five or more digits
  overflow left without widening the gutter or changing the text layout.
- Use a subtle theme-aware gutter background across the visible editor
  height, including blank space below the Document.
- Disabling line numbers hides both numbers and the gutter background but
  preserves layout space. Toggling must not move the text's left edge,
  change its interactive width, or alter soft-wrap positions.
- Show numbers only beside the Markdown editing area, aligned with each
  source line's first visual row through scrolling and layout changes.
- Keep line-number alignment stable when an empty source line gains text
  or becomes empty again; do not compensate with a blanket pixel offset.
- Preserve configured line-height offsets during IME composition. Composition
  start, update, commit, and cancel must not move adjacent empty source lines;
  do not temporarily flatten line heights. Consecutive empty lines are the
  target boundary; an intervening content line is a control case.
- Line-number digits must share the editor text's native scrolling displacement;
  do not use per-scroll JavaScript repositioning as the synchronization
  mechanism. Keep the gutter background covering the visible editor height.
- At viewport widths <=600 CSS px, use a 22px button bar, a 12px minimum
  editor right padding, and line-number text at 0.75em with a 12px floor.
  Keep four-digit capacity, unchanged body font size, all controls, and
  unchanged vertical button hit areas. Keep wider layouts unchanged.
- Default to enabled. Expose “显示行号” in 配置 → 性能, below the dynamic-loading
  controls. Apply it on 确认 through the existing settings flow; sync the top-level
  `lineNumbers` key by default.
- Keep numbers outside editable/copied content. Do not add line selection,
  current-line highlighting, sidebar entries, or shortcuts.

### Editor Hot-Path Geometry (cledit)

`cledit.Utils.findContainer` / `selectionMgr.getCoordinates` walk the whole
content DOM per call — O(document text). NEVER call them inside mousemove /
scroll / drag hot paths (batch them once per frame at most). Line-level
geometry for editor overlays must come from band-scanning
`Range.getClientRects()` over only the nodes intersecting the target vertical
band (prune by section element boundingRect first). Overlay containers
mounted on the scroll element need an explicit `left:0;top:0` origin —
auto-positioned absolute containers land at their static flow position
(below the content) and every child coordinate silently shifts.

### Editor Inline Image Card Order

An inline image card (`.img-wrapper`) shows two halves: the rendered `<img>`
and its raw `![alt](uri)` source text. `配置 → 性能 → 图片显示` picks their
vertical order (`editor.inlineImageOrder`, `image-above` default /
`text-above`).

- The order is decided **in the style layer only**: the wrapper stacks its two
  children in a flex column and `text-above` merely flips
  `flex-direction: column-reverse`. The DOM order stays image-first forever
  (ADR 0016). cledit rebuilds every card on each re-highlight, so making DOM
  order follow the setting would force a full re-highlight per toggle; the CSS
  flip is instant, rebuild-free and flicker-free.
- Do not let this order leak into geometry: the `<img>` is decoration, not
  editor text, so caret/selection positions are untouched, and
  `measureMarkerPrefixRoom` / `measureInlineRoom` measure outside the wrapper
  (`range.setEndBefore(wrapper)`) — ADR 0006's marker-pinning and shrink rules
  stay exactly as they are.
- Editor-only. Preview, export and Publish render the image alone; there is no
  source text to order.

### Modal Spacing and Sticky Bars

Every modal's whitespace comes from one place: `Modal.vue`'s `.modal__inner-2`,
`.modal__button-bar` and `.form-entry`. Baseline (2026-07 compact):
`.modal__inner-2 { margin: 16px 10px 32px; padding: 20px 20px 14px }`,
`.modal__button-bar { margin: 0.5rem -20px -14px; padding: 10px 20px 10px;
bottom: -14px }`, `.form-entry { margin: 0.5em 0 }`.

- **Coupling iron rule**: the sticky header's cover must equal the top padding
  — `.modal__inner-2 .tabs`, `.modal__title` use `box-shadow: 0 -Npx` with
  N = `padding-top`, and `.tabs` uses `margin: 0 -Npx; padding: 0 Npx` with the
  same N; `.modal__button-bar`'s negative margin + `bottom` must equal the
  matching paddings. Change the inner padding and you MUST change all three
  spots together, or scrolled content bleeds through above the tabs / the
  button bar drifts off the panel edge.
- Settings modal only (`.modal__inner-1--settings` prefix): fields go
  single-row — label `1fr` (may wrap) + control fixed 170px on the right,
  `textfield` height 1.9rem / font 0.95em, section title `8px 0 2px` at 14px,
  header-button rows with 20px icons and a 120px shortcut field. Textarea
  fields opt out of the fixed width (`wide` on `FormEntry`). Never scope these
  to a shared class — other modals keep label-above/full-width fields.
- **Mobile modal (≤600 CSS px)**: the panel is flush with the viewport on all
  four sides — `.modal__inner-1` loses its `max-width`/`min-width` (otherwise a
  per-modal cap leaves side bands between 481 and 600px), `.modal__inner-2`
  drops both margins and its border radius, `max-height` becomes `100vh`,
  padding goes 20px → 12px, and the iron rule's `N` above becomes 12 (cover
  shadow, tabs negative margin/padding, button-bar negative margin + `bottom`).
  Type drops one step: title 20px, tabs `1em`, form label `0.8rem`. Buttons and
  `textfield` stay at 16px — the touch target never shrinks with the type.
  Above 600px nothing changes. Verified by `test/browser/mobile-modal.mjs`
  (390 / 590 / 601 / 1280 px against the real build).

### 窄屏侧边栏关闭语义 (layoutOverflow)

侧栏在窄屏是覆盖文档的全宽面板，桌面端是文档旁的固定列。任何面板内的点击若已把
结果显示到文档区（如「文件历史」选中一个版本、diff 已打在编辑/预览上），必须在
`styles.layoutOverflow` 为真时关闭侧栏、回到文档；桌面端保持侧栏不动。既是
「关掉了一个看不见的内容面板」，也是这条规则与目录面板回退语义（批 016 切片 2）
同族的唯一理由。

### Overlay Z-Index Ladder

Fixed stacking order for app-level overlays (established 2026-07; keep new
overlays consistent and never rely on DOM order alone once any layer has an
explicit z-index):

- `CustomScrollbar` 1 (panel-local)
- `PublishProgressPopup` 50 (publish progress floating card/pill)
- `.modal` 100
- `.notification` 200
- `.context-menu` 300
- `ImageLightbox` 1000

`.editor`/`.layout` ancestors create no stacking context, so any explicit
z-index inside them competes at root level — pick values from this ladder.

### Hooks（无 hook 模式与指令替代）

### Overview

This project does not use React hooks or Vue Composition API composables as a
primary pattern. Shared stateful logic lives in Vuex modules, services, global
directives, and optional service registration modules.

### Shared Stateful Logic

Use these existing mechanisms before adding a new pattern:

- Vuex modules in `src/store/` for shared app state.
- Services in `src/services/` for side effects and orchestration.
- Provider classes/helpers under `src/services/providers/`.
- Global directives in `src/main.js` for small DOM behaviors such as `v-focus`,
  `v-title`, and `v-clipboard`.
- Optional feature modules in `src/services/optional/` for opt-in editor
  behavior registration.

### Data Fetching

There is no React Query/SWR-style fetch layer. Data comes from:

- Browser IndexedDB/localStorage through `localDbSvc`.
- Provider services for GitHub, Gitee, GitLab, Gitea, GitCode, Google Drive,
  Dropbox, etc.
- Flask support endpoints for OAuth token exchange, `/conf`, and export.

Provider and sync changes should follow `syncSvc.js`, `workspaceSvc.js`, and
`src/services/providers/common/Provider.js` instead of creating hook-like
fetch wrappers.

### Naming Conventions

- Do not create `use*` composables unless a task explicitly moves an area toward
  Composition API.
- Service objects use `*Svc.js` names (`localDbSvc`, `workspaceImageSvc`).
- Provider helpers use `<provider>Helper.js`.

### Common Mistakes

- Adding a composable for logic that already belongs to a Vuex module or
  service.
- Fetching provider data directly from components instead of going through the
  provider/service layer.
- Creating another global event mechanism when Vuex or `mitt`-based existing
  services already cover the case.

### Type Safety (JS Contracts)

### Overview

The frontend is JavaScript, not TypeScript. Type safety comes from stable item
shapes, empty factories, runtime normalization, focused utilities, and tests.
Do not invent TypeScript-only conventions for this codebase.

### Shape Organization

- Persisted item defaults live under `src/data/empties/`.
- Store modules use those empty factories when setting or patching items.
- Shared constants live under `src/data/constants.js` and related data files.
- Provider content serialization shape is centralized in
  `src/services/providers/common/Provider.js`.

### Runtime Validation and Normalization

Existing patterns include:

- `utils.sanitizeText(...)` before storing content parsed from providers.
- `htmlSanitizer.sanitizeHtml(...)` and `sanitizeUri(...)` for rendered HTML.
- `imageTypeUtils.js` for MIME/extension normalization.
- Explicit fallback behavior, for example `getImageExt(..., "png")` and PDF
  page size fallback to `A4`.

Add small validation helpers near the data owner rather than repeating ad hoc
checks in multiple components.

### Common Patterns

- Object spread and `Object.assign` merge patches into known empty shapes.
- Hashes identify persisted item changes.
- Provider parsing catches malformed embedded metadata and falls back to empty
  content plus sanitized text.
- Tests cover utility normalization with concrete cases, as in
  `imageTypeUtils.spec.js`.

### Forbidden Patterns

- Do not scatter raw payload parsing across multiple consumers. Put decoders or
  normalizers near the service/provider that owns the payload.
- Do not trust provider, Markdown, or HTML payloads without sanitation at the
  established boundary.
- Do not use base64 strings as a stored type for Document images.
- Do not rename persisted identifiers without a migration.

### Review Checklist

- Is the data owner clear?
- Does the input have one normalization path?
- Are empty/null/invalid cases handled?
- Do utility tests cover new normalization behavior?

### Quality（构建/回归/评审预期）

### Overview

Quality checks are centered on Vite build output, stylelint during style builds,
and Jest unit tests for services/components. The project is a StackEdit fork, so
compatibility with existing data and editor behavior matters as much as local
code cleanliness.

### Formatting and Style

- `.editorconfig` requires UTF-8, LF, final newline, trimmed trailing
  whitespace, and 2-space indentation.
- SCSS is checked with `stylelint-config-standard` through
  `stylelint-processor-html`.
- Keep comments minimal and useful. Existing code has legacy comments; do not
  churn unrelated comments.

### Forbidden Patterns

- Do not change persisted StackEdit identifiers during visual KEDIT rebranding.
- Do not store base64 image data in Document source or persisted image state
  unless a future ADR explicitly changes the model.
- Do not add broad dependencies or rewrite framework patterns for a narrow fix.
- Do not duplicate provider parsing, path projection, or content serialization
  logic in components.
- Do not make preview/source changes that break raw Markdown portability unless
  the task explicitly updates the source contract.

### Required Patterns

- Search before adding a new utility, store getter, service method, or constant.
- Keep source Markdown as the canonical Author-edited text.
- For preview-only Markdown behavior, add markdown-it rules under
  `src/extensions/`, register block rules before the CommonMark rule they must
  preempt, and escape raw token content before emitting preview HTML.
- Put cross-component logic in services or Vuex.
- Keep provider contracts centralized under `src/services/providers/`.
- Preserve frontend/backing-store compatibility unless the task includes a
  migration and tests.

### Testing Requirements

Use focused tests for changed behavior:

- Services/libs: add or update tests under `test/unit/specs/services/` or
  `test/unit/specs/libs/`.
- Components: use Vue Test Utils patterns under `test/unit/specs/components/`.
- Store-driven UI flows should assert Vuex state and user-observable effects,
  as `ExplorerNode.spec.js` does for selection, rename, drag/drop, and badges.
- For visual/style-only changes, run the build and inspect the affected UI when
  practical.

Available project commands:

- `npm run build`
- `npm run build-style`
- Jest config exists at `test/unit/jest.conf.js`, but there is no npm test
  script in the current `package.json`.

### Current Jest Harness Gotcha

The current package is `"type": "module"`, while `test/unit/jest.conf.js` is a
CommonJS config that calls `require`. Running Jest directly with that config
fails before tests load. If you bypass that first layer with a temporary CJS
config, the repo also lacks `jest-environment-jsdom` for Jest 29 and references
`vue-jest`, which is not installed. Until the harness is fixed in a dedicated
testing-infra task, report focused Jest runs as blocked by the project test
stack and rely on `npm run build` plus code review for task-level verification.

### Code Review Checklist

- Does the change preserve KEDIT domain terms from `CONTEXT.md`?
- Does it preserve Sync vs Publish separation?
- Does it keep private images private at rest?
- Does it avoid breaking `.stackedit-*` data-contract identifiers?
- Does it reuse existing services/store getters?
- Are edge cases covered by focused tests or an explicit manual check?

### Common Mistake: Signature Change Without Sweeping Call Sites

**Symptom**: A feature dies silently at runtime (e.g., every sidebar/explorer
toggle click threw `TypeError`) while `npm run build` and CI stay green.

**Cause**: A helper's parameter list changed (`toggleLayoutSetting` dropped its
badge `featureId` param in the cruft-trim), but two direct call sites in
`src/store/data.js` kept passing the old arity. Arguments shifted one position:
a string landed in the `getters` slot. **Vite/Rollup do not check argument
arity or types** — only ESLint `no-undef`-class errors or runtime hits it.

**Fix**: `rg "<helperName>("` and reconcile EVERY call site in the same commit
as the signature change (bf7aca6e).

**Prevention**: Changing any function/action signature triggers the
Pre-Modification Rule (`.trellis/spec/guides/index.md`): grep all call sites
first; count arguments, not just names. Plain-JS refactors have NO compiler
net — assume the build proves nothing about call compatibility.
