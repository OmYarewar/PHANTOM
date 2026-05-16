## 2024-05-24 - Event loop blocking via child_process.execSync
**Learning:** Using `execSync` for shell commands block the Node.js event loop, degrading API response times and overall application concurrency.
**Action:** Replaced sequential `execSync` calls with `await execAsync` (`util.promisify(exec)`) and used `Promise.allSettled` to execute independent system commands in parallel across API routes like `/system/info` and `/doctor/chat`. This ensures non-blocking I/O and faster parallel execution.
