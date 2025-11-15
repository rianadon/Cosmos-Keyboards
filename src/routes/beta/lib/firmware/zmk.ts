import { download } from '$lib/browser'
import { hasPinsInMatrix } from '$lib/loaders/keycaps'
import type { CuttleKey, Geometry } from '$lib/worker/config'
import { filterObj, findIndexIter, mapObjNotNull, mapObjNotNullToObj, mapObjToObj, objEntries, objEntriesNotNull, objKeysOfNotNull, sum } from '$lib/worker/util'
import { strToU8, zip } from 'fflate'
import type { FullGeometry } from '../viewers/viewer3dHelpers'
import { dtsFile, encoderKeys, fullLayout, logicalKeys, type Matrix, raw, yamlFile } from './firmwareHelpers'

const RE_PID_VID = /^0x[0-9A-Fa-f]{4}$/

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
function keycode(code: string | undefined) {
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
      build: { uses: 'zmkfirmware/zmk/.github/workflows/build-user-config.yml@main' },
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
          board: 'cosmos_lemon_wireless',
          shield: shieldList(`${options.folderName}`, options.peripherals.unibody),
          snippet: snippets.join(';'),
          'cmake-args': options.enableStudio ? '-DCONFIG_ZMK_STUDIO=y' : undefined,
        },
      ]
      : [
        {
          board: 'cosmos_lemon_wireless',
          shield: shieldList(`${options.folderName}_left`, options.peripherals.left),
          snippet: options.centralSide == 'left' ? snippets.join(';') : undefined,
          'cmake-args': options.centralSide == 'left' && options.enableStudio ? '-DCONFIG_ZMK_STUDIO=y' : undefined,
        },
        {
          board: 'cosmos_lemon_wireless',
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

function generateWestYaml(): string {
  return yamlFile({
    manifest: {
      remotes: [
        { name: 'zmkfirmware', 'url-base': 'https://github.com/zmkfirmware' },
        { name: 'rianadon', 'url-base': 'https://github.com/rianadon' },
      ],
      projects: [
        { name: 'zmk', remote: 'rianadon', revision: 'main', import: 'app/west.yml' },
      ],
      self: { path: 'config', import: 'deps.yml' },
    },
  })
}

function generateDefconfig(config: FullGeometry, options: ZMKOptions) {
  const { folderName } = options
  const centralSide = options.centralSide.toUpperCase()
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

function generateConf(config: FullGeometry, options: ZMKOptions) {
  return [
    '# RGB underglow configuration',
    'CONFIG_ZMK_RGB_UNDERGLOW=y',
    'CONFIG_WS2812_STRIP=y',
    'CONFIG_ZMK_RGB_UNDERGLOW_BRT_START=50',
    'CONFIG_ZMK_RGB_UNDERGLOW_EFF_START=3',
    'CONFIG_ZMK_RGB_UNDERGLOW_ON_START=' + (options.underGlowAtStart ? 'y' : 'n'),
    '',
    '# zmk mouse emulation for trackball/trackpad',
    'CONFIG_ZMK_POINTING=' + (Object.values(options.peripherals).some(p => p.pmw3610 || p.cirque) ? 'y' : 'n'),
    '',
    '# encoder support',
    'CONFIG_EC11=' + (Object.values(options.peripherals).some(p => p.encoder) ? 'y' : 'n'),
    'CONFIG_EC11_TRIGGER_GLOBAL_THREAD=' + (Object.values(options.peripherals).some(p => p.encoder) ? 'y' : 'n'),
  ].join('\n') + '\n'
}

function generateDTSI(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const activeMode = options.diodeDirection == 'COL2ROW' ? 'GPIO_ACTIVE_HIGH' : 'GPIO_ACTIVE_LOW'
  const pullMode = options.diodeDirection == 'COL2ROW' ? 'GPIO_PULL_DOWN' : 'GPIO_PULL_UP'
  const encoders = mapObjNotNull(config, (g) => encoderKeys(g.c))
  const encodersWithLength = filterObj(encoders, (k, v) => v.length > 0)

  return dtsFile({
    [raw()]: '#include <behaviors.dtsi>',
    [raw()]: '#include <dt-bindings/zmk/matrix_transform.h>',
    [raw()]: '#include <dt-bindings/zmk/keys.h>',
    [raw()]: `#include "${options.folderName}-layouts.dtsi"`,
    [raw()]: '// Tell VIK that there is 1 other device on the SPI bus.',
    [raw()]: '// You will need to increase this number if you add another SPI device.',
    [raw()]: '#define VIK_SPI_REG_START 1',
    [raw()]: '// Pulled out to an external variable so VIK can find the SPI bus.',
    [raw()]: '#define VIK_SPI_CS_PREFIX <&gpio0 4 GPIO_ACTIVE_LOW>',
    '&spi1': {
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
        rowGpios: [
          `<&gpio0 20 (${activeMode} | ${pullMode})>`,
          `<&gpio0 22 (${activeMode} | ${pullMode})>`,
          `<&gpio0 24 (${activeMode} | ${pullMode})>`,
          `<&gpio0 9  (${activeMode} | ${pullMode})>`,
          `<&gpio0 10 (${activeMode} | ${pullMode})>`,
          `<&gpio1 13 (${activeMode} | ${pullMode})>`,
          `<&gpio1 15 (${activeMode} | ${pullMode})>`,
        ],
        colGpios: [
          `<&shifter 0 ${activeMode}>`,
          `<&shifter 1 ${activeMode}>`,
          `<&shifter 2 ${activeMode}>`,
          `<&shifter 3 ${activeMode}>`,
          `<&shifter 4 ${activeMode}>`,
          `<&shifter 5 ${activeMode}>`,
          `<&shifter 6 ${activeMode}>`,
        ],
      },
      ...mapObjToObj(encodersWithLength, (encoders, side) => ({
        [`${side}_encoder: encoder_${side}`]: {
          compatible: 'alps,ec11',
          aGpios: '<&gpio0 29 (GPIO_ACTIVE_HIGH | GPIO_PULL_UP)>',
          bGpios: '<&gpio0 31 (GPIO_ACTIVE_HIGH | GPIO_PULL_UP)>',
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

  return dtsFile({
    [raw()]: `#include "${options.folderName}.dtsi"`,
    '/': {
      'bootloader_key: bootloader_key': {
        compatible: 'zmk,boot-magic-key',
        keyPosition: bootloaderPosition,
        jumpToBootloader: true,
      },
    },
    '&default_transform': right && {
      colOffset: 7,
    },
    ...(encoders.length
      ? {
        [`&${side}_encoder`]: {
          status: 'okay',
        },
      }
      : {}),
  })
}

const BOARD_OVERLAY = `#include <dt-bindings/led/led.h>

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

export function downloadZMKCode(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const { folderName } = options
  zip({
    [folderName]: {
      '.github/workflows/build.yml': strToU8(generateGitHubWorkflow()),
      'build.yaml': strToU8(generateBuildYaml(config, options)),
      'zephyr/module.yml': strToU8(generateModuleYaml()),
      'config/deps.yml': strToU8(generateDepsYaml()),
      'config/west.yml': strToU8(generateWestYaml()),
      [`boards/shields/${folderName}`]: {
        'boards/cosmos_lemon_wireless.overlay': strToU8(BOARD_OVERLAY),
        'Kconfig.defconfig': strToU8(generateDefconfig(config, options)),
        'Kconfig.shield': strToU8(generateShield(config, options)),
        [folderName + '.dtsi']: strToU8(generateDTSI(config, matrix, options)),
        [folderName + '-layouts.dtsi']: strToU8(generateLayouts(config, matrix, options)),
        [folderName + '.keymap']: strToU8(generateKeymap(config, matrix, options)),
        [folderName + '.zmk.yml']: strToU8(generateZMKYaml(config, options)),
        ...(config.unibody
          ? {
            [folderName + '.overlay']: strToU8(generateOverlay(config, matrix, options, 'unibody')),
            [folderName + '.conf']: strToU8(generateConf(config, options)),
          }
          : {
            [folderName + '_left.overlay']: strToU8(generateOverlay(config, matrix, options, 'left')),
            [folderName + '_right.overlay']: strToU8(generateOverlay(config, matrix, options, 'right')),
            [folderName + '_left.conf']: strToU8(generateConf(config, options)),
            [folderName + '_right.conf']: strToU8(generateConf(config, options)),
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
