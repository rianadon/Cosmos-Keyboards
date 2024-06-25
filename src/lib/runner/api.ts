import type { FullCuttleform } from '$lib/worker/config'
import ETrsf, { flipKeyLabels, mirror } from '$lib/worker/modeling/transformation-ext'

export function run(content: string): { newConf?: FullCuttleform; err?: Error } {
  try {
    console.log('Tryin')
    const newConf = Function(
      'Trsf',
      'mirror',
      'flipKeyLabels',
      content.replace('export default', 'return'),
    )(ETrsf, mirror, flipKeyLabels)

    return { newConf }
  } catch (err) {
    return { err }
  }
}
