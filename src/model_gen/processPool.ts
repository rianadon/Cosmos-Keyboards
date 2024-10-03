import { ChildProcess, fork } from 'child_process'
import { PromisePool } from './promisePool'

type R = string | void | { key: string; result: any; output?: string }
type QueueItem = { name: string; f: () => Promise<R> }
type WorkingItem = { promise: Promise<R>; began: number; name: string; process: ChildProcess }

/**
 * A ProcessPool is like a PromisePool, except that it forks itself n times.
 * Each fork processes items in the queue.
 *
 * Because the ProcessPool is created in every fork, this has the advantage
 * that the pools can all reference a common set of tasks.
 * There cost of startup is also only invoked once per worker!
 *
 * The end result is that a ProcessPool looks very similar to a ProcessPool,
 * except that it can take advantage of multithreading.
 *
 * If a process is being run as a worker, it's argv[2] will be set to "child".
 */
export class ProcessPool extends PromisePool {
  protected workers: ChildProcess[] = []
  protected taskReference: QueueItem[] | undefined

  /** Generate a task to start a new worker */
  startupToWorking(cp: ChildProcess, i: number): WorkingItem {
    return {
      name: `worker ${i}...`,
      promise: new Promise<R>((resolve, reject) => {
        cp.once('message', (m: any) => {
          if (m.error) reject(new Error(m.error))
          else if (m.result !== 'ready') reject(new Error('Worker did not ready'))
          else resolve()
        })
      }),
      process: cp,
      began: Date.now(),
    }
  }

  /** Convert a queued task to one that runs on a given worker */
  processToWorking(cp: ChildProcess, item: QueueItem): WorkingItem {
    cp.send(this.taskReference!.indexOf(item))
    return {
      name: item.name,
      promise: new Promise<R>((resolve, reject) => {
        cp.once('message', (m: any) => {
          if (m.error) reject(new Error(m.error + '\n' + m.stack))
          else resolve(m.result)
        })
      }),
      process: cp,
      began: Date.now(),
    }
  }

  /** Return true if this process is a worker process */
  get isWorker() {
    return process.argv[2]?.startsWith('child')
  }

  async run(): Promise<void> {
    if (this.isWorker) {
      await new Promise<void>((resolve) => {
        process.send!({ id: process.argv[2], result: 'ready' })
        process.on('message', (id: number) => {
          // Quit if the id < 1
          // Otherwise process the corresponding item in the queue
          if (id < 0) return resolve()
          this.queue[id].f().then(
            result => process.send!({ id: process.argv[2], result }),
            error => process.send!({ id: process.argv[2], error: error.message, stack: error.stack }),
          )
        })
      })
      process.exit(0)
    } else {
      this.taskReference = [...this.queue]
      for (let i = 0; i < this.size; i++) {
        if (i < this.queue.length) {
          const subprocess = fork(process.argv[1], ['child'])
          this.workers.push(subprocess)
          this.working.push(this.startupToWorking(subprocess, i))
        }
        if (this.interactive) console.log()
      }
      if (this.interactive) console.log()

      this.updateConsole()
      const interval = setInterval(() => this.updateConsole(), 1000)

      while (this.working.length > 0) {
        const toRemove = await Promise.race(this.working.map(w => w.promise.then(() => w)))
        const result = await toRemove.promise
        const time = Math.round((Date.now() - toRemove.began) / 1000)
        this.updateResult(toRemove.name, time, result)
        this.working.splice(this.working.indexOf(toRemove), 1)
        const cp = (toRemove as WorkingItem).process
        if (this.queue.length > 0) this.working.push(this.processToWorking(cp, this.queue.shift()!))
      }
      clearInterval(interval)

      // Tell all the subprocesses they can exit now
      for (const worker of this.workers) {
        worker.send(-1)
      }
    }
  }
}
