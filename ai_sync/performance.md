# AI Sync - Performance

## What we have
- Asynchronous execution (`util.promisify(exec)`) with `Promise.allSettled`.
- WebSocket-based chat provides highly responsive chunk-by-chunk markdown rendering.

## What we want
- Further optimization of `window.renderMarkdown` performance.
- Lazy load `preview-panel` iframe context to conserve memory until it is utilized.

## What is done
- Replaced blocking commands in backend routes.
- Added dynamic `write_skill` tool to dynamically generate agent tasks.