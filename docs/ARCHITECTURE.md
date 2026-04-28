# Architecture

A short, opinionated map of the Cosmos Keyboards codebase. Aimed at people (or agents) landing in the repo for the first time. Companion to `CLAUDE.md` at the repo root, which focuses on toolchain and conventions.

## High-level shape

```
┌────────────────────────────────────────────────────────────┐
│  Browser                                                   │
│  ┌──────────────────────────┐   ┌──────────────────────┐   │
│  │  Main thread (Svelte UI) │   │  Web Worker          │   │
│  │  src/routes/beta/        │◄──┤  src/lib/worker/     │   │
│  │  src/lib/3d/ (Threlte)   │   │  geometry → model    │   │
│  └──────────────┬───────────┘   └──────────┬───────────┘   │
│                 │  comlink (RPC over postMessage)          │
│                 └──────────────────────────┘               │
└────────────────────────────────────────────────────────────┘
        ▲
        │ static GLB / STEP / type defs / compiled .proto
        │
┌────────────────────────────────────────────────────────────┐
│  Build-time (Makefile)                                     │
│  src/model_gen/  +  src/proto/  →  target/                 │
└────────────────────────────────────────────────────────────┘
```

The runtime app is two threads bridged by `comlink`. The build step is a separate program: it produces files in `target/` that the runtime app then imports as plain assets.

## The worker boundary

- **Main thread** does Svelte, UI state, Three.js scene management. Lives in `src/routes/beta/` and `src/lib/3d/`.
- **Worker** does all CAD math and modeling — anything that touches `replicad`/OpenCascade or `manifold-3d`. Lives in `src/lib/worker/`.
- The bridge is `comlink`. The API surface the worker exposes is `src/lib/worker/api.ts`. The main-thread proxy is set up in `src/lib/runner/`.

Rule of thumb: **nothing in `src/lib/worker/` may touch the DOM.** No `window`, `document`, `Image`. Likewise, the main thread should not import `replicad` directly — call into the worker.

## The rendering pipeline

The "how does the keyboard get rendered?" path goes through three files, each with a clear job:

| File                               | Role                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/worker/geometry.ts`       | Pure geometry. Where each key, web, screw, microcontroller goes in 3D space. Math, no solids. ~2,500 lines.           |
| `src/lib/worker/cachedGeometry.ts` | Memoized higher-level wrapper over `geometry.ts`. Adds caching keyed off the config.                                  |
| `src/lib/worker/model.ts`          | Turns geometry into actual 3D solids using replicad/OpenCascade — extrusions, lofts, booleans, fillets. ~1,200 lines. |

Adjacent helpers in the same directory specialize this pipeline:

- `geometry.intersections.ts`, `geometry.thickWebs.ts` — extracted geometry passes.
- `clipper.ts`, `concaveman.ts`, `concaveman-extra.ts` — 2D polygon ops used for plate generation.
- `modeling/transformation.ts`, `modeling/transformation-ext.ts` — the `Trsf` and `ETrsf` classes used everywhere to position parts.
- `modeling/assembly.ts`, `modeling/bezier.ts`, `modeling/splitter.ts`, `modeling/supports.ts` — model-construction utilities.
- `pro-patch/` — conditional pro-only extensions; safe to ignore in OSS clones.

## Configuration and serialization

The config object that fully describes a keyboard is the input to the entire pipeline.

- **Schema source of truth: `src/proto/`.** `cosmos.proto` is the current format; `cuttleform.proto`, `manuform.proto`, `lightcycle.proto` are older formats kept for URL-decode compatibility. `common.proto` holds shared messages.
- **Generated TS bindings**: `target/proto/*.ts`, produced by `protoc-gen-ts` via the `Makefile`. Don't edit.
- **TS-side model**: `src/lib/worker/config.ts` (the canonical `Cuttleform` shape) and `config.cosmos.ts` (the newer `CosmosKeyboard` shape). `config.serialize.ts` round-trips between TS objects and the encoded URL string.
- **Editor autocompletion**: `src/model_gen/genEditorTypes.ts` walks `config.ts` and emits `target/editorDeclarations.d.ts`, which Monaco loads in expert mode.

When you change the schema:

1. Edit the relevant `.proto`.
2. `make build` to regenerate `target/proto/*.ts` and `target/editorDeclarations.d.ts`.
3. Update the TS model in `config.ts` / `config.cosmos.ts`.
4. Update `config.serialize.ts` if encode/decode logic changed.

## Build-time pipeline (`src/model_gen/`)

These scripts run at build time, not at app runtime. They produce static assets in `target/` that the app loads later.

| Script                                                                 | Output                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `keycaps.ts`, `keycaps2.ts`, `keycaps-simple.ts`, `keycaps-simple2.ts` | Keycap geometry GLBs (full and collision-only variants).        |
| `keyholes.ts` (+ `keyholes.cljs`)                                      | Backwards-compatible Dactyl keyholes (requires Java/Leiningen). |
| `parts.ts`, `parts-simple.ts`                                          | Switch / part GLBs.                                             |
| `keyboards.ts`                                                         | Renders keyboard previews used in the docs.                     |
| `genEditorTypes.ts`                                                    | Editor `.d.ts` from `config.ts`.                                |
| `download-openscad.ts`                                                 | Bootstraps OpenSCAD if needed.                                  |

Two execution backends exist for the keycap scripts:

- `keycaps2`/`keycaps-simple2` use a WASM build of Manifold + an OpenSCAD-to-Manifold translation layer. Faster, less accurate. Default for local dev.
- `keycaps`/`keycaps-simple` shell out to a real OpenSCAD binary. Used for production builds.

`processPool.ts` and `promisePool.ts` parallelize these scripts across cores.

## Asset loading at runtime

`src/lib/loaders/` loads the build-time artifacts on demand:

- `gltfLoader.ts` — generic GLB loader used by the others.
- `keycaps.ts`, `simplekeys.ts`, `parts.ts`, `simpleparts.ts`, `sockets.ts`, `boardElement.ts` — typed loaders for each artifact category.
- `cacher.ts` — IndexedDB cache so repeat loads are fast.
- `geometry.ts` — bridges loaded geometry to the worker.

Geometric metadata about parts (independent of their meshes) lives in `src/lib/geometry/`: `keycaps.ts`, `microcontrollers.ts`, `screws.ts`, `socketsParts.ts`, `switches.ts`.

## Routes

| Route                        | Purpose                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `/beta` (`src/routes/beta/`) | The main generator. Where users design a keyboard.                                              |
| `/scan`, `/scan2`            | Hand-scanning UIs. Processing in `src/routes/scan/lib/hand.ts` (uses MediaPipe Hands + OpenCV). |
| `/parts`                     | Browser for the parts library.                                                                  |
| `/keycaps`                   | Keycap profile browser.                                                                         |
| `/embed`                     | Embeddable viewer.                                                                              |
| `/showcase`                  | Curated keyboard gallery.                                                                       |
| `/pair`                      | Pairing flow for hand-scan handoff.                                                             |

## Hand scanning

A self-contained subsystem under `src/routes/scan/`. Pipeline:

1. Capture frames from the user's camera.
2. Run MediaPipe Hands to get 2D landmarks.
3. Use OpenCV (loaded lazily from `src/lib/opencv*.js`, which are **generated** by Vite plugins from the npm package — don't hand-edit) to triangulate to 3D.
4. Process and serialize hand data, eventually feeding it into `/beta` as positioning input.

The OpenCV WASM blobs are inlined as base64 by the Vite plugin at build time.

## Docs site

`docs/docs/` is the mkdocs source. Built by `make docs` (production) or `npm run doc` (dev). Vite proxies `/docs`, `/blog`, `/assets`, `/stylesheets`, `/javascripts` to the mkdocs server in dev so both run side by side.

## Cross-cutting things to know

- `target/` is **generated** — don't hand-edit, don't commit individual files there.
- `pro/` is **gitignored** — pro features. Code in `pro-patch/` is conditional.
- `src/lib/opencv.js` and `src/lib/opencv-contrib.js` are generated by `vite.config.ts` plugins, not source.
- `src/routes/lemon/` is also gitignored.
- The whole `target/PseudoProfiles/` and `target/KeyV2/` trees are clones of external repos pulled by `make`.
