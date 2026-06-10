# @mileszim/useworker-vite

A Vite plugin for [`@mileszim/useworker`](../useWorker) that lets you write your
worker function across **multiple modules and npm packages** and invoke it
exactly like passing a pure function.

## Why

`useWorker(fn)` moves `fn` into a Web Worker by stringifying it
(`fn.toString()`). That captures only the source text of that one function — any
variable from its closure or any imported binding is **not** included, so a
worker function that references other modules throws `ReferenceError` at
runtime:

```ts
import { square } from './math'
const compute = (xs) => xs.map(square) // `square` is undefined inside the worker
useWorker(compute) // ❌ ReferenceError: square is not defined
```

The import graph that `square` came from was resolved and discarded by your
bundler — it doesn't exist at runtime. The only place it _does_ exist is at
**build time**, which is what this plugin hooks into.

## How it works

1. You put worker code in a `*.worker.{js,ts,jsx,tsx}` module and import it
   normally.
2. The plugin redirects that import to a generated proxy whose named exports are
   *tagged refs* understood by `useWorker`.
3. Each ref is backed by Vite's native `?worker`, so the bundler compiles the
   worker module's **entire import graph** (local files _and_ npm packages) into
   a dedicated module-worker chunk.
4. A tiny RPC dispatcher is appended to the worker so its exports are callable
   over `postMessage`.

`useWorker` detects the tagged ref and routes to this module-worker path instead
of the blob/`toString` path — so the call site is unchanged.

## Install

```bash
npm install @mileszim/useworker
npm install -D @mileszim/useworker-vite
```

## Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { useworkerVite } from '@mileszim/useworker-vite'

export default defineConfig({
  plugins: [react(), useworkerVite()],
})
```

## Usage

```ts
// transforms.worker.ts
import Papa from 'papaparse' // npm dep — bundled into the worker
import { square } from './math' // local import — bundled into the worker

export const compute = (xs: number[]) => xs.map(square)
export const parseCsv = (text: string) => Papa.parse(text).data
```

```tsx
import { useWorker } from '@mileszim/useworker'
import { compute } from './transforms.worker'

function Example() {
  const [computeWorker] = useWorker(compute) // reads like a pure function

  const run = async () => {
    const result = await computeWorker([1, 2, 3]) // runs off the main thread
    console.log(result)
  }
  // ...
}
```

Because TypeScript resolves `./transforms.worker` to the real source, `compute`
keeps its real type signature — argument and return types are inferred at the
call site. (At runtime it is a tagged ref; the plugin makes that swap safe.)

## Options

```ts
useworkerVite({
  // Which modules are treated as worker modules.
  include: /\.worker\.[mc]?[jt]sx?$/, // default
  // Modules to exclude even if they match `include`.
  exclude: undefined,
})
```

## Limitations

- **Named exports only.** Export worker functions as named exports
  (`export const fn = …`), not `export default`.
- Worker modules must be statically importable (a normal `import`), so the
  plugin can find them at build time.
- Standard Web Worker constraints still apply: no `window`/`document` access,
  arguments and results must be structured-cloneable, and a worker function
  can't return a function.

## Testing

The runtime behavior is verified end-to-end in a real browser (jsdom cannot
execute workers) across both dev and production builds:

```bash
pnpm --filter @mileszim/useworker-vite test
```

Point `CHROME_PATH` at a Chrome/Chromium binary if it isn't at the default
macOS location.
