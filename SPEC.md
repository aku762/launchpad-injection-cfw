# Novation Components Custom Mode SysEx Format
## Launchpad Mini Mk3

Reverse-engineered from 14 sample .syx files downloaded from Novation Components.
All values hexadecimal unless noted.

---

## File Layout

```
[0x00]  F0 00 20 29          SysEx start + Novation manufacturer ID
[0x04]  02 0D                Mini Mk3 product ID
[0x06]  20 00                Command: custom mode upload
[0x08]  45 40 7F 20 10 2A   6 constant bytes (unknown purpose)
[0x0E]  <16 bytes>           Mode name, ASCII, zero/null padded
[0x1E]  <type>               Mode type: 01 = control, 04 = keyboard/drum
[0x1F]  00
[0x20]  <pad entries>        72 variable-length entries (see below)
        <trailer>            17 bytes (see below)
```

Total header before pad entries: **32 bytes** for control modes (`type=01`).
For keyboard/drum modes (`type=04`), 3 additional parameter bytes appear at
0x20–0x22 before the pad entries, so pad entries begin at **byte 35**.

---

## Pad Address Space

72 total pad positions, addressed 0x00–0x47:

```
0x00–0x07   Top 8 circular buttons, left to right
            Novation labels these btn81–btn88

0x08–0x47   Main 8×8 grid, ROW-MAJOR TOP-DOWN
            Row 1 (topmost, just below circular): 0x08–0x0F
            Row 2:                                0x10–0x17
            Row 3:                                0x18–0x1F
            Row 4:                                0x20–0x27
            Row 5:                                0x28–0x2F
            Row 6:                                0x30–0x37
            Row 7:                                0x38–0x3F
            Row 8 (bottommost):                   0x40–0x47
```

Within each row, columns go left (0x_0) to right (0x_7).

### Fader starting addresses
Faders span 8 pads but use a single entry. The address encodes the
CC=0 end of the fader:

- **Vertical** fader in column C (0-indexed from left):  
  `addr = 0x40 + C`  (bottom pad of the column = CC 0; firmware spans upward)
- **Horizontal** fader on row R (1-indexed from bottom, so R=1 = row 8 = bottommost):  
  `addr = 0x48 - R * 8`  (leftmost pad of the row = CC 0; firmware spans rightward)

Both the bottom row and leftmost column share the corner at `addr=0x40`, so the
`05` direction flag in the trailer is required to distinguish them.

---

## Pad Entry Types

All 72 positions are encoded sequentially. Entries are variable length.

### Blank pad — 2 bytes
```
40 [addr]
```
A pad with no assignment.

### Standard control — 10 bytes (type byte `48`)
Used for: note buttons, CC faders (vertical/horizontal/bipolar)

```
48 [addr] [sub] [color] [min] [ch_behav] [len] 00 [cc/note] [max]
```

| Byte | Field      | Notes |
|------|------------|-------|
| [0]  | `48`       | Entry type |
| [1]  | addr       | Pad position 0x00–0x47 |
| [2]  | sub-type   | `01`=note, `02`=CC fader |
| [3]  | color      | Novation palette index (see Color Palette below) |
| [4]  | min        | Min CC value — always `00` in observed samples |
| [5]  | ch_behav   | `(behavior << 4) | (channel - 1)` |
| [6]  | len        | `00`=single button, `08`=standard fader, `09`=bipolar fader |
| [7]  | `00`       | Always zero |
| [8]  | cc/note    | CC number (sub `02`) or `00` (sub `01`) |
| [9]  | max/note   | Max CC value (sub `02`) or MIDI note number (sub `01`) |

**Behavior values** (high nibble of ch_behav):
- `0` = normal / N/A (faders, non-momentary notes)
- `1` = momentary (note buttons)

### CC button / Program Change — 11 bytes (type byte `49`)
Used for: CC buttons (momentary or toggle), PC buttons

```
49 [addr] [sub] [color] [off] [ch_behav] 00 00 [cc/pc] [on] 00
```

| Byte | Field      | Notes |
|------|------------|-------|
| [0]  | `49`       | Entry type |
| [1]  | addr       | Pad position 0x00–0x47 |
| [2]  | sub-type   | `02`=CC button, `03`=PC |
| [3]  | color      | Novation palette index |
| [4]  | off value  | Value sent on release (CC button: typically `00`) |
| [5]  | ch_behav   | `(behavior << 4) | (channel - 1)` |
| [6]  | `00`       |  |
| [7]  | `00`       |  |
| [8]  | cc/pc num  | CC number (sub `02`) or PC number (sub `03`) |
| [9]  | on value   | Value sent on press (CC button: typically `7F`) |
| [10] | `00`       | Always zero — extra byte vs type `48` |

**Behavior values** for `49`-type entries:
- `0` = momentary CC button
- `2` = PC (observed for sub `03` only — may encode bank behavior)

---

## Trailer (last 17 bytes)

```
00 15 01 15 02 00 06 00 07 [oct] 08 00 05 [dir] 04 [semi+40] F7
```

Structured as sequential tag/value byte pairs:

| Trailer offset | Tag  | Default value | Meaning |
|----------------|------|---------------|---------|
| +0 / +1        | `00` | `15`          | Unknown (always 0x15) |
| +2 / +3        | `01` | `15`          | Unknown (always 0x15) |
| +4 / +5        | `02` | `00`          | Unknown |
| +6 / +7        | `06` | `00`          | Unknown |
| +8 / +9        | `07` | `00`          | Octave transpose nav buttons |
| +10 / +11      | `08` | `00`          | Unknown |
| +12 / +13      | `05` | `00`          | Fader direction flag |
| +14 / +15      | `04` | `40`          | Semitone transpose nav buttons |
| +16            | `F7` | —             | SysEx end |

### Fader direction (tag `05`)
- `00` = horizontal faders (or no faders)
- `01` = vertical faders

**`05` is a boolean direction flag, not a count.** Two vertical faders → `05 01`, not `05 02`.

### Navigation button transpose (tags `07` and `04`)
Confirmed by diffing `blank.syx`, `octave_transpose_on.syx`, `semitone_transpose_on.syx`.  
The navigation row buttons (XY 91–98) are **not** in the pad entry address space — their
state is encoded only in these trailer fields.

| Feature               | Tag  | Off value | On value |
|-----------------------|------|-----------|----------|
| Octave transpose      | `07` | `00`      | `64`     |
| Semitone transpose    | `04` | `40`      | `42`     |

Both features can be active simultaneously (set both values).  
The exact sub-encoding of the `on` values (which specific arrows are selected, direction,
behavior) is not yet fully decoded — `0x64` and `0x42` are empirically confirmed constants.

---

## Color Palette (confirmed)

| Index (hex) | Index (dec) | Color  |
|-------------|-------------|--------|
| `05`        | 5           | Red    |
| `0D`        | 13          | Yellow |
| `15`        | 21          | Green  |
| `2D`        | 45          | Blue   |
| `31`        | 49          | Purple |

Full palette has 128 entries (0x00–0x7F). Remaining indices unconfirmed.

---

## Fader Length Field

| `len` byte | Type                         | Trailer `05` |
|------------|------------------------------|--------------|
| `00`       | Single button (note or CC)   | `00`         |
| `08`       | Standard CC fader (8 pads)   | `00` or `01` |
| `09`       | Bipolar CC fader (8 pads)    | `00` or `01` |

Combined with trailer flag:
- `len=08`, `05=01` → vertical standard fader
- `len=09`, `05=01` → vertical bipolar fader
- `len=08`, `05=00` → horizontal standard fader
- `len=09`, `05=00` → horizontal bipolar fader

Fader length in Components is fixed at 8 pads and cannot be changed via the UI.
Horizontal and vertical faders cannot coexist in the same layout.

### `len` field is only honoured at valid fader addresses

**Confirmed empirically**: placing a `0x48` entry with `sub=02`, `len=08` at an address that is
not a geometrically valid fader start (e.g. addr `0x28` — mid-column) causes the firmware to
**ignore `len` entirely** and treat the entry as a momentary CC button instead:

- off-value = byte[4] (`min`)
- on-value  = byte[9] (`max`)
- CC number = byte[8]
- behavior  = momentary (because `ch_behav` high nibble = `0`)

This also means mixing horizontal and vertical faders in one layout is impossible: a `len=08`
entry at a row-start address will be silently converted to a CC button if the trailer direction
flag says vertical (and vice versa), because neither address is valid for the configured direction.

---

## Keyboard / Drum Mode (`type=04`)

Chromatic keyboard, scale keyboard, and drum grid modes are **macros** in the
Components UI — they auto-place standard note buttons based on musical
parameters. The `.syx` output is just regular `48`-type note entries, identical
to any manually placed note button.

Files with `type=04` at byte 0x1E have 3 additional bytes at 0x20–0x22 (the
macro input parameters), then pad entries begin at byte 35. The 3 bytes encode
the layout inputs (start note, scale, row/column count, etc.) whose exact
encoding is not fully decoded — but they are not needed for import.

| Mode                  | Bytes 0x20–0x22 |
|-----------------------|-----------------|
| Chromatic keyboard    | `08 47 58`      |
| Scale keyboard (C min)| `09 51 00`      |
| Drum grid (C1, 4×4)   | `04 33 54`      |

**For import:** skip the 3 parameter bytes if `type=04`, then parse pad entries
normally. No special handling required — they are just note buttons.

**For export:** always write `type=01`. Our editor does individual pad
assignments; `type=04` auto-layout metadata is Components-internal and not
needed to produce a working custom mode.

---

## Chromatic Keyboard Layout Pattern

The chromatic keyboard maps one octave across two physical rows:
- **Circular buttons** (`0x00–0x07`): black keys (5 assigned, 3 blank for E, B, and unused)
- **Top main grid row** (`0x08–0x0F`): white keys left to right

Black key positions in the circular row (0-indexed, 0=leftmost):
```
0x00 = blank (no black below C)
0x01 = C# / Db
0x02 = D#  / Eb
0x03 = blank (E–F gap)
0x04 = F#  / Gb
0x05 = G#  / Ab
0x06 = A#  / Bb
0x07 = blank (B–C gap)
```

"Primary color" (user-selected) = non-root notes.  
"Secondary color" = root/octave notes (C).

---

## File Size Reference

| Controls     | Type(s) | Pad bytes | Total |
|--------------|---------|-----------|-------|
| 0 controls   | —       | 144       | 193   |
| 1 × `48`     | note/fader | 152    | 201   |
| 1 × `49`     | CC/PC btn | 153     | 202   |
| 2 × `48`     |         | 160       | 209   |
| N × `48`     |         | 144+8N    | 193+8N |
| N × `49`     |         | 144+9N    | 193+9N |

Formula: `32 (header) + pad_bytes + 17 (trailer)`

---

## Known Unknowns

1. **6 constant bytes** at 0x08–0x0D (`45 40 7F 20 10 2A`) — purpose unknown
2. **Trailer tags `00`, `01`, `02`, `06`, `08`** — always constant (`15 15 00 00 00`), purpose unknown
3. **Trailer tag `04` and `07` sub-encoding** — confirmed values for octave/semitone on/off, but the
   specific bit layout within `0x64` and `0x42` (e.g., which arrow buttons, up/down direction) is unknown
4. **Keyboard parameter bytes** at 0x20–0x22 for `type=04` modes — partially decoded
5. **Full color palette** — only 5 of 128 entries confirmed
6. **Behavior value `2`** in ch_behav high nibble for PC entries — precise meaning unclear
