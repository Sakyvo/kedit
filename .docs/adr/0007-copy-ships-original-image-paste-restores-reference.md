# Selection copy ships the original image; pasting back into KEDIT restores the reference

Status: superseded by ADR-0008 (the marked data-URL html payload was abandoned after field evidence)

Copying a selection that contains images must serve two opposite masters: outside
targets (Discourse, web rich-text boxes, terminals, chat apps) should receive the
**original image**, while pasting back into KEDIT must restore the image
reference text and never duplicate the image into storage.

**Decision**: the copy is written as up to three clipboard representations.

- `text/plain` — the raw Markdown selection, untouched (image references included).
- `text/html` — every image inlined as a data URL of its **original bytes** (no
  re-encode), prefixed with an invisible `<!--kedit:copy-->` marker.
- Native `image/png` — only when the trimmed selection is exactly one image
  reference, and then **without** `text/plain`: an image-only clipboard.

On paste, a `text/html` carrying the marker means "self copy": insert the plain
text as-is and skip both `processUpload` and turndown. If a referenced image is
unresolvable in the current workspace (workspace switched, image cleaned), the
original bytes are recovered from the html data URL and stored through the normal
`updateImg` path, inserting the fresh reference — content carries its images.

`text/plain` is still written synchronously in the copy event (empty-clipboard
insurance); the full representation set is then upgraded via async
`navigator.clipboard.write` — the copy event handler cannot await IndexedDB.

**Considered Options**

- *`text/html` only, no native image* — rejected: pebrel (`ClipboardPayload`
  takes Text before Image) and WeChat/TG-style targets never look at html; a
  native bitmap is the only channel that reaches them.
- *Single-image selection keeps `text/plain` alongside* — rejected: pebrel pastes
  the text and silently drops the image. A pure-image clipboard is the only
  trigger for its existing screenshot-staging path (`CF_DIB` → temp PNG → pasted
  path), so single-image selection copy deliberately omits the text.
- *Custom MIME (`web application/x-kedit-markdown`) instead of the html marker* —
  rejected: custom formats are not reliably readable in the synchronous paste
  event outside Chromium; the html comment marker is portable and can be
  layered with a custom type later if some target strips comments.
- *Unresolvable reference pasted as-is* — rejected: pasting content across
  workspaces would leave broken images when the bytes were right there on the
  clipboard.

**Consequences**

- An image-only copy pastes nothing into plain-text tools (Notepad3): you copied
  an image, not text. Semantically intended.
- Mixed text+image paste into pebrel delivers text only; images go one at a time
  via single-image copies. This is pebrel's architecture, not a KEDIT limit.
- Losslessness is per channel: the data-URL path carries byte-identical originals;
  the native path is pixel-lossless but re-encoded to PNG by the receiver when
  the source was lossy (jpg/webp).
- Depends on Chrome writing `CF_DIB` for `clipboard.write(image/png)` on Windows;
  if a Chrome version stops doing so, the pebrel channel degrades silently
  (first real-machine acceptance item guards this).
