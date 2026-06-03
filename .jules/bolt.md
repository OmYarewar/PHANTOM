- For testing `openai` SDK v4 within `node:test`, attempting to mock `global.fetch` or internal prototypes (like `Object.getPrototypeOf(client.chat.completions)`) can fail dynamically depending on bindings and the presence of `node-fetch`. A more resilient strategy for E2E integration tests is to spawn a temporary local `http.createServer()` and point `config.api.baseUrl` to it, mocking the raw REST API responses and SSE streams.
## Telegram Bot Optimization
- Fixed syntax error in string interpolation for tool outputs.
- Removed parse_mode Markdown from `sendMessage` which caused fallback parsing errors previously.
- Implemented `send_telegram_media` to handle media cleanly instead of routing large streams through markdown text renderer.
- Addressed testing issues with `vitest` expecting options arguments after removing the parse_mode option.
- [2025-05-28] Fixed `tests/tools.test.js` to include coverage for `validateUrlForSSRF` protecting against Server-Side Request Forgery vulnerabilities.

- Fix MarkdownV2 API calls by refactoring everything to HTML mode across the `telegramify` handlers to fix recurring parsing entity issues on Telegram SDK.
- Fix missing SQLite `db.run` parameters by implementing an implicit AST-like parameter count validator interceptor wrapped over `getDB().prepare()` to trap query vs parameters count mismatches dynamically.
## Start-up Optimizations
- Resolved redundant configuration and initialization logs during startup by eliminating double executions of `initDB` and `loadPersistedSettings` resulting from ESM top-level import behavior in `server/index.js` and `server/app.js`.
- Handled unhandled 'error' events explicitly on the server socket via `server.on('error')` to gracefully catch `EADDRINUSE` panics when another backend instance retains port bindings, outputting user-actionable instructions to release the port instead of emitting unhandled exceptions.

- Added security fix for Zip Slip vulnerability in ZIP file upload handler by thoroughly validating absolute resolved path bounds.
