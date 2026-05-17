# AI Sync - Performance

## What we have
- Changed `execSync` to asynchronous execution (`util.promisify(exec)`) with `Promise.allSettled` to improve concurrent routing performance.
- WebSocket-based chat provides highly responsive chunk-by-chunk markdown rendering.

## What we want
- Further optimization of `window.renderMarkdown` performance as it currently recalculates the whole document on every RequestAnimationFrame, leading to O(N^2) complexity on long messages.
- Lazy load `preview-panel` iframe context to conserve memory until it is utilized.

## What is done
- Replaced blocking commands in backend routes.
- Identified markdown rendering as a core area for future improvement.
