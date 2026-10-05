# Dark theme revival

Status: accepted

KEDIT was declared light-only in code: `App.vue` hardcoded
`classes() => themeClasses.light` and force-normalized any persisted
`colorTheme: dark` back to `light` (a watcher dispatching
`switchThemeSetting`). The 025 batch explicitly kept that out of scope.

We now **revive dark theme**: the force-normalize watcher is removed and
`App.vue` follows `computedSettings.colorTheme` (the same pattern
`Home.vue` already had, with light fallback). Scope is deliberately
incremental: this batch fixes only the settings modal and any visually
broken main-UI spots found in real-machine acceptance; a full
component-by-component dark audit is rejected — remaining dark blemishes
are fixed as reported, in later batches.

Why the flip is safe now: `colorTheme` is in the built-in `syncExclude`
set (ADR 0010), so the theme stays a per-device choice and no sync-design
question reopens.

Rejected: keeping light-only (the Author wants dark); full dark audit
(disproportionate to demand; StackEdit's `.app--dark` style base still
exists in base.scss / markdownHighlighting / ExplorerNode / Modal).

Consequences: the `dark` select option returns to plain 「深色」; exported
HTML keeps following the live theme class — unchanged render-layer
divergence per ADR 0004.
