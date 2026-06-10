---
id: examples-module-imports
title: Module Imports
---

## Example

This demo's worker function is composed from **several modules plus an npm package** — something the classic `fn.toString()` approach can't do. It uses the [`@mileszim/useworker-vite`](../vite-plugin.md) plugin, which bundles the worker's entire import graph into the worker.

The logic is spread across files:

```javascript
// lib/math.js
export const square = (x) => x * x;
export const sum = (xs) => xs.reduce((acc, x) => acc + x, 0);
```

```javascript
// lib/stats.js  (imports ./math)
import { square, sum } from "./math";

export const mean = (xs) => sum(xs) / xs.length;
export const stddev = (xs) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => square(x - m))));
};
```

```javascript
// lib/analyze.js  (imports ./stats and the npm `date-fns` package)
import { format } from "date-fns";
import { mean, stddev } from "./stats";

export const analyzeNumbers = (numbers) => ({
  count: numbers.length,
  mean: mean(numbers),
  stddev: stddev(numbers),
  finishedAt: format(new Date(), "HH:mm:ss"),
});
```

The worker entry lives in a `*.worker.js` module:

```javascript
// workers/analyze.worker.js
import { analyzeNumbers } from "../lib/analyze";

export const analyze = (numbers) => analyzeNumbers(numbers);
```

And the call site is unchanged — `useWorker(analyze)` reads like a pure function:

```jsx
import { useWorker, WORKER_STATUS } from "@mileszim/useworker";
import { analyze } from "./workers/analyze.worker";

const numbers = [...Array(2000000)].map(() => Math.random() * 1000);

function App() {
  const [analyzeWorker, { status }] = useWorker(analyze);

  const onWorkerClick = () => {
    analyzeWorker(numbers).then((result) => {
      console.log("Analyze useWorker()", result); // { count, mean, stddev, finishedAt }
    });
  };

  return (
    <button
      type="button"
      disabled={status === WORKER_STATUS.RUNNING}
      onClick={onWorkerClick}
    >
      Analyze with useWorker()
    </button>
  );
}
```

See full code on [Github](https://github.com/mileszim/useWorker/tree/main/apps/examples/src/pages/ModuleImports).
