import qmkVik from '$assets/qmk-vik.zip?url'
import { download } from '$lib/browser'
import { PART_INFO } from '$lib/geometry/socketsParts'
import { hasKeyGeometry, hasPinsInMatrix } from '$lib/loaders/keycaps'
import type { CuttleKey, Geometry } from '$lib/worker/config'
import { mapObjNotNull, objKeys, sum } from '$lib/worker/util'
import { strToU8, zip } from 'fflate'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { encoderKeys, fullLayout, jsonFile, logicalKeys, type Matrix, unzipURL, yamlFile, zipPromise } from './firmwareHelpers'

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
  return fullLayout(config, matrix).map(({ matrix, x, y }) => ({ matrix, x, y }))
}

/** Generates keyboard.json, in JSON format */
function generateInfoJSON(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  if (validateConfig(options)) throw new Error('Invalid config')
  const encodersPerSide = mapObjNotNull(config, c => encoderKeys(c.c).length)
  const hasEncoders = Object.values(encodersPerSide).some(e => e > 0)
  return jsonFile({
    keyboard_name: options.keyboardName,
    manufacturer: options.yourName,
    url: 'ryanis.cool/cosmos',
    maintainer: options.yourName,
    usb: {
      vid: options.vid,
      pid: options.pid,
      device_version: '0.0.1',
    },
    processor: 'RP2040',
    bootloader: 'rp2040',
    features: {
      bootmagic: true,
      rgblight: true,
      console: options.enableConsole,
      encoder: hasEncoders,
      encoder_map: hasEncoders,
      extrakey: hasEncoders || !!EXTRAKEY_REQUIRED.intersection(new Set(generateKeycodes(config))).size,
      // Not needed since VIK sets it up?
      // pointing_device: Object.values(config).some(c => pointingDevices(c).length > 0),
      oled: Object.values(config).some(c => displays(c).length > 0),
    },
    matrix_pins: {
      cols: ['GP25', 'GP24', 'GP23', 'GP22', 'GP21', 'GP20', 'GP10'],
      rows: ['GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'GP8', 'GP9'],
    },
    diode_direction: options.diodeDirection,
    ws2812: {
      pin: 'GP2',
      driver: 'vendor',
    },
    rgblight: {
      driver: 'ws2812',
      animations: {
        rainbow_mood: true,
      },
      default: {
        animation: 'rainbow_mood',
        val: 50,
      },
      led_count: 98,
      split: true,
      split_count: [49, 49],
    },
    bootmagic: {
      matrix: [0, 0],
    },
    ...(hasEncoders
      ? {
        encoder: {
          rotary: encodersPerSide.unibody || encodersPerSide.left ? [{ pin_a: 'GP28', pin_b: 'GP29', resolution: 1 }] : [],
          right: {
            rotary: encodersPerSide.right ? [{ pin_a: 'GP28', pin_b: 'GP29', resolution: 1 }] : [],
          },
        },
      }
      : {}),
    split: {
      enabled: true,
      bootmagic: {
        matrix: [7, 0],
      },
      serial: {
        driver: 'vendor',
      },
      transport: {
        watchdog: true,
      },
    },
    layouts: {
      LAYOUT: {
        layout: generateLayout(config, matrix),
      },
    },
  })
}

function generateConfigH(config: FullGeometry, options: QMKOptions) {
  const driver = Object.values(config).flatMap(c => pointingDevices(c))[0]
  const display = Object.values(config).flatMap(c => displays(c))[0]
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
    ...(needsSPI(config)
      ? [
        '',
        '#define SPI_DRIVER SPID1',
        '#define SPI_SCK_PIN GP14',
        '#define SPI_MISO_PIN GP12',
        '#define SPI_MOSI_PIN GP15',
      ]
      : []),
    ...(Object.values(config).some(c => pointingDevices(c).length > 0)
      ? [
        '',
        '#define POINTING_DEVICE_CS_PIN GP13',
        '// #define ROTATIONAL_TRANSFORM_ANGLE 0 // Optional: Rotates the trackball',
        '// #define POINTING_DEVICE_INVERT_X // Optional: Inverts trackball X',
      ]
      : []),
    ...(driver?.type == 'trackpad-azoteq'
      ? ['#define AZOTEQ_IQS5XX_TPS65']
      : []),
    ...(driver?.type == 'trackpad-procyon'
      ? [`#define PROCYON_${driver.variant.size.replace('x', '_')}`]
      : []),
    ...(Object.values(config).some(c => displays(c).length > 0)
      ? ['#define OLED_DISPLAY_128X32']
      : []),
    ...(displayProtocol(display) == 'spi'
      ? ['#define OLED_CS_PIN ' + (Object.values(config).some(c => pointingDevices(c).length > 0) ? 'GP26' : 'GP13')]
      : []),
    '',
    `#include "keyboards/cosmos/${options.folderName}/vik/config.vik.post.h"`,
  ].join('\n') + '\n'
}

function generateMCUConfH(options: QMKOptions) {
  return [
    '#pragma once',
    '#include_next <mcuconf.h>',
    '',
    '// Set up SPI',
    '#undef RP_SPI_USE_SPI1',
    '#define RP_SPI_USE_SPI1 TRUE',
  ].join('\n') + '\n'
}

function generateRulesMK(config: FullGeometry) {
  const driver = Object.values(config).flatMap(c => pointingDevices(c))[0]
  const driverSide = objKeys(config).filter(c => pointingDevices(config[c]!).length)[0]
  const driverSuffix = { right: '_RIGHT', left: '', unibody: '' }[driverSide] || ''

  const display = Object.values(config).flatMap(c => displays(c))[0]

  return [
    '# Add VIK configuration here (e.g. VIK_PMW3360_RIGHT=yes to use a trackball)',
    '',
    'VIK_ENABLE = yes',
    '',
    ...(driver
      ? [
        'POINTING_DEVICE_DRIVER = ' + pointingDeviceDriver(driver),
      ]
      : []),
    ...(driver?.type == 'trackpad-cirque'
      ? [
        `VIK_CIRQUE${driverSuffix} = yes`,
        'CIRQUE_PINNACLE_DIAMETER_MM = ' + driver.variant.size.replace('mm', ''),
      ]
      : []),
    ...(driver?.type == 'trackpad-procyon'
      ? [
        `VIK_PROCYON${driverSuffix} = yes`,
      ]
      : []),
    ...(display
      ? [
        'OLED_TRANSPORT = ' + displayProtocol(display),
      ]
      : []),
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

// dprint-ignore
const EXTRAKEY_REQUIRED = new Set([
  'KC_SYSTEM_POWER', 'KC_PWR',
  'KC_SYSTEM_SLEEP', 'KC_SLEP',
  'KC_SYSTEM_WAKE', 'KC_WAKE',
  'KC_AUDIO_MUTE', 'KC_MUTE',
  'KC_AUDIO_VOL_UP', 'KC_VOLU',
  'KC_AUDIO_VOL_DOWN', 'KC_VOLD',
  'KC_MEDIA_NEXT_TRACK', 'KC_MNXT',
  'KC_MEDIA_PREV_TRACK', 'KC_MPRV',
  'KC_MEDIA_STOP', 'KC_MSTP',
  'KC_MEDIA_PLAY_PAUSE', 'KC_MPLY',
  'KC_MEDIA_SELECT', 'KC_MSEL',
  'KC_MEDIA_EJECT', 'KC_EJCT',
  'KC_MEDIA_FAST_FORWARD', 'KC_MFFD',
  'KC_MEDIA_REWIND', 'KC_MRWD',
  'KC_MAIL',
  'KC_CALCULATOR', 'KC_CALC',
  'KC_MY_COMPUTER', 'KC_MYCM',
  'KC_CONTROL_PANEL', 'KC_CPNL',
  'KC_ASSISTANT', 'KC_ASST',
  'KC_MISSION_CONTROL', 'KC_MCTL',
  'KC_LAUNCHPAD',
  'KC_WWW_SEARCH', 'KC_WSCH',
  'KC_WWW_HOME', 'KC_WHOM',
  'KC_WWW_BACK', 'KC_WBAK',
  'KC_WWW_FORWARD', 'KC_WFWD',
  'KC_WWW_STOP', 'KC_WSTP',
  'KC_WWW_REFRESH', 'KC_WREF',
  'KC_WWW_FAVORITES', 'KC_WFAV',
  'KC_BRIGHTNESS_UP', 'KC_BRIU',
  'KC_BRIGHTNESS_DOWN', 'KC_BRID',
])

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
function generateKeycodes(config: FullGeometry) {
  const keycodes: string[] = []
  for (const key of logicalKeys(config)) {
    if (!hasPinsInMatrix(key)) continue
    keycodes.push(keycode('keycap' in key ? key.keycap?.letter : undefined))
  }
  return keycodes
}

function generateEncoderMap(encodersPerSide: Record<keyof FullGeometry, number>) {
  const numEncoders = sum(Object.values(encodersPerSide).map(s => Math.min(s, 1)))
  return new Array(numEncoders).fill('ENCODER_CCW_CW(KC_VOLD, KC_VOLU)').join(', ')
}

function generateKeymap(config: FullGeometry, matrix: Matrix, options: QMKOptions) {
  const encodersPerSide = mapObjNotNull(config, c => encoderKeys(c.c).length)
  const hasEncoders = Object.values(encodersPerSide).some(e => e > 0)
  const display = Object.values(config).flatMap(displays)[0]
  return [
    '#include QMK_KEYBOARD_H\n',
    'const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {',
    `    [0] = LAYOUT(${generateKeycodes(config).join(', ')}),`,
    '};',
    ...(
      hasEncoders
        ? [
          '#if defined(ENCODER_MAP_ENABLE)',
          'const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS] = {',
          `    [0] = { ${generateEncoderMap(encodersPerSide)} },`,
          '};',
          '#endif',
        ]
        : ['']
    ),
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
    ...(
      display
        ? [
          '',
          'oled_rotation_t oled_init_user(oled_rotation_t rotation) {',
          '    return OLED_ROTATION_90;',
          '}',
          '',
          'bool oled_task_user(void) {',
          '    static const char PROGMEM raw_logo[] = {',
          '        0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,128,224,248,200,220,252,246,222,254,254,246,238,254,252,252,248,240,224,128,0,0,0,0,0,0,0,0,0,0,255,127,254,241,103,159,63,63,127,255,255,255,255,127,63,223,15,135,243,251,225,17,252,254,0,0,0,0,',
          '        0,0,0,0,7,15,11,15,16,63,59,32,63,56,7,7,7,48,62,63,48,15,59,62,27,30,15,15,0,0,0,0,192,224,16,16,16,0,128,192,64,64,128,0,128,64,64,0,192,64,64,192,64,64,128,0,128,64,64,128,0,128,64,64,0,1,2,2,2,0,1,3,2,2,1,0,2,3,3,0,3,0,0,3,0,0,3,0,3,2,2,1,0,2,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,16,16,124,16,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,',
          '        0,0,0,0,0,0,0,0,0,0,128,0,128,0,0,128,0,0,128,0,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,160,160,160,248,252,252,255,28,255,252,252,31,252,252,255,28,255,252,252,248,160,160,160,0,0,0,0,0,0,0,0,0,164,164,164,255,255,255,255,240,239,223,223,0,223,223,239,240,255,255,255,255,164,164,164,0,0,0,0,0,0,0,0,0,0,0,0,3,7,7,63,7,63,7,7,63,7,7,63,7,63,7,7,3,0,0,0,0,0,0,0,0,',
          '        0,0,0,128,192,96,96,96,192,128,0,224,224,192,0,0,0,192,224,224,0,224,224,0,128,192,224,96,0,0,0,0,0,0,0,15,31,48,48,112,223,143,0,63,63,3,15,28,15,3,63,63,0,63,63,7,15,29,56,48,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,',
          '    };',
          '',
          '    oled_write_raw_P(raw_logo, sizeof(raw_logo)); // Show Cosmos + QMK logo',
          '    return false;',
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
      [`cosmos/${folderName}`, 'default', { 'MAKECMDGOALS': 'uf2-split-left', 'VIK_BUILD_LEFT': 'yes', 'TARGET': `${folderName}_default_left` }],
      [`cosmos/${folderName}`, 'default', { 'MAKECMDGOALS': 'uf2-split-right', 'VIK_BUILD_RIGHT': 'yes', 'TARGET': `${folderName}_default_right` }],
      [`cosmos/${folderName}`, 'via', { 'MAKECMDGOALS': 'uf2-split-left', 'VIK_BUILD_LEFT': 'yes', 'TARGET': `${folderName}_via_left` }],
      [`cosmos/${folderName}`, 'via', { 'MAKECMDGOALS': 'uf2-split-right', 'VIK_BUILD_RIGHT': 'yes', 'TARGET': `${folderName}_via_right` }],
    ],
  })
}

function generateGitHubWorkflow(config: FullGeometry) {
  const hasProcyon = Object.values(config).some(c => c.c.keys.some(k => k.type == 'trackpad-procyon'))
  return yamlFile({
    name: 'Build QMK firmware',
    on: ['push', 'pull_request', 'workflow_dispatch'],
    permissions: { contents: 'write' },
    jobs: {
      build: {
        name: 'QMK Userspace Build',
        uses: 'qmk/.github/.github/workflows/qmk_userspace_build.yml@main',
        with: {
          qmk_repo: hasProcyon ? 'george-norton/qmk_firmware' : 'qmk/qmk_firmware',
          qmk_ref: hasProcyon ? 'multitouch_experiment' : 'master',
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
        '.github/workflows/build.yml': strToU8(generateGitHubWorkflow(config)),
        'qmk.json': strToU8(generateQMKJSON(options)),
        [`keyboards/${options.folderName}`]: {
          'config.h': strToU8(generateConfigH(config, options)),
          'rules.mk': strToU8(generateRulesMK(config)),
          'keyboard.json': strToU8(generateInfoJSON(config, matrix, options)),
          'keymaps/default/keymap.c': strToU8(generateKeymap(config, matrix, options)),
          'keymaps/via/keymap.c': strToU8(generateKeymap(config, matrix, options)),
          'keymaps/via/rules.mk': strToU8('VIA_ENABLE = yes\n'),
          'vik': await unzipURL(qmkVik),
          ...(needsSPI(config)
            ? {
              'mcuconf.h': strToU8(generateMCUConfH(options)),
            }
            : {}),
        },
      },
    }))().then((data) => {
      const blob = new Blob([data], { type: 'application/x-zip' })
      download(blob, `firmware-${options.keyboardName}.zip`)
    })
    .catch(err => console.error(err))
}

function pointingDevices(config: Geometry) {
  return config.c.keys.filter(k => !!pointingDeviceDriver(k))
}

function displays(config: Geometry) {
  return config.c.keys.filter(k => k.type.startsWith('oled'))
}

function displayProtocol(k: CuttleKey) {
  if (!k) return undefined
  const info = PART_INFO[k.type]
  const numpin = typeof info.numPins == 'function' ? info.numPins(k.variant as any) : info.numPins
  if (numpin?.i2c) return 'i2c'
  return 'spi'
}

function pointingDeviceDriver(key: CuttleKey) {
  if (!key) return undefined
  if (key.type == 'trackball') {
    return 'pmw3389'
  } else if (key.type == 'trackpad-cirque') {
    return 'cirque_pinnacle_spi'
  } else if (key.type == 'trackpad-azoteq') {
    return 'azoteq_iqs5xx'
  } else if (key.type == 'trackpad-procyon') {
    return 'digitizer'
  }
}

function needsSPI(config: FullGeometry) {
  return Object.values(config).some(c =>
    pointingDevices(c).length > 0
    || displays(c).filter(d => displayProtocol(d) == 'spi').length > 0
  )
}

export function* qmkInfo(config: Geometry) {
  if (encoderKeys(config.c).length > 0) yield 'Encoder detected. Make sure it is wired to GPIO28 and GPIO29'
}

export function* qmkErrors(config: Geometry) {
  if (encoderKeys(config.c).length > 1) yield 'Multiple encoders detected on this side. Only the first will be configured in the firmware.'
  if (displays(config).length > 1) yield 'Multiple displays detected on this side. Only the first will be configured in the firmware.'
  if (pointingDevices(config).length > 1) yield 'Multiple pointing devices (trackballs/trackpads) detected on this side. Only the first will be configured in the firmware.'
}
