## [2026-05-27] — Session 1
**What I decided to work on:** I chose to perform a Bug Hunt focusing on unhandled promise rejections and potential WebSocket crashes. I noticed that several asynchronous route handlers in the Express backend lacked `try/catch` wrappers, which in Express 4 can lead to unhandled promise rejections crashing the application. Additionally, the WebSocket `onmessage` handler in the frontend blindly parsed incoming JSON without a `try/catch`, posing a risk of UI crashes if malformed data was received.
**What I built/fixed:**
- Wrapped the asynchronous `/api/system/info` route handler in `server/routes/api.js` in a `try/catch` block.
- Wrapped the asynchronous `/api/settings/test` route handler in `server/routes/api.js` in a `try/catch` block.
- Added a `try/catch` block around `JSON.parse(event.data)` inside the WebSocket `onmessage` handler in `frontend/js/app.js` to gracefully catch and log parsing errors.
**Files changed:**
- `server/routes/api.js`
- `frontend/js/app.js`
**Tests:** 11 passed / 0 added
**Commits:** Pending
## YYYY-MM-DD
**Tasks Completed:**
- Added Telegram bot integration using `node-telegram-bot-api`.
- Created `server/telegram/bot.js` for bot logic and `server/telegram/session.js` for session management.
- Integrated bot start into `server/index.js` based on `config.telegram`.
- Updated `server/config.js` and `.env.example` to support `TELEGRAM_BOT_TOKEN` and `TELEGRAM_USER_ID`.
- Added `/api/telegram/status` and `/api/telegram/restart` API endpoints.
- Added Telegram configuration UI in `frontend/index.html` and logic in `frontend/js/settings.js` with pulse animation in `frontend/css/styles.css`.
- Wrote tests in `tests/telegram.test.js` to verify bot commands, session handling, and message filtering.

**Testing:**
- All tests pass (`npm test`).
- Lint checks completed (`npm run lint`).
## Telegram Settings Form UX Fix
- **Issue**: The Telegram "Bot Token" and "Your User ID" inputs were faded out and disabled via CSS (pointer-events) but there was no JavaScript hooked up to toggle the active/inactive state when checking the enable box.
- **Fix**: Added JavaScript logic in `frontend/js/settings.js` `init()` method to toggle the `.style.opacity` and `.style.pointerEvents` attributes for `#telegram-fields` when the `#setting-telegram-enable` checkbox is toggled. Also implemented the token visibility toggle button `#toggle-telegram-token` and the `#save-telegram-btn` event listener.
- **Files Changed**:
  - `frontend/js/settings.js`
- **Tests**: Ran all tests with `bun test` and `npm test` successfully. Visually verified the UI fix with a Playwright script.
Update Telegram bot integration: normal text replies, model command, formatted tool logs, and media sending

## Telegram Typing Indicator and Markdown Removal
- **Decisions**:
  - Added `remove-markdown` to format the AI response as plain text before sending it to the Telegram bot, while retaining standard Markdown output on the web frontend.
  - Implemented a throttled `sendTyping` helper inside the message handler in `server/telegram/bot.js` that triggers `bot.sendChatAction(..., 'typing')`. It is hooked into the `onChunk` and `onThinking` streaming callbacks to keep the typing indicator active for long responses.
  - Updated `tests/telegram.test.js` to mock `sendChatAction` to ensure the new integrations are fully tested without breaking existing suites.
- **Fixes**:
  - Telegram bot now successfully sends plain text instead of raw markdown characters.
  - Telegram bot now shows a visible typing indicator while processing the stream or waiting for model generation.
- **Files Changed**: `package.json`, `package-lock.json`, `server/telegram/bot.js`, `tests/telegram.test.js`.
- **Test Status**: `npm test` executed and all 17 tests passed.
- **Commit Hashes**: `8f00f9f`, `ee59388`.
## [2026-05-28] — Telegram Markdown Parsing Fix
**Tasks Completed:**
- Replaced the simple `remove-markdown` package for formatting telegram outputs with a Python bridge leveraging `telegramify-markdown`.
- Created `server/utils/telegramify.js` which spawns a `python3` child process to safely and reliably parse and chunk the markdown strings, returning both `text` entities and `file` attachments.
- Refactored `server/telegram/bot.js` `sendMessage` and `splitMessage` methods to handle objects containing parsed entities, routing them through `bot.sendMessage` and `bot.sendDocument` accordingly.
- Cleaned up unneeded dependencies from test cases and verified everything works.

**Testing:**
- Verified Python bridge functionality individually and integrated.
- `npm test` all suites passed successfully.
- `npm run lint` passed without major related errors.
**Files Changed:**
- `server/utils/telegramify.js`
- `server/telegram/bot.js`
- `tests/telegram.test.js`

## Fix Telegram Markdown and Add File Sending (Dec 2024)
- Fixed Telegram MarkdownV2 formatting by replacing the Python `sudoskys/telegramify-markdown` shell call with the native Node.js `telegramify-markdown` npm package.
- Created `server/telegram/sender.js` as the single source of truth for all Telegram sending. Handles Markdown conversion, chunking messages, fallbacks, tool updates, and media.
- Refactored `server/telegram/bot.js` to strictly import from `sender.js`. Removed direct `bot.sendMessage()` calls.
- Exposed active session globally via `server/telegram/session.js` allowing tools to access chat metadata.
- Added `send_file_to_telegram` tool in `server/tools/registry.js` and `executor.js`, allowing the AI to send files to the active Telegram user using `mime-types`.
- Added unit tests for `sender.js` and updated existing bot tests.
- Status: All tests pass.
- Fixed Telegram command display to pass tool status and result output.
- Wrapped OpenAI client creation in a retry mechanism with exponential backoff on 429 status code.
- Cleaned up LLM unused thinkingContent warnings.

## Fix Multiple Telegram Bot Bugs
*   **Decisions:**
    *   Hardened \`toTelegramMarkdown\` escaping logic in \`server/telegram/sender.js\` to correctly escape all 18 characters reserved by Telegram. Built nuclear fallback to prevent `400 Bad Request` API errors.
    *   Replaced `Processing...` sequential text messages with a more native `bot.sendChatAction(chatId, 'typing')` typing indicator interval loop in \`server/telegram/bot.js\`.
    *   Replaced blocking synchronous message sending loops in \`server/telegram/sender.js\` and `sendToolUpdate` with delayed (2000ms threshold) and non-blocking background logic to lower UI lag and make responses feel instantly faster. Set \`NTBA_FIX_319\` to squash bot warnings.
    *   Skipped LLM Client Bug 2 regarding `JSON.parse` failures on stream responses. Investigated the codebase structure and concluded that \`server/ai/llm-client.js\` leverages the official `openai` Node.js SDK which robustly parses streaming `Server-Sent Events` internally, making custom `parseSSELines` fixes irrelevant to this version of the codebase.
*   **Fixes:** Resolved MarkdownV2 markdown parsing failures, squashed "Processing..." notification noise, fixed laggy status updates using background tracking handles, and suppressed telegram bot driver deprecation log warnings.
*   **Files Changed:** \`server/telegram/sender.js\`, \`server/telegram/bot.js\`, \`tests/telegram.test.js\`, \`tests/sender.test.js\`
*   **Test Status:** 24/24 Vitest cases passing \`npm test\` with 100% pass rate.
*   **Commit:** fix(telegram): hardened MarkdownV2 escaping, added typing indicators, batched tool updates and parallel chunk sending


## [$(date +"%Y-%m-%d")] Session Bootstrap Step Added
- Implemented a session bootstrap step for the Telegram bot.
- Created `server/telegram/bootstrap.js` to load skills from the `skills/` directory and memories from SQLite store via `recallMemory`.
- Updated `server/memory/store.js` to add an overloaded `recallMemory` function supporting `limit` and `orderBy` options.
- Refactored `server/telegram/session.js` to use a `Map` structure for `sessions` keyed by `chatId`.
- Modified `server/telegram/bot.js` to invoke the bootstrap logic upon session start and pass the `session.systemContext`.
- Updated `server/ai/system-prompt.js` and `server/ai/llm-client.js` to integrate the injected `sessionContext`.
- Mocked dependencies properly and wrote Unit tests inside `tests/bootstrap.test.js` ensuring correct context extraction and formatting.
- **Tests pass successfully** (`npm test`).

### Fixed Telegram MarkdownV2 and SQLite Parameter Mismatches
- **Decisions:** Rewrote all `parse_mode: 'MarkdownV2'` references to `parse_mode: 'HTML'` in `server/telegram/sender.js`. Used the provided manual HTML parsing methods to eradicate the error-prone library `telegramify-markdown`. For SQLite param mismatch (BUG 2), implemented a `validateParams` interceptor globally injected into `getDB().prepare()` to check param count dynamically for `.run()`, `.all()`, and `.get()` operations. Wrapped the LLM tool memory saves inside a try/catch.
- **Fixes:** `sender.js` MarkdownV2 replaced. `store.js` augmented with an interceptor validation proxy.
- **Files Changed:** `server/telegram/sender.js`, `server/memory/store.js`, `server/ai/llm-client.js`, `tests/sender.test.js`, `tests/memory.test.js`.
- **Test Status:** Passing.
## [2026-05-30] — Security Hardening Session
**What I decided to work on:** I decided to focus on security hardening based on the directives. The application runs an Express server but lacked fundamental security middlewares like Helmet (for setting secure HTTP headers) and rate limiting (to protect endpoints from brute-force or DoS attacks).
**What I built/fixed:**
- Installed `helmet` and `express-rate-limit` dependencies.
- Configured and applied `helmet` middleware globally in `server/app.js` (with CSP disabled for compatibility with the Vite dev server).
- Configured `express-rate-limit` to limit requests to 100 per 15 minutes globally for `/api` routes.
- Configured Express to trust the proxy (`app.set('trust proxy', 1)`) to ensure correct IP tracking for rate limiting, especially important for test environments and reverse proxies.
- Wrote tests in `tests/api.test.js` to verify the security headers are present and the rate limit triggers correctly on exceeding 100 requests.
- Updated tests in `tests/api.test.js` to mock different `X-Forwarded-For` IP addresses to ensure isolated state for rate limit checks between test cases.
**Files changed:**
- `package.json`
- `package-lock.json`
- `server/app.js`
- `tests/api.test.js`
**Tests:** 44 passed / 2 added
**Commits:** Pending

## $(date +"%Y-%m-%d") - Fix AI Thought Process Error & UI
- **Decisions:**
  - Fixed an argument mismatch in `processMessage` calls (`server/index.js`, `server/tools/executor.js`) which caused `onThinking` to map to `abortSignal`, leading to `LLM Error: onThinking is not a function`. Passed `null` for the missing `sessionContext`.
  - Improved the UI for the thought process by converting it to use `<details>` and `<summary>` elements, making it collapsible natively.
  - The `<details>` element remains `open=true` while streaming and collapses `open=false` when thinking completes.
- **Fixes:** Added missing `sessionContext` parameter correctly aligning all callback mappings.
- **Files Changed:** `server/index.js`, `server/tools/executor.js`, `frontend/js/chat.js`, `frontend/css/styles.css`
- **Test Status:** Tested with `npm test`, executed Playwright to ensure UI loads correctly. All passed.
- **Commit:** $(git rev-parse HEAD)
- Fixed EADDRINUSE error and double initialization logs in backend.
## Fix EADDRINUSE unhandled exception
**Date**: 2025-05-28
- Fixed unhandled node process exception when port 1337 is blocked.
- Fixed duplicate logs printed during startup by modifying server/index.js.
- Tests passing.
## Session: Performance Optimization
- **Goal**: Optimize `server/ai/system-prompt.js:22` to remove `execSync` execution.
- **Fix**: Replaced shell executions (`cat`, `uname`, and `which`) with `fs.readFileSync`, `os.release()`, and `fs.existsSync` against `process.env.PATH`.
- **Files Modified**: `server/ai/system-prompt.js`
- **Testing**: Ran `vitest` and benchmark scripts (reduced execution time from ~250ms to ~2ms).
- **Status**: Completed and committed.
- **Commit**: $(git rev-parse HEAD)
