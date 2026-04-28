# Keyboard layouts

A **layout** controls which letter is printed on (and emitted by) each alpha
key. It does not introduce layers, modifiers, or non-alpha behavior — those are
covered by [keymap structures](keymap-structures.md). The two settings are
orthogonal: any layout can be paired with any keymap structure.

In Cosmos the layout is set via the **Layout** dropdown in the editor sidebar
and stored on the keyboard config (`layout` field in the proto). Cosmos updates
both the visual keycap legends and the firmware keycodes (ZMK `&kp X`, QMK
`KC_X`) to match. Number-row digits, F-keys, and outer-pinky punctuation are
shared across all letter-swap layouts and don't change with the layout.

Cosmos ships five alphabet layouts: QWERTY, Colemak, Colemak-DH, Dvorak, and
Workman.

---

## QWERTY

| Field    | Value                                            |
| -------- | ------------------------------------------------ |
| Designer | Christopher Latham Sholes                        |
| Year     | ~1873                                            |
| Origin   | Sholes & Glidden / Remington No. 1 typewriter    |
| Goal     | Reduce typebar jams by separating common bigrams |

```
Q W E R T   Y U I O P
A S D F G   H J K L ; '
Z X C V B   N M , . /
```

**Notes**

- Universal default; printed on virtually all keyboards.
- High same-finger bigram count (`ed`, `un`, `lo`, `mp`, …).
- Hand alternation rate ~33% on English prose.
- Home-row usage ~32%.
- Designed for typewriter mechanics, not modern fingers — kept by inertia.

---

## Colemak

| Field    | Value                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Designer | Shai Coleman                                                                  |
| Year     | 2006                                                                          |
| Goal     | Maximize home-row use; retain QWERTY's `Z X C V` for cut/copy/paste shortcuts |

```
Q W F P G   J L U Y ; '
A R S T D   H N E I O
Z X C V B   K M , . /
```

**Differences from QWERTY**

- 17 keys move; 10 stay (`Q W A Z X C V B M`, plus the punctuation).
- Common letters (`A R S T N E I O`) sit on the home row.
- Caps-lock position is conventionally remapped to Backspace (Cosmos doesn't enforce this — set in your OS or firmware).

**Notes**

- Native OS support: Linux, macOS, Windows (with download).
- Home-row usage ~74% on English prose.
- Hand alternation ~35% (similar to QWERTY but with much shorter average finger travel).

---

## Colemak-DH

| Field    | Value                                                                                |
| -------- | ------------------------------------------------------------------------------------ |
| Designer | Stevep99 (community)                                                                 |
| Year     | ~2014                                                                                |
| Goal     | Address Colemak's `D` and `H` index-finger curl by moving them off the middle column |

```
Q W F P B   J L U Y ; '
A R S T G   M N E I O
Z X C D V   K H , . /
```

**Differences from Colemak**

- `D` moves from home row middle to bottom-row index column (`C V D` instead of `C V B` on the left bottom).
- `H` moves from home row index inner-reach to bottom-row index column.
- The middle column thereby drops the awkward inward index reach for Colemak's most common letters.

**Notes**

- Often considered the canonical "modern" Colemak.
- Especially well-suited to Mod-DH style boards (e.g. Corne, Cosmos thumbs-only ortho) where the bottom row is reachable without curl.
- OS support is community-distributed (manual install or Karabiner/AutoHotkey on macOS/Windows; xkb variant on Linux).

---

## Dvorak

| Field    | Value                                                          |
| -------- | -------------------------------------------------------------- |
| Designer | August Dvorak and William Dealey                               |
| Year     | Patented 1936 (research from 1932)                             |
| Goal     | Place most-used letters on the home row; alternate hands often |

```
' , . P Y   F G C R L /
A O E U I   D H T N S -
; Q J K X   B M W V Z
```

**Differences from QWERTY**

- All vowels on left home row (`A O E U I`); most common consonants on right home row (`D H T N S`).
- Punctuation sits on the top row (`'` and `,` and `.`), not the bottom.
- Bottom row has the rare letters (`Q J K X B`).

**Notes**

- Oldest non-QWERTY alternative still in widespread use.
- Native OS support on Linux, macOS, Windows.
- Home-row usage ~70%.
- Hand alternation ~50% (the highest among the five layouts here).

---

## Workman

| Field    | Value                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Designer | OJ Bucao                                                                                                      |
| Year     | 2010                                                                                                          |
| Goal     | Lower same-finger bigrams below Colemak; respect that columns 1 and 5 are stronger than the index inner-reach |

```
Q D R W B   J F U P ; '
A S H T G   Y N E O I
Z X M C V   K L , . /
```

**Differences from Colemak**

- 9 keys move relative to Colemak; the home-row reorganization is the largest change.
- Right home row is `Y N E O I` (vs Colemak's `H N E I O`) — `H` moves to the left side.
- Letters that Colemak places on the index inner reach (`D`, `H`) are pushed to "easier" columns under Workman's finger-strength model.

**Notes**

- Smaller community than Colemak/Dvorak; less native OS support.
- Designed around the assumption that index inner-reach (column 5 / column 6) is uncomfortable, contradicting Colemak's home-row placement of `D`/`H` there.
- Trade-off: more keys move from QWERTY (steeper relearn) but lower same-finger bigram rate in some studies.

---

## Picking a layout

| If you …                                            | Consider   |
| --------------------------------------------------- | ---------- |
| Are new to ergo / want OS compatibility             | QWERTY     |
| Want a measured improvement, keep shortcuts         | Colemak    |
| Have an ortho/split with reachable bottom-row index | Colemak-DH |
| Want maximal home-row use & hand alternation        | Dvorak     |
| Optimize same-finger bigrams over keep-from-QWERTY  | Workman    |

## Two-layer translation

The OS turns scancodes into characters. Cosmos's layout setting only controls
what scancode each physical key sends. There are two valid configurations:

- **Cosmos = QWERTY, OS = your layout.** The keyboard sends QWERTY scancodes;
  the OS remaps them. Common with shared/work computers since the keyboard
  works as expected on any machine.
- **Cosmos = your layout, OS = QWERTY.** The keyboard sends your layout's
  scancodes; the OS treats them as QWERTY. The keyboard "is" your layout
  regardless of which machine it's plugged into.

Pick whichever matches your workflow — Cosmos doesn't enforce either. The
generated firmware emits the correct keycodes for whatever layout you select.
