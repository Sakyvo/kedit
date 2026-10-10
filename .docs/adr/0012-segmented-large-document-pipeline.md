# Segmented large-document pipeline: text model separated from rendering, ~20k-char block-anchored segments

Very large **Documents** (the Author's novel is ~800k chars / ~2MB) froze the app on open and lagged badly while typing on a 2018 phone (Honor Magic 2): the load path did full-document Prism highlighting, full markdown-it conversion, full preview DOM build, and full section measurement synchronously; the typing path repeated full-text reads, full diffs, and full re-parses on every keystroke. We decided to split the pipeline into segments — while keeping the Markdown source and the editing experience (Prism highlighting included) untouched.

## Context

- Per-keystroke work was O(document): `textContent` full read, `diff_main` full diff, markdown-it full block re-parse, debounced full conversion — even with the preview panel hidden (mobile default), where all preview work was pure waste.
- The Author rejected plain-text degraded editing: syntax highlighting must stay.
- Target: open usable within ~1s on the old phone, "like opening Notepad".

## Decision

- **Text model separated from the DOM.** The full document string lives in a single in-memory model (the source of truth for edits, undo, Find/Replace, Sync, and persistence). cledit's DOM becomes a re-creatable rendering artifact. Keystrokes apply as deltas to the model; the O(full-text) read/diff/re-parse chain is removed from the typing path.
- **Segments of ~20k chars, cut at block boundaries** — never hard-cut at exactly char 20000 (a fixed-offset cut splits paragraphs/fences mid-token and, worse, makes every later segment shift on each insertion, cascading re-highlights back to O(document)).
- **Progressive fill:** at open, render only the first segment(s) to reach <1s usability; remaining segments materialize in idle slices and, eventually, fully. Scrolling/clicking into an unloaded segment loads it on demand.
- **Preview renders only when visible** (device-independent rule): a hidden preview panel means zero conversion, zero DOM, zero measurement. When shown, it renders from the current position, in segments, idle-filled. During continuous typing the visible preview refreshes at a reduced rate (~200ms idle).
- **Editor and preview rebuild only affected segments** on edit; section-dimension measurement becomes O(1) incremental (changed section re-measured, subsequent offsets shifted by delta).
- TOC is built by an independent cheap line scan, not from the preview product.
- One pipeline for all documents (a small document is the degenerate single-segment case — no size threshold), gated by a user-facing setting **长文档分段加载** (`segmentedLoading`, default ON, under 配置 → 可视化 above 常规): turning it OFF falls back to the legacy full-render pipeline, kept deliberately as a safety valve while the new pipeline proves itself on-device.

## Considered Options (rejected)

- **Editor windowing / CodeMirror-6-style virtualization** (only viewport ± buffer in the DOM, permanently): definitively fastest, but requires rewriting cledit's selection offsets, copy/paste, undo wiring, image cards, and scroll sync — several times the cost and a regression surface over every editing interaction. Deferred; incremental measurement and placeholder design leave the door open if on-device acceptance still fails.
- **Plain-text degraded mode for huge docs** (drop Prism highlighting): rejected by the Author — highlighting must stay.
- **Fixed-offset hard cuts at exactly 20000 chars:** mid-token splits corrupt highlighting/rendering, and offset shifts cascade re-highlights. Rejected in favor of block-anchored cuts.
- **Chunked scheduling without a text model** (render everything, just spread over idle time): fixes the freeze but not per-keystroke O(document) work nor the heavy final DOM on low-end devices.

## Measured outcomes (implementation, batch 010)

Real sample: `GlitchesSwap.md` — 810,031 chars, ~33.5k lines, ~9.7k sections, 2038 headings
(1391 unique). Synthetic near-2MB documents built with `unit.repeat()` were found to
*fabricate* pathologies absent from real text (thousands of identical headings made the
anchor-uniquifier O(n²), showing 13.8s); **perf evidence must come from structurally real
samples.**

Achieved (automated, real sample):

- Keystroke path free of O(document) work: windowed diff, delta into the text model,
  per-pass markdown-it parse 20 calls/keystroke → 2 (input memoization).
- Progressive highlighting converges (deferred segments → 0); segment DOM text ≡ model
  slice ≡ store text (810,031 chars, byte-exact).
- Preview hidden ⇒ zero convert / zero DOM / zero measurement; preview visible ⇒ windowed
  mounting (edit 1 of 600 sections rebuilt 1, reused 599).
- TOC decoupled from preview rendering, complete at open, fence-aware.
- Anchor uniquifier O(n²) → O(n): 19.9ms → 1.5ms on the real sample.

**Not achieved:** the "<1s open" target measured 1.75–1.87s in desktop dev/build.
Remaining cost is the ~9.7k-node editor DOM build plus **one full-document text layout
(~374ms, independent of section count)** plus markdown-it parse. **Coarsening section
granularity was empirically rejected** — 41 aggregated ~20k-char sections laid out in 395ms
vs 374ms for 9,730 block sections; layout is a property of the text, not the node count.
Breaking the floor requires the rejected **editor windowing** option above; decision is
deferred to the on-device acceptance verdict (task 016, item A9).

## Consequences

- Browser-native features degrade on **unloaded** segments, in the editor pane as much as the preview: Ctrl+F find-in-page only covers loaded segments, spellcheck checks only loaded segments, and native select-all copy would only carry loaded DOM. Mitigations: Find/Replace runs on the text model (full document, always); select-all copy/cut is intercepted and served from the model.
- **Hard requirement:** Ctrl+A → copy/cut in the editor must always carry the full document text (served from the model), regardless of what is currently rendered. This is an acceptance item, not a nice-to-have.
- Cross-segment reference-style links (`[text]` ↔ `[text]: url` in different segments) render as literal text in the per-segment preview; documents containing reference definitions fall back to the full-convert path. Copy/Publish/export always do a full render, so public output is unaffected (consistent with ADR-0004: divergence may live at the render layer only).
- Scroll-sync precision over never-measured segments is estimated (placeholder heights) and refines as segments materialize; TOC stays exact because it is line-scanned.
- Editing inside a loaded segment is byte-for-byte today's experience: native echo, per-block re-highlight, undo chain intact. Development builds assert segment DOM text ≡ model slice (reconciliation sentinel).
- Cost: the legacy full-render pipeline stays alive behind the OFF switch — dual-path maintenance is accepted on purpose (the Author's escape hatch "以防问题") until long-term on-device evidence retires it.
