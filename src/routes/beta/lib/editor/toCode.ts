import { curvature, cuttleConf, type Cuttleform, type CuttleformProto, fingers, newGeometry, thumbCurvature, thumbOrigin, thumbs, upperKeysPlane } from '$lib/worker/config'
import ETrsf, { stringifyObj } from '$lib/worker/modeling/transformation-ext'

const INDENT = 2

/** A custom implementation of JSON.stringify that deals with special constructs. */
export function jsonToCode(o: object, level = 0): string {
  if (Array.isArray(o)) {
    if (typeof o[0] != 'object') return '[' + o.map(a => jsonToCode(a, level + 1)).join(', ') + ']'
    return '[\n' + o.map(a => ' '.repeat(INDENT * (level + 1)) + jsonToCode(a, level + 1)).join(',\n') + '\n' + ' '.repeat(INDENT * level)
      + ']'
  }
  if (o instanceof ETrsf) {
    return o.toString((level + 1) * INDENT)
  }

  if (typeof o == 'object' && typeof o !== 'undefined' && o !== null) {
    const entries = Object.entries(o).filter(([k, v]) => typeof v != 'undefined')
    if (entries.length == 0) return '{}'
    if (entries.length <= 2) return '{ ' + entries.map(([k, v]) => k + ': ' + jsonToCode(v, level + 1)).join(', ') + ' }'

    return '{\n' + entries.map(([k, v]) => ' '.repeat(INDENT * (level + 1)) + k + ': ' + jsonToCode(v, level + 1)).join(',\n') + '\n' + ' '.repeat(INDENT * level)
      + '}'
  }

  if (typeof o == 'number') {
    // Display fractions in fractional form
    if (Math.abs(10 * o - Math.round(10 * o)) < 1e-9) return '' + o
    if (Math.abs(10 / o - Math.round(10 / o)) < 1e-9) return `1/${Math.round(10 / o) / 10}`
    return '' + o
  }

  return JSON.stringify(o)
}

export function toCode(proto: CuttleformProto) {
  const c = cuttleConf(proto)

  const keysPlane = upperKeysPlane(proto)
  const thumbOffset = thumbOrigin(proto)

  const geo = newGeometry(c)
  const screwIdx = geo.justScrewIndices
  const connectorIdx = proto.wall.microcontroller ? geo.autoConnectorIndex : -1

  const cm: Partial<Cuttleform> = { ...c }
  delete cm.keys
  delete cm.wristRestOrigin

  const fingy = fingers(proto)
  const thumb = thumbs(proto)

  return [
    'const options: Options = ' + jsonToCode(cm),
    '// NOTE: Screws / the connector with',
    '// negative indices are placed automatically.',
    '// In the basic/advanced tab, these values were:',
    `// screwIndices: ${jsonToCode(screwIdx)}`,
    `// connectorIndex: ${connectorIdx}`,
    '',
    `const curvature = ${stringifyObj(curvature(false, proto).merged, 0)}`,
    '',
    '/**',
    ' * Useful for setting a different curvature',
    ' * for the pinky keys.',
    ' */',
    `const pinkyCurvature = ${stringifyObj(curvature(true, proto), 0)}`,
    '',
    '/**',
    ` * The plane used to position the upper keys.`,
    ` * It's rotated by the tenting and x rotation`,
    ` * then translated by the z offset.`,
    ` */ `,
    `const ${keysPlane.name} = ${keysPlane.toString(2)}`,
    '',
    `/** Definitions for the upper keys. */`,
    'const fingers: Key[] = ' + jsonToCode(fingy),
    '',
    `/**`,
    ` * The plane used to position the thumbs.`,
    ` * It's defined using a nearby key position,`,
    ` * then offset by some amount.`,
    ` */`,
    `const ${thumbOffset.name} = ${thumbOffset.toString(2)}`,
    '',
    '/** The curvature of the thumb cluster. */',
    `const thumbCurvature = ${stringifyObj(thumbCurvature(proto.thumbCluster), 0)}`,
    '',
    'const thumbs: Key[] = ' + jsonToCode(thumb),
    '',
    `const wristRestOrigin = ${thumbOrigin(proto, true).toString(2)}`,
    '',
    'export default {',
    '  ...options,',
    '  wristRestOrigin,',
    proto.wall.unibody
      ? `  keys: mirror([...fingers, ...thumbs], ${proto.wall.unibodyGap / 10}, ${proto.wall.unibodyAngle / 45}),`
      : '  keys: [...fingers, ...thumbs],',
    '}',
  ].join('\n')
}
