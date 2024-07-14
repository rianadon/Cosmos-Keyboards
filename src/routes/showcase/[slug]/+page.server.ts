import { KEY_NAMES } from '$lib/geometry/keycaps.js'
import { PART_INFO } from '$lib/geometry/socketsParts.js'
import { type CosmosKeyboard, fromCosmosConfig } from '$lib/worker/config.cosmos.js'
import { sum } from '$lib/worker/util.js'
import type { CuttleKey } from '$target/cosmosStructs.js'
import { error } from '@sveltejs/kit'
import { deserialize } from '../../beta/lib/serialize.js'
import { keyboards } from '../showcase.js'

function isTrulyKey(k: CuttleKey) {
  return PART_INFO[k.type].keycap && k.type != 'blank'
}

export const load = ({ params }) => {
  const keyboard = keyboards.find(k => k.key == params.slug)

  if (!keyboard) {
    error(404, {
      message: 'Not found',
    })
  }

  const deserialized = keyboard.config ? deserialize(keyboard.config.substring(1), () => undefined as any).options as CosmosKeyboard : undefined
  const cuttleConf = deserialized ? fromCosmosConfig(deserialized) : undefined

  let name = ''
  if (cuttleConf) {
    if (keyboard.type == 'left') name += cuttleConf.left!.keys.filter(isTrulyKey).length + '-Key '
    if (keyboard.type == 'right') name += cuttleConf.right!.keys.filter(isTrulyKey).length + '-Key '
    else name += sum(Object.values(cuttleConf).map(c => c.keys.filter(isTrulyKey).length)) + '-Key '
  }
  name += {
    split: 'Split Keyboard',
    left: "Keyboard (yes, that's all!)",
    right: "Keyboard (yes, that's all!)",
    unibody: 'Unibody Keyboard',
  }[keyboard.type]

  const keycaps = deserialized ? KEY_NAMES[deserialized.profile] : undefined

  return {
    keyboard,
    name,
    keycaps,
  }
}
