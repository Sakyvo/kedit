# Logging Guidelines

## Overview

The backend uses Python's standard `logging` module. `server/app.py` configures
global level from `LOG_LEVEL`, defaults to `INFO` in debug mode and `WARNING`
otherwise, and can suppress Werkzeug access logs with `HTTP_ACCESS_LOG=false`.

There is no structured logging framework.

## Log Levels

- `ERROR` / `logger.exception(...)`: unexpected backend failures that need a
  stack trace. Example: generic PDF export failure in `server/pdf.py`.
- `WARNING`: recoverable operational problems where the route can still return
  a controlled response.
- `INFO`: startup/runtime information only when useful during debugging.
- Avoid noisy per-request logs in production; use `HTTP_ACCESS_LOG` for access
  log control.

## Structured Logging

No JSON log format is used. Keep logging simple and local. If structured
logging becomes necessary, introduce it as an explicit backend task and update
this spec.

## What to Log

- Unexpected exceptions in export helpers.
- Subprocess failures when the stderr is necessary to diagnose the toolchain.
- Configuration/runtime decisions only when they are not sensitive.

## What NOT to Log

- OAuth codes, access tokens, refresh tokens, client secrets, or full provider
  responses that may contain credentials.
- Document content, private image content, base64 payloads, or private repo
  paths beyond what is needed to diagnose a failure.
- Full request bodies for export routes.

## Examples

- `server/app.py`: configures `logging.basicConfig(...)`, `app.logger`, and
  `werkzeug` log level.
- `server/pdf.py`: obtains a module logger and uses `logger.exception(e)` for
  unexpected export errors.
