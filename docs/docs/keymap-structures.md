# Keymap structures

Keymap structures vs. layouts is the most common source of confusion when picking how a Cosmos keyboard should behave. This doc walks through the difference, what Cosmos ships today, and what's coming.

## Layouts vs. keymaps

These are orthogonal. You pick one of each.

| Concept    | What it changes                                                     | Examples                                     | Where in Cosmos                 |
| ---------- | ------------------------------------------------------------------- | -------------------------------------------- | ------------------------------- |
| **Layout** | Which letter sits on each alpha key (Q, W, E, …)                    | QWERTY, Colemak, Colemak-DH, Dvorak, Workman | Editor sidebar — "Layout" field |
| **Keymap** | How layers, mods, and non-alpha keys are organized across the board | Default (single-layer), Miryoku              | Program tab — "Keymap" field    |

A QWERTY keyboard with Miryoku is fully valid; so is Colemak-DH with the default keymap. The two settings don't constrain each other. Internally Cosmos stores them in separate proto fields (`layout`, `keymapPreset`) and resolves the alpha letter at firmware-emit time so a Miryoku BASE layer auto-picks up Colemak-DH letters without per-layout copies.

## Default — single-layer

What Cosmos has always shipped. Each physical key fires a single keycode pulled from the keycap legend. Mods (Shift, Ctrl, Alt, GUI) sit on dedicated outer keys. No mod-tap, no layer-tap, no extra layers.

- **Pros:** zero learning curve; predictable; works on any size board; nothing to misfire.
- **Cons:** large boards only — mods, numbers, F-row, navigation cluster all need their own physical keys; lots of pinky reaches; not as ergonomic on small boards.
- **Best for:** users new to ergo, full-size or near-full-size boards, anyone who wants the keymap obvious from the keycap legends.

## Miryoku — 7-layer home-row-mod system

A canonical layered keymap by David Brown (manna-harbour), [shipped since 2020 in `manna-harbour/miryoku`](https://github.com/manna-harbour/miryoku) and ported to ZMK as [`manna-harbour/miryoku_zmk`](https://github.com/manna-harbour/miryoku_zmk). Originally designed for a 36-key 3×5+3 layout (10 alpha cols × 3 rows + 6 thumbs).

### Philosophy

- **Everything in one well-tested config.** Miryoku is shipped as a single keymap that you configure via build flags, not a starting point you customize. The defaults are the result of years of community feedback.
- **Same shape on any board.** The 36-key footprint means a Miryoku setup is portable across keyboards — switching boards doesn't change muscle memory.
- **Hold-tap on every key that earns it.** Home-row keys are mod-taps (tap = letter, hold = mod). Thumbs are layer-taps (tap = common key like Space/Enter, hold = activate a layer). Outer keys stay plain.

### Layer structure

Cosmos ships 6 of the 7 canonical Miryoku layers. The seventh (BUTTON) requires combos and is deferred to Phase 3.

| # | Layer | Activated by              | Holds                                                   |
| - | ----- | ------------------------- | ------------------------------------------------------- |
| 0 | BASE  | (default)                 | Alphas + home-row mods + thumb layer-taps               |
| 1 | NAV   | Hold left thumb 1 (Space) | Arrow keys, paging, undo/cut/copy/paste                 |
| 2 | MOUSE | Hold left thumb 2 (Tab)   | Mouse movement + scroll (per-firmware, may need tweaks) |
| 3 | MEDIA | Hold left thumb 0 (Esc)   | Volume, transport, brightness                           |
| 4 | NUM   | Hold right thumb 1 (Bksp) | Number pad on left half                                 |
| 5 | SYM   | Hold right thumb 0 (Ent)  | Symbols on left half (mirroring NUM layout)             |
| 6 | FUN   | Hold right thumb 2 (Del)  | F1-F12 + Print Screen / Scroll Lock / Pause             |

Right home-row mods are GUI / Alt / Ctrl / Shift (pinky→index home, weakest→strongest). Left side is the mirror image. The mod-tap behavior is identical across all layers that include the home-row mod block (NUM/SYM/FUN), so you can hold mods through layer changes.

### Pros

- **Compact and ergonomic.** 36 keys means everything stays within home position; no awkward pinky stretches for navigation or numbers.
- **Mods at home position.** Shift/Ctrl/Alt/GUI never require leaving the home row.
- **Portable mental model.** Same keymap on a 36-key Corne, a 42-key Sofle, or a 60-key Cosmos build — the muscle memory transfers.
- **Layout-agnostic.** Works with any alpha layout — Cosmos resolves the active letter at emit time.
- **Mature.** Years of community refinement; the timing defaults work for most typists.

### Cons

- **Steep learning curve.** Home-row mods take 2-4 weeks to internalize. Expect typo bursts in the first week.
- **Roll misfires on rolls.** Common rolls (e.g. "AS", "EN") can trigger the held mod on fast typists. Mitigations exist (HRM-aware tap-hold flavors, per-key timing) but defaults are conservative.
- **36-key minimum.** Boards with fewer than 36 alphanumeric+thumb positions can't host the full layout — Cosmos disables the option below 36 keys.
- **No customization without forking the spec.** Miryoku as we ship it is the canonical config. Reordering layers, changing thumb assignments, or swapping mods means waiting for the Phase 3 layer editor (or hand-editing the downloaded firmware).
- **BUTTON layer omitted.** Mouse-button combos require firmware-side combo config that Cosmos doesn't generate yet.

### Best for

Users who:

- Have a small (36-50 key) ergonomic board
- Are willing to invest a few weeks adapting
- Want a known-good config rather than tweaking endlessly
- Type primarily prose or code (Miryoku's symbol layer is reasonable but tuned more for prose)

## Other layered keymaps (not yet supported)

Phase 3 will likely add a "Custom" keymap option plus one or two more presets. Common alternatives in the ergo community:

| Preset                                                                                | Distinguishing trait                                                   |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [**Seniply**](https://stevep99.github.io/seniply/)                                    | 4 layers; mods on thumbs (no home-row mods); friendlier learning curve |
| [**Sturdy**](https://github.com/Adamhrv/sturdy)                                       | Mod-DH alpha + tweaked layer split; opinionated symbol arrangement     |
| [**Callum mods**](https://github.com/callum-oakley/keymaps/tree/master/handsdown_neu) | One-shot mods + smart-shift (no tap-hold misfires); single-shot layers |
| [**Sweep / Bilateral combinations**](https://github.com/davidphilipbarr/Sweep)        | Heavy use of combos for symbols/numbers; very compact but combo-heavy  |

These each trade off learning curve vs. ergonomics differently. Cosmos's Phase 3 work will let users either pick from these as presets or build their own keymap directly in the editor.

## How it lives in Cosmos

- **Selecting a preset:** Program tab → "Keymap" dropdown. Selecting Miryoku enables the slot picker below.
- **Slot picker:** 36 cards arranged like the keyboard. Each card maps a Miryoku slot (`L00`…`R24`, `LT0`…`RT2`) to one physical key (identified by the keycap legend + matrix coord). Auto-suggested by physical position; per-slot overrides are persisted in `localStorage`.
- **Storage:** `keymapPreset?: 'miryoku'` on `CosmosKeyboard` (proto field 34, trimmed to absent for back-compat). Slot overrides stay client-side until Phase 3.
- **Firmware emission:** ZMK gets 7 `bindings = <…>` blocks; QMK gets a 7-entry `keymaps[]` array. Both share the same Cosmos runtime boilerplate (relay pin, OLED, etc.) as the default keymap.
