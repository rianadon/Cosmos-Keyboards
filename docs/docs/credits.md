# Inspiration and Credits

Cosmos was built from the ground up in order to build as much flexibility as possible into a keyboard generator. Nevertheless, it takes the best ideas from many of the open-source generators that came before it:

<div class="clearfix less-margin" markdown>
![Dactyl Keyboard](https://raw.githubusercontent.com/adereth/dactyl-cave/master/resources/glamourshot.png){ align=left width=54 .circle .black }

[The Dactyl Keyboard](https://github.com/adereth/dactyl-keyboard):
Matt Adereth's generator kicked off keyboard generators for contoured ergonomic keyboards and inspired Cosmos's Stilts case.

</div><div class="clearfix less-margin" markdown>
![Dactyl Manuform](https://camo.githubusercontent.com/3d431aa11a1b1314f7ead63224cbc909bc4dff656a4a65ce7e30139bdeb144f1/687474703a2f2f692e696d6775722e636f6d2f4c646a456872522e6a7067){ align=left width=54 .circle style="background: #636362" }

[The Dactyl Manuform Keyboard](https://github.com/tshort/dactyl-keyboard):
Tom Short's generator simplifies the 3D printing of the keyboard by extruding walls straight down. Cosmos uses the same technique.

</div><div class="clearfix less-margin" markdown>
![Dactyl Manuform](https://camo.githubusercontent.com/7b2170ed551e0d129a764f3a01c6942b781bd9be401cfcfef352ba3f1d5b816b/68747470733a2f2f692e696d6775722e636f6d2f3364765731306f2e706e67){ align=left width=54 .circle .cover .left }

[Carbonfet's Manuform Fork](https://github.com/carbonfet/dactyl-keyboard):
Modifies the Dactyl Manuform to have a thumb cluster more similar to the original Dactyl. This thumb cluster is one of the presets in Cosmos.

</div><div class="clearfix less-margin" markdown>
![Dactyl Manuform](https://preview.redd.it/rla4f748m0i71.png?width=918&format=png&auto=webp&s=bfb7267f1328e1e930689a78d17a2c9e97a3630d){ align=left width=54 .circle .lightgrey style="background: linear-gradient(#a6adb1, #e8ebef)" }

[Joshua Shreve's Manuform Fork](https://github.com/joshreve/dactyl-keyboard): The first Manuform generator to produce STEP files, thanks to a rewrite of the codebase, and the basis for Cosmos's Orbyl preset.

</div><div class="clearfix less-margin" markdown>
![Compactyl](https://github.com/dereknheiley/compactyl/raw/master/images/compactyl-v6.png){ align=left width=54 .circle .darkgrey style="background: #2f2f2f" }

[The Compactyl Keyboard](https://github.com/dereknheiley/compactyl): Derek Nheiley's keyboard adds lots of tenting and a gel pad holder to the Manuform, plus 3d-printable hotswap holders used by Cosmos.

</div><div class="clearfix less-margin" markdown>
![Dometyl](https://github.com/geoffder/dometyl-keyboard/raw/main/things/niztyl/images/topless.jpg){ align=left width=54 .circle style="background:#4f418a" }

[The Dometyl Keyboard](https://github.com/dereknheiley/compactyl): Geoff deRosenroll's keyboard is better explained by its author. Its tenting design inspired Cosmos's Tilted case design.

</div>

I also owe my gratitude to the many contributors to the Cosmos generator:

[![Profiles of Contributors](https://contrib.rocks/image?repo=rianadon/cosmos-keyboards){ width=230 }](https://github.com/rianadon/Cosmos-Keyboards/graphs/contributors).

I would not have imagined testing so many keyboards or spending so much time on this project, were it not for the wonderful individuals who have sponsored the project. If that's you, thanks!

Additionally:

- The [backwards-compatible parts](https://ryanis.cool/cosmos/parts) are generated from Ibnu Daru Aji's [web generator](https://github.com/ibnuda/dactyl-keyboard), which is the basis for my original [Dactyl web generator](https://ryanis.cool/dactyl).
- Cosmos would not be able to generate accurate previews without high-quality keycap renders. Most of these are generated using the [KeyV2](https://github.com/rsheldiii/KeyV2/) library, and DES keycaps are generated from [the inventor's own generator](https://github.com/pseudoku/PseudoMakeMeKeyCapProfiles).
- The only reason it's possible to generate CAD designs in the browser is because the wonderful [OpenCascade](https://dev.opencascade.org/) CAD kernel is open-source, and Sebastian Alff maintains a [port of OpenCascade to WebAssembly](https://github.com/donalffons/opencascade.js/). I'm also indebted to Steve Genoud's work on [replicad](https://replicad.xyz/), which greatly simplifies the kernel's API.
- https://grabcad.com/library/kailh-choc-low-profile-switch-1
