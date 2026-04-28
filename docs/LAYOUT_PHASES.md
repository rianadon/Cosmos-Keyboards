# Layout switcher — phase plan

Roadmap for letting users pick a keyboard layout (QWERTY, Colemak, Miryoku, etc.) in the Cosmos editor and have it flow through both visual legends and firmware (ZMK/QMK) output. One PR per phase.

For end-user docs on what each keymap structure does and how they compare, see [KEYMAP_STRUCTURES.md](KEYMAP_STRUCTURES.md).

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

## Phase 2 — Miryoku keymap preset (shipped)

**In scope:** Miryoku as a fixed preset bundle — toggle it on, slot picker shows up in the firmware download dialog, ZMK/QMK output emits 7 layers (BASE + NAV/MOUSE/MEDIA/NUM/SYM/FUN, omitting BUTTON since that needs combos).

**Design decisions that landed:**

- **Miryoku is a flag, not a layout.** Stored on `CosmosKeyboard` as `keymapPreset?: KeymapPresetId` (currently only `'miryoku'`), proto field `keymap_preset = 34`, trimmed to 0 when absent for URL back-compat. Orthogonal to the Phase 1 `layout` field — you can run "Colemak-DH letters with Miryoku layers."
- **Open-ended `KeyAction` union.** `kind: 'kp' | 'mt' | 'lt' | 'osm' | 'osl' | 'trans' | 'none'` covers what ZMK and QMK both support natively. Tap-dance, combos, and macros are deferred to Phase 3.
- **`__ALPHA__` placeholder for layout-driven alpha.** Miryoku's BASE layer references letters via a sentinel; firmware emit resolves it to whatever letter the active layout has at that physical slot. Means Miryoku × Colemak-DH "just works" without per-layout Miryoku copies.
- **Keymap preset selector lives in the firmware download dialog, not the main editor.** It's a `<Select>` (`Default` / `Miryoku`, extensible to `Custom` for Phase 3) right above the slot picker. Both the selector and the slot picker only affect firmware output, so the editor stays focused on geometry. Phase 3 will add `Custom` to the same dropdown when the layer editor lands.
- **Smart auto-suggest + manual override.** `suggestMiryokuPositions(geometry)` walks `FullGeometry`, identifies the 5 alpha columns by letter density, maps profile rows 2/3/4 to Miryoku rows 0/1/2, and orders thumbs outer→inner per side. Users can override per-slot; overrides persist in `localStorage` (key `cosmos.prefs.miryokuOverrides`).
- **<36 keys → checkbox disabled.** Help text explains the floor. >36 keys → unassigned positions emit `&trans` (ZMK) / `KC_TRNS` (QMK) so they fall through to BASE.

**Files added:**

| Area            | File                                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Spec + types    | `src/lib/keymap/index.ts` (`KeyAction`, `Layer`, `KEYMAP_PRESET`), `src/lib/keymap/miryoku.ts` (7-layer Miryoku def) |
| Slot suggestion | `src/lib/keymap/miryokuSlots.ts` (CosmosKeyboard-space), `src/routes/beta/lib/firmware/miryokuLayout.ts` (geo-space) |
| Emitters        | `src/lib/keymap/zmkEmit.ts`, `src/lib/keymap/qmkEmit.ts` (ZMK→QMK code translation incl. `LC(LALT)` → `C(KC_LALT)`)  |
| Slot picker UI  | `src/routes/beta/lib/editor/MiryokuSlotPicker.svelte` (36-slot grid with override inputs, reset action)              |

**Files touched:**

| Area             | File                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Proto + types    | `src/proto/cosmos.proto`, `src/lib/worker/config.cosmos.ts`, `src/lib/worker/config.serialize.ts`     |
| Editor           | `src/routes/beta/lib/editor/VisualEditor2.svelte` (Miryoku checkbox)                                  |
| Firmware exports | `src/routes/beta/lib/firmware/zmk.ts`, `src/routes/beta/lib/firmware/qmk.ts` (multi-layer emission)   |
| Download dialog  | `src/routes/beta/lib/editor/PeaConfig.svelte` (slot picker integration, `$miryokuOverrides` storable) |

**Tests:** `src/lib/keymap/keymap.test.ts` (18 unit tests on emitters + Miryoku spec), `src/lib/keymap/keymapEndToEnd.test.ts` (12 e2e: proto round-trip, slot suggestion, every layer's actions emit valid syntax, home-row mod placement).

**Out of scope (deferred to Phase 3):** general layer editor, BUTTON layer / combos, tap-dance, per-key letter override UI.

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
