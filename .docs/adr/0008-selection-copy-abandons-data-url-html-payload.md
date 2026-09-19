# Selection copy abandons the data-URL html payload

Status: accepted (supersedes ADR-0007)

ADR-0007 shipped a marked `text/html` payload with images inlined as data URLs.
Field evidence killed it: Word desktop cannot read base64 images (officially
documented), Google Docs rejects `data:` URLs outright, and social-media
textboxes ignore html entirely — pasted results were blank paragraphs where
images should be. The same giant base64 payload also made pasting janky in
receiving apps. The html payload served exactly one target (Discourse, which
auto-uploads `data:*` images per PR #35012) and was a net negative everywhere
else.

**Decision**: copy/cut writes `text/plain` only (the original StackEdit
behavior). The single exception: a selection that trims to exactly one
workspace-local image reference is asynchronously upgraded to an
**image-only clipboard** (`image/png`, no text, no html) — the only form
pebrel, chat apps, and social textboxes will accept as an image. Pasting that
exact image back into KEDIT restores the reference text instead of
re-uploading: the copied image's pixel fingerprint is kept in memory and
matched against the pasted file's decoded pixels (sampling, tolerant of
Chrome's PNG re-encode). Text self-paste needs no marker at all: a plain-text
clipboard inserts verbatim by construction.

Cross-workspace image recovery from clipboard data URLs (task 016) is dropped
with the payload — the bytes no longer ride the clipboard.

**Considered Options**

- *Structured html (`<p>` wrapping) + native first image + size cap* — fixes
  the blank lines but keeps the jank class and still loses images on
  Word/GDocs/social; complexity to serve only Discourse.
- *In-memory text-matching to detect self copies* — unnecessary: plain-text
  clipboards paste verbatim already; the marker only existed to defend against
  our own html payload.
- *Keeping marked html only for kedit↔kedit* — the paste-back case is already
  solved by the pixel-fingerprint match for the image-only clipboard, and text
  needs no detection.

**Consequences**

- Multi-image / mixed selections no longer carry images to any target; images
  move one at a time via single-image copies. Accepted as the retreat scope.
- Discourse keeps working: markdown source via text/plain, images via native
  pasted images (auto-uploaded by Discourse).
- Fingerprint mismatch degrades to the old path (image re-uploaded as a new
  file) — a storage duplicate, never a content corruption.
