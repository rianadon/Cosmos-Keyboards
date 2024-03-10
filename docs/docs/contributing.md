# Contributing to Cosmos

## Building the Project

For quick instructions, refer to the [README](https://github.com/rianadon/Cosmos-Keyboards/blob/main/README.md#start-of-content). If you're not a programmer but would still like to contribute CAD designs, skip to the [Super SImple Contributing](#super-simple-contributing) section. If you'd like more details on the build system, here you go:

### Building Documentation

I've omited instructions for building docs from the README because they're all just Markdown, and submitting a PR will trigger a preview build of the site, with documentation, on Vercel. Additionally, if you are using the docker setup, the docs server will be started as well.

To generate docs, install Python 3 and venv then run the following commands:

```bash
npm install --include=optional # Make sure optional dependencies are installed
make venv # Creates virtual environment and installs python dependencies.
make keyboards # Generates images of keyboards used in the docs.
npm run doc # Serves the documentation
```

If you'd like to run the dev servers for the generator and docs simultaneously, use `npm run dev:all`. Vite is set up to proxy the documentation, so you can go to the main page, click the link to the docs, and view your local changes.

### Quickstart, in Detail

The `make quickstart` command recommended in the README bundles together several useful commands in the `Makefile`:

```bash
npm install --omit=optional # Installs dependencies
mkdir target
make # Compiles protobuf files and expert mode autocompletions
make parts # Generates the mx switch geometry
make keycaps-simple2  # Generates keycaps used for collision detection
make keycaps2 # Generates geometry for all the keycaps
```

This will set you up for a pretty complete generator. There are a few more commands available for building the production site, which are not included in `make quickstart` since they require optional dependencies

```bash
make keyholes # (requires Java and Leiningen): Generates backwards-compatible Dactyl keyholes
export OPENSCAD=$(which openscad) # For the next 2 commands: sets var to openscad executable
make keycaps-simple # Alternative to make keycaps-simple2; Requires OpenSCAD
make keycaps # Alternative to make keycaps2; Requires OpenSCAD
```

??? info "What's the difference between keycaps and keycaps2?"

    The `make keycaps-simple2 keycaps2` scripts use a web assembly version of Manifold to render models (and OpenSCAD for running the scripting parts of the scad files), but the translation layer I wrote is not 100% accurate.

    _The relative proportions of keys are not fully correct, but the scripts are more than good enough for local development._

    The `make keycaps-simple keycaps` scripts are what I use for the production site, but they require a recent version of [OpenSCAD](https://openscad.org/downloads.html) (at least 2023) and the Linux version of OpenSCAD seems to struggle rendering the keycaps for some reason. If you wish to use these, either set the `OPENSCAD` environment variable to the location of the OpenSCAD executable or symlink the executable to `target/openscad`.

### Why so many Make targets?

Everything except `make` (i.e. running `make` by itself which triggers the default target) will trigger a script that takes several minutes to execute and depends on too many files to use Make's dependency system. They're broken up so that you don't need to re-run the entire build process if you have, say, only added a new keycap.

You'll probably find yourself needing to run `make` (the default target) once in a while, which is intelligent enough to only re-compile things that have changed.

## Super Simple Contributing

_(relative to the other methods of contributing)_

This guide will cover how to make changes to the CAD files in Cosmos so you can add a new part, without needing to use the command line or downloading any programming environments.

The end goal is that you'll be able to create a pull request [like these](https://github.com/rianadon/Cosmos-Keyboards/pulls?q=is%3Apr) on GitHub. This is how you can contribute your own changes to the repository.

1. Fork the [the repository](https://github.com/rianadon/Cosmos-Keyboards/) by clicking the Fork button at the top right. A fork is a copy of the repository in which you can make your changes.
2. Open the fork in [GitHub Desktop](https://desktop.github.com/). You can find this button by clicking the green Code button. In the likely case you don't have GitHub desktop installed, the button will take you to the download page.

   ![Screenshot of the GitHub Desktop button's location](../assets/open-gh.png)

3. Open GitHub Desktop once it's downloaded. You'll be prompted to sign in. Create a GitHub account if you don't already have one.
4. Click on the forked repository in GitHub Desktop then click the blue Clone button (alternatively, follow step #1 again). At this point you'll be asked to choose a Local Path for the repository. This is the place on your computer where all the files will be downloaded.

   ![Screenshot of cloning in GitHub Desktop](../assets/gh-clone.png){ width=500 .center }

5. Click Clone, make sure Contribute to the parent project is selected, and then click Initialize Git LFS. GitHub will place you on the main branch, but it's cleaner to put each big change in a new branch so that we can discuss each change independently. To create a new branch, click "Current branch" at the top, then "New Branch", and give the branch a name.

   ![Screenshot of creating a new branch](../assets/gh-branch.png){ width=400 .center }

6. Now you can view and open the files on your computer! All CAD assets are stored in the `src/assets` folder. Go ahead and make your modifications.

7. Once you've made changes, they'll show up in the list of files. Give a short summary and description for your changes, then click "Commit to &lt;branch&gt;". You can commit as many times as you like. Think of each commit as a saved version you can go back to.

8. Upload your changes to GitHub by clicking Publish branch.

   ![Screenshot of Push Origin button](../assets/gh-push.png){ width=600 .center }

9. This button will be replaced with a new button to create a Pull Request with your changes. Write up what work you've done, and we'll discuss the changes in the comments section in the Pull Request!

   When you create the Pull Request, the Vercel bot will deploy a preview of the entire Cosmos website, with your changes applied. You don't have install any additional software to preview your changes; it's all managed in the cloud. ☁️

## Contributing Guides

### Contributing Parts

In the codebase, the part integrated into the keyboard that holds a switch, trackball, screen, etc. is called a **socket**. Whatever is placed within the socket is called a **part**. Both the socket and part share the same name, which is used in Expert mode as the `type` property for a key. This short guide covers adding a new socket & part to the codebase.

![Labeled Part and Socket](../assets/socket.png){ width=550 .center }

Some notes about sockets:

1. They can be of any size (width, height, and depth). However, a depth of at least 4mm is recommended so that there is enough material around the socket.
2. Try to make the width and height (top-down dimensions) as small as you can. The smaller the socket, the closer it can be placed to other parts on the keyboard!
3. There are many steps because there are many features in Cosmos that rely on part information. A socket needs to show up in the BOM, support collision checking, have a matching part model, etc.

If you're looking for some code to follow along as you complete these steps, you can refer to [this Pull Request](https://github.com/rianadon/Cosmos-Keyboards/pull/11). It also serves as good reference for when you create a PR of your changes!

---

1. Give the socket a name. The standard I've been loosely following is `thing-dimensions-vendor`. The vendor & dimensions can be omitted if they are obvious. For example, `trackpad-23mm-cirque` and `oled-128x32-0.91in-adafruit`.
2. Edit `src/lib/worker/config.ts` and add the name of your socket to the config. You'll probably be adding it under `CuttleBaseKey`. Look for a similar part.
3. Design a STEP file for the socket. Place it at `src/assets/key-(name).step`. If you're using someone else's STEP file, make sure it is licensed for reuse.
4. The boundary of the socket must be a rectangle, but it can be of any size. Take note of the dimensions. (You can also make it a cylinder—reference the trackpad).
5. Edit `src/lib/geometry/socketsParts.ts`. Add your part to `PART_NAMES` so it can be correctly shown in the BOM. Also edit `socketSize` to return the size of the rectangle from step 3.
6. The `partBottom` function returns a box describing the boundary of the part that rests in the socket, referenced from the top of the socket. This is used to raise the model high enough so that your part doesn't collide with the ground! Measure the part and modify this function.
7. Edit `src/lib/worker/socketsLoader.ts`. Import your STEP file and add it to `KEY_URLS` so the generator can make use of it.
8. Run `make` again to regenerate the Typescript type declarations for Expert mode.
9. Run `make parts` to convert the STEP file to GLB so the parts preview page can efficiently display the model.

At this point you should be able to visit [http://localhost:5173/parts](http://localhost:5173/parts) and see your part's socket displayed.
You'll also likely have an STL file of the part that goes into the socket. Follow these steps add it:

9. Again make sure the STL file is licensed for reuse or that it's your own. Place it under `src/assets/key-(name).stl`.
10. Edit `src/model_gen/parts.ts` so that your STL file can be converted to a GLB.
11. Edit `src/lib/loaders/parts.ts`and add your part.
12. Re-run `make parts`

!!! info ""

    The working name of Cosmos was Cuttleform, named after the Cuttlefish. Cuttlefish are pretty adaptable!

### Contributing Microcontrollers

There are two options to add a microcontroller. The first is to generaate it entirely parametrically. Many microcontrollers share very similar designs (a rectangle with a connector on it), so the parametric generator is capable of mocking most microcontrollers.

The alternative is to design a 3D model or use an open source one (Adafruit and Seeed Studio publish open source models for their micocontrollers). There are additional steps needed to prepare this 3D model for Cosmos.

If you'd like to follow an example, [@semickolon's pull request](https://github.com/rianadon/Cosmos-Keyboards/pull/4) is a great reference.

---

1. Add the microcontroller name to the `SpecificCuttleform` interface in `src/lib/worker/config.ts`. There's no standard for naming yet.
2. Add configuration for the microcontroller in `src/lib/geometry/microcontrollers.ts`. You'll need to give the microcontroller a nicely formatted name, size (width x height x thickness), bounding box height (set this to about how tall the components stick up from the bottom of the microcontroller), offset (set x and y to zero, and z is set to the distance between the center of the connector & the bottom of the microcontroller), and how far in the cutouts go so that pins are accessible.
3. Make a model for the microcontroller. You can parametrically generate a board model by editing `src/model_gen/parts.ts` then run `make parts`. You don't need to specify much, since the parametric generator uses the size properties you previously configured. Alternatively, if you have a STL file, you'll need to convert it to GLB and put it in `src/assets` (I use Blender for this).

???+ info "Using an STL file for a microcontroller?"

    Follow the following conventions: the board's short edge is the X axis, the long edge is the Y axis, and the top of the board faces +Z. The board should be centered on the X axis and the side with the connector should be touching the X axis (Y=0), so that most of the board is below the X axis (Y < 0). The bottom of the microcontroller should touching the XY plane. This is illustrated in the screenshot below.

    ![A microcontroller in blender demonstrating the blow conventions](../assets/microcontroller.png){ width=400 .center }

    In Blender, make sure to export with "Y axis up" unchecked. GLB files use the convention that the Y axis points up, but in Cosmos the convention is Z points up.

4. Edit `src/lib/loaders/boardElement.ts` and add the model url to `MICROCONTROLLER_URLS`. The glb file will be placed in `target` or `src/assets` depending on whether you autogenerated the board or not.
5. Edit `src/proto/cuttleform.proto` to add the microcontroller to the UI. You'll also need to edit `MAP_MICROCONTROLLER` in `src/lib/worker/config.ts` as well as the `microcontroller = 15` field.
6. To auto-assign a specific connector when choosing the microcontroller in basic mode, edit `caseChange` in `src/routes/beta/lib/editor/VisualEditor.svelte`.
