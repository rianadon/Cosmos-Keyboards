import { cpus } from 'os'

type QueueItem<R> = { name: string; f: () => Promise<R> }
type WorkingItem<R> = { promise: Promise<R>; began: number; name: string }
export class PromisePool<R = void> {
  private queue: QueueItem<R>[] = []
  private working: WorkingItem<R>[] = []
  private interactive = (process.stdout.moveCursor != null)

  constructor(private size = cpus().length) {}

  /** Add a task to the queue */
  add(name: string, f: () => Promise<R>): void {
    this.queue.push({ name, f })
  }

  /** Wrap a promise in a few extra variables the code requires */
  toWorking(queueItem: QueueItem<R>): WorkingItem<R> {
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
        console.log(`[${time}s] Generating ${w.name}       `)
      } else {
        console.log() // Pad with blank lines
      }
    }
    console.log(`Plus ${this.queue.length} more tasks        `)
  }

  /** Execute all tasks in the queue */
  async run(): Promise<void> {
    for (let i = 0; i < this.size; i++) {
      this.working.push(this.toWorking(this.queue.shift()!))
      if (this.interactive) console.log()
    }
    if (this.interactive) console.log()

    this.updateConsole()
    const interval = setInterval(() => this.updateConsole(), 1000)

    while (this.working.length > 0) {
      const toRemove = await Promise.race(this.working.map(w => w.promise.then(() => w)))
      if (!this.interactive) {
        const time = Math.round((Date.now() - toRemove.began) / 1000)
        console.log(`[${time}s] Finished ${toRemove.name}`)
      }
      this.working.splice(this.working.indexOf(toRemove), 1)
      if (this.queue.length > 0) this.working.push(this.toWorking(this.queue.shift()!))
    }
    clearInterval(interval)
  }
}
