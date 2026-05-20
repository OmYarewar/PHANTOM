## 2024-05-24 - Event loop blocking via child_process.execSync
**Learning:** Using `execSync` for shell commands block the Node.js event loop, degrading API response times and overall application concurrency.
**Action:** Replaced sequential `execSync` calls with `await execAsync` (`util.promisify(exec)`) and used `Promise.allSettled` to execute independent system commands in parallel across API routes like `/system/info` and `/doctor/chat`. This ensures non-blocking I/O and faster parallel execution.

## 2024-05-16 - [Typing Animation Loop O(N^2) Bottleneck in Markdown Rendering]
**Learning:** In `frontend/js/chat.js`, the `_startTypingLoop` function renders characters gradually via `requestAnimationFrame`. However, on *every single frame* where a new character is rendered, it re-evaluates the *entire* accumulated markdown string via `window.renderMarkdown(this.renderedContent)`. This O(N^2) scaling behavior makes markdown rendering performance exceptionally critical for UI responsiveness during long AI responses, elevating the importance of micro-optimizations like regex consolidation that would normally be premature.
**Action:** Always scrutinize rendering loops tied to `requestAnimationFrame` for re-evaluation of growing strings. Micro-optimizations to string parsing are highly justified when the parsing occurs inside an O(N^2) render loop like a typing animation.

## 2026-05-18 - [SSE Stream Parsing Errors due to Chunking]
**Learning:** When parsing Server-Sent Events (SSE) directly from a stream, chunks do not necessarily align with logical message boundaries (like newlines). Splitting arbitrary stream chunks by `\n` without buffering incomplete lines results in dropped events and `JSON.parse` errors.
**Action:** Introduced a buffering mechanism when reading SSE streams in the frontend (`app.js` and `settings.js`) to accumulate chunks, split by the event delimiter, and properly handle incomplete trailing lines by leaving them in the buffer for the next chunk.

## 2026-05-18 - [SQLite Temporary B-Tree Sorting Bottleneck]
**Learning:** In SQLite, queries using `ORDER BY` with unindexed or partially indexed columns (like `ORDER BY updated_at DESC` or `WHERE conversation_id = ? ORDER BY created_at ASC`) fallback to a temporary B-Tree sort (`USE TEMP B-TREE FOR ORDER BY` in `EXPLAIN QUERY PLAN`). This becomes a noticeable performance bottleneck for frequent queries as data grows.
**Action:** Always add targeted indexes, especially composite indexes like `(conversation_id, created_at ASC)`, to allow SQLite to natively return sorted results without secondary sorting overhead. This is a common and necessary optimization for this application's database access patterns.

## 2026-05-19 - [Consolidating Regex Passes for String Sanitization]
**Learning:** Performance optimization for string processing (like `escapeHtml`) heavily favors consolidated regex passes with replacer functions `str.replace(/[&<>"]/g, m => map[m])` over chained `.replace()` calls. Chained replaces redundantly traverse the entire string multiple times.
**Action:** When performing multiple simple substring replacements on long strings, always use a single regex pass with a dictionary map instead of chained replaces.

## 2024-05-19 - [SQLite Temporary B-Tree Sorting Bottleneck in Memories and MCP Servers]
**Learning:** Queries on `memories` (like `ORDER BY updated_at DESC` or `WHERE category = ? ORDER BY updated_at DESC`) and `mcp_servers` (`ORDER BY created_at DESC`) lacked appropriate indexes, leading to temporary B-Tree sorts. This became apparent as these tables are queried frequently for settings/knowledge retrieval and loading integrations.
**Action:** Added `idx_memories_updated`, `idx_memories_cat_updated`, and `idx_mcp_servers_created` to the schema in `server/memory/store.js` to ensure fast, indexed sorting for these core tables.
