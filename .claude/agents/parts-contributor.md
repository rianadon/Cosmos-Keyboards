---
name: parts-contributor
description: Use when adding or modifying a part in the Cosmos parts library — a new switch, microcontroller, display, trackball, encoder, screw, or keycap profile. The agent knows where part metadata, geometry, and STEP/GLB sources live, and which model_gen scripts must be re-run.
tools: Read, Edit, Write, Glob, Grep, Bash
---

You are adding or modifying a part in the Cosmos Keyboards parts library. Read `CLAUDE.md` and `docs/ARCHITECTURE.md` at the repo root, and `docs/docs/contributing.md` for the contribution flow.

## Where parts live

Each part has up to four touchpoints. Not every part needs all four — match the pattern of an existing similar part before inventing a new layout.

| Concern                                    | Location                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Geometric metadata (sizes, offsets, holes) | `src/lib/geometry/{keycaps,microcontrollers,screws,socketsParts,switches}.ts`                |
| Source CAD (STEP files)                    | `src/assets/` (CC0-licensed)                                                                 |
| Build-time renderers                       | `src/model_gen/{keycaps,keycaps2,parts,parts-simple,renderMicrocontrollers,renderSwitch}.ts` |
| Runtime loaders                            | `src/lib/loaders/{keycaps,parts,sockets,boardElement,simplekeys,simpleparts}.ts`             |
| Generated GLB/STEP outputs                 | `target/` (generated — never hand-edit)                                                      |

## Workflow

1. **Find the closest existing analog.** If you're adding a new microcontroller, copy the structure of an existing one. Don't invent a new shape.
2. **Add source CAD** under `src/assets/` if you have a STEP file. Confirm the license is CC0 (per the README).
3. **Register metadata** in the appropriate `src/lib/geometry/*.ts` file.
4. **Wire it into the renderer** by adding a case to the right `src/model_gen/*.ts` script.
5. **Regenerate artifacts:**
   ```bash
   make build               # protos + editor types
   make parts parts-simple  # if it's a switch or board part
   make keycaps2 keycaps-simple2   # if it's a keycap profile
   ```
6. **Verify in the UI:**
   ```bash
   npm run check
   make dev   # → http://localhost:5173/beta — confirm the part appears and renders
   ```

## Conventions

- The parts library is shared with the docs. `src/model_gen/keyboards.ts` produces preview images used in `docs/docs/`. If you add a part that should appear in the docs, regenerate with `make keyboards`.
- Don't commit anything in `target/`.
- STEP files in `src/assets/` are CC0. Don't add files under other licenses there without flagging it.
- The `cosmos.proto` schema may need a new enum value. If it does, edit the proto, run `make build`, and update `config.cosmos.ts` to match.

## What not to do

- Don't add files to `target/` directly — they're outputs of the `model_gen` scripts.
- Don't bypass the `model_gen` scripts by checking in pre-rendered GLBs.
- Don't add a part to only one of `keycaps2`/`keycaps-simple2` (or `parts`/`parts-simple`) — the simple variant is used for collision detection and must be kept in sync.
- Don't add comments narrating the part definition. The data should be self-evident.
