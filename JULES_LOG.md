## 2025-08-06 — Session 1
**What I decided to work on:** I decided to fix a sibling directory path traversal vulnerability in the `/api/workspace/file` endpoint and implement caching for static system information to improve performance, as both issues were specifically mentioned in memory context.
**What I built/fixed:**
- Modified the `/workspace/file` endpoint to use `path.resolve` and strict prefix validation with `path.sep` to prevent path traversal outside the workspace directory.
- Implemented a module-level variable `cachedSystemInfo` in `server/routes/api.js` to memoize the static portions of the `/system/info` route, preventing event loop blocking while still updating dynamic data like RAM and uptime.
- Added a corresponding test in `tests/api.test.js` to ensure that traversal requests return a 403 status.
**Files changed:**
- `server/routes/api.js`
- `tests/api.test.js`
**Tests:** 73 passed / 1 added
**Commits:** Will be included on push.

## 2025-08-07 — Session 2
**What I decided to work on:** I noticed that the API endpoints for creating and updating conversation titles (`POST /conversations` and `PUT /conversations/:id/title`) lacked input validation, which could allow extremely long or empty strings. Additionally, the plain text fallback in Telegram bot sender manually stripped markdown using regex instead of utilizing the `remove-markdown` package mentioned in memory.
**What I built/fixed:**
- Added input validation for `title` in `/api/conversations` (both POST and PUT) to enforce a non-empty string with a maximum length of 200 characters. Returns 400 on error.
- Integrated `remove-markdown` in `server/telegram/sender.js` within `sendPlain` to correctly strip Markdown from messages before chunking them.
- Added comprehensive Vitest tests for the API title validations in `tests/api.test.js`.
**Files changed:**
- `server/routes/api.js`
- `server/telegram/sender.js`
- `tests/api.test.js`
**Tests:** 75 passed / 2 added
**Commits:** Will be included on push.
