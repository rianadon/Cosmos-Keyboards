import { download } from '$lib/browser'
import { hasPinsInMatrix } from '$lib/loaders/keycaps'
import type { CuttleKey, Geometry } from '$lib/worker/config'
import { filterObj, findIndexIter, mapObjNotNull, mapObjNotNullToObj, mapObjToObj, objEntries, objEntriesNotNull, objKeysOfNotNull, sum } from '$lib/worker/util'
import { strToU8, zip } from 'fflate'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { dtsFile, encoderKeys, fullLayout, logicalKeys, type Matrix, raw, yamlFile } from './firmwareHelpers'

const RE_PID_VID = /^0x[0-9A-Fa-f]{4}$/

export const Microcontroller = {
  LemonWireless: 'lemon-wireless',
  LemonWired: 'lemon-wired',
} as const
export type Microcontroller = typeof Microcontroller[keyof typeof Microcontroller]

export const SplitTransport = {
  Uart: 'uart',
  PioUsb: 'pio-usb',
} as const
export type SplitTransport = typeof SplitTransport[keyof typeof SplitTransport]

interface ZMKPeripherals {
  pmw3610: boolean
  cirque: boolean
  encoder: boolean
}

export interface ZMKOptions {
  vid: string
  pid: string
  keyboardName: string
  folderName: string
  yourName: string
  diodeDirection: 'COL2ROW' | 'ROW2COL'
  centralSide: 'left' | 'right'
  peripherals: {
    left: ZMKPeripherals
    right: ZMKPeripherals
    unibody: ZMKPeripherals
  }
  underGlowAtStart: boolean
  enableConsole: boolean
  enableStudio: boolean
  microcontroller: Microcontroller
  wirelessVersion: 'v0.3' | 'v0.4'
  wiredVersion?: 'v0.4' | 'v0.5'
  splitTransport?: SplitTransport
  linkPort?: 'pio' | 'native'
}

export function validateConfig(options: ZMKOptions) {
  if (!RE_PID_VID.test(options.vid)) return 'VID should be of form 0xaaaa'
  if (!RE_PID_VID.test(options.pid)) return 'PID should be of form 0xaaaa'
}

const CHARS = {
  '!': 'EXCL',
  '@': 'AT',
  '#': 'HASH',
  '$': 'DLLR',
  '%': 'PRCNT',
  '^': 'CARET',
  '&': 'AMPS',
  '*': 'ASTRK',
  '(': 'LPAR',
  ')': 'RPAR',
  '-': 'MINUS',
  '_': 'UNDER',
  '=': 'EQUAL',
  '+': 'PLUS',
  '[': 'LBKT',
  '{': 'LBRC',
  ']': 'RBKT',
  '}': 'RBRC',
  '\\': 'BSLH',
  '|': 'PIPE',
  ';': 'SEMI',
  ':': 'COLON',
  "'": 'SQT',
  '"': 'DQT',
  ',': 'COMMA',
  '<': 'LT',
  '.': 'DOT',
  '>': 'GT',
  '/': 'FSLH',
  '?': 'QMARK',
  '`': 'GRAVE',
  '~': 'TILDE',
  ' ': 'SPACE',
}

const SPECIALS = [
  'esc',
  'escape',
  'enter',
  'return',
  'ret',
  'ret2',
  'return2',
  'space',
  'tab',
  'bspc',
  'backspace',
  'del',
  'delete',
  'ins',
  'insert',
  'home',
  'end',
  'pg_up',
  'page_up',
  'pg_dn',
  'page_down',
  'up',
  'up_arrow',
  'down',
  'down_arrow',
  'left',
  'left_arrow',
  'right',
  'right_arrow',
  'k_app',
  'k_application',
  'k_context_menu',
  'k_cmenu',
  'caps',
  'capslock',
  'clck',
  'lcaps',
  'locking_caps',
  'slck',
  'scrolllock',
  'lslck',
  'locking_scroll',
  'lnlck',
  'locking_num',
]

/** Return the ZMK keycode for a letter */
export function keycode(code: string | undefined) {
  const c = code?.toLowerCase()

  if (!c || !code) return '&kp SPACE'
  if (/^[a-z]$/.test(c)) return '&kp ' + c.toUpperCase()
  if (/^[0-9]$/.test(c)) return '&kp N' + String(c)
  if (/^F[0-9]+$/.test(c)) return '&kp ' + c
  if (CHARS.hasOwnProperty(c)) return '&kp ' + (CHARS as any)[c]
  if (SPECIALS.includes(c)) return '&kp ' + c.toUpperCase()
  if (c.startsWith('&')) return code

  return '&kp SPACE'
}

/** Generates the keycodes for the ZMK keymap */
function generateKeycodes(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const keycodes: string[] = []
  for (const key of logicalKeys(config)) {
    if (!hasPinsInMatrix(key)) continue
    let kc = keycode('keycap' in key ? key.keycap?.letter : undefined)
    if (options.enableStudio) {
      const matrixPos = matrix.get(key)
      if (matrixPos && matrixPos[0] == 0 && matrixPos[1] % 7 == 0) kc = '&studio_unlock'
    }
    keycodes.push(kc)
  }
  return keycodes
}

/** Returns the Zephyr board name used for the given microcontroller selection.
 *  The Lemon Wireless board ships in `rianadon/zmk`; the Lemon Wired board
 *  ships in the Phase-1 fork branch wired up by generateWestYaml.
 *
 *  v0.4 and v0.5 Wired share one Zephyr board — the only Phase-1 hardware
 *  diff (LED-relay polarity) is encoded in the per-shield ext_power_hog. */
function boardName(options: ZMKOptions) {
  if (options.microcontroller === Microcontroller.LemonWired) return 'cosmos_lemon_wired'
  if (options.wirelessVersion == 'v0.4') return 'cosmos_lemon_wireless_v4'
  return 'cosmos_lemon_wireless'
}

type GpioPin = { ctrl: '&gpio0' | '&gpio1'; pin: number }

interface MCUProfile {
  /** Row GPIOs for the matrix scan. */
  rows: GpioPin[]
  /** Column GPIOs when columns are driven directly (no shifter). */
  cols?: GpioPin[]
  /** SPI-driven 595 shifter for column expansion. When set, `cols` is ignored
   *  and columns reference the shifter outputs. */
  shifter?: { spiBus: string; csPin: GpioPin }
  /** Encoder A/B GPIOs (one encoder per side). */
  encoderA: GpioPin
  encoderB: GpioPin
  /** When set, hold an LED-power enable pin in its OFF state at boot using a
   *  gpio-hog. Used when the user opts not to start with underglow on. */
  extPowerHog?: {
    pin: GpioPin
    activeMode: 'GPIO_ACTIVE_HIGH' | 'GPIO_ACTIVE_LOW'
    offLevel: 'high' | 'low'
  }
  /** VIK_SPI_REG_START: number of devices already on the VIK SPI bus before
   *  VIK peripherals (e.g. the Wireless shifter occupies slot 0). */
  vikSpiRegStart: number
  /** VIK_SPI_CS_PREFIX expression. Omitted when nothing precedes VIK on the bus. */
  vikSpiCsPrefix?: string
}

function mcuProfile(options: ZMKOptions): MCUProfile {
  if (options.microcontroller === Microcontroller.LemonWired) {
    const v05 = options.wiredVersion === 'v0.5'
    return {
      rows: [3, 4, 5, 6, 7, 8, 9].map((pin): GpioPin => ({ ctrl: '&gpio0', pin })),
      cols: [25, 24, 23, 22, 21, 20, 10].map((pin): GpioPin => ({ ctrl: '&gpio0', pin })),
      encoderA: { ctrl: '&gpio0', pin: 28 },
      encoderB: { ctrl: '&gpio0', pin: 29 },
      extPowerHog: options.underGlowAtStart ? undefined : {
        pin: { ctrl: '&gpio0', pin: 11 },
        activeMode: v05 ? 'GPIO_ACTIVE_HIGH' : 'GPIO_ACTIVE_LOW',
        offLevel: v05 ? 'low' : 'high',
      },
      vikSpiRegStart: 0,
    }
  }
  // lemon-wireless: existing behavior (matched 1:1 with the prior hard-coded DTSI).
  return {
    rows: [
      { ctrl: '&gpio0', pin: 20 },
      { ctrl: '&gpio0', pin: 22 },
      { ctrl: '&gpio0', pin: 24 },
      { ctrl: '&gpio0', pin: 9 },
      { ctrl: '&gpio0', pin: 10 },
      { ctrl: '&gpio1', pin: 13 },
      { ctrl: '&gpio1', pin: 15 },
    ],
    shifter: { spiBus: '&spi1', csPin: { ctrl: '&gpio0', pin: 4 } },
    encoderA: { ctrl: '&gpio0', pin: 29 },
    encoderB: { ctrl: '&gpio0', pin: 31 },
    extPowerHog: options.underGlowAtStart ? undefined : {
      pin: { ctrl: '&gpio0', pin: 2 },
      activeMode: 'GPIO_ACTIVE_LOW',
      offLevel: 'high',
    },
    vikSpiRegStart: 1,
    vikSpiCsPrefix: '<&gpio0 4 GPIO_ACTIVE_LOW>',
  }
}

function gpioRef(p: GpioPin, flags?: string) {
  return flags ? `<${p.ctrl} ${p.pin} ${flags}>` : `<${p.ctrl} ${p.pin}>`
}

function generateEncoderMap(encodersPerSide: Record<keyof FullGeometry, number>) {
  const numEncoders = sum(Object.values(encodersPerSide).map(s => Math.min(s, 1)))
  return new Array(numEncoders).fill('&inc_dec_kp C_VOL_UP C_VOL_DN').join(' ')
}

function generateKeymap(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const encodersPerSide = mapObjNotNull(config, c => encoderKeys(c.c).length)
  const hasEncoders = Object.values(encodersPerSide).some(e => e > 0)
  return dtsFile({
    [raw()]: '#include <behaviors.dtsi>',
    [raw()]: '#include <dt-bindings/zmk/keys.h>',
    '/': {
      keymap: {
        compatible: 'zmk,keymap',
        default_layer: {
          bindings: '<' + generateKeycodes(config, matrix, options).join(' ') + '>',
          ...(hasEncoders
            ? {
              sensorBindings: '<' + generateEncoderMap(encodersPerSide) + '>',
            }
            : {}),
        },
        ...(options.enableStudio
          ? {
            extra1: {
              status: 'reserved',
            },
            extra2: {
              status: 'reserved',
            },
            extra3: {
              status: 'reserved',
            },
          }
          : {}),
      },
    },
  })
}

function generateGitHubWorkflow() {
  return yamlFile({
    on: ['push', 'pull_request', 'workflow_dispatch'],
    jobs: {
      build: { uses: 'rianadon/zmk/.github/workflows/build-user-config.yml@main' },
    },
  })
}

function generateBuildYaml(config: FullGeometry, options: ZMKOptions): string {
  function shieldList(name: string, peripherals: ZMKPeripherals) {
    const shields = [name]
    if (peripherals.pmw3610) shields.push('vik_pmw3610')
    if (peripherals.cirque) shields.push('vik_cirque_spi')
    return shields.join(' ')
  }
  let snippets: string[] = []
  if (options.enableConsole) snippets.push('zmk-usb-logging')
  if (options.enableStudio) snippets.push('studio-rpc-usb-uart')

  return yamlFile({
    include: config.unibody
      ? [
        {
          board: boardName(options),
          shield: shieldList(`${options.folderName}`, options.peripherals.unibody),
          snippet: snippets.join(';'),
          'cmake-args': options.enableStudio ? '-DCONFIG_ZMK_STUDIO=y' : undefined,
        },
      ]
      : [
        {
          board: boardName(options),
          shield: shieldList(`${options.folderName}_left`, options.peripherals.left),
          snippet: options.centralSide == 'left' ? snippets.join(';') : undefined,
          'cmake-args': options.centralSide == 'left' && options.enableStudio ? '-DCONFIG_ZMK_STUDIO=y' : undefined,
        },
        {
          board: boardName(options),
          shield: shieldList(`${options.folderName}_right`, options.peripherals.right),
          snippet: options.centralSide == 'right' ? snippets.join(';') : undefined,
          'cmake-args': options.centralSide == 'right' && options.enableStudio ? '-DCONFIG_ZMK_STUDIO=y' : undefined,
        },
      ],
  }, true)
}

function generateModuleYaml(): string {
  return yamlFile({
    build: {
      depends: ['vik-core'],
      settings: { board_root: '.' },
    },
  })
}

function generateDepsYaml(): string {
  return yamlFile({
    manifest: {
      remotes: [
        { name: 'sadekbaroudi', 'url-base': 'https://github.com/sadekbaroudi' },
        { name: 'rianadon', 'url-base': 'https://github.com/rianadon' },
      ],
      projects: [
        { name: 'zmk-fingerpunch-vik', remote: 'rianadon', revision: 'main', import: 'config/deps.yml' },
      ],
    },
  })
}

function generateWestYaml(options: ZMKOptions): string {
  // The Lemon Wired board + USB split transport live on the Olson3R fork
  // until that work merges upstream. The fork's app/west.yml pulls in the
  // Pico-PIO-USB module + Zephyr UHC/UDC glue transitively.
  // Wireless continues to track rianadon/zmk.
  const wired = options.microcontroller === Microcontroller.LemonWired
  return yamlFile({
    manifest: {
      remotes: [
        { name: 'zmkfirmware', 'url-base': 'https://github.com/zmkfirmware' },
        { name: 'rianadon', 'url-base': 'https://github.com/rianadon' },
        ...(wired ? [{ name: 'Olson3R', 'url-base': 'https://github.com/Olson3R' }] : []),
      ],
      projects: [
        wired
          ? { name: 'zmk', 'repo-path': 'rainadon-zmk', remote: 'Olson3R', revision: 'main', import: 'app/west.yml' }
          : { name: 'zmk', remote: 'rianadon', revision: 'main', import: 'app/west.yml' },
      ],
      self: { path: 'config', import: 'deps.yml' },
    },
  })
}

function generateDefconfig(config: FullGeometry, options: ZMKOptions) {
  const { folderName } = options
  const centralSide = options.centralSide.toUpperCase()
  const usbSplit = options.microcontroller === Microcontroller.LemonWired && options.splitTransport !== SplitTransport.Uart
  return `
if SHIELD_${folderName}_${centralSide}

config ZMK_KEYBOARD_NAME
    default "${options.keyboardName.substring(0, 16)}"

config ZMK_SPLIT_ROLE_CENTRAL
    default y

endif # SHIELD_${folderName}_${centralSide}

if SHIELD_${folderName}_LEFT || SHIELD_${folderName}_RIGHT

config ZMK_SPLIT
    default y
${
    usbSplit
      ? `
config ZMK_SPLIT_USB
    default y
`
      : ''
  }
endif # SHIELD_${folderName}_LEFT || SHIELD_${folderName}_RIGHT
`
}

function generateShield(config: FullGeometry, options: ZMKOptions) {
  return `
config SHIELD_${options.folderName}_LEFT
    def_bool $(shields_list_contains,${options.folderName}_left)

config SHIELD_${options.folderName}_RIGHT
    def_bool $(shields_list_contains,${options.folderName}_right)
`
}

function generateConf(config: FullGeometry, options: ZMKOptions, side: keyof FullGeometry) {
  const wired = options.microcontroller === Microcontroller.LemonWired
  const split = side !== 'unibody'
  const usbSplit = wired && split && options.splitTransport !== SplitTransport.Uart
  const isCentral = split && side === options.centralSide
  // Phase 1: the wired path doesn't yet ship a working WS2812 driver
  // (RP2040 needs a PIO-based ws2812 binding the upstream Zephyr 3.5 doesn't
  // have). Force underglow off so the build completes; revisit once the wired
  // board overlay grows a working LED strip definition.
  const underglow = options.underGlowAtStart && !wired
  const hasPointing = Object.values(options.peripherals).some(p => p.pmw3610 || p.cirque)
  const hasEncoder = Object.values(options.peripherals).some(p => p.encoder)
  // USB device strings. Peripheral re-uses the central PID — the host only
  // ever sees the central, so a unique PID on the peripheral has no observer.
  // The 16-char limit on ZMK_KEYBOARD_NAME is BLE-specific; USB strings have
  // no such cap.
  const productName = options.keyboardName + (usbSplit && !isCentral ? ' (peripheral)' : '')
  return [
    'CONFIG_SPI=y',
    '',
    '# RGB underglow configuration',
    'CONFIG_ZMK_RGB_UNDERGLOW=' + (underglow ? 'y' : 'n'),
    'CONFIG_WS2812_STRIP=' + (underglow ? 'y' : 'n'),
    ...(underglow
      ? [
        'CONFIG_ZMK_RGB_UNDERGLOW_BRT_START=50',
        'CONFIG_ZMK_RGB_UNDERGLOW_EFF_START=3',
      ]
      : [
        'CONFIG_ZMK_EXT_POWER=n',
      ]),
    ...(wired
      ? [
        '',
        '# RP2040 essentials',
        'CONFIG_PINCTRL=y',
        'CONFIG_GPIO=y',
        '',
        '# Zephyr 3.5 RP2040 flash driver is broken in this fork — non-persistent',
        '# settings until that lands. The board defconfig sets these to y; we override.',
        'CONFIG_FLASH=n',
        'CONFIG_NVS=n',
        'CONFIG_SETTINGS=n',
        '',
        ...(usbSplit
          ? [
            '# Pico-PIO-USB split transport: legacy USB device stack on the',
            '# native USB-C carries HID (central) / split bulk endpoints (peripheral);',
            '# the central also runs Pico-PIO-USB as a UHC on the Link port.',
            'CONFIG_USB_DEVICE_STACK=y',
            `CONFIG_USB_DEVICE_PRODUCT="${productName}"`,
            `CONFIG_USB_DEVICE_VID=${options.vid}`,
            `CONFIG_USB_DEVICE_PID=${options.pid}`,
            'CONFIG_USB_CDC_ACM=y',
            'CONFIG_SERIAL=y',
            'CONFIG_UART_INTERRUPT_DRIVEN=y',
            'CONFIG_UART_LINE_CTRL=y',
            'CONFIG_USB_DEVICE_INITIALIZE_AT_BOOT=' + (isCentral ? 'y' : 'n'),
            ...(isCentral ? ['CONFIG_ZMK_USB=y'] : []),
            ...(isCentral && options.enableConsole
              ? [
                '',
                '# CDC ACM console on the central native USB-C (alongside HID).',
                'CONFIG_CONSOLE=y',
                'CONFIG_UART_CONSOLE=y',
                'CONFIG_LOG=y',
                'CONFIG_LOG_PRINTK=y',
                'CONFIG_LOG_BACKEND_UART=y',
                'CONFIG_LOG_DEFAULT_LEVEL=2',
              ]
              : []),
          ]
          : split
          ? [
            '# Wired-split UART transport on GP0/GP1',
            'CONFIG_ZMK_SPLIT_WIRED=y',
          ]
          : []),
        ...(split ? ['CONFIG_ZMK_SPLIT=y'] : []),
      ]
      : []),
    '',
    '# zmk mouse emulation for trackball/trackpad',
    'CONFIG_ZMK_POINTING=' + (hasPointing ? 'y' : 'n'),
    '',
    '# encoder support',
    'CONFIG_EC11=' + (hasEncoder ? 'y' : 'n'),
    'CONFIG_EC11_TRIGGER_GLOBAL_THREAD=' + (hasEncoder ? 'y' : 'n'),
  ].join('\n') + '\n'
}

function generateDTSI(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const activeMode = options.diodeDirection == 'COL2ROW' ? 'GPIO_ACTIVE_HIGH' : 'GPIO_ACTIVE_LOW'
  const pullMode = options.diodeDirection == 'COL2ROW' ? 'GPIO_PULL_DOWN' : 'GPIO_PULL_UP'
  const encoders = mapObjNotNull(config, (g) => encoderKeys(g.c))
  const encodersWithLength = filterObj(encoders, (k, v) => v.length > 0)
  const profile = mcuProfile(options)

  const rowGpios = profile.rows.map(p => gpioRef(p, `(${activeMode} | ${pullMode})`))
  const colGpios = profile.shifter
    ? Array.from({ length: 7 }, (_, i) => `<&shifter ${i} ${activeMode}>`)
    : (profile.cols ?? []).map(p => gpioRef(p, activeMode))

  const shifterBlock: Record<string, unknown> = profile.shifter
    ? {
      [profile.shifter.spiBus]: {
        status: 'okay',
        csGpios: ['VIK_SPI_CS_PREFIX'],
        'shifter: 595@0': {
          compatible: 'zmk,gpio-595',
          status: 'okay',
          gpioController: true,
          spiMaxFrequency: 200000,
          reg: 0,
          ngpios: 8,
          '#gpio-cells': 2,
        },
      },
    }
    : {}

  const vikSpiDefines: Record<string, unknown> = {
    [raw()]: `// Tell VIK how many devices already sit on the VIK SPI bus before VIK peripherals.`,
    [raw()]: `// Increase this number if you add another SPI device.`,
    [raw()]: `#define VIK_SPI_REG_START ${profile.vikSpiRegStart}`,
    ...(profile.vikSpiCsPrefix
      ? {
        [raw()]: '// Pulled out to an external variable so VIK can find the SPI bus.',
        [raw()]: `#define VIK_SPI_CS_PREFIX ${profile.vikSpiCsPrefix}`,
      }
      : {}),
  }

  const extPowerBlock: Record<string, unknown> = profile.extPowerHog
    ? {
      [raw()]: '// Hack to force-drive the LED power pin to its OFF level, ensuring LEDs stay off at boot.',
      [raw()]: '// Ext power is also disabled in the conf file.',
      [profile.extPowerHog.pin.ctrl]: {
        'ext_power_hog: ext_power_hog': {
          'gpio-hog': true,
          'gpios': [`<${profile.extPowerHog.pin.pin} ${profile.extPowerHog.activeMode}>`],
          [`output-${profile.extPowerHog.offLevel}`]: true,
        },
      },
    }
    : {}

  return dtsFile({
    [raw()]: '#include <behaviors.dtsi>',
    [raw()]: '#include <dt-bindings/zmk/matrix_transform.h>',
    [raw()]: '#include <dt-bindings/zmk/keys.h>',
    [raw()]: `#include "${options.folderName}-layouts.dtsi"`,
    ...vikSpiDefines,
    ...shifterBlock,
    '/': {
      'chosen': {
        'zmk,kscan': '&kscan0',
        'zmk,physical-layout': '&default_layout',
        // 'zmk,matrix_transform': '&default_transform',
      },
      'default_transform: keymap_transform_0': {
        compatible: 'zmk,matrix-transform',
        columns: 14,
        rows: 7,
        map: '<' + Array.from(matrix.values()).map(([r, c]) => `RC(${r},${c})`).join(' ') + '>',
      },
      'kscan0: kscan_0': {
        compatible: 'zmk,kscan-gpio-matrix',
        diodeDirection: 'col2row',
        rowGpios,
        colGpios,
      },
      ...mapObjToObj(encodersWithLength, (encoders, side) => ({
        [`${side}_encoder: encoder_${side}`]: {
          compatible: 'alps,ec11',
          aGpios: gpioRef(profile.encoderA, '(GPIO_ACTIVE_HIGH | GPIO_PULL_UP)'),
          bGpios: gpioRef(profile.encoderB, '(GPIO_ACTIVE_HIGH | GPIO_PULL_UP)'),
          steps: 80,
          status: 'disabled',
        },
      })),
      ...(Object.keys(encodersWithLength).length
        ? {
          'sensors: sensors': {
            compatible: 'zmk,keymap-sensors',
            sensors: '<' + Object.keys(encodersWithLength).map(s => `&${s}_encoder`).join(' ') + '>',
            triggersPerRotation: 20,
          },
        }
        : {}),
    },
    ...extPowerBlock,
  })
}

function generateLayouts(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const KEY_UNIT = 19
  return dtsFile({
    [raw()]: '#include <physical_layouts.dtsi>',
    '/': {
      'default_layout: physical_layout_0': {
        compatible: 'zmk,physical-layout',
        displayName: 'Default Layout',
        transform: '<&default_transform>',
        keys: fullLayout(config, matrix).map(({ x, y, angle }) => {
          const w = 100
          const h = 100
          const tx = Math.round(x / KEY_UNIT * 100)
          const ty = Math.round(y / KEY_UNIT * 100)
          const rot = Math.round(angle * 100)
          const rx = rot == 0 ? 0 : tx + 50
          const ry = rot == 0 ? 0 : ty + 50

          return `<&key_physical_attrs ${w} ${h} ${tx} ${ty} ${rot < 0 ? '(' + rot + ')' : rot} ${rx} ${ry}>`
        }),
      },
    },
  })
}

function generateZMKYaml(config: FullGeometry, options: ZMKOptions) {
  const { folderName, keyboardName } = options
  return yamlFile({
    file_format: '"1"',
    id: folderName,
    name: keyboardName,
    type: 'shield',
    url: 'https://github.com/rianadon/Cosmos-Keyboards',
    features: objKeysOfNotNull({
      keys: true,
      underglow: true,
      encoder: Object.values(options.peripherals).some(p => p.encoder),
      studio: options.enableStudio,
    }),
    siblings: config.unibody ? [folderName] : [`${folderName}_left`, `${options.folderName}_right`],
  })
}

function generateOverlay(config: FullGeometry, matrix: Matrix, options: ZMKOptions, side: keyof FullGeometry) {
  // Find the bootloader position, which should be the index of the key with (0,0) matrix position.
  // If no suck key exists, fall back to the first key on the left/right side.
  const right = side === 'right'
  let bootloaderPosition = findIndexIter(matrix.values(), m => m[0] == 0 && m[1] == (right ? 7 : 0))
  if (bootloaderPosition == -1 && right && config.right) bootloaderPosition = findIndexIter(matrix.keys(), k => config.right!.c.keys.includes(k))
  if (bootloaderPosition == -1 && !right && config.left) bootloaderPosition = findIndexIter(matrix.keys(), k => config.left!.c.keys.includes(k))
  if (bootloaderPosition == -1) bootloaderPosition = 0

  const encoders = config[side] ? encoderKeys(config[side].c) : []

  // Wired-split transport DT (Phase 2: USB over Link, or legacy: UART).
  const wired = options.microcontroller === Microcontroller.LemonWired
  const split = side !== 'unibody'
  const usbSplit = wired && split && options.splitTransport !== SplitTransport.Uart
  const uartSplit = wired && split && options.splitTransport === SplitTransport.Uart
  const isCentral = split && side === options.centralSide
  const wantConsole = !!options.enableConsole

  // Central + USB split: disable uart0 (its pins are now PIO-USB D+/D-),
  // bring up Pico-PIO-USB as a UHC on the Link port, expose it to ZMK as
  // the split transport, and optionally surface a CDC ACM console on the
  // native USB-C alongside HID.
  const centralUsbBlock: Record<string, unknown> = usbSplit && isCentral
    ? {
      'pio_usb_host: pio_usb_host': {
        compatible: 'raspberrypi,pio-usb-host',
        pinDp: 0,
        pinout: 'dpdm',
        dataRate: 'full-speed',
        status: 'okay',
      },
      'usb_split: usb_split': {
        compatible: 'zmk,usb-split',
        uhc: '<&pio_usb_host>',
      },
      ...(wantConsole
        ? {
          chosen: {
            'zephyr,console': '&cdc_acm_uart0',
            'zephyr,uart-mcumgr': '&cdc_acm_uart0',
          },
        }
        : {}),
    }
    : {}

  // Peripheral CDC ACM bulk pair — what the central's UHC enumerates and
  // drives. The label `zsu_cdc_acm` is what ZMK's USB-split peripheral
  // driver looks for via DT_CHOSEN/label lookup.
  const peripheralCdcBlock = usbSplit && !isCentral
    ? { 'zsu_cdc_acm: zsu_cdc_acm': { compatible: 'zephyr,cdc-acm-uart' } }
    : {}

  // Optional CDC ACM console on the central's native USB-C.
  const centralConsoleCdc = usbSplit && isCentral && wantConsole
    ? { 'cdc_acm_uart0: cdc_acm_uart0': { compatible: 'zephyr,cdc-acm-uart' } }
    : {}

  // Legacy UART split: GP0/GP1 carry a serial link between halves.
  const wiredSplitNode = uartSplit
    ? {
      'wired_split: wired_split': {
        compatible: 'zmk,wired-split',
        device: '<&uart0>',
      },
    }
    : {}

  return dtsFile({
    [raw()]: `#include "${options.folderName}.dtsi"`,
    ...(usbSplit && isCentral
      ? { '&uart0': { status: 'disabled' } }
      : {}),
    '/': {
      'bootloader_key: bootloader_key': {
        compatible: 'zmk,boot-magic-key',
        keyPosition: bootloaderPosition,
        jumpToBootloader: true,
      },
      ...centralUsbBlock,
      ...wiredSplitNode,
    },
    '&default_transform': right && {
      colOffset: 7,
    },
    ...(usbSplit && (Object.keys(centralConsoleCdc).length || Object.keys(peripheralCdcBlock).length)
      ? {
        '&zephyr_udc0': { ...centralConsoleCdc, ...peripheralCdcBlock },
      }
      : {}),
    ...(encoders.length
      ? {
        [`&${side}_encoder`]: {
          status: 'okay',
        },
      }
      : {}),
  })
}

const BOARD_OVERLAY_NRF52 = `#include <dt-bindings/led/led.h>

&pinctrl {
    spi3_default: spi3_default {
        group1 {
            psels = <NRF_PSEL(SPIM_MOSI, 0, 26)>;
        };
    };

    spi3_sleep: spi3_sleep {
        group1 {
            psels = <NRF_PSEL(SPIM_MOSI, 0, 26)>;
            low-power-enable;
        };
    };
};

&spi3 {
    compatible = "nordic,nrf-spim";
    status = "okay";

    pinctrl-0 = <&spi3_default>;
    pinctrl-1 = <&spi3_sleep>;
    pinctrl-names = "default", "sleep";

    led_strip: ws2812@0 {
        compatible = "worldsemi,ws2812-spi";

        /* SPI */
        reg = <0>; /* ignored, but necessary for SPI bindings */
        spi-max-frequency = <4000000>;

        /* WS2812 */
        chain-length = <49>;
        spi-one-frame = <0xE0>;
        spi-zero-frame = <0x80>;
        reset-delay = <50>;

        color-mapping = <LED_COLOR_ID_GREEN LED_COLOR_ID_RED LED_COLOR_ID_BLUE>;
    };
};

/ {
    chosen {
        zmk,underglow = &led_strip;
    };

    vik_conn: vik_connector {
		    compatible = "sadekbaroudi,vik-connector";
        #gpio-cells = <2>;
        gpio-map-mask = <0xffffffff 0xffffffc0>;
        gpio-map-pass-thru = <0 0x3f>;
        gpio-map
          = <0 0 &gpio0  15 0>   /* vik SDA */
          , <1 0 &gpio0  13 0>   /* vik SCL */
          , <2 0 &gpio0  26 0>   /* vik RGB Data */
          , <3 0 &gpio0  29 0>   /* vik AD_1 */
          , <4 0 &gpio0  12 0>   /* vik MOSI */
          , <5 0 &gpio0  31 0>   /* vik AD_2 */
          , <6 0 &gpio0  8 0>    /* vik CS */
          , <7 0 &gpio0  6 0>    /* vik MISO */
          , <8 0 &gpio1  1 9>    /* vik SCLK */
          ;
    };
};

vik_i2c: &i2c0 {};
vik_spi: &spi1 {};
`

// Wired board overlay. The cosmos_lemon_wired board (in the fork) already
// enables &uart0/&spi1/&i2c1 with their pinctrl groups; this overlay just
// adds the VIK connector pin map. The split transport (UART or USB) lives
// in the per-side overlay.
// RGB underglow is not configured here yet: Zephyr 3.5 in the ZMK fork lacks
// an in-tree PIO ws2812 driver, so the .conf file forces underglow off for
// this MCU.
const BOARD_OVERLAY_RP2040 = `/ {
    vik_conn: vik_connector {
        compatible = "sadekbaroudi,vik-connector";
        #gpio-cells = <2>;
        gpio-map-mask = <0xffffffff 0xffffffc0>;
        gpio-map-pass-thru = <0 0x3f>;
        gpio-map
          = <0 0 &gpio0 18 0>   /* vik SDA */
          , <1 0 &gpio0 19 0>   /* vik SCL */
          , <2 0 &gpio0  2 0>   /* vik RGB Data */
          , <3 0 &gpio0 26 0>   /* vik AD_1 */
          , <4 0 &gpio0 15 0>   /* vik MOSI */
          , <5 0 &gpio0 27 0>   /* vik AD_2 */
          , <6 0 &gpio0 13 0>   /* vik CS */
          , <7 0 &gpio0 12 0>   /* vik MISO */
          , <8 0 &gpio0 14 0>   /* vik SCLK */
          ;
    };
};

vik_i2c: &i2c1 {};
vik_spi: &spi1 {};
`

function boardOverlay(options: ZMKOptions) {
  return options.microcontroller === Microcontroller.LemonWired ? BOARD_OVERLAY_RP2040 : BOARD_OVERLAY_NRF52
}

export function downloadZMKCode(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const { folderName } = options
  if (!folderName || folderName == '.') {
    alert('Invalid folder name')
    return
  }
  zip({
    [folderName]: {
      '.github/workflows/build.yml': strToU8(generateGitHubWorkflow()),
      'build.yaml': strToU8(generateBuildYaml(config, options)),
      'zephyr/module.yml': strToU8(generateModuleYaml()),
      'config/deps.yml': strToU8(generateDepsYaml()),
      'config/west.yml': strToU8(generateWestYaml(options)),
      [`boards/shields/${folderName}`]: {
        [`boards/${boardName(options)}.overlay`]: strToU8(boardOverlay(options)),
        'Kconfig.defconfig': strToU8(generateDefconfig(config, options)),
        'Kconfig.shield': strToU8(generateShield(config, options)),
        [folderName + '.dtsi']: strToU8(generateDTSI(config, matrix, options)),
        [folderName + '-layouts.dtsi']: strToU8(generateLayouts(config, matrix, options)),
        [folderName + '.keymap']: strToU8(generateKeymap(config, matrix, options)),
        [folderName + '.zmk.yml']: strToU8(generateZMKYaml(config, options)),
        ...(config.unibody
          ? {
            [folderName + '.overlay']: strToU8(generateOverlay(config, matrix, options, 'unibody')),
            [folderName + '.conf']: strToU8(generateConf(config, options, 'unibody')),
          }
          : {
            [folderName + '_left.overlay']: strToU8(generateOverlay(config, matrix, options, 'left')),
            [folderName + '_right.overlay']: strToU8(generateOverlay(config, matrix, options, 'right')),
            [folderName + '_left.conf']: strToU8(generateConf(config, options, 'left')),
            [folderName + '_right.conf']: strToU8(generateConf(config, options, 'right')),
          }),
      },
    },
  }, (err, data) => {
    if (!err) {
      const blob = new Blob([data], { type: 'application/x-zip' })
      download(blob, `firmware-${options.folderName}.zip`)
    }
  })
}

export function* zmkInfo(config: Geometry) {
  if (encoderKeys(config.c).length > 0) yield 'Encoder detected. Make sure it is wired to P0.29 and P0.31'
}

export function* zmkErrors(config: Geometry) {
  if (encoderKeys(config.c).length > 1) yield 'Multiple encoders detected on this side. Only the first will be configured in the firmware.'
}
