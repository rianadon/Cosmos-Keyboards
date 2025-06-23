# Lemon Wireless

The Lemon Wireless is an nRF52840-based microcontroller for split keyboards with a USB-C port, power switch, JST battery connector, a VIK connector, and two FPC connectors for connecting column-flex PCBs. If you use column-flex PCBs and VIK-compatible peripherals, it's possible to build a wireless split keyboard without soldering any wires!

If you haven't already, I suggest you check out the [Lemon Landing page](https://ryanis.cool/lemon) to learn more.

--8<-- "docs/docs/lemon/.shared.md"

## Pinout

Go to the [landing page](https://ryanis.cool/lemon) :)

## Power

The Lemon Wireless can run on both USB power and a 4.2/3.7V Lithium Polymer (LiPo/LiPoly) or Lithium Ion (LiIon) rechargable battery. If you connect both at the same time, the microcontroller will draw from USB power while charging the battery.

!!! warning

    Connecting a battery with incorrect JST connector polarity can permanently damage the board. There's no standard for the polarity, so batteries ordered from places like Amazon may be wired incorrectly. You can fix a reversed connector by [removing and rearranging](https://www.youtube.com/watch?v=0G7iIwfuaJ8) the crimped leads in the JST housing. Then double check the wire coloring matches the silkscreen on the board (red goes to +, black goes to -).

    To avoid this risk entirely, it's safest to buy [batteries from Adafruit](https://www.adafruit.com/category/574). Their batteries are correctly wired and buying from them helps support their open-source contributions—such as the bootloader used by this board.

These are the only two kinds of batteries supported. Plugging in a higher voltage battery (e.g. a multicell one like 7.4V) or alkaline/nonrechargeable batteries will damage the board.

## ZMK Example

The best example of using ZMK on the Lemon microcontroller will for now probably be the ZMK implementation of my [peaMK](https://github.com/rianadon/peaMK/tree/main/zmk) software. Currently, all this program does is print the matrix position of a key you press, but you can disable this feature by editing `boards/shields/peamk/peamk.keymap`. There are a few noteworthy aspects to this program:

- The structure is the same as a ZMK userspace repository, so you can follow the ZMK install instructions then copy these files over to your GitHub repository.
  - It uses Sadek Baroudi's [VIK module](https://github.com/sadekbaroudi/zmk-fingerpunch-vik) which makes configuring VIK modules very easy. For example, to add a Cirque trackpad you only need to add this to your `build.yml`:
  ```yaml
  ---
  include:
    - board: cosmos_lemon_wireless
      shield: <YOUR_KEYBOARD> vik_cirque_spi
  ```

## Arduino Core

I haven't contributed this board upstream yet since I don't know how popular this option is going to be. Therefore, if you do program the Lemon with Arduino then please tell me so I can prioritize this!

??? note "Expand Arduino Instructions (Caution: Not Easy)"

    You will need to install Adafruit's nRF52 core via git by following the instructions [here](https://learn.adafruit.com/introducing-the-adafruit-nrf52840-feather/arduino-bsp-setup), all the way down to and including **Advanced Option: Manually Install the BSP via 'git'**. Then, open the cloned `Adafruit_nRF52_Arduino` folder and add these lines to the end of `boards.txt`:

    ``` title="boards.txt"
    # -----------------------------------
    # Cosmos Lemon Wireless
    # -----------------------------------
    cosmos_lemon_wireless.name=Cosmos Lemon Wireless

    cosmos_lemon_wireless.vid.0=0x1915
    cosmos_lemon_wireless.pid.0=0x6c77

    # Upload
    cosmos_lemon_wireless.bootloader.tool=bootburn
    cosmos_lemon_wireless.upload.tool=nrfutil
    cosmos_lemon_wireless.upload.protocol=nrfutil
    cosmos_lemon_wireless.upload.use_1200bps_touch=true
    cosmos_lemon_wireless.upload.wait_for_upload_port=true
    cosmos_lemon_wireless.upload.maximum_size=815104
    cosmos_lemon_wireless.upload.maximum_data_size=237568

    # Build
    cosmos_lemon_wireless.build.mcu=cortex-m4
    cosmos_lemon_wireless.build.f_cpu=64000000
    cosmos_lemon_wireless.build.board=NRF52840_FEATHER
    cosmos_lemon_wireless.build.core=nRF5
    cosmos_lemon_wireless.build.variant=cosmos_lemon_wireless
    cosmos_lemon_wireless.build.usb_manufacturer="Cosmos"
    cosmos_lemon_wireless.build.usb_product="Lemon Wireless"
    cosmos_lemon_wireless.build.extra_flags=-DNRF52840_XXAA {build.flags.usb}
    cosmos_lemon_wireless.build.ldscript=nrf52840_s140_v6.ld
    cosmos_lemon_wireless.build.openocdscript=scripts/openocd/daplink_nrf52.cfg
    cosmos_lemon_wireless.build.vid=0x1915
    cosmos_lemon_wireless.build.pid=0x6c77

    # Menu: SoftDevice
    cosmos_lemon_wireless.menu.softdevice.s140v6=S140 6.1.1
    cosmos_lemon_wireless.menu.softdevice.s140v6.build.sd_name=s140
    cosmos_lemon_wireless.menu.softdevice.s140v6.build.sd_version=6.1.1
    cosmos_lemon_wireless.menu.softdevice.s140v6.build.sd_fwid=0x00B6

    # Menu: Debug Level
    cosmos_lemon_wireless.menu.debug.l0=Level 0 (Release)
    cosmos_lemon_wireless.menu.debug.l0.build.debug_flags=-DCFG_DEBUG=0
    cosmos_lemon_wireless.menu.debug.l1=Level 1 (Error Message)
    cosmos_lemon_wireless.menu.debug.l1.build.debug_flags=-DCFG_DEBUG=1
    cosmos_lemon_wireless.menu.debug.l2=Level 2 (Full Debug)
    cosmos_lemon_wireless.menu.debug.l2.build.debug_flags=-DCFG_DEBUG=2
    cosmos_lemon_wireless.menu.debug.l3=Level 3 (Segger SystemView)
    cosmos_lemon_wireless.menu.debug.l3.build.debug_flags=-DCFG_DEBUG=3
    cosmos_lemon_wireless.menu.debug.l3.build.sysview_flags=-DCFG_SYSVIEW=1

    # Menu: Debug Port
    cosmos_lemon_wireless.menu.debug_output.serial=Serial
    cosmos_lemon_wireless.menu.debug_output.serial.build.logger_flags=-DCFG_LOGGER=0
    cosmos_lemon_wireless.menu.debug_output.serial1=Serial1
    cosmos_lemon_wireless.menu.debug_output.serial1.build.logger_flags=-DCFG_LOGGER=1 -DCFG_TUSB_DEBUG=CFG_DEBUG
    cosmos_lemon_wireless.menu.debug_output.rtt=Segger RTT
    cosmos_lemon_wireless.menu.debug_output.rtt.build.logger_flags=-DCFG_LOGGER=2 -DCFG_TUSB_DEBUG=CFG_DEBUG -DSEGGER_RTT_MODE_DEFAULT=SEGGER_RTT_MODE_BLOCK_IF_FIFO_FULL
    ```

    There should be a `variants` folder in the same directory as `boards.txt`. Inside the `variants` folder, create a directory called `cosmos_lemon_wireless`. Then add these two files

    ```cpp title="variant.cpp"
    #include "variant.h"
    #include "wiring_constants.h"
    #include "wiring_digital.h"
    #include "nrf.h"

    const uint32_t g_ADigitalPinMap[] =
    {
      (32+13), // D0
      (32+15),
      (2),
      (29),
      (31),
      (26),
      (4),
      (6),
      (8),
      (32+9),
      (12), // D10
      (10),
      (9),
      (32+0), // D13
      (24),
      (22),
      (20),
      (18),
      (15),
      (13), // D19
      (14), // Useless pin
      (17), // useless pin
    };

    void initVariant() { }
    ```
    ```cpp title="variant.h"
    #ifndef _VARIANT_LEMONWIRELESS_
    #define _VARIANT_LEMONWIRELESS_

    /** Master clock frequency */
    #define VARIANT_MCK       (64000000ul)

    #define USE_LFXO      // Board uses 32khz crystal for LF
    // define USE_LFRC    // Board uses RC for LF

    /*----------------------------------------------------------------------------
     *        Headers
     *----------------------------------------------------------------------------*/

    #include "WVariant.h"

    #ifdef __cplusplus
    extern "C"
    {
    #endif // __cplusplus

    // Number of pins defined in PinDescription array
    #define PINS_COUNT           (22)
    #define NUM_DIGITAL_PINS     (22)
    #define NUM_ANALOG_INPUTS    (6) // A6 is used for battery, A7 is analog reference
    #define NUM_ANALOG_OUTPUTS   (0)

    #define LED_STATE_ON 1

    // LEDs
    /* #define PIN_LED1             (3) */
    /* #define PIN_LED2             (4) */
    /* #define PIN_NEOPIXEL_POWER   (34) */
    #define PIN_NEOPIXEL         (13)
    #define NEOPIXEL_NUM         1

    #define PIN_LED1             (20)
    #define PIN_LED2             (21)

    #define LED_BUILTIN          PIN_LED1
    #define LED_CONN             PIN_LED2

    #define LED_RED              PIN_LED1
    #define LED_BLUE             PIN_LED2

    #define ADC_RESOLUTION    14

    // Other pins

    /*
     * Serial interfaces
     */
    #define PIN_SERIAL1_RX       (14)
    #define PIN_SERIAL1_TX       (15)

    /*
     * SPI Interfaces
     */
    #define SPI_INTERFACES_COUNT 1

    #define PIN_SPI_MISO         (7)
    #define PIN_SPI_MOSI         (10)
    #define PIN_SPI_SCK          (9)

    static const uint8_t SS   = (5);
    static const uint8_t MOSI = PIN_SPI_MOSI ;
    static const uint8_t MISO = PIN_SPI_MISO ;
    static const uint8_t SCK  = PIN_SPI_SCK ;

    /*
     * Wire Interfaces
     */
    #define WIRE_INTERFACES_COUNT 1

    #define PIN_WIRE_SDA         (22)
    #define PIN_WIRE_SCL         (23)

    // QSPI Pins
    #define PIN_QSPI_SCK         27
    #define PIN_QSPI_CS          28
    #define PIN_QSPI_IO0         29
    #define PIN_QSPI_IO1         30
    #define PIN_QSPI_IO2         31
    #define PIN_QSPI_IO3         32

    // On-board QSPI Flash
    #define EXTERNAL_FLASH_DEVICES   GD25Q16C
    #define EXTERNAL_FLASH_USE_QSPI

    #ifdef __cplusplus
    }
    #endif

    /*----------------------------------------------------------------------------
     *        Arduino objects - C++ only
     *----------------------------------------------------------------------------*/

    #endif
    ```
    After modifying these files, restart Arduino IDE. You should now see Cosmos Lemon Wireless listed as the last option when choosing a board through **Tools -> Board -> Raspberry Pi Pico -> Cosmos Lemon Wired**.

After modifying these files, restart Arduino IDE. You should now see Cosmos Lemon Wireless listed as the last option when choosing a board through **Tools -> Board -> Adafruit nRF52 Boards -> Cosmos Lemon Wireless**.

## Further Documentation

Documentation for older boards, schematics and layout, and more can be found on the Wireless Lemon's [GitHub page](https://github.com/rianadon/Cosmos-Keyboard-PCBs/tree/main/lemon-wireless-uc).
