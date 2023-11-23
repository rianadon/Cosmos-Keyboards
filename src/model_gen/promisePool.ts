import { cpus } from 'os'

type QueueItem<R> = { name: string; f: () => Promise<R> }
type WorkingItem<R> = { promise: Promise<R>; began: number; name: string }
export class PromisePool<R = void> {
  private queue: QueueItem<R>[] = []
  private working: WorkingItem<R>[] = []

  constructor(private size = cpus().length) {}

  add(name: string, f: () => Promise<R>): void {
    this.queue.push({ name, f })
  }

  toWorking(queueItem: QueueItem<R>): WorkingItem<R> {
    return {
      name: queueItem.name,
      promise: queueItem.f(),
      began: Date.now(),
    }
  }

  updateConsole() {
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

  async run(): Promise<void> {
    for (let i = 0; i < this.size; i++) {
      this.working.push(this.toWorking(this.queue.shift()!))
      console.log()
    }
    console.log()

    this.updateConsole()
    const interval = setInterval(() => this.updateConsole(), 1000)

    while (this.working.length > 0) {
      const toRemove = await Promise.race(this.working.map(w => w.promise.then(() => w)))
      this.working.splice(this.working.indexOf(toRemove), 1)
      if (this.queue.length > 0) this.working.push(this.toWorking(this.queue.shift()!))
    }
    clearInterval(interval)
  }
}
