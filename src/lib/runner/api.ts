import type { Cuttleform } from '$lib/worker/config'
import ETrsf, { mirror } from '$lib/worker/modeling/transformation-ext'

export function run(content: string): { newConf?: Cuttleform; err?: Error } {
  try {
    console.log('Tryin')
    const newConf = Function('Trsf', 'mirror', content.replace('export default', 'return'))(ETrsf, mirror)
    return { newConf }
  } catch (err) {
    return { err }
  }
}
