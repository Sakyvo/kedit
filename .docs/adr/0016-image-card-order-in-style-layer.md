# Image card order flips in the style layer, DOM order stays image-first

Status: accepted

An editor inline image card (`.token.img-wrapper`) holds the rendered `<img>` and
its raw `![alt](uri)` source text. The Author can pick their vertical order
(`editor.inlineImageOrder`: `image-above` default, `text-above`).

**Decision**: the wrapper stacks its two children as a flex column; `text-above`
only flips `flex-direction: column-reverse`. The DOM order remains `<img>` first,
source text second, always.

**Considered Options**

- *Decide the DOM order at highlight time (append text first when the setting
  says so)* — cledit rebuilds every card on each re-highlight, so the setting
  could only take effect after a full re-highlight, and the rebuild frame itself
  is the thing that makes cards flicker on this document class. It also forks
  the construction path in `sectionHighlighted` into two orders that must each
  keep working with `applyRememberedCap`, `fitImgWrapper`'s line-fit caches and
  the natural-size preset.
- *Move the DOM nodes when the setting changes* — needs handlers for a live
  re-order across every existing card, and every one of those cards'
  remembered caps / measured section heights would have to be invalidated by
  hand.
- *Style-layer flip (chosen)* — one class on the editor root, instant, no
  rebuild, no cache invalidation. Cost: DOM order no longer matches visual
  order.

**Why the cost is acceptable**

- The `<img>` is decoration, not editor text: cledit's caret and selection
  positions live in the source-text node, so arrow keys and selections never
  traverse it. Reordering visually cannot desync text navigation.
- ADR 0006's marker pinning and shrink-to-fit measure *outside* the wrapper
  (`range.setEndBefore(wrapper)`, `measureInlineRoom`), so the internal order
  cannot change those results.
- A height change after the flip still needs one re-measure
  (`fitAllImgWrappers` + `measureSectionDimensions` on the next frame), which
  the settings watcher in `editorSvc` performs.
