import { dequal } from 'dequal' // a real npm package — must be bundled into the worker
import { square } from './helpers' // a local module — must be bundled into the worker

/** Uses a local import. */
export const compute = (xs: number[]): number[] => xs.map(square)

/** Uses an npm package (dequal) inside the worker. */
export const dedupe = <T>(items: T[]): T[] => {
  const out: T[] = []
  for (const item of items) {
    if (!out.some((seen) => dequal(seen, item))) out.push(item)
  }
  return out
}
