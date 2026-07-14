# Design — Image storage model

> Behaviour/contract-level design. File-level targets are deferred to `implement.md` because the StackEdit fork (ADR-0001) does not yet exist.

## Boundaries

Two cooperating mechanisms over the forked StackEdit base; pdir is an external consumer that **must not change**.

```
paste ──▶ [Mechanism A: store]  ──▶ /imgs/Kedit_<ts>.<ext> in private repo + ![](…) ref
                                         │ (synced as-is by StackEdit, ADR-0002)
edit/preview ◀── render from /imgs ref (no base64 shown)
                                         │
Copy-for-Publish ──▶ [Mechanism B: project] ──▶ clipboard text/plain = raw md, local /imgs → base64
                                                         │ (manual paste)
                                                         ▼
                                        pdir admin (UNCHANGED): collapseImages → publish() → /images/N.<ext>
```

## Mechanism A — private file storage (replaces StackEdit upload naming)

- Trigger: image paste/drop into the editor.
- Store bytes as a file in the bound private repo under flat `/imgs/`.
- Name: `Kedit_${YYYY-MM-DD}_${HH-MM-SS}.${ext}`, local clock at paste. `ext` from the source MIME (`image/png`→`png`, `image/jpeg`→`jpg`, etc.).
- Collision rule: if the name exists (same-second), append `(${n})` before the extension, `n` = 1,2,… — first occurrence is bare. Existence is checked against the local working copy.
- Insert ref `![<alt>](/imgs/<name>)` at the cursor. This ref is the at-rest representation; it syncs verbatim.
- **Invariant**: no `data:image` is ever written into the document.

## Mechanism B — Copy-for-Publish projection (new)

- Trigger: explicit user action (command/button). Distinct from normal copy. Honours CONTEXT.md **Publish** = manual.
- Input: the active Document's raw Markdown.
- Transform, per image ref:
  - **local private** (`/imgs/...`, the Mechanism-A shape): read bytes from the local repo, emit `![<alt>](data:image/<ext>;base64,<b64>)`.
  - **external** (`http(s)://...`): leave verbatim — pdir's `publish()` fetches it (`fetchAsDataUrl`, admin.js:1689).
  - other/unknown: leave verbatim.
- Output: write **only** `text/plain` to the clipboard. Do **not** set `text/html`.
- No incremental/dedup logic: emit base64 for every local ref every time — pdir dedups by content hash (admin.js:1697), so re-publish is idempotent.

## pdir consumption contract (external, fixed)

Verified in `K:/Projects/website/pdir/js/admin.js`. An image resolves on pdir **iff** its `src` is base64 **or** a publicly-fetchable URL:

- Source-area paste prefers `text/html` and runs `htmlToMarkdown` when present (:1170) — **lossy** for KaTeX/Mermaid/tables. Sending `text/plain` only keeps pdir on the verbatim-text path → faithful.
- `collapseImages` turns pasted `data:image` into `img://N` placeholders; `publish()` materialises to `/images/N.<ext>` (re-numbered via `getMaxNumberedImageIndex`, :1667) and dedups by content (:1697).
- A private relative path (`/imgs/...`) is **not** fetchable → would break; Mechanism B exists precisely to eliminate it from the payload.

## Compatibility

- **Sync (ADR-0002)**: unchanged — at-rest `.md` carries short `/imgs/...` refs, image bytes live in the same repo; no base64 churn.
- **Editing (ADR-0001)**: unchanged — source pane shows refs, never base64.
- **pdir**: zero change.

## Risks

- Timestamp naming loses random-name collision-proofing — only two offline devices pasting different images in the same second collide; negligible for one Author.
- Very large Documents → large `text/plain` clipboard payload at publish; acceptable (pdir already handles bulk base64 intake).
