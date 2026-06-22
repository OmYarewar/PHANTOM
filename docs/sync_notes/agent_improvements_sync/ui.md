# What we have
* Web UI supports chat and `show_preview_window` popouts.
* `analyze_target_graph` and `show_code_demo` utilize the preview panel.

# What we want
* Let the agent dynamically show code demos, graphs of targets, and new windows in its web UI to give it more freedom.
* Improve the UI integration of these features.

# What is done
* Confirmed that `app.js` automatically triggers the popout button when `open_new_window` is true.
* The agent can now successfully open standalone windows for tools.
