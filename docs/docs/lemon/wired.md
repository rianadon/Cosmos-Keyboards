# Lemon Wired

The Lemon Wired is a RP2040-based microcontroller for split keyboards with two USB-C ports, a VIK connector, and two FPC connectors for connecting column-flex PCBs. If you use column-flex PCBs and VIK-compatible peripherals, it's possible to build a split keyboard without soldering any wires!

If you haven't already, I suggest you check out the [Lemon Landing page](https://ryanis.cool/lemon) to learn more.

--8<-- "docs/docs/lemon/.shared.md"

## Pinout

Go to the [landing page](https://ryanis.cool/lemon) :)

## QMK Example

The best example of using QMK on the Lemon microcontroller will for now probably be the QMK implementation of my [peaMK](https://github.com/rianadon/peaMK/tree/main/qmk) software. Currently, all this program does is print the matrix position of a key you press, but you can disable this feature by editing `keymap.c.`. There's a few noteworthy aspects to this program:

- It uses as much of the modern, data-driven QMK approach as possible.
- It relies on Sadek Baroudi's VIK library for QMK to enable quick setup of VIK modules.
- Communication is done through full-duplex UART.

When using QMK, you will need to wire the Link-only connector on this microcontroller to the Link-only connector on the other microcontroller.

## KMK Example

Work in progress :) I'm working on merging my changes into CircuitPython and KMK.

## Arduino Core

WIP.

## Further Documentation

Documentation for older boards, schematics and layout, and more can be found on the Wired Lemon's [GitHub page](https://github.com/rianadon/Cosmos-Keyboard-PCBs/tree/main/lemon-microcontroller).
