import { curvature, cuttleConf, type Cuttleform, type CuttleformProto, fingers, newFullGeometry, newGeometry, thumbCurvature, thumbOrigin, thumbs, upperKeysPlane } from '$lib/worker/config'
import { calcClusterTrsf, type CosmosKey, type CosmosKeyboard, fromCosmosConfig, mirrorCluster, rotationPositionETrsf, sortClusters, toCosmosConfig } from '$lib/worker/config.cosmos'
import ETrsf, { stringifyObj } from '$lib/worker/modeling/transformation-ext'
import { capitalize, notNull, objEntries } from '$lib/worker/util'
import type { ClusterName, ClusterSide } from 'target/cosmosStructs'

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

function allClustersFlipped(conf: CosmosKeyboard) {
  const newClusters = [...conf.clusters]
  for (const name of ['fingers', 'thumbs'] as ClusterName[]) {
    if (!newClusters.find(c => c.side == 'left' && c.name == name)) {
      newClusters.push(mirrorCluster({
        ...newClusters.find(c => c.side == 'right' && c.name == name)!,
        side: 'left',
      }))
    }
  }
  sortClusters(newClusters)
  return newClusters
}

export function toCode(proto: CosmosKeyboard) {
  const cosmosConf = fromCosmosConfig(proto, false)
  const geo = newFullGeometry(cosmosConf)

  const baseConfig: Partial<Cuttleform> = { ...cosmosConf.right! ?? cosmosConf.unibody }
  delete baseConfig.keys

  const fingerDefinitions: string[] = []
  const fingerReferences: string[] = []
  for (const [name, kbd] of objEntries(cosmosConf)) {
    fingerReferences.push(
      `  ${name}: {`,
      '    ...options,',
      `    keys: [...fingers${capitalize(name)}, ...thumbs${capitalize(name)}],`,
      '  },',
    )
    for (const side of ['fingers', 'thumbs']) {
      const keys = kbd!.keys.filter(k => k.cluster == side)
      fingerDefinitions.push(
        'const ' + side + capitalize(name) + ': Key[] = ' + jsonToCode(keys) + '\n',
      )
    }
  }

  // const keysPlane = upperKeysPlane(proto)
  // const thumbOffset = thumbOrigin(proto)

  // const screwIdx = geo.justScrewIndices
  // const connectorIdx = c.microcontroller ? geo.autoConnectorIndex : -1

  // const wrOrigin = baseConfig.wristRestOrigin
  // delete baseConfig.wristRestOrigin

  // const fingy = fingers(proto)
  // const thumb = thumbs(proto)

  return [
    'const options: Options = ' + jsonToCode(baseConfig),
    '// NOTE: Screws / the connector with',
    '// negative indices are placed automatically.',
    '// In the basic/advanced tab, these values were:',
    // `// screwIndices: ${jsonToCode(screwIdx)}`,
    // `// connectorIndex: ${connectorIdx}`,
    '',
    // `const curvature = ${stringifyObj(curvature(false, proto).merged, 0)}`,
    '',
    // '/**',
    // ' * Useful for setting a different curvature',
    // ' * for the pinky keys.',
    // ' */',
    // `const pinkyCurvature = ${stringifyObj(curvature(true, proto), 0)}`,
    '',
    '/**',
    ` * The planes used to position the clusters.`,
    ` * It's rotated by the tenting and x rotation`,
    ` */ `,
    ...notNull(
      allClustersFlipped(proto).map(cluster => {
        const clusterName = cluster.side + capitalize(cluster.name) + 'Plane'
        const clusterTrsf = calcClusterTrsf(cluster, proto)
        return clusterTrsf ? `const ${clusterName} = ${clusterTrsf.toString(2)}\n` : null
      }),
    ),
    // `const ${keysPlane.name} = ${keysPlane.toString(2)}`,
    '',
    `/** Definitions for all keys. */`,
    ...fingerDefinitions,
    // '',
    // '',
    // '/** The curvature of the thumb cluster. */',
    // `const thumbCurvature = ${stringifyObj(thumbCurvature(proto.thumbCluster), 0)}`,
    // '',
    // 'const thumbs: Key[] = ' + jsonToCode(thumb),
    // '',
    // `const wristRestOrigin = ${jsonToCode(wrOrigin!)}`,
    // '',
    'export default {',
    ...fingerReferences,
    '}',
  ].join('\n')
}
