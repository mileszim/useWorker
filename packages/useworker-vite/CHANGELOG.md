# @mileszim/useworker-vite

## 4.2.0

### Minor Changes

- e046f9c: Add the `@mileszim/useworker-vite` Vite plugin, which compiles a `*.worker` module's entire import graph (local files **and** npm packages) into a real module-worker chunk. Worker functions can now be composed across modules and invoked with `useWorker` exactly like a pure function.

  `@mileszim/useworker` detects these plugin-built worker modules and runs them via a module worker instead of the `fn.toString()` blob path. This release also fixes `remoteDependencies` (`importScripts`), which threw under module workers, and the `kill` controller for module workers.
