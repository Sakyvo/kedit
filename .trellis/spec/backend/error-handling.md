# Error Handling

## Overview

Backend error handling is local to each route helper. There is no global Flask
error response envelope. Preserve the existing route-specific response shape
unless a task explicitly updates the frontend caller too.

## Error Types

- OAuth token helpers catch general exceptions and return JSON errors with a
  400 status, as in `server/github.py`.
- Export helpers use Werkzeug exceptions for expected export failures:
  `BadRequest`, `Unauthorized`, and `RequestTimeout` in `server/pdf.py`.
- Unexpected export errors are logged with `logger.exception(...)` and returned
  as plain text with status 400.

## Error Handling Patterns

- Let `requests` raise transport/status errors via `response.raise_for_status()`
  in OAuth helpers.
- Validate or normalize route options before subprocess execution. `pdf.py`
  restricts page size to `AUTHORIZED_PAGE_SIZES` and falls back to `A4`.
- Kill long-running subprocesses on timeout.
- Clean up temporary files in `finally` blocks.
- Keep frontend user-facing notification behavior in the frontend. Backend
  helpers return HTTP responses; Vuex services decide how to notify the Author.

## API Error Responses

Current backend response shapes are mixed:

- OAuth token failure: `jsonify({"error": str(e)}), 400`.
- PDF timeout: `Response(str(e), status=408, mimetype="text/plain")`.
- PDF unauthorized: `Response(str(e), status=401, mimetype="text/plain")`.
- PDF generic failure: `Response(str(e), status=400, mimetype="text/plain")`.

Do not standardize these shapes opportunistically. If a response shape changes,
update the frontend caller and tests in the same task.

## Common Mistakes

- Returning secret-bearing upstream error bodies to the browser. Check OAuth
  and export failures before exposing details.
- Swallowing subprocess failures without a status code. `pdf.py` raises
  `BadRequest(stderr)` when `wkhtmltopdf` exits nonzero.
- Forgetting cleanup when adding temporary files.
