// A leaf module — imported by ./stats, which is imported by ./analyze, which is
// imported by the worker. None of this survives the classic `fn.toString()`
// path; @mileszim/useworker-vite bundles the whole graph into the worker.
export const square = (x) => x * x

export const sum = (xs) => xs.reduce((acc, x) => acc + x, 0)
