### VIK Breakout and Display

All displays require at least 3.3V and GND connected. For SPI displays like the Nice!View shown below, also connect CS, SCK, and MOSI. Many displays alternatively use I2C: for these connect SDA and SCL.

![Wiring Diagram of VIK and Display](../../assets/vik_display.png){width=600 .center}

In this case the labels on the display and breakout match, so the table is not necessary.

### VIK Modules with RGB

If you are driving the LEDs a constant color, solder the "RGB->VIK" solder jumper on the rear of the microcontroller, and you will be good to go!

If you are using animations together with LEDs on your keys, you will need to manually solder a cable for RGB data from the last LED in the chain of keys to the VIK module. Leave the "RGB->VIK" solder jumper unsoldered.

???info "More Details"

    I ran into a snafu routing LED signals on the board. I use the same connectors as Skree for the flex PCBs so that the Lemon is compatible with their hardware. However, these connectors do not have enough pins for the return signal on the thumb cluster connector. Unless I break compatibility, there is no way for me or you to cleanly run a chain of LEDs that starts at the keys then contintinues to the VIK module.

    The solution to this problem is the RGB->VIK jumper. By default the VIK RGB pin is not connected to anything, so you can feed it from wherever you like. Once it's soldered, the signal fed to the start of the LED chain for the keys will also be fed to your VIK module.
