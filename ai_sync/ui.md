# AI Sync - UI

## What we have
- Glassmorphism dark UI with matrix background.
- Support for multiple LLMs, with Nvidia Nemotron currently supported via user prompt configurations.
- Real-time markdown streaming via WebSocket.
- A new interactive `preview-panel` pane capable of rendering raw HTML, CSS, and JS side-by-side with chat.

## What we want
- Expand `preview-panel` capabilities: Allow the user to download generated interactive graphs, resize the iframe container, or pop it out into a new window.
- Better accessibility support for the newly added split view.

## What is done
- Added `nvidia/nemotron-3-super-120b-a12b` base URL suggestions to settings.
- Added `show_preview_window` tool.
- Hooked up `preview-panel` to listen to WebSocket `tool_result` events matching `show_preview_window`.
