    npm run serve:nano
    ```
  - Open: `http://localhost:8080/` (it will serve `test_nano/index.html`).
- Use the demo:
  - Paste long text in the textarea.
  - Click “Initialize” to trigger `Summarizer.create()` (this starts model download on first run; watch status messages).
  - Click “Summarize (batch)” for a single result or “Summarize (stream)” for incremental output.
- Useful Chrome pages:
  - `chrome://version` to confirm version.
  - `chrome://on-device-internals` to check on-device model status and size.

Troubleshooting
- “Summarizer API NOT supported”: update to Chrome 138+ desktop.
- “User activation required”: ensure you clicked the button (the demo already binds to click handlers).
- No download progress: check disk space and `chrome://on-device-internals`.