import { useWorker, WORKER_STATUS } from '@mileszim/useworker'
import React from 'react'
import toast from 'react-hot-toast'

import { analyzeNumbers } from './lib/analyze' // real function (main thread)
import { analyze } from './workers/analyze.worker' // worker ref (via the plugin)

const numbers = [...Array(2_000_000)].map(() => Math.random() * 1000)

function ResultCard({ title, result }) {
  if (!result) return null
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: 'white',
        padding: '12px 16px',
        borderRadius: 8,
        margin: 8,
        textAlign: 'left',
        minWidth: 220,
        fontFamily: 'monospace',
      }}
    >
      <strong>{title}</strong>
      <div>count: {result.count.toLocaleString()}</div>
      <div>mean: {result.mean}</div>
      <div>median: {result.median}</div>
      <div>stddev: {result.stddev}</div>
      <div>finishedAt: {result.finishedAt}</div>
    </div>
  )
}

function App() {
  const [analyzeWorker, { status }] = useWorker(analyze)
  const [mainBusy, setMainBusy] = React.useState(false)
  const [mainResult, setMainResult] = React.useState(null)
  const [workerResult, setWorkerResult] = React.useState(null)

  const onMainThreadClick = () => {
    setMainBusy(true)
    // Heavy + synchronous → freezes the UI (watch the logo stop spinning).
    requestAnimationFrame(() => {
      const result = analyzeNumbers(numbers)
      setMainResult(result)
      setMainBusy(false)
      toast.success('Main thread finished — the UI was frozen while it ran')
    })
  }

  const onWorkerClick = () => {
    analyzeWorker(numbers).then((result) => {
      setWorkerResult(result)
      toast.success('Worker finished — the UI stayed responsive')
    })
  }

  return (
    <div>
      <section className="App-section">
        <button
          type="button"
          disabled={mainBusy}
          className="App-button"
          onClick={onMainThreadClick}
        >
          {mainBusy ? 'Analyzing… (blocked)' : 'Analyze on main thread'}
        </button>
        <button
          type="button"
          disabled={status === WORKER_STATUS.RUNNING}
          className="App-button"
          onClick={onWorkerClick}
        >
          {status === WORKER_STATUS.RUNNING
            ? 'Analyzing… (non-blocking)'
            : 'Analyze with useWorker()'}
        </button>
      </section>

      <section
        className="App-section"
        style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <ResultCard title="Main thread" result={mainResult} />
        <ResultCard title="useWorker()" result={workerResult} />
      </section>

      <section className="App-section">
        <p style={{ color: 'white', maxWidth: 620, margin: '0 auto' }}>
          The worker function is composed from several modules (
          <code>analyze.js → stats.js → math.js</code>) plus the npm package{' '}
          <code>date-fns</code>. The classic <code>fn.toString()</code> path
          would throw <code>ReferenceError</code>; the{' '}
          <code>@mileszim/useworker-vite</code> plugin bundles the whole import
          graph into the worker so it just works. Compare the two buttons — the
          spinning logo freezes for the main-thread run and keeps spinning for
          the worker run.
        </p>
      </section>
    </div>
  )
}

export default App
