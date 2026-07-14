# Directory Structure

## Overview

The backend is a flat `server/` package. `server/app.py` owns Flask app
construction, environment-controlled runtime flags, route declarations, and
static file serving. Provider-specific OAuth token exchanges and export helpers
live in sibling modules.

## Directory Layout

```text
server/
  app.py             Flask app, routes, static assets, runtime flags
  conf.py            Config loaded from server/.env.<STACKEDIT_ENV>
  github.py          GitHub OAuth token exchange
  gitee.py           Gitee OAuth token exchange
  gitcode.py         GitCode OAuth token exchange
  gitea.py           Gitea OAuth token exchange
  gitlab.py          GitLab OAuth token exchange
  pdf.py             wkhtmltopdf export helper
  pandoc.py          Pandoc export helper
  requirements.txt   Python runtime dependencies
```

## Module Organization

- Keep route registration in `server/app.py`.
- Keep provider-specific token logic in `server/<provider>.py`; expose one route
  function such as `github_token(args)`.
- Keep heavy export subprocess logic in helper modules (`pdf.py`, `pandoc.py`),
  not inline in `app.py`.
- Keep configuration access through `Config` in `server/conf.py`; do not read
  OAuth secrets directly in route files when a `Config` field already exists.
- The built frontend is served from `dist/` and `dist/static/`; backend code
  should not depend on source files under `src/` at runtime except static
  pass-throughs such as Prism components.

## Naming Conventions

- Python module names are lowercase snake_case.
- Flask route functions use snake_case matching the route purpose:
  `github_token`, `pdf_export`, `static_files`.
- Environment variables are uppercase and read in one place where possible:
  `LISTENING_PORT`, `DEBUG_FLAG`, `LOG_LEVEL`, `HTTP_ACCESS_LOG`.
- Provider modules mirror frontend provider names where practical:
  `github.py`, `gitee.py`, `gitlab.py`, `gitea.py`.

## Examples

- `server/app.py`: central route table and static asset serving.
- `server/github.py`: minimal OAuth token helper with `requests.post`.
- `server/pdf.py`: subprocess-backed export helper with explicit response
  status handling.
- `server/conf.py`: public vs private config split.

## Avoid

- Adding nested backend packages for one-off helpers; the current backend is
  intentionally flat.
- Moving Document, Sync, Publish, or workspace behavior out of frontend
  services without a dedicated architecture task.
- Exposing source-tree paths or development-only assets from production routes.
