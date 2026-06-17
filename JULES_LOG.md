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


## [2026-06-04] Session Bootstrap Step Added
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

## 2026-06-04 - Fix AI Thought Process Error & UI
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


## [2026-06-04] — Session X
**What I decided to work on:** I noticed a missing security boundary test and a potential XSS vulnerability where URL-encoded payloads like `javascript%3A` could bypass the markdown parser's `javascript:` link filter. I chose to implement this security hardening.
**What I built/fixed:**
- Added `decodeURIComponent` in `frontend/js/markdown.js` to correctly decode and block malicious protocols even if they are URL-encoded.
- Wrapped the decoder in a `try/catch` to ignore `URIError` when encountering malformed encoded strings.
- Added a full test suite `tests/markdown.test.js` to specifically target this markdown URL rendering security boundary.
**Files changed:**
- `frontend/js/markdown.js`
- `tests/markdown.test.js`
**Tests:** 51 passed / 5 added
**Commits:** Pending
## [2026-06-04] — Accessibility improvements
**What I decided to work on:** I noticed a learning from `.jules/palette.md` where form labels and icon-only buttons in hidden panels lack `aria-label`s. Specifically, I found two buttons related to Telegram Bot configuration in `frontend/index.html` were missing accessibility attributes.
**What I built/fixed:** Added `aria-label` for `#toggle-telegram-token` and `#save-telegram-btn` to improve screen-reader accessibility for the Telegram settings configuration inside the Settings hidden panel.
**Files changed:** `frontend/index.html`
**Tests:** 51 passed / 0 added
**Commits:** Pending

## [2026-06-05] — Session N
**What I decided to work on:** I noticed the frontend still relied heavily on native `alert()` and `confirm()` popup boxes which provided a poor User Experience, blocking the main thread and looking unstyled compared to the rest of the dark glassmorphism theme.
**What I built/fixed:**
- Created a beautiful new custom `window.Toast` module in `frontend/js/toast.js` supporting standard toast notifications and a custom overlay confirmation dialog.
- Replaced the `alert()` logic in `frontend/js/management.js` with `Toast.show()`.
- Replaced all `confirm()` calls in `frontend/js/app.js` and `frontend/js/management.js` with `Toast.confirm(message, callback)`.
- Verified UI elements visually using Playwright scripting.
**Files changed:** `frontend/js/toast.js`, `frontend/js/main.js`, `frontend/css/styles.css`, `frontend/js/management.js`, `frontend/js/app.js`.
**Tests:** 51 passed / 0 added
**Commits:** Pending

## [2026-06-06] — Fix Test Flakiness / Security Tests State Leaks
**What I decided to work on:** Based on log review and test execution, there was a test state leakage due to rate limit constraints during security middleware tests. Express-rate-limit tracks usage globally based on IP, and the tests were re-using a single `uuidv4()` string and later failing with `ERR_ERL_INVALID_IP_ADDRESS` validation errors from the package.
**What I built/fixed:** Updated the testing suites (`tests/api.test.js`) to generate unique, valid IPv4 string headers (`192.168.1.X`) per test by randomizing the last octet. Bound it explicitly in Supertest instances using `set('X-Forwarded-For')`. This bypassed the invalid UUID crashes and isolated tests effectively.
**Files changed:** `tests/api.test.js`
**Tests:** 51 passed / 0 added
**Commits:** Pending

## [2026-06-09] — Add Message Timestamps and Copy Button
**What I decided to work on:** I decided to add message timestamps and a copy button for AI messages to improve the user experience on the frontend chat interface, based on the suggestions in the instructions.
**What I built/fixed:** Added a `window.copyText` function in `frontend/js/markdown.js` to handle text copying. Modified `frontend/js/chat.js` to render timestamps for both user and assistant messages, and added a copy button to the assistant messages. Added corresponding CSS styles in `frontend/css/styles.css` to properly position and style the message footer. Addressed a bug where the footer was unconditionally appended to empty AI messages (e.g. during errors) by ensuring the footer is only appended when the assistant message has content.
**Files changed:**
- `frontend/js/markdown.js`
- `frontend/js/chat.js`
- `frontend/css/styles.css`
**Tests:** 51 passed / 0 added
**Commits:** Pending

## [2026-06-13] — Session N+1
**What I decided to work on:** I noticed that the sidebar toggle button was hidden on desktop, and there was no way to collapse the sidebar to gain more space for the main chat interface on larger screens.
**What I built/fixed:**
- Removed the `mobile-only` class from the `#sidebar-toggle` button in `frontend/index.html`.
- Added a transition for `margin-left` and implemented the collapsed state in `frontend/css/styles.css` using a negative `margin-left` for the sidebar when the `.sidebar-collapsed` class is applied to `#app` on desktop displays.
- Modified the sidebar toggle logic in `frontend/js/app.js` to correctly handle both mobile (`.open` class on sidebar) and desktop (`.sidebar-collapsed` class on `#app`) scenarios.
**Files changed:**
- `frontend/index.html`
- `frontend/css/styles.css`
- `frontend/js/app.js`
**Tests:** 51 passed / 0 added
**Commits:** Pending

## [2026-06-15] — Add Export Conversation Feature
**What I decided to work on:** I decided to add a New Feature to allow users to export their conversations to a Markdown file. This is highly valuable for penetration testers who need to generate reports from their findings. I also noticed that adding this functionality was missing but easily achievable using existing conversation history data.
**What I built/fixed:**
- Added a `GET /api/conversations/:id/export` API endpoint in `server/routes/api.js` to format a given conversation history as a well-structured Markdown string. It forces a file download by setting the `Content-disposition` header.
- Added an "Export" button in `frontend/index.html` inside the `.top-bar-actions` area to make it easily accessible.
- Wired the button in `frontend/js/app.js` to open the export URL for the currently active conversation.
- Added integration test coverage for the export endpoint in `tests/api.test.js`.
**Files changed:**
- `server/routes/api.js`
- `frontend/index.html`
- `frontend/js/app.js`
- `tests/api.test.js`
**Tests:** 52 passed / 1 added
**Commits:** Pending

## [2026-06-15] — Fix npm run dev start error
**What I decided to work on:** I noticed that running `npm run dev` resulted in a `concurrently: command not found` error, even when all dependencies appeared correctly installed. The agent incorrectly tried to fix this by modifying `package.json` earlier, which failed code review.
**What I built/fixed:** Instructed the user to simply run `npm install` as no codebase changes were needed. Testing showed that the `dev` script inherently works fine once `npm install` runs and places the local `concurrently` binary into `node_modules/.bin/`.
**Files changed:** None.
**Tests:** 52 passed / 0 added
**Commits:** None required.

## [2026-06-15] — Fix Telegram Bot Markdown Formatting & Add General Task Capabilities
**What I decided to work on:** I noticed that the AI's responses to the user on Telegram were rendering raw markdown (e.g., `*🔥 PHANTOM Capabilities Overview*`) instead of properly formatting it. I also updated the AI's system prompt to allow for general tasks and file sending, based on the user's request.
**What I built/fixed:**
- Changed `parse_mode: 'HTML'` to `parse_mode: 'MarkdownV2'` across `server/telegram/sender.js` because `telegramify-markdown` specifically converts text to Telegram's MarkdownV2 syntax.
- Removed custom double-escaping logic `fixUnescapedChars` which conflicted with `telegramify-markdown`.
- Updated `sendToolUpdate` to securely escape tool names and previews using `telegramifyMarkdown`.
- Updated test assertions in `tests/sender.test.js` and `tests/telegram.test.js` to expect `MarkdownV2`.
- Updated `server/ai/system-prompt.js` to explicitly declare the AI as a general-purpose AI agent capable of downloading/working with files. Added documentation for the `send_file_to_telegram` tool so the AI knows how to send files back to the user.
**Files changed:**
- `server/telegram/sender.js`
- `tests/sender.test.js`
- `tests/telegram.test.js`
- `server/ai/system-prompt.js`
**Tests:** 52 passed / 0 added
**Commits:** Pending

## [2026-06-16] — Add Error Catching
**What I decided to work on:** I decided to perform a Bug Hunt focusing on unhandled promise rejections and potential errors from missing catch blocks in async functions across the Express backend and Vite frontend. I noticed that several asynchronous functions and promise handlers had empty catch blocks which can hide issues and fail silently.
**What I built/fixed:**
- Added `console.error` and `window.Toast.show` inside the empty `catch` blocks of `loadConversations`, `deleteConversation`, and `checkSudoStatus` in `frontend/js/app.js`.
- Added `console.error` and `window.Toast.show` inside the empty `catch` blocks of `saveMCP`, `deleteMCP`, and `deleteSkill` in `frontend/js/management.js`.
- Added `console.error` and `console.warn` inside the empty `catch` blocks of `writeSkill`, `editSourceCode`, and `saveTrace` in `server/tools/executor.js`.
**Files changed:**
- `frontend/js/app.js`
- `frontend/js/management.js`
- `server/tools/executor.js`
**Tests:** 61 passed / 0 added
**Commits:** Pending

## [2026-06-16] — Fix Test Timeout
**What I decided to work on:** I decided to investigate and fix the test failure causing the pipeline to fail (`Error: Test timed out in 5000ms`). The `save_memory and recall_memory should round-trip correctly` test in `tests/tools.test.js` was hitting the default 5000ms Vitest timeout because `saveMemory` uses the `@xenova/transformers` library to initialize the `all-MiniLM-L6-v2` model and generate vector embeddings on its first run, which frequently takes longer than 5 seconds.
**What I built/fixed:**
- Increased the test timeout to 50000ms by passing `50000` as the third argument to the `it` block in `tests/tools.test.js`.
**Files changed:**
- `tests/tools.test.js`
**Tests:** 61 passed / 0 added
**Commits:** Pending
