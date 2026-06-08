# Fork StackEdit as the base engine; adopt markra's design system as a skin

KEDIT forks **StackEdit** (Vue 3 / Vite, markdown-it ecosystem, Apache-2.0) for the editor engine, and ports **markra's** `DESIGN.md` ink-black minimalist visual system on top as a restyle.

## Context

The choice was StackEdit vs markra vs greenfield. The apparent dilemma was "features (StackEdit) vs minimalism (markra)", but the real conflict is **paradigm, not aesthetics**:

- KEDIT requires a **flat, source-of-truth Markdown** model (no "blocks"): the Author edits raw Markdown, blank lines are preserved, `1. 2. 3.` lists and `---` rules round-trip faithfully, and content pastes cleanly into any other Markdown tool. StackEdit is a flat source+preview editor; markra is a **block-based WYSIWYG** (Milkdown / ProseMirror) — the exact paradigm the Author rejected (Notion / 思源 / Wolai were all dismissed for it).
- **Auto cloud Sync** is a hard requirement. StackEdit already has GitHub-backed sync to extend; markra's `PRODUCT.md` lists cloud sync as an explicit anti-goal ("Do not add ... cloud sync") and is desktop-native / local-first by design.
- **Features must be guaranteed.** StackEdit is feature-complete (KaTeX, Mermaid, footnotes, tables, …) and is the Author's current daily driver; markra is feature-poor and would require rebuilding.
- Licensing: StackEdit is Apache-2.0 (permissive); markra is AGPL-3.0.

markra's one irreplaceable asset is its **design system**, which is portable as a CSS/token skin — it does not require forking markra. StackEdit-engine + markra-skin captures both sides, and the feature-vs-minimalism dilemma dissolves.

## Design philosophy & precedence

Two principles guide KEDIT, in strict precedence:

1. **Pragmatism (实用主义) — priority-guaranteed.** A real authoring need always wins. Where a principle below would compromise usability, pragmatism overrides it.
2. **Minimalism & content-as-interface (极简 & 内容即界面) — best-effort, subordinate to pragmatism.**
   - **极简 = markra's elegant _visual_ aesthetic** (ink-black, restrained chrome, typographic calm) — **not functional minimalism.** KEDIT keeps StackEdit's full feature set; features are never dropped in the name of "minimal."
   - **内容即界面** (the Document dominates; chrome stays out of the way) is a goal, not a hard constraint — it yields to pragmatism whenever access or clarity needs more chrome.

Worked example (pain-point review): the TOC becomes a side **drawer** (accepts chrome) rather than a pure floating overlay, because reliable access beats minimal chrome.

## Consequences

- KEDIT inherits StackEdit's Vue 3 / Vuex / Vite stack and markdown-it pipeline.
- The 8 known StackEdit pain points are treated as **fixable UX defects** on top of this base, not architectural blockers.
- "Source + preview" means KEDIT is explicitly **not** WYSIWYG; "内容即界面" is realized as minimal chrome (the Document dominates the screen), not in-place block rendering — see precedence above for how it yields to pragmatism.
