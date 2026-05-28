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
