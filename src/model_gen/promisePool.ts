import { cpus } from 'os'
import { maybeStat } from './modeling'

type R = string | void | { key: string; result: any; output?: string }
type QueueItem = { name: string; f: () => Promise<R> }
type WorkingItem = { promise: Promise<R>; began: number; name: string }
export class PromisePool {
  protected queue: QueueItem[] = []
  protected queuePromises: Promise<void>[] = []
  protected nSkipped = 0
  protected working: WorkingItem[] = []
  protected interactive: boolean
  public results: Record<string, any> = {}

  constructor(protected size = cpus().length, interactive?: boolean) {
    this.interactive = interactive ?? (process.stdout.moveCursor != null)
  }

  /** Add a task to the queue */
  add(name: string, f: () => Promise<R>): void {
    this.queue.push({ name, f })
  }

  /** Add a task to the queue only if the generated file is older than any of its dependencies */
  addIfModified(name: string, output: string, dependencies: string[], f: () => Promise<R>): void {
    this.queuePromises.push((async () => {
      const [outStat, ...depStats] = await Promise.all([maybeStat(output), ...dependencies.map(maybeStat)])
      for (let i = 0; i < depStats.length; i++) {
        if (!depStats[i]) throw new Error(`Dependency ${dependencies[i]} was not found in the filesystem.`)
      }
      if (!outStat?.mtime || depStats.some(d => !d!.mtime || outStat.mtime < d!.mtime)) {
        this.queue.push({ name, f })
      } else {
        this.nSkipped++
      }
    })())
  }

  async skippedCount() {
    await Promise.all(this.queuePromises)
    return this.nSkipped
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

  protected updateResult(name: string, time: number, result: R) {
    let output: string | undefined = ''
    if (typeof result === 'object' && result) {
      output = result.output
      this.results[result.key] = result.result
    } else if (typeof result == 'string') {
      output = result
    }
    if (this.interactive && output) {
      process.stdout.moveCursor(0, -this.size - 1)
      console.log(name + ' in ' + time + 's: ' + output)
      console.log('\n'.repeat(this.size))
      this.updateConsole()
    } else if (!this.interactive) {
      console.log(`[${time}s] Finished ${name}`)
      if (output) console.log('  ↳ ' + output)
    }
  }

  /** Execute all tasks in the queue */
  async run(): Promise<void> {
    await Promise.all(this.queuePromises)
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
      this.updateResult(toRemove.name, time, result)
      this.working.splice(this.working.indexOf(toRemove), 1)
      if (this.queue.length > 0) this.working.push(this.toWorking(this.queue.shift()!))
    }
    clearInterval(interval)
  }
}
