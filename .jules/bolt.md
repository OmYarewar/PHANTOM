## 2025-03-01 - Blocking System Information Gathering
**Learning:** The application heavily used synchronous execution (`execSync`) to gather system information in key endpoints (`/api/system/info` and `/api/doctor/chat`), unnecessarily blocking the event loop and reducing server throughput.
**Action:** Use asynchronous execution and `Promise.allSettled` whenever possible to execute multiple shell commands in parallel in Node.js route handlers.
