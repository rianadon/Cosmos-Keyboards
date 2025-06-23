import { download } from '$lib/browser'
import { hasKeyGeometry } from '$lib/loaders/keycaps'
import type { CuttleKey } from '$lib/worker/config'
import { strToU8, zip } from 'fflate'
import type { FullGeometry } from './viewers/viewer3dHelpers'

export type Matrix = Map<CuttleKey, [number, number]>

const RE_PID_VID = /^0x[0-9A-Fa-f]{4}$/

export interface QMKOptions {
  vid: string
  pid: string
  keyboardName: string
  folderName: string
  yourName: string
  diodeDirection: 'COL2ROW' | 'ROW2COL'
}

export function validateConfig(options: QMKOptions) {
  if (!RE_PID_VID.test(options.vid)) return 'VID should be of form 0xaaaa'
  if (!RE_PID_VID.test(options.pid)) return 'PID should be of form 0xaaaa'
}

/** Generates the key layout used in keyboard.json */
function generateLayout(config: FullGeometry, matrix: Matrix) {
  const layout: { matrix: [number, number]; x: number; y: number }[] = []
  for (const [side, keyboard] of Object.entries(config)) {
    const positions = keyboard.keyHolesTrsfs2D
    for (let i = 0; i < positions.length; i++) {
      const key = keyboard.c.keys[i]
      if (!hasKeyGeometry(key)) continue
      const keyPos = positions[i].xyz()

      const matrixPosition = matrix.get(key)
      if (!matrixPosition) throw new Error('Key has no matrix position')

      const x = side === 'left' ? -keyPos[0] : keyPos[0]
      layout.push({ matrix: matrixPosition, x, y: keyPos[1] })
    }
  }
  const minX = Math.min(...layout.map(l => l.x))
  const minY = Math.min(...layout.map(l => l.y))
  return layout.map(({ matrix, x, y }) => ({ matrix, x: x - minX, y: y - minY }))
}

/** Generates keyboard.json, in JSON format */
function generateInfoJSON(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  if (validateConfig(options)) throw new Error('Invalid config')
  return {
    'keyboard_name': options.keyboardName,
    'manufacturer': options.yourName,
    'url': 'ryanis.cool/cosmos',
    'maintainer': options.yourName,
    'usb': {
      'vid': options.vid,
      'pid': options.pid,
      'device_version': '0.0.1',
    },
    'processor': 'RP2040',
    'bootloader': 'rp2040',
    'features': {
      'bootmagic': true,
      'rgblight': true,
      'console': true,
    },
    'matrix_pins': {
      'cols': ['GP25', 'GP24', 'GP23', 'GP22', 'GP21', 'GP20', 'GP7'],
      'rows': ['GP10', 'GP6', 'GP9', 'GP4', 'GP8', 'GP5', 'GP3'],
    },
    'diode_direction': options.diodeDirection,
    'ws2812': {
      'pin': 'GP2',
      'driver': 'vendor',
    },
    'rgblight': {
      'driver': 'ws2812',
      'animations': {
        'rainbow_mood': true,
      },
      'default': {
        'animation': 'rainbow_mood',
      },
      'led_count': 98,
      'split': true,
      'split_count': [49, 49],
    },
    'bootmagic': {
      'matrix': [0, 0],
    },
    'split': {
      'enabled': true,
      'soft_serial_pin': 'GP1',
      'bootmagic': {
        'matrix': [7, 0],
      },
      'serial': {
        'driver': 'vendor',
      },
    },
    'layouts': {
      'LAYOUT': {
        'layout': generateLayout(config, matrix),
      },
    },
  }
}

function generateInfoFile(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  return JSON.stringify(generateInfoJSON(config, matrix, options), null, 4) + '\n'
}

// function generateRulesMK(config: FullGeometry) {
//   return
// }

function generateConfigH(config: FullGeometry) {
  return [
    '#pragma once\n',
    '#define EE_HANDS\n',
    '#define RP2040_BOOTLOADER_DOUBLE_TAP_RESET',
  ].join('\n') + '\n'
}

/** Generates the keycodes for the QMK keymap */
function generateKeycodes(config: FullGeometry, matrix: Matrix) {
  const keycodes: string[] = []
  for (const keyboard of Object.values(config)) {
    for (const key of keyboard.c.keys) {
      if (!hasKeyGeometry(key)) continue
      keycodes.push('KC_Q')
    }
  }
  return keycodes
}

function generateKeymap(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  return [
    '#include QMK_KEYBOARD_H\n',
    'const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {',
    `    [0] = LAYOUT(${generateKeycodes(config, matrix).join(',')}),`,
    '};',
  ].join('\n') + '\n'
}

export function downloadQMKCode(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  zip({
    [options.folderName]: {
      'config.h': strToU8(generateConfigH(config)),
      'keyboard.json': strToU8(generateInfoFile(config, matrix, options)),
      'keymaps/default/keymap.c': strToU8(generateKeymap(config, matrix, options)),
      'keymaps/via/keymap.c': strToU8(generateKeymap(config, matrix, options)),
      'keymaps/via/rules.mk': strToU8('VIA_ENABLE = yes\n'),
    },
  }, (err, data) => {
    if (!err) {
      const blob = new Blob([data], { type: 'application/x-zip' })
      download(blob, `firmware-${options.keyboardName}.zip`)
    }
  })
}
