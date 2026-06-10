/**
 * Contract shared between `useWorker` (this package) and the build-time
 * `@mileszim/useworker-vite` plugin.
 *
 * The plugin can't move a closure or an import graph into a worker at runtime —
 * `fn.toString()` only captures one function's source text. Instead it bundles
 * a `*.worker.{js,ts}` module (and its full import graph, including npm deps)
 * into a real module-worker chunk, and replaces each named export with a
 * *tagged ref*: a small object that tells `useWorker` how to build that worker
 * and which exported function to invoke.
 *
 * `useWorker` detects the tag and routes to the module path instead of the
 * blob/`toString` path, so `const [run] = useWorker(myWorkerFn)` reads exactly
 * like passing a pure function.
 */

/** Marker key on the message envelope, identifying the module-worker RPC protocol. */
export const UW_MSG = '__uw' as const

/** Request posted to the worker: invoke `name(...args)`, correlate the reply by `id`. */
export interface WorkerModuleRequest {
  [UW_MSG]: 1
  id: number
  name: string
  args: unknown[]
}

/** Reply posted back from the worker for request `id`. */
export type WorkerModuleResponse =
  | { [UW_MSG]: 1; id: number; ok: true; result: unknown }
  | {
      [UW_MSG]: 1
      id: number
      ok: false
      error: { name: string; message: string; stack?: string }
    }

/** The shape the plugin emits for each exported worker function. */
export interface WorkerModuleRef {
  __useWorkerModule: {
    /** Builds a fresh module worker for this module (Vite's `?worker` ctor). */
    factory: () => Worker
    /** Which exported function of the worker module to invoke. */
    name: string
  }
}

/**
 * Returns the worker-module descriptor if `fn` is a plugin-produced tagged ref,
 * otherwise null. The plugin types these refs as the original function
 * signature for DX, so this is the runtime escape hatch behind that type.
 */
export const getWorkerModuleRef = (
  fn: unknown,
): WorkerModuleRef['__useWorkerModule'] | null => {
  if (
    fn != null &&
    typeof fn === 'object' &&
    '__useWorkerModule' in fn &&
    typeof (fn as WorkerModuleRef).__useWorkerModule?.factory === 'function'
  ) {
    return (fn as WorkerModuleRef).__useWorkerModule
  }
  return null
}
