# Quality Guidelines

## Overview

Backend changes are usually small but can expose secrets or break export/OAuth
flows. Keep changes narrow, route-compatible, and aligned with the frontend
caller.

## Forbidden Patterns

- Do not expose `Config.values()` through a public route; use
  `Config.public_values()`.
- Do not log OAuth secrets, provider tokens, Document content, or private image
  payloads.
- Do not add server-side Document storage, a database, or a public image host
  without a reviewed architecture task.
- Do not rename persisted StackEdit identifiers as part of visible rebranding.
- Do not change route response shape without updating the matching frontend
  service.

## Required Patterns

- Keep Flask routes in `server/app.py` and delegate provider/export details to
  helper modules.
- Validate external inputs before passing them to subprocesses or provider API
  calls.
- Use environment variables through `Config` or the existing runtime flags in
  `server/app.py`.
- Preserve manual Publish as the public boundary. Sync remains private.
- Clean temporary files and kill timed-out subprocesses.

## Testing Requirements

The repo currently has Jest tests for frontend services/components, but no
Python test suite. For backend changes:

- Run `npm run build` when route/static/export changes could affect bundled
  integration.
- Manually smoke-test Flask routes if changing `server/app.py` or export
  helpers.
- Add focused tests where a backend-adjacent contract can be tested in frontend
  code, for example provider config handling or image projection utilities.
- Document any backend route that cannot be tested locally due to missing
  provider credentials.

## Code Review Checklist

- Does the change keep secrets server-side?
- Does `/conf` expose only public config?
- Does error handling preserve the current caller contract?
- Does the change preserve KEDIT's Sync vs Publish boundary?
- Does image handling keep private files at rest and base64 transient only?
- Are temporary files, subprocesses, and external requests bounded?
