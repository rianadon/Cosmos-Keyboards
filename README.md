# Cosmos Keyboards

The most adaptable generator for ergonomic mechanical keyboards there is.

<p align="center">
   <a href="https://ryanis.cool/cosmos"><img alt="Cosmos Logo" height="400px" src="static/keyboard2.png" /></a>
</p>

[Cosmos](https://ryanis.cool/cosmos) is released under an open-core model. 95% of the generator is free and open-source. Pro features (rounded edges, the stilts model, and wrist rests) are not.

## Generator

Most generator code lives at [`src/lib`] and[`src/routes/beta`]. Some files used for pre-generating STEP & GLB files used in the generator are located at [`src/model_gen`].

[`src/lib`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/lib
[`src/routes/beta`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/routes/beta
[`src/model_gen`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/model_gen

To run the generator locally, you'll need to [clone] the repository and [have installed Node.js][nodejs] and [OpenSCAD]. Then run these commands on the command line:

[clone]: https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository
[nodejs]: https://nodejs.org/en/learn/getting-started/how-to-install-nodejs
[OpenSCAD]: https://openscad.org/downloads.html

```bash
cd Cosmos-Keyboards
npm install
mkdir target
export OPENSCAD=/path/to/openscad # should end in .exe on Windows
make keycaps-simple # Generates keycaps used for collision detection.
make keycaps # Generates geometry for all the keycaps. Take a while.
make # Compiles protobuf files
make parts # Generates the mx switch geometry
npm run dev

# Optional
make keyholes # (requires Java and Leiningen): Generates keyholes used in the Dactyl generator
```

Then visit [`http://localhost:5173/beta`](http://localhost:5173/beta).

If you're using Windows and don't have access to the `make` command, you can piece together the commands that are run by referencing the `Makefile` and running them yourself. Or just [install make](https://stackoverflow.com/a/73862277) :)

### Contributing Parts

In the codebase, the part integrated into the keyboard that holds a switch, trackball, screen, etc. is called a **socket**. Whatever is placed within the socket is called a **part**. Both the socket and part share the same name, which is used in Expert mode as the `type` property for a key. This short guide covers adding a new socket & part to the codebase.

1. Give the socket a name. The standard I've been loosely following is `thing-dimensions-vendor`. The vendor & dimensions can be omitted if they are obvious. For example, `trackpad-23mm-cirque` (I don't follow my convention) and `oled-128x32-0.91in-adafruit`.
2. Design a STEP file for the socket. Place it at `src/assets/key-(name).step`. If you're using someone else's STEP file, make sure it is licensed for reuse.
3. The boundary of the socket must be a rectangle. Take note of the dimensions. (You can also make it a cylinder—reference the trackpad).
4. Edit `src/lib/geometry/socketsParts.ts`. Add your part to `PART_NAMES` so it can be correctly shown in the BOM. Also edit `socketSize` to return the size of the rectangle from step 3.
5. The `partBottom` function returns a box describing the boundary of the part that rests in the socket, referenced from the top of the socket. This is used to raise the model high enough so that your part doesn't collide with the ground! Measure the part and modify this function.
6. Edit `src/lib/worker/socketsLoader.ts`. Import your STEP file and add it to `KEY_URLS` so the generator can make use of it.
7. Edit `src/lib/worker/config.ts` and add the name of your socket to the config. You'll probably be adding it under `CuttleBaseKey`.
8. Run `make` again to regenerate the Typescript type declarations for Expert mode.

You'll likely have an STL file of the part that goes into the socket. Follow these steps add it:

9. Again make sure the STL file is licensed for reuse or that it's your own. Place it under `src/assets/key-(name).stl`.
10. Edit `src/model_gen/parts.ts` so that your STL file can be converted to a GLB.
11. Edit `src/lib/loaders/parts.ts`and add your part.

> The working name of Cosmos was Cuttleform, named after the Cuttlefish. Cuttlefish are pretty adaptable!

### Contributing Microcontrollers

1. Add the microcontroller name to the `SpecificCuttleform` interface in `src/lib/worker/config.ts`. There's no standard for naming yet.
2. Add configuration for the microcontroller in `src/lib/geometry/microcontrollers.ts`. You'll need to give the microcontroller a nicely formatted name, size (width x height x thickness), bounding box height (set this to about how tall the components stick up from the bottom of the microcontroller), offset (set x and y to zero, and z is set to the distance between the center of the connector & the bottom of the microcontroller), and how far in the cutouts go so that pins are accessible.
3. Make a model for the microcontroller. You can parametrically generate a board model by editing `src/model_gen/parts.ts` then run `make parts`. You don't need to specify much, since the parametric generator uses the size properties you previously configured. Alternatively, if you have a STL file, you'll need to convert it to GLB and put it in `src/assets` (I use Blender for this). Follow the following conventions: the board's short edge is the X axis, the long edge is the Y axis, and the top of the board faces +Z. The board should be centered on the X axis and the side with the connector should be touching the X axis (Y=0), so that most of the board is below the X axis (Y < 0). The bottom of the microcontroller should touching the XY plane. Make sure to export with "Y axis up" unchecked.
4. Edit `src/lib/loaders/boardElement.ts` and add the model url to `MICROCONTROLLER_URLS`. The glb file will be placed in `target` or `src/assets` depending on whether you autogenerated the board or not.
5. Edit `src/proto/cuttleform.proto` to add the microcontroller to the UI. You'll also need to edit `MAP_MICROCONTROLLER` in `src/lib/worker/config.ts`.
6. To auto-assign a specific connector when choosing the microcontroller in basic mode, edit `caseChange` in `src/routes/beta/lib/editor/VisualEditor.svelte`.

## Hand Scanning

The code is at [`src/routes/scan`](https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/routes/scan). Most of the processing happens in [`lib/hand.ts`](https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/routes/scan/lib/hand.ts).

Please feel free to use either GitHub or Discord for submitting issues.

### Building your own keyboard app?

I'm planning on building out an API to make it easy for users to share their scanned hand data with other keyboard-related websites. If you maintain a keyboard-related site and are interested in adding a way for visitors to quickly see how your keyboard fits their hand, send me an email at.cool. You can of course use this code to build out your own hand scanning solution, provided you abide by the terms of the [AGPL-3.0 license](https://github.com/rianadon/Cosmos-Keyboards/blob/main/LICENSE).
