import qmkVik from '$assets/qmk-vik.zip?url'
import { download } from '$lib/browser'
import { hasKeyGeometry, hasPinsInMatrix } from '$lib/loaders/keycaps'
import type { CuttleKey } from '$lib/worker/config'
import { strToU8, zip } from 'fflate'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { jsonFile, logicalKeys, unzipURL, yamlFile, zipPromise } from './firmwareHelpers'

export type Matrix = Map<CuttleKey, [number, number]>

const RE_PID_VID = /^0x[0-9A-Fa-f]{4}$/

export interface QMKOptions {
  vid: string
  pid: string
  keyboardName: string
  folderName: string
  yourName: string
  diodeDirection: 'COL2ROW' | 'ROW2COL'
  enableConsole: boolean
}

export function validateConfig(options: QMKOptions) {
  if (!RE_PID_VID.test(options.vid)) return 'VID should be of form 0xaaaa'
  if (!RE_PID_VID.test(options.pid)) return 'PID should be of form 0xaaaa'
}

/** Generates the key layout used in keyboard.json */
function generateLayout(config: FullGeometry, matrix: Matrix) {
  const layout: { matrix: [number, number]; x: number; y: number }[] = []

  const keyPositions = new Map<CuttleKey, { x: number; y: number }>()
  for (const [side, keyboard] of Object.entries(config)) {
    const positions = keyboard.keyHolesTrsfs2D
    for (let i = 0; i < positions.length; i++) {
      const keyPos = positions[i].xyz()
      const x = side === 'left' ? -keyPos[0] : keyPos[0]
      const y = keyPos[1]
      keyPositions.set(keyboard.c.keys[i], { x, y })
    }
  }

  for (const key of logicalKeys(config)) {
    if (!hasPinsInMatrix(key)) continue
    const matrixPosition = matrix.get(key)
    const { x, y } = keyPositions.get(key)!
    if (!matrixPosition) throw new Error('Key has no matrix position')
    layout.push({ matrix: matrixPosition, x, y })
  }
  const minX = Math.min(...layout.map(l => l.x))
  const minY = Math.min(...layout.map(l => l.y))
  return layout.map(({ matrix, x, y }) => ({ matrix, x: x - minX, y: y - minY }))
}

/** Generates keyboard.json, in JSON format */
function generateInfoJSON(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  if (validateConfig(options)) throw new Error('Invalid config')
  return jsonFile({
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
      'console': options.enableConsole,
    },
    'matrix_pins': {
      'cols': ['GP25', 'GP24', 'GP23', 'GP22', 'GP21', 'GP20', 'GP10'],
      'rows': ['GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9'],
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
  })
}

// function generateRulesMK(config: FullGeometry) {
//   return
// }

function generateConfigH(options: QMKOptions) {
  return [
    "// You shouldn't need to edit any of this.",
    '',
    '#pragma once',
    '',
    `#include "keyboards/cosmos/${options.folderName}/vik/config.vik.pre.h"`,
    '',
    '#define EE_HANDS',
    '',
    '#define VIK_SPI_DRIVER   SPID1',
    '#define VIK_SPI_SCK_PIN  GP14',
    '#define VIK_SPI_MOSI_PIN GP15',
    '#define VIK_SPI_MISO_PIN GP12',
    '#define VIK_SPI_CS       GP13',
    '#define VIK_I2C_DRIVER   I2CD1',
    '#define VIK_I2C_SDA_PIN  GP18',
    '#define VIK_I2C_SCL_PIN  GP19',
    '#define VIK_GPIO_1       GP26',
    '#define VIK_GPIO_2       GP27',
    '#define VIK_WS2812_DI_PIN GP2',
    '',
    '#define RP2040_BOOTLOADER_DOUBLE_TAP_RESET',
    '',
    '#define SPLIT_USB_DETECT',
    '#define SERIAL_USART_FULL_DUPLEX',
    '#define SERIAL_USART_PIN_SWAP',
    '#define SERIAL_USART_TX_PIN GP0',
    '#define SERIAL_USART_RX_PIN GP1',
    '',
    `#include "keyboards/cosmos/${options.folderName}/vik/config.vik.post.h"`,
  ].join('\n') + '\n'
}

function generateRulesMK() {
  return [
    '# Add VIK configuration here (e.g. VIK_PMW3360_RIGHT=yes to use a trackball)',
    '',
    'VIK_ENABLE = yes',
    '',
    'include $(KEYBOARD_PATH_1)/vik/rules.mk',
  ].join('\n') + '\n'
}

const CHARS = {
  '-': 'MINUS',
  '_': 'UNDERSCORE',
  '=': 'EQUAL',
  '+': 'PLUS',
  '[': 'LEFT_BRACKET',
  '{': 'LEFT_CURLY_BRACE',
  ']': 'RIGHT_BRACKET',
  '}': 'RIGHT_CURLY_BRACE',
  '\\': 'BACKSLASH',
  '|': 'PIPE',
  '#': 'HASH', // Or NONUS_HASH if non-US layout
  '~': 'TILDE', // Or GRAVE for ` and ~
  ';': 'SEMICOLON',
  ':': 'COLON',
  "'": 'QUOTE',
  '"': 'DOUBLE_QUOTE',
  '`': 'GRAVE',
  ',': 'COMMA',
  '<': 'LEFT_ANGLE_BRACKET',
  '.': 'DOT',
  '>': 'RIGHT_ANGLE_BRACKET',
  '/': 'SLASH',
  '?': 'QUESTION',
  '!': 'EXCLAIM',
  '@': 'AT',
  '$': 'DOLLAR',
  '%': 'PERCENT',
  '^': 'CIRCUMFLEX',
  '&': 'AMPERSAND',
  '*': 'ASTERISK',
  '(': 'LEFT_PAREN',
  ')': 'RIGHT_PAREN',
  ' ': 'SPACE',
}

const SPECIALS = [
  'enter',
  'ent',
  'escape',
  'esc',
  'backspace',
  'bspc',
  'tab',
  'space',
  'spc',
  'minus',
  'mins',
  'equal',
  'eql',
  'left_bracket',
  'lbrc',
  'right_bracket',
  'rbrc',
  'backslash',
  'bsls',
  'nonus_hash',
  'nuhs',
  'semicolon',
  'scln',
  'quote',
  'quot',
  'grave',
  'grv',
  'comma',
  'comm',
  'dot',
  'slash',
  'slsh',
  'caps_lock',
  'caps',
  'print_screen',
  'pscr',
  'scroll_lock',
  'scrl',
  'brmd',
  'pause',
  'paus',
  'brk',
  'brmu',
  'insert',
  'ins',
  'home',
  'page_up',
  'pgup',
  'delete',
  'del',
  'end',
  'page_down',
  'pgdn',
  'right',
  'rght',
  'left',
  'down',
  'up',
]

/** Return the QMK keycode for a letter */
function keycode(code: string | undefined) {
  const c = code?.toLowerCase()

  if (!c || !code) return 'KC_SPACE'
  if (/^[a-z]$/.test(c)) return 'KC_' + c.toUpperCase()
  if (/^[0-9]$/.test(c)) return 'KC_' + c
  if (/^F[0-9]+$/.test(c)) return 'KC_' + c
  if (CHARS.hasOwnProperty(c)) return 'KC_' + (CHARS as any)[c]
  if (SPECIALS.includes(c)) return 'KC_' + c.toUpperCase()
  if (/^(KC|QK|RGB)_/.test(code)) return code
  if (c.includes('(') && c.includes(')')) return code

  return 'KC_SPACE'
}

/** Generates the keycodes for the QMK keymap */
function generateKeycodes(config: FullGeometry, matrix: Matrix) {
  const keycodes: string[] = []
  for (const key of logicalKeys(config)) {
    if (!hasPinsInMatrix(key)) continue
    keycodes.push(keycode('keycap' in key ? key.keycap?.letter : undefined))
  }
  return keycodes
}

function generateKeymap(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  return [
    '#include QMK_KEYBOARD_H\n',
    'const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {',
    `    [0] = LAYOUT(${generateKeycodes(config, matrix).join(', ')}),`,
    '};',
    ...(
      options.enableConsole
        ? [
          '',
          'void keyboard_post_init_user(void) {',
          '    debug_enable=true;',
          '    debug_matrix=true;',
          '}',
        ]
        : []
    ),
  ].join('\n') + '\n'
}

function generateQMKJSON(options: QMKOptions) {
  const { folderName } = options
  return jsonFile({
    userspace_version: '1.1',
    build_targets: [
      [`cosmos/${folderName}`, 'default', { 'MAKECMDGOALS': 'uf2-split-left', 'TARGET': `${folderName}_default_left` }],
      [`cosmos/${folderName}`, 'default', { 'MAKECMDGOALS': 'uf2-split-right', 'TARGET': `${folderName}_default_right` }],
      [`cosmos/${folderName}`, 'via', { 'MAKECMDGOALS': 'uf2-split-left', 'TARGET': `${folderName}_via_left` }],
      [`cosmos/${folderName}`, 'via', { 'MAKECMDGOALS': 'uf2-split-right', 'TARGET': `${folderName}_via_right` }],
    ],
  })
}

function generateGitHubWorkflow() {
  return yamlFile({
    name: 'Build QMK firmware',
    on: ['push', 'pull_request', 'workflow_dispatch'],
    permissions: { contents: 'write' },
    jobs: {
      build: {
        name: 'QMK Userspace Build',
        uses: 'qmk/.github/.github/workflows/qmk_userspace_build.yml@main',
        with: {
          qmk_repo: 'qmk/qmk_firmware',
          qmk_ref: 'master',
          preparation_command: 'mkdir qmk_firmware/keyboards/cosmos && cp -r keyboards/* qmk_firmware/keyboards/cosmos/ && qmk userspace-doctor',
        },
      },
      publish: {
        name: 'QMK Userspace Publish',
        uses: 'qmk/.github/.github/workflows/qmk_userspace_publish.yml@main',
        if: 'always() && !cancelled()',
        needs: 'build',
      },
    },
  })
}

export function downloadQMKCode(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  ;(async () =>
    zipPromise({
      [options.folderName]: {
        '.github/workflows/build.yml': strToU8(generateGitHubWorkflow()),
        'qmk.json': strToU8(generateQMKJSON(options)),
        [`keyboards/${options.folderName}`]: {
          'config.h': strToU8(generateConfigH(options)),
          'rules.mk': strToU8(generateRulesMK()),
          'keyboard.json': strToU8(generateInfoJSON(config, matrix, options)),
          'keymaps/default/keymap.c': strToU8(generateKeymap(config, matrix, options)),
          'keymaps/via/keymap.c': strToU8(generateKeymap(config, matrix, options)),
          'keymaps/via/rules.mk': strToU8('VIA_ENABLE = yes\n'),
          'vik': await unzipURL(qmkVik),
        },
      },
    }))().then((data) => {
      const blob = new Blob([data], { type: 'application/x-zip' })
      download(blob, `firmware-${options.keyboardName}.zip`)
    })
    .catch(err => console.error(err))
}
