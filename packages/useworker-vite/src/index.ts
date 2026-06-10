import fs from 'node:fs/promises'
import { type ExportSpecifier, init, parse } from 'es-module-lexer'
import type { Plugin } from 'vite'

/**
 * @mileszim/useworker-vite
 *
 * `@mileszim/useworker`'s blob path stringifies the function you pass
 * (`fn.toString()`), which captures only that one function's source — any
 * closure variable or imported binding is lost, so a worker function spread
 * across modules throws `ReferenceError` at runtime.
 *
 * This plugin removes that limitation at build time. You write worker code in a
 * `*.worker.{js,ts,jsx,tsx}` module and import it normally:
 *
 * ```ts
 * // transforms.worker.ts
 * import Papa from 'papaparse'          // npm dep — bundled into the worker
 * import { square } from './math'        // local import — bundled into the worker
 * export const compute = (xs: number[]) => xs.map(square)
 * export const parseCsv = (text: string) => Papa.parse(text).data
 * ```
 *
 * ```tsx
 * import { compute } from './transforms.worker'
 * const [run, ctrl] = useWorker(compute) // reads like a pure function
 * ```
 *
 * The plugin:
 *  1. Redirects imports of `*.worker.*` modules to a generated proxy module
 *     whose named exports are *tagged refs* understood by `useWorker`.
 *  2. Backs each ref with Vite's native `?worker`, so the bundler resolves the
 *     worker module's ENTIRE import graph (local files + npm deps) into a
 *     dedicated module-worker chunk.
 *  3. Appends an RPC dispatcher to the worker entry, exposing its exports over
 *     `postMessage`.
 *
 * The ref shape and message protocol below are the contract with
 * `@mileszim/useworker` (see its `src/lib/workerModule.ts`). Keep them in sync.
 */

export interface UseworkerViteOptions {
  /** Which modules are treated as worker modules. Default: `/\.worker\.[mc]?[jt]sx?$/`. */
  include?: RegExp
  /** Modules to exclude even if they match `include`. */
  exclude?: RegExp
}

const DEFAULT_INCLUDE = /\.worker\.[mc]?[jt]sx?$/
const PROXY_PREFIX = '\0useworker-proxy:'

const cleanId = (id: string): string => id.split('?')[0]

const isWorkerModule = (
  id: string,
  include: RegExp,
  exclude?: RegExp,
): boolean => {
  const path = cleanId(id)
  if (exclude?.test(path)) return false
  return include.test(path)
}

/** Builds the RPC dispatcher appended to a worker entry module. */
const buildDispatcher = (entries: ExportSpecifier[]): string => {
  const apiPairs = entries
    .map((e) => `${JSON.stringify(e.n)}: ${e.ln || e.n}`)
    .join(', ')

  // Mirrors @mileszim/useworker's jobRunner: AUTO-transfer a transferable
  // result. The guard keeps this inert if the module is ever evaluated on the
  // main thread (workers have no `document`).
  return `
;(() => {
  if (typeof self === 'undefined' || typeof self.postMessage !== 'function' || typeof document !== 'undefined') return;
  const __api = { ${apiPairs} };
  const __isTransferable = (v) =>
    (typeof ArrayBuffer !== 'undefined' && v instanceof ArrayBuffer) ||
    (typeof MessagePort !== 'undefined' && v instanceof MessagePort) ||
    (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas);
  self.addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || m.__uw !== 1) return;
    try {
      const fn = __api[m.name];
      if (typeof fn !== 'function') throw new Error('[useworker-vite] worker module has no exported function "' + m.name + '"');
      const result = await fn(...m.args);
      self.postMessage(
        { __uw: 1, id: m.id, ok: true, result },
        __isTransferable(result) ? [result] : []
      );
    } catch (err) {
      self.postMessage({
        __uw: 1,
        id: m.id,
        ok: false,
        error: { name: err && err.name, message: err && err.message, stack: err && err.stack },
      });
    }
  });
})();
`
}

/**
 * Transform that appends the dispatcher to a worker entry module. Registered in
 * BOTH the main pipeline (dev serves the worker entry through the main
 * transform chain) and `config.worker.plugins` (production bundles workers in a
 * separate pipeline). Guarded to skip virtual ids so it never touches the
 * generated proxy.
 */
const makeDispatcherTransform = (include: RegExp, exclude?: RegExp) =>
  async function transform(code: string, id: string) {
    if (id.startsWith('\0')) return null
    if (!isWorkerModule(id, include, exclude)) return null
    await init
    const [, exports] = parse(code)
    const entries = exports.filter((e) => e.n && e.n !== 'default')
    if (entries.length === 0) return null
    return { code: code + buildDispatcher(entries), map: null }
  }

export function useworkerVite(options: UseworkerViteOptions = {}): Plugin[] {
  const include = options.include ?? DEFAULT_INCLUDE
  const { exclude } = options
  const dispatcherTransform = makeDispatcherTransform(include, exclude)

  const workerDispatcherPlugin: Plugin = {
    name: 'useworker-vite:worker-dispatcher',
    enforce: 'pre',
    transform: dispatcherTransform,
  }

  const mainPlugin: Plugin = {
    name: 'useworker-vite',
    enforce: 'pre',

    config() {
      // Production worker builds run a separate plugin pipeline.
      return { worker: { plugins: () => [workerDispatcherPlugin] } }
    },

    // Dev: the worker entry is served through the main transform chain.
    transform: dispatcherTransform,

    async resolveId(source, importer, opts) {
      // Vite adds a `scan` flag during dep pre-bundling; skip those passes.
      if ((opts as { scan?: boolean } | undefined)?.scan) return null
      if (source.startsWith('\0')) return null
      if (!source.includes('.worker')) return null
      // Let Vite's own worker handling claim `realId?worker` / `?worker_file`.
      if (/[?&](worker|sharedworker)/.test(source)) return null

      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (!resolved) return null
      if (!isWorkerModule(resolved.id, include, exclude)) return null

      return PROXY_PREFIX + resolved.id
    },

    async load(id) {
      if (!id.startsWith(PROXY_PREFIX)) return null
      const realId = id.slice(PROXY_PREFIX.length)

      await init
      const src = await fs.readFile(cleanId(realId), 'utf8')
      const [, exports] = parse(src)
      const names = exports
        .map((e) => e.n)
        .filter((n): n is string => Boolean(n) && n !== 'default')

      const lines = [
        `import __UseWorkerCtor from ${JSON.stringify(`${realId}?worker`)};`,
        `function __makeRef(name) { return { __useWorkerModule: { factory: () => new __UseWorkerCtor(), name } }; }`,
        ...names.map(
          (n) =>
            `export const ${n} = /*@__PURE__*/ __makeRef(${JSON.stringify(n)});`,
        ),
      ]
      return lines.join('\n')
    },
  }

  return [mainPlugin]
}

export default useworkerVite
