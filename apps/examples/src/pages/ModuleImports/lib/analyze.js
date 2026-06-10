import { format } from 'date-fns' // a real npm package — bundled into the worker
import { mean, median, stddev } from './stats' // ./stats -> ./math

/**
 * Composed from several local modules (./stats -> ./math) plus the npm
 * `date-fns` package. Shared by the main-thread button and the worker so both
 * run the exact same code — the only difference is which thread it runs on.
 */
export const analyzeNumbers = (numbers) => ({
  count: numbers.length,
  mean: Number(mean(numbers).toFixed(3)),
  median: Number(median(numbers).toFixed(3)),
  stddev: Number(stddev(numbers).toFixed(3)),
  finishedAt: format(new Date(), 'HH:mm:ss.SSS'),
})
