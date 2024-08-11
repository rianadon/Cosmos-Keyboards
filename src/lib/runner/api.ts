import type { FullCuttleform } from '$lib/worker/config'
import ETrsf, { mirror, unibody } from '$lib/worker/modeling/transformation-ext'

export function run(content: string): { newConf?: FullCuttleform; err?: Error } {
  try {
    console.log('Tryin')
    const newConf = Function(
      'Trsf',
      'mirror',
      'unibody',
      content.replace('export default', 'return'),
    )(ETrsf, mirror, unibody)

    if (newConf.left) newConf.left.keys = mirror(newConf.left.keys, false)
    return { newConf }
  } catch (err) {
    return { err }
  }
}
