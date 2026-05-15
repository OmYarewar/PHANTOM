
## 2024-05-15 - Fixed Path Traversal in Skill Deletion
**Vulnerability:** A critical path traversal vulnerability existed in `DELETE /skills/:name` where `req.params.name` was not sanitized before joining with `skillsDir`. An attacker could exploit this to delete arbitrary files on the filesystem.
**Learning:** File path inputs from user requests (e.g. `req.params`, `req.body`, `req.query`) must always be sanitized when used in operations involving the filesystem like `rmSync` or `readFileSync`.
**Prevention:** Always use `path.basename()` or strictly validate paths to ensure they stay within intended directory bounds before file operations.
