# AI Sync - UI

## What we have
- Glassmorphism dark UI with matrix background.
- Support for multiple LLMs.
- Real-time markdown streaming via WebSocket.
- A new interactive `preview-panel` pane capable of rendering raw HTML, CSS, and JS side-by-side with chat.

## What we want
- Expand `preview-panel` capabilities: Allow the user to pop it out into a new window.
- Make the preview window able to show code, demos, and graphs of target.

## What is done
- Added `show_preview_window` tool.
- Hooked up `preview-panel` to listen to WebSocket `tool_result` events matching `show_preview_window`.
- Added 'open in new window' feature to the `preview-panel` UI.