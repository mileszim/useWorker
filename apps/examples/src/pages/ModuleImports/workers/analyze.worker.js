import { analyzeNumbers } from '../lib/analyze'

// The worker entry. `@mileszim/useworker-vite` turns this `*.worker.js` module
// into a real module-worker chunk: `analyzeNumbers` and its whole import graph
// (./lib/analyze -> ./lib/stats -> ./lib/math, plus `date-fns`) are bundled in.
//
// A plain `export const` keeps the binding local, which the plugin's dispatcher
// can expose. `useWorker(analyze)` then calls it off the main thread.
export const analyze = (numbers) => analyzeNumbers(numbers)
