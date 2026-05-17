# AI Sync - Security

## What we have
- Local SQLite database ensuring secure storage of credentials (e.g. sudo password).
- System execution is handled carefully via `util.promisify(exec)` to prevent event loop blocking.
- Addressed a path traversal vulnerability in `/api/skills/:name` DELETE endpoint by properly sanitizing path inputs using `path.basename`.

## What we want
- Ensure tools executed from the frontend via LLMs do not arbitrarily leak secrets over network endpoints unless explicitly requested.
- Better validation to prevent command injection payloads inside AI tool invocations.

## What is done
- Created this sync file to communicate security posture.
