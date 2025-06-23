import { download } from '$lib/browser'
import { hasPinsInMatrix } from '$lib/loaders/keycaps'
import type { CuttleKey } from '$lib/worker/config'
import { findIndexIter } from '$lib/worker/util'
import { strToU8, zip } from 'fflate'
import type { FullGeometry } from './viewers/viewer3dHelpers'

export type Matrix = Map<CuttleKey, [number, number]>

const RE_PID_VID = /^0x[0-9A-Fa-f]{4}$/

interface ZMKPeripherals {
  trackball: boolean
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
}

export function validateConfig(options: ZMKOptions) {
  if (!RE_PID_VID.test(options.vid)) return 'VID should be of form 0xaaaa'
  if (!RE_PID_VID.test(options.pid)) return 'PID should be of form 0xaaaa'
}

/** Very simple function to process converting arrays and objects to YAML. */
function _jsonToYaml(data: any, indent: number = 0): string {
  const indentation = '  '.repeat(indent)

  if (Array.isArray(data)) {
    return data
      .map(item => `${indentation}- ` + _jsonToYaml(item, indent + 1).trim())
      .join('\n')
  } else if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => {
        const prefix = typeof value === 'object' && value !== null ? '\n' : ' '
        return `${indentation}${key}:${prefix}${_jsonToYaml(value, indent + 1)}`
      })
      .join('\n')
  }
  return String(data)
}

/** Convert a json object to a YAML document. */
function jsonToYaml(data: any, newDoc = false): string {
  if (newDoc) return '---\n' + _jsonToYaml(data) + '\n'
  return _jsonToYaml(data) + '\n'
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
  code = code?.toLowerCase()

  if (!code) return '&kp SPACE'
  if (/^[a-z]$/.test(code)) return '&kp ' + code.toUpperCase()
  if (/^[0-9]$/.test(code)) return '&kp N' + String(code)
  if (CHARS.hasOwnProperty(code)) return '&kp ' + (CHARS as any)[code]
  if (SPECIALS.includes(code)) return '&kp ' + code.toUpperCase()

  return '&kp SPACE'
}

/** Generates the keycodes for the ZMK keymap */
function generateKeycodes(config: FullGeometry, matrix: Matrix) {
  const keycodes: string[] = []
  for (const keyboard of Object.values(config)) {
    for (const key of keyboard.c.keys) {
      if (!hasPinsInMatrix(key)) continue
      keycodes.push(keycode('keycap' in key ? key.keycap?.letter : undefined))
    }
  }
  return keycodes
}

function generateKeymap(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  return `#include <behaviors.dtsi>
#include <dt-bindings/zmk/keys.h>

/ {
    keymap {
        compatible = "zmk,keymap";

        default_layer {
            bindings = <${generateKeycodes(config, matrix).join(' ')}>;
        };
    };
};`
}

function generateGitHubWorkflow() {
  return jsonToYaml({
    on: ['push', 'pull_request', 'workflow_dispatch'],
    jobs: {
      build: { uses: 'zmkfirmware/zmk/.github/workflows/build-user-config.yml@main' },
    },
  })
}

function generateBuildYaml(config: FullGeometry, options: ZMKOptions): string {
  function shieldList(name: string, peripherals: ZMKPeripherals) {
    const shields = [name]
    if (peripherals.trackball) shields.push('vik_pmw3610')
    return shields.join(' ')
  }
  return jsonToYaml({
    include: config.unibody
      ? [
        {
          board: 'cosmos_lemon_wireless',
          shield: shieldList(`${options.folderName}`, options.peripherals.unibody),
          snippet: 'zmk-usb-logging',
        },
      ]
      : [
        {
          board: 'cosmos_lemon_wireless',
          shield: shieldList(`${options.folderName}_left`, options.peripherals.left),
          snippet: 'zmk-usb-logging',
        },
        {
          board: 'cosmos_lemon_wireless',
          shield: shieldList(`${options.folderName}_right`, options.peripherals.right),
          snippet: 'zmk-usb-logging',
        },
      ],
  }, true)
}

function generateModuleYaml(): string {
  return jsonToYaml({
    build: {
      depends: ['vik-core'],
      settings: { board_root: '.' },
    },
  })
}

function generateDepsYaml(): string {
  return jsonToYaml({
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
  return jsonToYaml({
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

config SPI
    default y

config ZMK_RGB_UNDERGLOW
    select WS2812_STRIP
    select SPI

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
    '# Uncomment the following lines to enable RGB underglow',
    'CONFIG_ZMK_RGB_UNDERGLOW=y',
    ...(Object.values(options.peripherals).some(p => p.trackball)
      ? [
        '# zmk mouse emulation for trackball',
        'CONFIG_ZMK_POINTING=y',
      ]
      : []),
  ].join('\n') + '\n'
}

function generateDTSI(config: FullGeometry, matrix: Matrix, options: ZMKOptions) {
  const activeMode = options.diodeDirection == 'COL2ROW' ? 'GPIO_ACTIVE_HIGH' : 'GPIO_ACTIVE_LOW'
  const pullMode = options.diodeDirection == 'COL2ROW' ? 'GPIO_PULL_DOWN' : 'GPIO_PULL_UP'

  return `#include <behaviors.dtsi>
#include <dt-bindings/zmk/matrix_transform.h>
#include <dt-bindings/zmk/keys.h>

// Tell VIK that there is 1 other device on the SPI bus.
// You will need to increase this number if you add another SPI device.
#define VIK_SPI_REG_START 1
// Pulled out to an external variable so VIK can find the SPI bus.
#define VIK_SPI_CS_PREFIX <&gpio0 4 GPIO_ACTIVE_LOW>

&spi1 {
    status = "okay";
    cs-gpios = VIK_SPI_CS_PREFIX;

    shifter: 595@0 {
        compatible = "zmk,gpio-595";
        status = "okay";
        gpio-controller;
        spi-max-frequency = <200000>;
        reg = <0>;
        ngpios = <8>;
        #gpio-cells = <2>;
    };
};

/ {
    chosen {
        zmk,kscan = &kscan0;
        zmk,matrix_transform = &default_transform;
    };

    default_transform: keymap_transform_0 {
        compatible = "zmk,matrix-transform";
        columns = <14>;
        rows = <7>;
        map = <${matrix.values().map(([r, c]) => `RC(${r},${c})`).toArray().join(' ')}>;
    };

    kscan0: kscan_0 {
        compatible = "zmk,kscan-gpio-matrix";

        diode-direction = "col2row";
        row-gpios
            = <&gpio0 20 (${activeMode} | ${pullMode})>
            , <&gpio0 22 (${activeMode} | ${pullMode})>
            , <&gpio0 24 (${activeMode} | ${pullMode})>
            , <&gpio0 9  (${activeMode} | ${pullMode})>
            , <&gpio0 10 (${activeMode} | ${pullMode})>
            , <&gpio1 13 (${activeMode} | ${pullMode})>
            , <&gpio1 15 (${activeMode} | ${pullMode})>
            ;

        col-gpios
            = <&shifter 0 ${activeMode}>
            , <&shifter 1 ${activeMode}>
            , <&shifter 2 ${activeMode}>
            , <&shifter 3 ${activeMode}>
            , <&shifter 4 ${activeMode}>
            , <&shifter 5 ${activeMode}>
            , <&shifter 6 ${activeMode}>
            ;
    };
};
`
}

function generateZMKYaml(config: FullGeometry, options: ZMKOptions) {
  const { folderName, keyboardName } = options
  return jsonToYaml({
    file_format: '"1"',
    id: folderName,
    name: keyboardName,
    type: 'shield',
    url: 'https://github.com/rianadon/Cosmos-Keyboards',
    features: ['keys', 'studio'],
    siblings: config.unibody ? [folderName] : [`${folderName}_left`, `${options.folderName}_right`],
  })
}

function generateOverlay(config: FullGeometry, matrix: Matrix, options: ZMKOptions, right: boolean) {
  // Find the bootloader position, which should be the index of the key with (0,0) matrix position.
  // If no suck key exists, fall back to the first key on the left/right side.
  let bootloaderPosition = findIndexIter(matrix.values(), m => m[0] == 0 && m[1] == (right ? 7 : 0))
  if (bootloaderPosition == -1 && right && config.right) bootloaderPosition = findIndexIter(matrix.keys(), k => config.right!.c.keys.includes(k))
  if (bootloaderPosition == -1 && !right && config.left) bootloaderPosition = findIndexIter(matrix.keys(), k => config.left!.c.keys.includes(k))
  if (bootloaderPosition == -1) bootloaderPosition = 0

  let overlay = `
#include "${options.folderName}.dtsi"

/ {
    bootloader_key: bootloader_key {
        compatible = "zmk,boot-magic-key";
        key-position = <${bootloaderPosition}>;
        jump-to-bootloader;
    };
};
`
  if (right) {
    overlay += `
&default_transform {
    col-offset = <7>;
};
`
  }
  return overlay
}

function generateBoardOverlay() {
  return `#include <dt-bindings/led/led.h>

&pinctrl {
    spi3_default: spi3_default {
        group1 {
            psels = <NRF_PSEL(SPIM_MOSI, 0, 6)>;
        };
    };

    spi3_sleep: spi3_sleep {
        group1 {
            psels = <NRF_PSEL(SPIM_MOSI, 0, 6)>;
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
        chain-length = <10>; /* arbitrary; change at will */
        spi-one-frame = <0x70>;
        spi-zero-frame = <0x40>;

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
}

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
        'boards/cosmos_lemon_wireless.overlay': strToU8(generateBoardOverlay()),
        'Kconfig.defconfig': strToU8(generateDefconfig(config, options)),
        'Kconfig.shield': strToU8(generateShield(config, options)),
        [folderName + '.conf']: strToU8(generateConf(config, options)),
        [folderName + '.dtsi']: strToU8(generateDTSI(config, matrix, options)),
        [folderName + '.keymap']: strToU8(generateKeymap(config, matrix, options)),
        [folderName + '.zmk.yml']: strToU8(generateZMKYaml(config, options)),
        ...(config.unibody
          ? {
            [folderName + '.overlay']: strToU8(generateOverlay(config, matrix, options, false)),
          }
          : {
            [folderName + '_left.overlay']: strToU8(generateOverlay(config, matrix, options, false)),
            [folderName + '_right.overlay']: strToU8(generateOverlay(config, matrix, options, true)),
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
