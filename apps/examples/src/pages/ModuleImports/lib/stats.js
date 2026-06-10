import { square, sum } from './math'

export const mean = (xs) => sum(xs) / xs.length

export const variance = (xs) => {
  const m = mean(xs)
  return mean(xs.map((x) => square(x - m)))
}

export const stddev = (xs) => Math.sqrt(variance(xs))

export const median = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
