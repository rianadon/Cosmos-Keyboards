# Phase 2 testing guide — Miryoku keymap preset

How to verify the Miryoku feature end-to-end. Covers automated tests, in-browser smoke tests, and inspection of the generated firmware.

## Automated

```bash
bun test src/lib/keymap/                   # 30 tests: unit + e2e
bun test src/lib/                          # 54 tests across 5 files
bun test                                   # full suite (70 tests, 8 files)
bun src/scripts/check.ts                   # CI svelte-check (no relevant errors)
```

What the keymap tests cover:

- **`keymap.test.ts`** — `keyActionToZmk` / `keyActionToQmk` for every `KeyAction` kind (kp, mt, lt, osm, osl, trans, none); ZMK→QMK code translation (`LC(LALT)` → `C(KC_LALT)`, `N7` → `KC_7`, `BSPC` → `KC_BSPC`); Miryoku spec sanity (36 slots, all layers populated, home-row mod placement, thumb layer-tap targets).
- **`keymapEndToEnd.test.ts`** — `keymapPreset` proto round-trip; back-compat (omitted preset decodes as `undefined`); slot suggestion fills 18 right-side slots for the default Cosmos config; every emitted action produces a syntactically valid ZMK/QMK string; right home row R col 1-4 holds SHFT/CTRL/ALT/GUI in that order (the lynchpin assertion that catches the column-reversal bug).

## Manual — UI

```bash
make dev                                   # http://localhost:5173/beta (or :5174 if 5173 is in use)
```

### Checkbox

1. Open `/beta` with the default config. Scroll to the "Layout" field in the editor sidebar.
2. The "Miryoku Keymap" checkbox sits below the Layout dropdown.
3. With the default ergo config (>36 keys), the checkbox is enabled. Toggle it on; the URL updates (you should see `keymapPreset` encoded into the proto).
4. Reduce the keyboard to <36 keys (toggle off the number row, remove columns) — the checkbox should grey out with the help text "Miryoku requires at least 36 keys".

### Slot picker

1. Re-enable Miryoku. Generate the matrix and proceed to the firmware download dialog (the "Pea Config" step).
2. The "Miryoku Slot Assignment" panel appears above the Download button. It shows 36 slots in 4 rows: Top, Home, Bottom, Thumbs.
3. Each slot has a number input prefilled (as placeholder) with the auto-suggested ZMK key position. Hover an input to see the position label, including the alpha letter when known (e.g. "12 (J)").
4. Type a number in any slot to override; the input border turns pink.
5. Click "Reset overrides" — the pink overrides clear, placeholders return to the auto-suggestions.
6. Reload the page — overrides persist (they're stored in `localStorage` under `cosmos.prefs.miryokuOverrides`).

### Combined with letter-swap layouts

Miryoku is orthogonal to the layout setting (Phase 1). The BASE layer's alpha slots use a `__ALPHA__` placeholder that gets resolved at firmware emit time to whatever letter is currently on that physical key.

1. Set Layout = Colemak-DH and enable Miryoku.
2. Download ZMK code. Open `<folder>.keymap` and find the BASE layer bindings.
3. Verify the home-row mod-taps reflect Colemak-DH letters: e.g. right-side index home (`R11`) should be `&mt LSHFT N` (Colemak-DH puts N on the right index home position), not `&mt LSHFT J` (the QWERTY letter).
4. Switch to Layout = Dvorak and re-download. Same physical position should now emit `&mt LSHFT H`.

## Manual — generated firmware inspection

### ZMK

`<folder>.keymap` should contain 7 layer bindings in canonical order:

```
#define BASE 0
#define NAV 1
#define MOUSE 2
#define MEDIA 3
#define NUM 4
#define SYM 5
#define FUN 6

/ {
    keymap {
        compatible = "zmk,keymap";
        base_layer { bindings = <...>; };
        nav_layer  { bindings = <...>; };
        mouse_layer { bindings = <...>; };
        media_layer { bindings = <...>; };
        num_layer  { bindings = <...>; };
        sym_layer  { bindings = <...>; };
        fun_layer  { bindings = <...>; };
    };
};
```

Spot-check the BASE layer: thumb keys should emit `&lt 3 ESC`, `&lt 1 SPACE`, `&lt 2 TAB` (left thumbs outer→inner) and `&lt 5 RET`, `&lt 4 BSPC`, `&lt 6 DEL` (right thumbs outer→inner). NUM layer should emit number keys on the left half and plain `&kp LSHFT` / `&kp LCTRL` / `&kp LALT` / `&kp LGUI` on right home cols 1-4.

### QMK

`keymap.c` should contain a `keymaps` array with 7 entries `[0]` through `[6]`, plus `#define BASE 0` … `#define FUN 6`. Encoder maps appear under `#if defined(ENCODER_MAP_ENABLE)` with one entry per layer.

## Common failure modes to watch for

- **Mods on the wrong fingers.** SHIFT must land on the index home column (R col 1 / L col 3), GUI on the pinky outer (R col 4 / L col 0). If they're swapped, `nonBaseLayer` in `src/lib/keymap/miryoku.ts` is mis-mapping the right side. There's a regression test for this — run `bun test src/lib/keymap/keymap.test.ts -t 'home row'`.
- **Missing layer in output.** Check that `MIRYOKU_KEYMAP[layer]` has entries for at least the cluster keys you have. Layers ship with `&trans` for unassigned slots, so a sparse keyboard still produces valid output.
- **Slot picker shows empty inputs everywhere.** That means `suggestMiryokuPositions(geometry)` returned an empty map. Most likely cause: `geo.left.c.keys` and `geo.right.c.keys` aren't populated yet (you're in an early matrix-building state). The picker only renders when the firmware-config dialog opens, so this shouldn't happen in normal flow.
- **localStorage overrides leak across keyboard configs.** This is a known limitation — overrides are not scoped per-config. If you switch keyboards, click "Reset overrides" before tweaking.
