# Layout switcher — phase plan

Roadmap for letting users pick a keyboard layout (QWERTY, Colemak, Miryoku, etc.) in the Cosmos editor and have it flow through both visual legends and firmware (ZMK/QMK) output. One PR per phase.

## Background

Before this work, Cosmos was QWERTY-only:

- `letterForKeycap()` in `src/lib/worker/config.ts` baked QWERTY letters into every alpha key as it was generated.
- `FLIPPED_KEY` in `src/lib/geometry/keycaps.ts` mirrored those letters for the left half.
- `keycap.letter` flowed straight to the firmware exporters; ZMK emitted `&kp <LETTER>` and QMK emitted `KC_<LETTER>` from whatever was stored on the key.

Three discoveries shaped the phases:

1. **No layer system exists.** No layer UI, no layer field on the data model. ZMK exports a single `default_layer`; QMK exports `[0] = LAYOUT(...)`. Mod-tap, layer-tap, and hold-tap are all unimplemented.
2. **Key counts are flexible (~14 to 42+).** But there's no semantic notion of "home-row index finger" — `home: 'index'` exists only as a cosmetic hint for MT3 keycap row selection, not something firmware can target.
3. **Letter-swap layouts and Miryoku are different problems.** QWERTY/Colemak/Dvorak/Workman are alpha remaps that fit the existing single-layer pipeline. Miryoku is a 36-key, 6-layer system built on home-row mods and layer-taps — it requires layers, mod-tap encoding, and assumptions about which physical keys play which Miryoku roles.

## Phase 1 — Letter-swap layouts (PR #3, in flight)

**In scope:** QWERTY (default), Colemak, Colemak-DH, Dvorak, Workman.

**Design decisions:**

- **Layout lives at the top level**, not per-key. Stored on `CosmosKeyboard` as `layout: LayoutId` and persisted in the URL via proto field `layout = 33` (uint32, with QWERTY trimmed to keep old URLs unchanged).
- **Letters resolve through layout at generation time**, not at render time. `cosmosFingers()` and `keycapInfo()` accept an optional layout (default QWERTY) and write the correct letter into `key.profile.letter`. Firmware exporters need no changes — they already read `keycap.letter`.
- **Layout switching rewrites the alpha block.** A new `applyLayoutToKeys()` walks finger clusters, identifies alpha columns via the existing `alphaColumns()` heuristic, and updates only rows 2/3/4. Number row, F-row, and outer-punctuation keys stay untouched (they're layout-independent).
- **Mirror is layout-aware.** `flippedKey()` and `mirrorCluster()` accept an optional layout. Editor callers thread `kbd.layout` through; `transformation-ext.ts`-level mirror callers default to QWERTY (legacy code path, rarely hit by non-QWERTY users).
- **Per-key letter overrides** are supported by the data model (the stored `keycap.letter` wins) but there's no UI for them yet. That's deferred — when an editor exists in Phase 3, it'll co-exist with the layout setting.

**Files touched:**

| Area              | File                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| New registry      | `src/lib/layouts/index.ts` (`LAYOUT.*` const, `DEFAULT_LAYOUT`, `LAYOUT_IDS`, `getLayout`, `rightSideLetter`, `flipLetter`)       |
| Proto + types     | `src/proto/cosmos.proto`, `src/lib/worker/config.cosmos.ts`, `src/lib/worker/config.serialize.ts`                                 |
| Letter generation | `src/lib/worker/config.ts` (`letterForKeycap`, `cosmosFingers`, `keycapInfo`)                                                     |
| Mirror            | `src/lib/geometry/keycaps.ts` (`flippedKey`), `src/lib/worker/config.cosmos.ts` (`mirrorCluster`)                                 |
| Editor            | `src/routes/beta/lib/editor/visualEditorHelpers.ts` (`applyLayoutToKeys`), `src/routes/beta/lib/editor/VisualEditor2.svelte` (UI) |
| Firmware exports  | (no changes — `keycap.letter` is now layout-aware end-to-end)                                                                     |

**Tests:** `src/lib/layouts/layouts.test.ts` (5 layouts × letter lookup, flip behavior); `src/lib/layouts/layoutEndToEnd.test.ts` (proto round-trip per layout, legacy URL back-compat, `applyLayoutToKeys`, ZMK/QMK keycode contract).

**Out of scope:** layers, mod-tap/layer-tap, Miryoku, per-key letter override UI.

## Phase 2 — Miryoku bundle

**In scope:** ship Miryoku as a fixed preset bundle, not as customizable layers. Apply Miryoku → 6 layers materialize in the firmware export.

**Why this needs a separate PR:** introduces three things Cosmos doesn't have:

1. **Layer data model.** Probably an array of layers on `CosmosKeyboard`, each layer being `Map<keyId, KeyAction>` where `KeyAction` covers basic kp, mod-tap, layer-tap, transparent, and "no-op." Phase 1's flat letter model survives as the implicit default-layer view.
2. **Mod-tap / layer-tap encoding** in `src/routes/beta/lib/firmware/zmk.ts` and `qmk.ts`. ZMK gets `&mt LSHFT A`, `&lt 1 SPACE`, etc. QMK gets `MT(MOD_LSFT, KC_A)`, `LT(1, KC_SPC)`. CHARS/SPECIALS tables stay; the keycode generator branches on `KeyAction.kind`.
3. **Miryoku slot assignment.** Miryoku has 36 named slots (LH4/LH3/LH2/LT1, etc.). Cosmos doesn't tag keys with those roles. The user picks "apply Miryoku" → UI shows the 36 slots with smart suggestions based on physical position (index/middle/ring/pinky finger and thumb cluster), and the user can override each slot. Slot assignments persist in the config.

**Open questions to settle when starting Phase 2:**

- How does the slot-picker UI live in the editor — modal? dedicated panel? inline overlay on the 3D view?
- For boards with extra keys beyond Miryoku's 36, do unassigned keys get `&trans` (passthrough) or a configurable default?
- For boards with fewer than 36 keys (e.g., a 3×4 micro), do we refuse Miryoku or auto-disable specific layers? Probably refuse with a clear message.
- Phase 2 ships Miryoku only; do we generalize the layer data model to be Miryoku-shaped (6 specific layers), or keep it open-ended for Phase 3? Lean open-ended so Phase 3 inherits cleanly.

**Out of scope:** general layer editor (Phase 3), tap-dance, combos.

## Phase 3 — General layer editor

**In scope:** users build their own layered keymaps on top of the Phase 2 layer data model. The Miryoku bundle becomes "import Miryoku as a starting point, then customize."

**Anticipated work:**

- Per-key, per-layer action editor (a UI surface that lists layers and lets the user click a key to change its action on a given layer).
- Layer add/remove/rename.
- Tap-dance and combo support (extends `KeyAction`).
- Per-key letter override UI — finally lands here, since the same editor that picks "this key is layer-tap to layer 2" also picks "this key prints `'`."
- Validation: warn on unreachable layers, missing return-to-base, duplicate combos, etc.

**Open questions for Phase 3:**

- Do we render the per-layer view as a 2D matrix (KLE-style) or layered overlays on the 3D model? 2D is more standard, 3D is more on-brand.
- Storage cost: a 60-key board × 6 layers × non-trivial action = ~1KB+ added to the URL. Do we need a more compact encoding, or is the URL size fine?
- Do we add a firmware-side "studio mode" hook (ZMK Studio) so users can edit layers on-device, with Cosmos acting only as the initial keymap generator? Probably yes for ZMK; QMK is harder.

## Branching note

Phase 1 (PR #3) is rebased onto current `main` (commit `660e20c`). The svelte-check fixes from PR #2 went to `claude-init`, not `main`, so this PR uses the CI script (`bun src/scripts/check.ts`) which filters the pre-existing accepted errors. If/when the fixes land on `main`, Phase 1 will fast-forward cleanly.
