---
name: geometry-change
description: Use when modifying the keyboard rendering pipeline — the files src/lib/worker/geometry.ts, src/lib/worker/cachedGeometry.ts, src/lib/worker/model.ts, or any of their helpers under src/lib/worker/modeling/. The agent enforces the geometry-vs-modeling split, runs the right verification commands, and avoids common worker-boundary mistakes.
tools: Read, Edit, Write, Glob, Grep, Bash
---

You are working on the Cosmos Keyboards 3D rendering pipeline. Read `CLAUDE.md` and `docs/ARCHITECTURE.md` at the repo root before starting.

## The pipeline

Three files, in order:

1. `src/lib/worker/geometry.ts` — pure geometry. Math only, no solid modeling.
2. `src/lib/worker/cachedGeometry.ts` — memoized wrapper.
3. `src/lib/worker/model.ts` — turns geometry into solids via replicad/OpenCascade.

Do not blur this split. Solid-modeling calls (`make`, `extrude`, `loft`, boolean ops, fillets) belong in `model.ts`. Pure positional/vector math belongs in `geometry.ts`. If you find yourself wanting to call replicad from `geometry.ts`, move the work to `model.ts` instead.

## Worker constraints

All three files run in a Web Worker. **No DOM APIs.** No `window`, `document`, `fetch` against relative URLs assuming a page origin, image loaders that need the DOM, etc. If you need browser-side data, it must be passed in through the comlink API in `src/lib/worker/api.ts`.

## Caching

`cachedGeometry.ts` memoizes by config. If you add a new field to the config that affects geometry, make sure the cache key reflects it — otherwise stale results will be served. Look at how existing fields participate in the cache before adding yours.

## Transformations

Positioning is done with `Trsf` and `ETrsf` from `src/lib/worker/modeling/transformation.ts` and `transformation-ext.ts`. Don't reach for raw matrix math when these abstractions exist — they handle mirror/right/left handedness and key-cluster composition correctly.

## Verification (always run these before reporting done)

```bash
npm run check     # svelte-check + tsc — the primary local signal
npm test          # bun test — runs the geometry/config tests
```

If you changed protobuf-related types, also:

```bash
make build        # regenerates target/proto/*.ts and target/editorDeclarations.d.ts
```

If your change is visual, you must verify in the browser:

```bash
make dev          # → http://localhost:5173/beta
```

Type-checking proves the code compiles. It does **not** prove the keyboard renders correctly. Open `/beta` and confirm the geometry looks right before claiming success.

## What not to do

- Don't edit anything in `target/` — it's generated.
- Don't add new top-level dependencies for math you can do with `three` or built-ins.
- Don't introduce a `pro-patch/` import unless you know what you're doing — those modules are conditional and may be missing.
- Don't add comments explaining what the code does. Only add a comment if the _why_ is non-obvious (a workaround, a tolerance value, a numerical-stability trick).
