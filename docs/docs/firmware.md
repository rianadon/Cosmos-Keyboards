# Firmware Autogen

If you're using the [Lemon Microcontrollers](https://ryanis.cool/cosmos/lemon), Cosmos can automatically generate your keyboard firmware. For the Wired Lemon, Cosmos will generate [QMK](https://qmk.fm/) firmware. For the Wireless Lemon, it will generate [ZMK](https://zmk.dev/) firmware. These are the most popular and feature-complete firmware for wired and wireless keyboards respectively.

Keyboards created in Cosmos need custom firmware because every keyboard firmware must be adjusted for the number of keys you chose to use, how they're wired, how they're mapped to letters/actions, and what extra peripherals you are using (like trackballs, encoders, etc). Typically you will adapt a configuration for QMK or ZMK to your keyboard then compile the firmware and configuration together, either by installing the toolchains yourself or using [GitHub Actions](https://github.com/features/actions) to compile in the cloud.

Despite the fact that some peripherals are not yet supported (you can track the implementation status at [Are we Programming yet](https://ryanis.cool/cosmos/areweprogrammingyet/)), Cosmos is still the easiest starting point for creating firmware for your board. You can use Cosmos to to generate what it can, start typing on your keyboard, and refer to the documentation and online examples to configure the remaining peripherals. It's like buying a car with a speaker system that still needs to be installed, versus piecing together an engine, drivetrain, chasis, etc.

!!!info "Support for More Microcontrollers"

    Right now only the Lemon microcontrollers are supported because the VIK and flex PCB connectors ensure there is only one way to connect everything to your microcontroller pins, which greatly simplifies the generation process.

    The priority right now is to make this process as dead simple as possible. There's still a lot of work to tackle, and if you're interested you can read the roadmap on the [PeaMK repository](https://github.com/rianadon/peaMK). Only after this is completed will the focus be expanding to other microcontrollers. However, you are more than welcome to fork Cosmos and adapt the code to the microcontroller you're using. Pull requests are always welcome :)

<div class="grid cards" markdown>

- **Lemon Wired**

  ---

  Install [`mkdocs-material`](#) with [`pip`](#) and get up
  and running in minutes

  [:octicons-arrow-right-24: Documentation](#)

- :fontawesome-brands-markdown:{ .lg .middle } **It's just Markdown**

  ---

  Focus on your content and generate a responsive and searchable static site

  [:octicons-arrow-right-24: Reference](#)

- :material-format-font:{ .lg .middle } **Made to measure**

  ---

  Change the colors, fonts, language, icons, logo and more with a few lines

  [:octicons-arrow-right-24: Customization](#)

- :material-scale-balance:{ .lg .middle } **Open Source, MIT**

  ---

  Material for MkDocs is licensed under MIT and available on [GitHub]

  [:octicons-arrow-right-24: License](#)

</div>

## QMK (Wired) Generation

## ZMK (Wireless) Generation

### Hardware Limitations

- For the Cirque trackpad, only SPI communication is supported! This is how they come out of the box. Don't listen to guides that tell you to remove R1. SPI is what you want to use because it is faster than I2C.
- Trackballs and trackpads are only officially supported (for now) on the central side. You can use a cirque trackpad on the peripheral side by changing `vik_cirque_spi` in your `build.yaml` to `vik_cirque_spi_split`. There's no such thing for the pmw3610 yet. Dual trackballs/trackpads are not yet supported either.

### Building

You can either follow ZMK's instruction to set up a [Local Toolchain](https://zmk.dev/docs/development/local-toolchain/setup) or use GitHub Actions to build your firmware. I recommend GitHub Actions since it requires installing no software and therefore is much faster to set up.

When you download the firmware from Cosmos, you'll get a zipped folder with a few directories. Here's what you should see after unzipping and turning on hidden folders in Mac/Linux (in Windows you don't need to turn on anything):

![.github, build.yaml, zephyr, boards, and config folders](../assets/zmkfolders.png){width=550 .center}

#### GitHub Actions Build

1. [Create a new repository on GitHub.](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
2. [Clone the repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository), copy the files shown above (including `.github`) into the repository, and [commit](https://github.com/git-guides/git-commit) and [push](https://github.com/git-guides/git-push). If you've never used GitHub before, my recommendation is to use the GitHub web editor by pressing ++period++ when on the repository page or replacing the `.com` in the URL with `.dev`. You can drag and drop these folders into the file explorerer then commit & push online.
3. Click the "Actions" tab on GitHub, click the top build, and you'll be able to download the firmware under "Artifacts" once the build completes. [ZMK has a detailed guide on this](https://zmk.dev/docs/user-setup#download-the-archive).

#### Local Toolchain Build

If you're using the local toolchain, copy the contents of `boards/shields` (there should be a single folder named after your keyboard) into ZMK's `app/boards/shields` directory. The command you'll use to build varies based on what modules you're using. The nice thing about GitHub actions is it automatically fetches and sets up these modules. If you're building locally, it's expected you can figure this stuff out on your own.

Here's how I build a keyboard with usb logging enabled:

```console
west build -d build/right -b cosmos_lemon_wireless -S zmk-usb-logging -- \
  -DSHIELD="cosmotyl_right" -DZMK_EXTRA_MODULES="/path/to/zmk-fingerpunch-vik"
```

and one with a PMW3610 trackball:

```console
west build -d build/right -b cosmos_lemon_wireless -S zmk-usb-logging -- \
  -DSHIELD="cosmotyl_right vik_pmw3610" \
  -DZMK_EXTRA_MODULES="/path/to/zmk-pmw3610-driver;/path/to/zmk-fingerpunch-vik"
```

You'll find the UF2 file under `build/right`, which you can then copy to the microcontroller.

Those extra modules come from these repositories, which you will need to clone onto your computer:

- [zmk-fingerpunch-vik](https://github.com/rianadon/zmk-fingerpunch-vik/)
- [zmk-pmw3610-driver](https://github.com/sadekbaroudi/zmk-pmw3610-driver)
- [cirque-input-module](https://github.com/petejohanson/cirque-input-module)
