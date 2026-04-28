import { expect, test } from 'bun:test'
import { dtsFile, raw, yamlFile } from './firmwareHelpers'

test('Example DTS', () => {
  const json = {
    [raw()]: '#include <behaviors.dtsi>',
    [raw()]: '#include <dt-bindings/zmk/matrix_transform.h>',
    [raw()]: '#include <dt-bindings/zmk/keys.h>',
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
        'zmk,matrix_transform': '&default_transform',
      },
      'default_transform: keymap_transform_0': {
        compatible: 'zmk,matrix-transform',
        columns: 14,
        rows: 7,
      },
      'kscan0: kscan_0': {
        compatible: 'zmk,kscan-gpio-matrix',
        diodeDirection: 'col2row',
        rowGpios: [
          '<&gpio0 20 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
          '<&gpio0 22 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
          '<&gpio0 24 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
          '<&gpio0 9  (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
          '<&gpio0 10 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
          '<&gpio1 13 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
          '<&gpio1 15 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>',
        ],
        colGpios: [
          '<&shifter 0 GPIO_ACTIVE_HIGH>',
          '<&shifter 1 GPIO_ACTIVE_HIGH>',
          '<&shifter 2 GPIO_ACTIVE_HIGH>',
          '<&shifter 3 GPIO_ACTIVE_HIGH>',
          '<&shifter 4 GPIO_ACTIVE_HIGH>',
          '<&shifter 5 GPIO_ACTIVE_HIGH>',
          '<&shifter 6 GPIO_ACTIVE_HIGH>',
        ],
      },
    },
  }

  const output = `#include <behaviors.dtsi>
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
    };

    kscan0: kscan_0 {
        compatible = "zmk,kscan-gpio-matrix";
        diode-direction = "col2row";

        row-gpios
            = <&gpio0 20 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            , <&gpio0 22 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            , <&gpio0 24 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            , <&gpio0 9  (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            , <&gpio0 10 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            , <&gpio1 13 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            , <&gpio1 15 (GPIO_ACTIVE_HIGH | GPIO_PULL_DOWN)>
            ;

        col-gpios
            = <&shifter 0 GPIO_ACTIVE_HIGH>
            , <&shifter 1 GPIO_ACTIVE_HIGH>
            , <&shifter 2 GPIO_ACTIVE_HIGH>
            , <&shifter 3 GPIO_ACTIVE_HIGH>
            , <&shifter 4 GPIO_ACTIVE_HIGH>
            , <&shifter 5 GPIO_ACTIVE_HIGH>
            , <&shifter 6 GPIO_ACTIVE_HIGH>
            ;
    };
};
`
  expect(dtsFile(json)).toEqual(output)
})

test('Overlay generation', () => {
  const overlayFn = (right: boolean) => {
    let overlay = `#include "folder.dtsi"

/ {
    bootloader_key: bootloader_key {
        compatible = "zmk,boot-magic-key";
        key-position = <6>;
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
  const overlayFn2 = (right: boolean) =>
    dtsFile({
      [raw()]: '#include "folder.dtsi"',
      '/': {
        'bootloader_key: bootloader_key': {
          compatible: 'zmk,boot-magic-key',
          keyPosition: 6,
          jumpToBootloader: true,
        },
      },
      '&default_transform': right && {
        colOffset: 7,
      },
    })

  expect(overlayFn2(false)).toBe(overlayFn(false))
  expect(overlayFn2(true)).toBe(overlayFn(true))
})

test('Example YAML file', () => {
  const yaml = {
    include: [
      {
        board: 'cosmos_lemon_wireless',
        shield: 'kb_left',
        snippet: 'zmk-usb-logging;studio-rpc-usb-uart',
        'cmake-args': '-DCONFIG_ZMK_STUDIO=y',
      },
      {
        board: 'cosmos_lemon_wireless',
        shield: 'kb_right',
        snippet: undefined,
        'cmake-args': undefined,
      },
    ],
  }

  const output = `---
include:
  - board: cosmos_lemon_wireless
    shield: kb_left
    snippet: zmk-usb-logging;studio-rpc-usb-uart
    cmake-args: -DCONFIG_ZMK_STUDIO=y
  - board: cosmos_lemon_wireless
    shield: kb_right
`

  expect(yamlFile(yaml, true)).toEqual(output)
})
