# AI Sync - Security

## What we have
- Local SQLite database ensuring secure storage of credentials.
- System execution is handled carefully via `util.promisify(exec)` to prevent event loop blocking.
- Basic input sanitization.
- Self-awareness capabilities added, allowing AI to reflect on skills.

## What we want
- Ensure tools executed from the frontend via LLMs do not arbitrarily leak secrets over network endpoints unless explicitly requested.
- Better validation to prevent command injection payloads inside AI tool invocations.

## What is done
- Created this sync file to communicate security posture.
- Added dynamic `write_skill` tool.
- Added `get_system_capabilities` skill.
