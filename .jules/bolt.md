## 2024-05-24 - Optimize backend concurrent execution
**Learning:** Sequential execution of commands with `execSync` is a blocking action. Node.js backend routes that execute multiple system commands sequentially using `execSync` block the event loop, resulting in an unresponsive server and increased route execution times.
**Action:** Replace `execSync` with `execAsync` (using `util.promisify(exec)`) and `Promise.allSettled` to execute independent system commands concurrently in Node.js backend routes, which resolves event loop blocking and decreases route execution times.
