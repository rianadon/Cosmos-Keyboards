/** Manage multiple web workers in parallel */
import { browser } from '$app/environment'
import { type Remote, wrap } from 'comlink'
import { type Writable, writable } from 'svelte/store'

export interface PoolWorker<T> {
  index: number
  worker: Worker
  remote: Remote<T>
  availableStore: Writable<boolean>
  available: boolean
  task: Promise<PoolWorker<T>>
}

interface History {
  start: number
  end: number
  index: number
  name?: string
  ocTime: number
}

export interface TaskError extends Error {
  task: string
}

export class WorkerPool<T> {
  public workers: PoolWorker<T>[]
  public history: Writable<History[]>

  constructor(public numWorkers: number, private create: () => Worker) {
    this.workers = new Array(numWorkers)
    this.history = writable([])

    if (!browser) return // Do not initialize workers if we're not in a browser
    for (let i = 0; i < numWorkers; i++) {
      const worker = create()
      this.workers[i] = {
        index: i,
        worker: worker,
        remote: wrap(worker),
        available: true,
        availableStore: writable(true),
        task: Promise.resolve(null as any),
      }
      this.workers[i].task = Promise.resolve(this.workers[i])
    }
  }

  async findAvailable(): Promise<PoolWorker<T>> {
    // Promise.resolve seems to prefer pending promises over resolved ones
    // So check to see if there are any immediately available workers
    const availableWorker = this.workers.find(w => w.available)
    if (availableWorker) {
      availableWorker.available = false // Hack to stop another task being immediately scheduled here
      return availableWorker
    }
    // Wait for a worker to finish
    const worker = await Promise.race(this.workers.map(w => w.task))
    // Try to be the first to grab it
    if (!worker.available) {
      // Another task already scheduled on this worker
      return await this.findAvailable()
    }
    // Grab the worker and return it
    worker.available = false
    return worker
  }

  async execute<R>(fn: (w: Remote<T>) => Promise<R>, name?: string) {
    const worker = await this.findAvailable()
    const task = fn(worker.remote)
    worker.availableStore.set(false)
    worker.available = false
    worker.task = task.then(() => worker)
    const start = performance.now()
    let result: R
    try {
      result = await task
    } catch (e) {
      if (typeof e == 'number') e = new Error('OpenCascade Error: ' + e)
      e.task = name
      throw e
    }
    this.history.update(h => [...h, {
      index: worker.index,
      name,
      start,
      end: performance.now(),
      ocTime: (result as any)?.ocTime,
    }])
    worker.availableStore.set(true)
    worker.available = true
    return result
  }

  async executeNow<R>(fn: (w: Remote<T>) => Promise<R>, name?: string) {
    this.reset(1)
    return this.execute(fn, name)
  }

  reset(n?: number) {
    if (!browser) return
    this.history.set([])
    const nWorkers = typeof n === 'number' ? n : this.numWorkers
    for (let i = 0; i < nWorkers; i++) {
      const worker = this.workers[i]
      if (!worker.available) {
        worker.worker.terminate()
        worker.worker = this.create()
        worker.remote = wrap(worker.worker)
        worker.available = true
        worker.availableStore.set(true)
        worker.task = Promise.resolve(worker)
      }
    }
  }
}
