# Cosmos Keyboards

The most adaptable generator for ergonomic mechanical keyboards there is.

<p align="center">
   <a href="https://ryanis.cool/cosmos"><img alt="Cosmos Logo" height="400px" src="static/keyboard2.png" /></a>
</p>

[Cosmos](https://ryanis.cool/cosmos) is released under an open-core model. 95% of the generator is free and open-source. Pro features (rounded edges, the stilts model, and wrist rests) are not.

---

Everything from here on is fairly technical. If you can't program but know CAD, read [this tutorial](https://ryanis.cool/cosmos/docs/contributing#super-simple-contributing) to learn how you can help improve (or reference) the generator's models.

---

## Generator

Most generator code lives at [`src/lib`] and[`src/routes/beta`]. Some files used for pre-generating STEP & GLB files used in the generator are located at [`src/model_gen`].

[`src/lib`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/lib
[`src/routes/beta`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/routes/beta
[`src/model_gen`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/model_gen

To run the generator locally, you have two options:

1. **Recommended Setup**:

   - [Clone] the repository and [install Bun][bun].
     > The rationale is that Bun has built-in TypeScript and path mapping support. Alternatively, you can use [Node.js][nodejs] v21 or later ([nvm][nvm-sh] recommended for Linux users). When using Node.js, Cosmos uses a custom ESM loader, which is more difficult to debug when things ultimately go wrong. Nevertheless, the WASM build scripts are more reliable in Node.js than Bun.
   - Run `make quickstart` to compile and build the necessary files.
   - Read the [dev documentation](https://ryanis.cool/cosmos/docs/contributing/#building-the-project) if you wish to compile the docs or create a production build.
   - Finally, run `make dev` to start a dev server and visit [`http://localhost:5173/beta`](http://localhost:5173/beta).

     If you are on Windows, use `bun make` (or `npm run nodemake` if you don't have Bun) instead of `make`. Cosmos includes a [simplistic cross-platform Make runner](https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/scripts/mini-make.ts). You can also use [Cygwin](https://www.cygwin.com/) if you have it.

2. **Docker Setup**:
   - [Clone] the repository and install [Docker and Docker compose](https://docs.docker.com/get-docker/).
   - Run `docker compose up` in the project root directory.
     - To avoid running the make scripts when rebuilding, set `SKIP_MAKE_FILES=true` in your .env file. This reduces build time if all target files and docs have already been created.

     I don't recommend using Docker unless you absolutely need to, for it adds a lot of complexity. Cosmos is designed to run anywhere with just a single installation of Bun (and Python if you need local docs).

[bun]: https://bun.sh/docs/installation
[lfs]: https://git-lfs.com/
[Clone]: https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository
[nodejs]: https://nodejs.org/en/learn/getting-started/how-to-install-nodejs
[nvm-sh]: https://github.com/nvm-sh/nvm
[OpenSCAD]: https://openscad.org/downloads.html

### Contributing

I recommend you first follow the steps above to run the generator locally so that you can test your changes. If you're interested in:

- Adding support for new parts (such as a display or trackball)
- Adding a new microcontroller to the generator

Then follow the instructions [in the documentation](https://ryanis.cool/cosmos/docs/contributing) (source is in `docs/docs`) for complete guide on how to do this.

Otherwise if you're looking to change how the generated keyboards look, the three files you'll be interested in are:

- [`src/lib/worker/geometry.ts`]
- [`src/lib/worker/cachedGeometry.ts`]
- [`src/lib/worker/model.ts`]

[`src/lib/worker/geometry.ts`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/lib/worker/geometry.ts
[`src/lib/worker/cachedGeometry.ts`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/lib/worker/cachedGeometry.ts
[`src/lib/worker/model.ts`]: https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/lib/worker/model.ts

Rendering in Cosmos is split into two parts: geometrical calculations (which determines where parts go), and modeling operations (building the 3d model in OpenCascade). The files `geometry.ts` and `cachedGeometry.ts` perform those geometrical calculations (with the latter acting as a higher-level wrapper over functions in the former), and `model.ts` is responsible for all 3d modeling operations.

### License

All code is licensed under the [AGPL-3.0 license](https://github.com/rianadon/Cosmos-Keyboards/blob/main/LICENSE). All STEP models under the `src/assets` folder are licensed under the [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) License. All documentation is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). All other assets and images are copyrighted and may not be reused without permission.

## Hand Scanning

The code is at [`src/routes/scan`](https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/routes/scan). Most of the processing happens in [`lib/hand.ts`](https://github.com/rianadon/Cosmos-Keyboards/tree/main/src/routes/scan/lib/hand.ts).

Please feel free to use either GitHub or Discord for submitting issues.

### Building your own keyboard app?

I'm planning on building out an API to make it easy for users to share their scanned hand data with other keyboard-related websites. If you maintain a keyboard-related site and are interested in adding a way for visitors to quickly see how your keyboard fits their hand, send me an email to ryan at ryanis .cool. You can of course use this code to build out your own hand scanning solution, provided you abide by the terms of the [AGPL-3.0 license](https://github.com/rianadon/Cosmos-Keyboards/blob/main/LICENSE).
