---
id: vite-plugin
title: Imported Modules (Vite Plugin)
sidebar_label: Imported Modules
---

## Why

`useWorker(fn)` moves `fn` into the worker by stringifying it (`fn.toString()`). That captures only the source text of that one function — any variable from its closure or any **imported binding** is lost. So a worker function spread across modules throws `ReferenceError` at runtime:

```javascript
import { square } from "./math";

const compute = (xs) => xs.map(square); // `square` is undefined inside the worker
const [run] = useWorker(compute); // ❌ ReferenceError: square is not defined
```

The import graph that `square` came from was resolved and discarded by your bundler — it doesn't exist at runtime. The only place it _does_ exist is at **build time**, which is where the `@mileszim/useworker-vite` plugin hooks in.

## Install

```bash
npm install @mileszim/useworker
npm install -D @mileszim/useworker-vite
```

## Setup

Add the plugin to your Vite config:

```javascript
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { useworkerVite } from "@mileszim/useworker-vite";

export default defineConfig({
  plugins: [react(), useworkerVite()],
});
```

## Usage

Put worker code in a `*.worker.js` module (also `.ts`, `.jsx`, `.tsx`) and import it normally. Its whole import graph — local files **and** npm packages — is bundled into the worker:

```javascript
// transforms.worker.js
import Papa from "papaparse"; // npm dep, bundled into the worker
import { square } from "./math"; // local import, bundled into the worker

export const compute = (xs) => xs.map(square);
export const parseCsv = (text) => Papa.parse(text).data;
```

```jsx
import { useWorker } from "@mileszim/useworker";
import { compute } from "./transforms.worker";

function Example() {
  const [computeWorker] = useWorker(compute); // reads like a pure function

  const run = async () => {
    const result = await computeWorker([1, 2, 3]); // runs off the main thread
    console.log(result);
  };

  return (
    <button type="button" onClick={run}>
      Run
    </button>
  );
}
```

:::tip
Because TypeScript resolves `./transforms.worker` to the real source file, `compute` keeps its real type signature — argument and return types are inferred at the call site. At runtime the plugin swaps it for a worker-backed reference.
:::

## How it works

1. Imports of worker modules are redirected to a generated proxy whose named exports are tagged references understood by `useWorker`.
2. Each reference is backed by Vite's native `?worker`, so the bundler compiles the worker module's **entire import graph** into a dedicated module-worker chunk.
3. A small RPC dispatcher is appended to the worker so its exports are callable over `postMessage`.

`useWorker` detects the tagged reference and routes to this module-worker path instead of the blob/`toString` path — the call site is unchanged.

## Options

```javascript
useworkerVite({
  include: /\.worker\.[mc]?[jt]sx?$/, // default — which modules are worker modules
  exclude: undefined, // modules to skip even if they match `include`
});
```

## Limitations

:::warning

- **Named exports only** — export worker functions as `export const fn = ...`, not `export default`.
- Worker modules must be statically importable (a normal `import`) so the plugin can find them at build time.
- Standard Web Worker constraints still apply: no `window`/`document`, arguments and results must be structured-cloneable, and a worker function can't return a function. See [Limitations](./limitation.md).

:::

:::note
This plugin is Vite-only. For other bundlers, the classic self-contained-function approach (or the `remoteDependencies` option) still applies.
:::
