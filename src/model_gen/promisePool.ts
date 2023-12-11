import { cpus } from 'os'

type R = string | void
type QueueItem = { name: string; f: () => Promise<R> }
type WorkingItem = { promise: Promise<R>; began: number; name: string }
export class PromisePool {
  private queue: QueueItem[] = []
  private working: WorkingItem[] = []
  private interactive: boolean

  constructor(private size = cpus().length, interactive?: boolean) {
    this.interactive = interactive ?? (process.stdout.moveCursor != null)
  }

  /** Add a task to the queue */
  add(name: string, f: () => Promise<R>): void {
    this.queue.push({ name, f })
  }

  /** Wrap a promise in a few extra variables the code requires */
  toWorking(queueItem: QueueItem): WorkingItem {
    return {
      name: queueItem.name,
      promise: queueItem.f(),
      began: Date.now(),
    }
  }

  updateConsole() {
    if (!this.interactive) return
    process.stdout.moveCursor(0, -this.size - 1)

    for (let i = 0; i < this.size; i++) {
      if (i < this.working.length) {
        const w = this.working[i]
        const time = Math.round((Date.now() - w.began) / 1000)
        process.stdout.write(`[${time}s] Generating ${w.name}`)
        process.stdout.clearLine(1)
        console.log()
      } else {
        process.stdout.clearLine(1)
        console.log()
      }
    }
    process.stdout.write(`Plus ${this.queue.length} more tasks`)
    process.stdout.clearLine(1)
    console.log()
  }

  /** Execute all tasks in the queue */
  async run(): Promise<void> {
    for (let i = 0; i < this.size; i++) {
      if (this.queue.length) {
        this.working.push(this.toWorking(this.queue.shift()!))
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
      if (this.interactive && result) {
        process.stdout.moveCursor(0, -this.size - 1)
        console.log(toRemove.name + ' in ' + time + 's: ' + result)
        console.log('\n'.repeat(this.size))
        this.updateConsole()
      } else if (!this.interactive) {
        console.log(`[${time}s] Finished ${toRemove.name}`)
        if (result) console.log('  ↳ ' + result)
      }
      this.working.splice(this.working.indexOf(toRemove), 1)
      if (this.queue.length > 0) this.working.push(this.toWorking(this.queue.shift()!))
    }
    clearInterval(interval)
  }
}
