# UI Fixes

- Fixed an issue where the auto-scroll feature (`scrollToBottom`) in `frontend/js/chat.js` would still execute even if the user manually scrolled up during streaming due to a race condition with `requestAnimationFrame`. Added a secondary check `(force || !this._userScrolled)` inside the innermost `requestAnimationFrame` callback.
