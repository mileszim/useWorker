import { useWorker } from '@mileszim/useworker'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { compute, dedupe } from './heavy.worker'

declare global {
  interface Window {
    __RESULT__?: unknown
  }
}

// A self-contained inline function — goes the classic blob/`toString` path
// through the SAME hook, proving both paths coexist (regression guard).
const sortNumbers = (nums: number[]): number[] =>
  [...nums].sort((a, b) => a - b)

function App() {
  // `compute` / `dedupe` are typed as the real functions (TS resolves the
  // source), so these calls read exactly like passing pure functions.
  const [computeWorker] = useWorker(compute)
  const [dedupeWorker] = useWorker(dedupe)
  const [sortWorker] = useWorker(sortNumbers)
  const [label, setLabel] = React.useState('running…')

  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  React.useEffect(() => {
    ;(async () => {
      try {
        const squared = await computeWorker([1, 2, 3, 4]) // module path: local `square`
        const deduped = await dedupeWorker([{ a: 1 }, { a: 1 }, { a: 2 }]) // module path: npm `dequal`
        const sorted = await sortWorker([3, 1, 2]) // blob path: inline fn
        window.__RESULT__ = { squared, dedupedLen: deduped.length, sorted }
        setLabel('done')
      } catch (e) {
        window.__RESULT__ = { error: String((e as Error)?.message ?? e) }
        setLabel('error')
      }
    })()
  }, [])

  return <div id="status">{label}</div>
}

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
