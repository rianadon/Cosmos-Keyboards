# Keymap structures

A **keymap structure** controls how layers, modifiers, and non-alpha keys are
organized across the board. It is independent of the alphabet
[layout](layouts.md) (QWERTY, Colemak, etc.) — keymaps and layouts are set on
separate fields and don't constrain each other.

In Cosmos the keymap structure is set via the **Keymap** dropdown in the
firmware download dialog (Program tab) and stored on the keyboard config
(`keymapPreset` field in the proto). Cosmos ships two keymap structures today:
**Default** (single-layer) and **Miryoku** (7-layer with home-row mods).

---

## Default

Single-layer keymap. Each physical key emits one keycode pulled from its
keycap legend.

| Property            | Value                          |
| ------------------- | ------------------------------ |
| Layers              | 1                              |
| Mods                | Dedicated outer keys           |
| Numbers             | Dedicated number row           |
| F-keys              | Dedicated F row (if present)   |
| Mod-tap / layer-tap | Not used                       |
| Combos              | Not used                       |
| Minimum key count   | None — works on any size board |

**Output**

- ZMK: a single `default_layer` block in `<folder>.keymap`.
- QMK: `keymaps[][...][...]` array with one entry, `[0] = LAYOUT(...)`.

---

## Miryoku

A canonical layered keymap by David Brown (manna-harbour), shipped since
2020 in [`manna-harbour/miryoku`](https://github.com/manna-harbour/miryoku) and
ported to ZMK as
[`manna-harbour/miryoku_zmk`](https://github.com/manna-harbour/miryoku_zmk).
Designed for a 36-key 3×5+3 layout (10 alpha cols × 3 rows + 6 thumbs).

Cosmos emits 6 of the 7 canonical Miryoku layers. The seventh (BUTTON, mouse
buttons via combos) requires firmware-side combo configuration that Cosmos
does not yet generate.

### Layer index

| # | Layer | Activated by               | Contents                                                 |
| - | ----- | -------------------------- | -------------------------------------------------------- |
| 0 | BASE  | (default)                  | Alphas + home-row mods + thumb layer-taps                |
| 1 | NAV   | Hold left thumb 1 (Space)  | Arrows, paging, undo / cut / copy / paste                |
| 2 | MOUSE | Hold left thumb 2 (Tab)    | Mouse movement and scroll                                |
| 3 | MEDIA | Hold left thumb 0 (Esc)    | Volume, transport, mute                                  |
| 4 | NUM   | Hold right thumb 1 (Bksp)  | Numpad on left half, mods on right home row              |
| 5 | SYM   | Hold right thumb 0 (Enter) | Symbols on left half (mirrors NUM layout), mods on right |
| 6 | FUN   | Hold right thumb 2 (Del)   | F1-F12 on left half, mods on right home row              |

### BASE layer mod placement

```
plain alphas        plain alphas
   GUI ALT CTL SHF      SHF CTL ALT GUI
plain alphas        plain alphas
        MEDIA NAV MOUSE  SYM NUM FUN
```

Home-row keys (row 1) are **mod-taps**: tap = letter, hold = mod. Thumbs are
**layer-taps**: tap = the key shown in the index table (Space, Enter, …),
hold = the layer.

| Slot column       | Mod           |
| ----------------- | ------------- |
| Pinky outer       | GUI           |
| Ring              | ALT           |
| Middle            | CTRL          |
| Index home        | SHIFT         |
| Index inner reach | (plain alpha) |

The four layered mod blocks (NUM, SYM, FUN, plus BASE itself) put the same
mods at the same physical positions, so a hold can carry across layer changes.

### Slot model

Miryoku reasons in 36 named **slots**:

| Group         | Slots                                      |
| ------------- | ------------------------------------------ |
| Left fingers  | `L00`–`L04`, `L10`–`L14`, `L20`–`L24` (15) |
| Right fingers | `R00`–`R04`, `R10`–`R14`, `R20`–`R24` (15) |
| Left thumbs   | `LT0`, `LT1`, `LT2`                        |
| Right thumbs  | `RT0`, `RT1`, `RT2`                        |

Slot id format: side (`L` / `R`) + row (0=top, 1=home, 2=bottom) + col
(0=leftmost-physical for that side, 4=rightmost-physical). Thumbs: side + `T`

- index (0=outer, 2=inner).

Cosmos auto-suggests a slot → physical-key mapping based on column letter
density (alpha columns) and physical thumb position. Each slot can be
overridden per-keyboard from the slot picker; overrides persist in
`localStorage`.

### Alpha resolution

The BASE layer's alpha slots use a `__ALPHA__` placeholder rather than a
fixed letter. At firmware-emit time the placeholder resolves to the letter
the active [layout](layouts.md) puts at that physical key. Result: Miryoku ×
QWERTY and Miryoku × Colemak-DH both work without per-layout copies.

### Output

- ZMK: 7 named layer blocks (`base_layer`, `nav_layer`, …, `fun_layer`) plus
  a 7-line `#define BASE 0 … FUN 6` block. Slots without an action emit
  `&trans` so unmapped physical keys fall through to BASE.
- QMK: `keymaps[]` array with 7 entries `[0] = LAYOUT(...) … [6] = LAYOUT(...)`,
  same `#define`s, and a 7-entry encoder map (when encoders are present).
  Unassigned positions emit `KC_TRNS`.

### Constraints

- **Minimum 36 keys.** Cosmos disables the option below this threshold (5
  alpha cols × 3 rows + 3 thumbs per side). Boards with extra keys get
  `&trans` / `KC_TRNS` for unassigned positions.
- **Spec is fixed.** Reordering layers or remapping individual slots beyond
  the slot picker isn't supported in Cosmos's current implementation. The
  general layer editor (a future Cosmos phase) will lift this constraint.
- **No BUTTON layer.** Mouse-button combos require firmware-side combo
  configuration that Cosmos doesn't generate.

---

## Storage and emission

| Concern             | Default                          | Miryoku                                            |
| ------------------- | -------------------------------- | -------------------------------------------------- |
| Proto field         | `keymapPreset` absent            | `keymapPreset = 'miryoku'` (proto field 34)        |
| Slot data           | n/a                              | `localStorage` overrides + auto-suggested defaults |
| ZMK keymap          | 1 block                          | 7 blocks + layer defines                           |
| QMK keymap          | 1-entry array                    | 7-entry array + layer defines                      |
| Encoder map         | 1 entry (if encoders)            | 7 entries (one per layer)                          |
| Cosmos runtime code | rgblight, RELAY, post-init, OLED | rgblight, RELAY, post-init, OLED (same as Default) |

The proto field is trimmed to absent when no preset is selected, so URLs
generated before the keymap-preset feature shipped continue to decode as
single-layer Default.

---

## Compatibility

| Concern                 | Default                                           | Miryoku                                                   |
| ----------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Min board size          | Any                                               | 36 keys                                                   |
| Layout (QWERTY etc.)    | All five Cosmos layouts                           | All five (alphas resolve through `__ALPHA__` placeholder) |
| OS-side layout          | Either side can do the translation                | Same — keymap structure is OS-agnostic                    |
| Studio (ZMK)            | Bootmagic key emits `&studio_unlock` when enabled | Same — injected at the bootmagic positions on BASE        |
| ZMK Studio extra layers | n/a                                               | `extra1`/`extra2`/`extra3` reserved when Studio is on     |
| Encoders                | One vol-up/down map                               | Same map repeated per layer                               |

## Future presets

Phase 3 of the keymap work will add a "Custom" entry to the Keymap dropdown
(the layer editor) and may add additional canonical presets. Common
candidates from the wider community:

| Preset                                                                                | Distinguishing trait                                                   |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [**Seniply**](https://stevep99.github.io/seniply/)                                    | 4 layers; mods on thumbs (no home-row mods); friendlier learning curve |
| [**Sturdy**](https://github.com/Adamhrv/sturdy)                                       | Mod-DH alpha + tweaked layer split; opinionated symbol arrangement     |
| [**Callum mods**](https://github.com/callum-oakley/keymaps/tree/master/handsdown_neu) | One-shot mods + smart-shift (no tap-hold misfires); single-shot layers |
| [**Sweep / Bilateral combinations**](https://github.com/davidphilipbarr/Sweep)        | Heavy use of combos for symbols/numbers; very compact but combo-heavy  |

These are not currently selectable in Cosmos.
