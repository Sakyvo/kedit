# Type Safety

## Overview

The frontend is JavaScript, not TypeScript. Type safety comes from stable item
shapes, empty factories, runtime normalization, focused utilities, and tests.
Do not invent TypeScript-only conventions for this codebase.

## Shape Organization

- Persisted item defaults live under `src/data/empties/`.
- Store modules use those empty factories when setting or patching items.
- Shared constants live under `src/data/constants.js` and related data files.
- Provider content serialization shape is centralized in
  `src/services/providers/common/Provider.js`.

## Runtime Validation and Normalization

Existing patterns include:

- `utils.sanitizeText(...)` before storing content parsed from providers.
- `htmlSanitizer.sanitizeHtml(...)` and `sanitizeUri(...)` for rendered HTML.
- `imageTypeUtils.js` for MIME/extension normalization.
- Explicit fallback behavior, for example `getImageExt(..., "png")` and PDF
  page size fallback to `A4`.

Add small validation helpers near the data owner rather than repeating ad hoc
checks in multiple components.

## Common Patterns

- Object spread and `Object.assign` merge patches into known empty shapes.
- Hashes identify persisted item changes.
- Provider parsing catches malformed embedded metadata and falls back to empty
  content plus sanitized text.
- Tests cover utility normalization with concrete cases, as in
  `imageTypeUtils.spec.js`.

## Forbidden Patterns

- Do not scatter raw payload parsing across multiple consumers. Put decoders or
  normalizers near the service/provider that owns the payload.
- Do not trust provider, Markdown, or HTML payloads without sanitation at the
  established boundary.
- Do not use base64 strings as a stored type for Document images.
- Do not rename persisted identifiers without a migration.

## Review Checklist

- Is the data owner clear?
- Does the input have one normalization path?
- Are empty/null/invalid cases handled?
- Do utility tests cover new normalization behavior?
