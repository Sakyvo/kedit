# KEDIT

KEDIT is a personal, single-author online Markdown editor backed by a private GitHub repository. It authors documents and feeds them, manually, into **pdir** for public display.

## Language

**KEDIT**:
The authoring editor — personal, single-user, private. Where documents are written and edited.
_Avoid_: the editor (ambiguous), the app

**pdir**:
The visitor-facing publication site (`pdir.cc.cd`). Receives pasted content from KEDIT and renders pages for visitors. Backed by a public Codeberg repository (`Sakyvo/pages`).
_Avoid_: the site, the frontend

**Author**:
The single human user of KEDIT. There is exactly one; they own every document.
_Avoid_: user, admin

**Visitor**:
A reader of **pdir**. Has no access to KEDIT and cannot see unpublished content.
_Avoid_: user, reader

**Document**:
A Markdown file authored in KEDIT. The unit of both editing and publishing.
_Avoid_: file, page, note

**Publish**:
The manual act of moving a **Document**'s content from KEDIT into **pdir** so **Visitors** can see it. Never automatic. This act is the boundary at which content becomes public.
_Avoid_: sync, deploy, export

**Sync**:
The automatic, near-real-time mirroring of **Documents** between the Author's devices (a mobile edit appears on desktop with no manual action). Internal to KEDIT; never reaches Visitors.
_Avoid_: publish, save, backup

**Public image / Private image**:
An image becomes **Public** only when the **Document** containing it is **Published** to pdir; until then it is **Private** (visible only to the Author inside KEDIT). The public/private line is drawn by the act of **Publishing**, not by a property chosen at insert time. At rest a Private image is stored privately and is never exposed; an image's portable, self-contained form is produced **only transiently** at copy or Publish — never as KEDIT's stored representation.
_Avoid_: shared/hidden, uploaded/local, "stored as base64" (no image is stored inline)

**Self-contained copy**:
A copy of a **Document** in which every image is inlined, so the content renders in any Markdown or rich-text target and **pdir** can ingest it with zero change. Produced **only transiently** — at the moment of copy or **Publish** — never as how a Document is stored. At rest, images remain **Private** files.
_Avoid_: export (overloaded); "base64 copy" (names the mechanism, not the concept)

## Flagged ambiguities

**"同步" (sync) collapses two distinct concepts.** In casual speech it can mean either **Sync** (device-to-device, private, automatic) or **Publish** (KEDIT-to-pdir, public, manual). They are opposites in audience and trigger. Always say **Sync** for the private/automatic one and **Publish** for the public/manual one.

## Example dialogue

> **Author:** I edited the intro on my phone — will visitors see it?
> **Dev:** No. That edit only **Syncs** to your other devices; it stays Private. Visitors see nothing until you **Publish** that Document to pdir.
> **Author:** And the screenshot I pasted into it?
> **Dev:** Private too. It's a Private image while it lives only in KEDIT. It becomes a Public image at the moment you Publish the Document — that's the single line between private and public.
> **Author:** So Sync never exposes anything?
> **Dev:** Correct. Sync is device-to-device only. Publish is the one and only path to a Visitor.
