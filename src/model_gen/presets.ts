import cuttleform from '$assets/cuttleform.json' assert { type: 'json' }
import { cuttleConf, type CuttleformProto } from '$lib/worker/config'

import { fromGeometry } from '$lib/loaders/geometry'
import { CONNECTOR, KEYCAP, SWITCH } from '../../target/proto/cuttleform'
import { generate, setup } from './node-model'
import { render } from './node-render'

function getCuttleform(): CuttleformProto {
  return JSON.parse(JSON.stringify(cuttleform.options))
}

async function renderPreset(conf: CuttleformProto, filename: string) {
  const { mesh, center } = await generate(cuttleConf(conf))
  await render(fromGeometry(mesh), 5000, 5000, center, {}).resize(500, 500).toFile('target/' + filename)
}

async function main() {
  await setup()

  const conf = getCuttleform()
  conf.upperKeys.keycapType = KEYCAP.DSA
  conf.upperKeys.switchType = SWITCH.BOX
  conf.upperKeys.rows = 0
  conf.upperKeys.columns = 0
  conf.wall.connector = CONNECTOR.NONE

  await renderPreset(conf, 'thumb-default.png')
  conf.thumbCluster = { oneofKind: 'carbonfetThumb', carbonfetThumb: {} }
  await renderPreset(conf, 'thumb-carbonfet.png')
  conf.thumbCluster = { oneofKind: 'orbylThumb', orbylThumb: { curvature: 0 } }
  await renderPreset(conf, 'thumb-orbyl.png')
  conf.thumbCluster = { oneofKind: 'curvedThumb', curvedThumb: { thumbCount: 5 } }
  await renderPreset(conf, 'thumb-curved.png')

  // conf.keys.thumbType = 'default'
  // conf.keys.thumbCount = 'zero'
  // conf.keys.rows = 3
  // conf.keys.columns = 4
  // await renderPreset(conf, '3x4.png')
  // conf.keys.rows = 4
  // conf.keys.columns = 5
  // await renderPreset(conf, '4x5.png')
  // conf.keys.rows = 5
  // conf.keys.columns = 5
  // await renderPreset(conf, '5x5.png')
  // conf.keys.rows = 4
  // conf.keys.columns = 6
  // await renderPreset(conf, '4x6.png')
  // conf.keys.rows = 5
  // conf.keys.columns = 6
  // await renderPreset(conf, '5x6.png')
}

main()
