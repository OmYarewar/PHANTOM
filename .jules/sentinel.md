## 2024-05-18 - [Path Traversal in API Endpoint]
**Vulnerability:** A critical path traversal vulnerability was found in the `DELETE /skills/:name` endpoint (`server/routes/api.js`). The user input `req.params.name` was passed directly to `join(skillsDir, req.params.name)` without sanitization, allowing arbitrary file deletion via `../`.
**Learning:** Even when path components are passed as URL parameters to an Express route, they must be sanitized if used in file system operations. The `join` function resolves `../` sequences, breaking out of the intended base directory.
**Prevention:** Always use `path.basename()` to sanitize user input intended as a filename before using it in file system operations, and explicitly reject `.` and `..` to prevent edge cases.
