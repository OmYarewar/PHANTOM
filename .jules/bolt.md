## 2026-05-15 - [Concurrent Execution Performance]
**Learning:** Found sequential blocking executions `execSync` that can be replaced with `Promise.allSettled` executing asynchronous processes in parallel.
**Action:** Always check array evaluations and loops when external blocking interactions happen if they can be efficiently parallelized.
