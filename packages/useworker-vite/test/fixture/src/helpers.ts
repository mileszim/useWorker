// A plain local module — imported by the worker, must be bundled INTO the
// worker chunk (this is exactly what the blob/toString path could not do).
export const square = (x: number): number => x * x
