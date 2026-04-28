# Cosmos Keyboards — Agent Notes

Web-based generator for ergonomic mechanical keyboards. SvelteKit + TypeScript on top of a heavy CAD/3D pipeline (Three.js + Threlte for rendering, replicad/OpenCascade + Manifold for solids, OpenSCAD for keycaps, MediaPipe for hand scanning).

The user-facing app lives at `/beta` (`src/routes/beta`). Most of the interesting logic is in `src/lib/worker/`, which runs in a Web Worker bridged via `comlink`.

## Toolchain

- **Bun is preferred, Node is the fallback.** The `Makefile` detects `bun` and uses it; otherwise it uses `node` with a custom ESM loader (`src/model_gen/register_loader.js`). When in doubt, use Bun — Node mode is harder to debug.
- **Python venv** is used only for docs (`mkdocs`). Created by `make venv`.
- **`.nvmrc`** pins Node v21+. Use that if running without Bun.

## Build flow

```bash
make quickstart        # one-time: install deps, compile protobufs, generate parts/keycaps geometry
make dev               # start vite dev server → http://localhost:5173/beta
npm run check          # svelte-check + tsc — the closest thing to a CI signal locally
npm test               # runs `bun test` against *.test.ts files
make build             # regenerates target/proto/*.ts and target/editorDeclarations.d.ts
```

The default `make` target only regenerates protobufs and editor types. `make quickstart` is heavier — it also runs `parts`, `parts-simple`, `keycaps2`, `keycaps-simple2` which produce GLB/STEP files in `target/`.

## Layout

| Path                                      | Role                                                                                                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/beta/`                        | The generator UI (the `/beta` page).                                                                                                                                              |
| `src/routes/scan/`, `scan2/`              | Hand-scanning UI; processing in `src/routes/scan/lib/hand.ts`.                                                                                                                    |
| `src/lib/worker/`                         | Worker-side CAD code. The hot files are `geometry.ts`, `cachedGeometry.ts`, `model.ts`, `config.ts`.                                                                              |
| `src/lib/3d/`                             | Threlte components (rendering).                                                                                                                                                   |
| `src/lib/loaders/`, `src/lib/runner/`     | Asset loading and worker bootstrap.                                                                                                                                               |
| `src/proto/`                              | `.proto` schemas — source of truth for serialized configs.                                                                                                                        |
| `src/model_gen/`                          | Build-time scripts that produce `target/` artifacts (keycaps, switches, microcontrollers, parts). Not run at app runtime.                                                         |
| `target/`                                 | **Generated.** Don't hand-edit. Includes `target/proto/*.ts` (compiled protos), GLB/STEP assets, editor type declarations.                                                        |
| `pro/`                                    | Pro-only features. **Gitignored — usually not present in this clone.** Code in `src/lib/worker/pro-patch/` references it conditionally; don't try to "fix" missing imports there. |
| `docs/docs/`                              | mkdocs source for the public docs site.                                                                                                                                           |
| `target/PseudoProfiles/`, `target/KeyV2/` | Cloned third-party repos (keycap profiles).                                                                                                                                       |

## Rendering pipeline (the part you'll edit most)

Three files, in order:

1. **`src/lib/worker/geometry.ts`** (≈2,500 lines) — pure geometry: where every key, web, and screw goes in 3D space. No solid modeling.
2. **`src/lib/worker/cachedGeometry.ts`** — memoized higher-level wrapper over `geometry.ts`.
3. **`src/lib/worker/model.ts`** (≈1,200 lines) — turns geometry into actual solids via replicad/OpenCascade.

If a change affects how the keyboard _looks_, it almost always lands in one of these three. The split is intentional: `geometry.ts` should stay free of CAD operations.

## Config and serialization

- The schema lives in `src/proto/cosmos.proto` (and the older `cuttleform.proto`, `manuform.proto`, `lightcycle.proto`). After editing a `.proto`, run `make build` to regenerate `target/proto/*.ts`.
- TypeScript-side model: `src/lib/worker/config.ts` and `config.cosmos.ts`. Serialization helpers in `config.serialize.ts`.
- Editor autocompletion types are generated from `config.ts` into `target/editorDeclarations.d.ts` by `src/model_gen/genEditorTypes.ts`.

## Tests

Two test files exist and use **`bun:test`** (not vitest):

- `src/lib/worker/config.test.ts`
- `src/routes/beta/lib/editor/tuple.test.ts`

Run with `npm test` (which calls `bun test`). Tests are sparse — `npm run check` (svelte-check + tsc) is the more useful local signal for most changes.

## Formatting

`dprint` is configured in `dprint.json` and runs on commit via `simple-git-hooks` + `lint-staged`. The Claude `PostToolUse` hook in `.claude/settings.json` formats edited files automatically — match this if you script around it.

Quote style: **single quotes, no semicolons** (TS) — see `dprint.json`.

## Things that will trip you up

- `src/lib/opencv.js` and `src/lib/opencv-contrib.js` are **generated by Vite plugins** in `vite.config.ts`. Don't edit them.
- `target/` and `pro/` look like source but are not.
- The Vite dev server proxies `/docs`, `/blog`, etc. to `localhost:8000` (mkdocs). Those routes look broken until you also start `make docs`.
- `src/routes/lemon` is gitignored — references to it from other files are intentional.
- Imports of `pro-patch/*` modules are conditional and may be stubbed in OSS clones.
- The `tsconfig.json` only includes `src/routes/**/*` directly; the rest is pulled in by SvelteKit's generated `.svelte-kit/tsconfig.json`. So `tsc` invoked outside SvelteKit's wrapper will look like nothing is type-checked — use `npm run check` instead.

## Conventions

- Don't add new top-level dependencies casually — the build is already heavy. Prefer reusing what's there (`replicad`, `manifold-3d`, `three`, `comlink`).
- Don't write to `target/` directly. If you need a new generated artifact, add a script under `src/model_gen/` and a target in the `Makefile`.
- Worker code (`src/lib/worker/`) cannot use DOM APIs. Keep main-thread vs. worker code separate.
