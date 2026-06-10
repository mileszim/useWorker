import React from 'react'
import { useDeepCallback } from './hook/useDeepCallback'
import { AbortError } from './lib/abortError'
import createWorkerBlobUrl from './lib/createWorkerBlobUrl'
import WORKER_STATUS from './lib/status'
import { getWorkerModuleRef, UW_MSG } from './lib/workerModule'

type WorkerController = {
  status: WORKER_STATUS
  kill: Function
}

export enum TRANSFERABLE_TYPE {
  AUTO = 'auto',
  NONE = 'none',
}

type Options = {
  timeout?: number
  remoteDependencies?: string[]
  autoTerminate?: boolean
  transferable?: TRANSFERABLE_TYPE
}

const PROMISE_RESOLVE = 'resolve'
const PROMISE_REJECT = 'reject'
const DEFAULT_OPTIONS: Options = {
  timeout: undefined,
  remoteDependencies: [],
  autoTerminate: true,
  transferable: TRANSFERABLE_TYPE.AUTO,
}

/**
 *
 * @param {Function} fn the function to run with web worker
 * @param {Object} options useWorker option params
 */
export const useWorker = <T extends (...fnArgs: any[]) => any>(
  fn: T,
  options: Options = DEFAULT_OPTIONS,
) => {
  const [workerStatus, setWorkerStatus] = React.useState<WORKER_STATUS>(
    WORKER_STATUS.PENDING,
  )
  const worker = React.useRef<(Worker & { _url?: string }) | undefined>(
    undefined,
  )
  const isRunning = React.useRef(false)
  const promise = React.useRef<{
    [PROMISE_REJECT]?: (result: ReturnType<T> | ErrorEvent | AbortError) => void
    [PROMISE_RESOLVE]?: (result: ReturnType<T>) => void
  }>({})
  const timeoutId = React.useRef<number | undefined>(undefined)
  const callId = React.useRef(0)

  const killWorker = React.useCallback(() => {
    if (worker.current) {
      promise.current[PROMISE_REJECT]?.(new AbortError())

      worker.current.terminate()
      // Blob workers (the fn.toString() path) carry a `_url` to revoke; module
      // workers built by the useworker-vite plugin do not.
      if (worker.current._url) {
        URL.revokeObjectURL(worker.current._url)
      }
      promise.current = {}
      worker.current = undefined
      isRunning.current = false
      window.clearTimeout(timeoutId.current)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const onWorkerEnd = React.useCallback(
    (status: WORKER_STATUS) => {
      const terminate =
        options.autoTerminate != null
          ? options.autoTerminate
          : DEFAULT_OPTIONS.autoTerminate

      if (terminate) {
        killWorker()
      }
      setWorkerStatus(status)
    },
    [options.autoTerminate, killWorker, setWorkerStatus],
  )

  const generateWorker = useDeepCallback(() => {
    const {
      remoteDependencies = DEFAULT_OPTIONS.remoteDependencies,
      timeout = DEFAULT_OPTIONS.timeout,
      transferable = DEFAULT_OPTIONS.transferable,
    } = options

    const moduleRef = getWorkerModuleRef(fn)
    let newWorker: Worker & { _url?: string }

    if (moduleRef) {
      // Module path: a fully-bundled module worker built by useworker-vite.
      // No blob / `fn.toString()`, so the worker can use cross-file and npm
      // imports just like any other module.
      newWorker = moduleRef.factory()
    } else {
      // Blob path: must be a *classic* worker. The generated blob uses
      // `importScripts(...)` for `remoteDependencies`, which throws in module
      // workers ("Module scripts don't support importScripts()").
      const blobUrl = createWorkerBlobUrl(
        fn,
        remoteDependencies!,
        transferable!,
      )
      newWorker = new Worker(blobUrl)
      newWorker._url = blobUrl
    }

    newWorker.onmessage = (e: MessageEvent) => {
      // Module path envelope: { __uw, id, ok, result | error }
      if (e.data?.[UW_MSG]) {
        if (e.data.ok) {
          promise.current[PROMISE_RESOLVE]?.(e.data.result)
          onWorkerEnd(WORKER_STATUS.SUCCESS)
        } else {
          promise.current[PROMISE_REJECT]?.(e.data.error)
          onWorkerEnd(WORKER_STATUS.ERROR)
        }
        return
      }

      // Blob path envelope: [status, result]
      const [status, result] = e.data as [WORKER_STATUS, ReturnType<T>]

      switch (status) {
        case WORKER_STATUS.SUCCESS:
          promise.current[PROMISE_RESOLVE]?.(result)
          onWorkerEnd(WORKER_STATUS.SUCCESS)
          break
        default:
          promise.current[PROMISE_REJECT]?.(result)
          onWorkerEnd(WORKER_STATUS.ERROR)
          break
      }
    }

    newWorker.onerror = (e: ErrorEvent) => {
      promise.current[PROMISE_REJECT]?.(e)
      onWorkerEnd(WORKER_STATUS.ERROR)
    }

    if (timeout) {
      timeoutId.current = window.setTimeout(() => {
        killWorker()
        setWorkerStatus(WORKER_STATUS.TIMEOUT_EXPIRED)
      }, timeout)
    }
    return newWorker
  }, [fn, options, killWorker])

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const callWorker = React.useCallback(
    (...workerArgs: Parameters<T>) => {
      const { transferable = DEFAULT_OPTIONS.transferable } = options
      return new Promise<ReturnType<T>>((resolve, reject) => {
        promise.current = {
          [PROMISE_RESOLVE]: resolve,
          [PROMISE_REJECT]: reject,
        }
        const transferList: any[] =
          transferable === TRANSFERABLE_TYPE.AUTO
            ? workerArgs.filter(
                (val: any) =>
                  ('ArrayBuffer' in window && val instanceof ArrayBuffer) ||
                  ('MessagePort' in window && val instanceof MessagePort) ||
                  ('ImageBitmap' in window && val instanceof ImageBitmap) ||
                  ('OffscreenCanvas' in window &&
                    val instanceof OffscreenCanvas),
              )
            : []

        const moduleRef = getWorkerModuleRef(fn)
        if (moduleRef) {
          callId.current += 1
          worker.current?.postMessage(
            {
              [UW_MSG]: 1,
              id: callId.current,
              name: moduleRef.name,
              args: [...workerArgs],
            },
            transferList,
          )
        } else {
          worker.current?.postMessage([[...workerArgs]], transferList)
        }

        setWorkerStatus(WORKER_STATUS.RUNNING)
      })
    },
    [setWorkerStatus],
  )

  const workerHook = React.useCallback(
    (...fnArgs: Parameters<T>) => {
      const terminate =
        options.autoTerminate != null
          ? options.autoTerminate
          : DEFAULT_OPTIONS.autoTerminate

      if (isRunning.current) {
        console.error(
          '[useWorker] You can only run one instance of the worker at a time, if you want to run more than one in parallel, create another instance with the hook useWorker(). Read more: https://github.com/alewin/useWorker',
        )
        return Promise.reject()
      }
      if (terminate || !worker.current) {
        worker.current = generateWorker()
      }

      return callWorker(...fnArgs)
    },
    [options.autoTerminate, generateWorker, callWorker],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const killWorkerController = React.useCallback(() => {
    killWorker()
    setWorkerStatus(WORKER_STATUS.KILLED)
  }, [killWorker, setWorkerStatus])

  const workerController = {
    status: workerStatus,
    kill: killWorkerController,
  }

  React.useEffect(() => {
    isRunning.current = workerStatus === WORKER_STATUS.RUNNING
  }, [workerStatus])

  React.useEffect(
    () => () => {
      killWorker()
    },
    [killWorker],
  )

  return [workerHook, workerController] as [typeof workerHook, WorkerController]
}
