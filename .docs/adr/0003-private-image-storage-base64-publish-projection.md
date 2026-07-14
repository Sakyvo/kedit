# Images stay Private files at rest; base64 is a transient Publish projection (no base64 storage, no image host)

KEDIT keeps pasted images as **Private files** in the existing StackEdit GitHub private repo. base64 is **never stored** — it is generated only at the moment of a manual "Copy for Publish" action, as the transport that pdir ingests with zero change.

## Context

KEDIT authors Documents with pasted images and **manually Publishes** them into pdir. The image-storage model had to satisfy four forces at once:

- **Private until Publish** (CONTEXT.md): an image must not be publicly reachable before its Document is Published. The public/private line *is* the act of Publishing.
- **pdir ingestion (hard requirement)**: pdir's admin resolves an image only if its `src` is base64 **or** a publicly-fetchable URL. A private relative path (`/imgs/...`) fails on *every* pdir paste channel — verified in pdir `js/admin.js`: the `htmlToMarkdown` img branch (`data:` → file, else `src` kept verbatim, :1415), `publish()`→`fetchAsDataUrl` (downloads http URLs at publish, :1689), and `downloadShimoImages` (only 石墨 hosts, :1597). A private path is none of these.
- **Faithful raw-Markdown editing** (ADR-0001): KEDIT's value is editing raw Markdown; inline base64 blobs in the source pane destroy that.
- **Lean interval sync** (ADR-0002): whole-file sync to a GitHub private repo on a tuned interval; inline base64 bloats every sync payload and permanently churns git history.

Three candidate models were weighed:

- **(A) base64 as the stored representation** — trivial sync (self-contained `.md`), but destroys raw editing and bloats sync/history. Contradicted by pdir's own design, which deliberately keeps base64 out of both storage (`/images/N.ext` files) and the editor (`img://N` placeholders + expand/collapse).
- **(B) external image host** — the image becomes public at *paste*, violating Private-until-Publish; adds a third-party dependency, link rot, and unknown limits.
- **(C) keep StackEdit's private-repo files, add a Publish-time base64 projection** — chosen.

The pdir "zero-change base64" proof only establishes base64 as a valid Publish **transport**, not a storage model. Conflating the two was the core error this decision resolves.

## Decision

- **At rest**, images stay **Private files** in the existing StackEdit GitHub **private repo** (the same repo as the Document source-of-truth), flat under `/imgs/`, named `Kedit_YYYY-MM-DD_HH-MM-SS.<ext>` from the paste-time local clock; same-second collisions get `(1)`, `(2)`… inserted **before** the extension. This replaces StackEdit's `/imgs/<date>/<random>` scheme.
- **base64 is never stored.** It is produced **only transiently** by a dedicated **"Copy for Publish"** action that writes **`text/plain` only** = the raw Markdown with every *local private* `/imgs/...` reference inlined as base64. External `http(s)` image URLs **pass through untouched** (pdir fetches them at publish). There is **no** `text/html`/rich-text copy variant.
- **Publish handoff is manual paste into pdir admin.** pdir's existing pipeline collapses base64 → numbered `/images/N.ext` files, dedupes by content hash (:1697), and re-numbers (:1667). KEDIT does **not** push to Codeberg directly.

## Consequences

- Private-until-Publish holds exactly; the public boundary stays at Publish (pdir materialisation). No image is ever exposed before then.
- Raw-Markdown editing and lean sync are preserved — no base64 lives at rest, so no source-pane blobs and no git/sync bloat.
- **pdir needs zero changes.** KEDIT adds two things over the StackEdit base: (1) the `/imgs/Kedit_<timestamp>` upload-naming patch; (2) the "Copy for Publish" command that inlines local refs as base64 and writes `text/plain` only.
- The `text/plain` payload also renders in other Markdown tools that support data URIs (best-effort) — fixing the original "broken relative path" portability pain. It will **not** render in non-Markdown rich editors (Word/Notion); this is explicitly out of scope.
- Re-publishing is idempotent (pdir dedupes by content hash), so KEDIT embeds all local images naively with no incremental bookkeeping.
- Timestamp naming drops StackEdit's random-name collision-proofing; the only collision is two offline devices pasting different images in the same second — negligible for a single Author.
