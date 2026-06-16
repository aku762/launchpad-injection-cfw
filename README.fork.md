# Launchpad Injection CFW — Fork Notes

Fork of [anthonyhfm/launchpad-injection-cfw](https://github.com/anthonyhfm/launchpad-injection-cfw) by [aku762](https://github.com/aku762).

This fork targets the **Launchpad Mini Mk3** and adds a browser-based layout editor plus a generated MIDI controller firmware mode. The injection infrastructure, binary patching system, and all upstream device support are unchanged.

---

## What this fork adds

### Visual Layout Editor (`editor/`)

A browser-based pad editor (`editor/index.html`) for designing MIDI controller layouts visually.

Open `editor/index.html` directly in any browser — no server needed.

**Supported widget types:**

| Type | Description |
|------|-------------|
| `note` | Sends Note On/Off. Momentary, toggle, or trigger behavior. |
| `cc` | Sends a CC value on press/release. Momentary or toggle. |
| `pc` | Sends a Program Change on press. |
| `fader` | Multi-pad fader with stepped CC output and optional slew rate. ⚠️ Work in progress — not working on device yet. |
| `mode_switch` | Switches to another firmware mode slot. |

**Each widget supports:**
- `label` — up to 6 characters, shown on the pad in the editor
- `description` — longer note, shown only in the properties panel

**Fader features:**
- Variable length (2–9 pads), vertical or horizontal
- `curve_mode`: turns the anchor pad into a rate selector. Tap it to cycle through instant / slow / medium / fast slew rates. The anchor LED color shows the current rate (white / green / yellow / red).
- Without `curve_mode`, the fader snaps instantly to the pressed position.

Save your layout as a `.json` file (File > Export JSON or copy from the browser).

---

### Code Generator (`tools/json_to_mode.py`)

Converts a layout `.json` into a ready-to-compile C firmware mode.

```
python3 tools/json_to_mode.py editor/my_layout.json my_mode
```

Outputs:
- `src/mode/user/my_mode.c`
- `include/mode/user/my_mode.h`

The generator prints the three manual registration steps (mode.h, mode.c, Makefile) and the selectable_modes entry for setup.c. After registering, run `make mini`.

---

### Demo mode (`editor/demo.json` → `src/mode/user/demo.c`)

A test layout wired in as mode slot 4 (accessible from the Setup screen via pad 13). It exercises faders, notes, CC buttons, and PC buttons across the Mini Mk3 grid.

---

## Building (Mini Mk3)

Requirements: `arm-none-eabi-gcc`, `python3`, `make`.

You need to supply the original firmware yourself (Novation does not allow redistribution):

1. Download `launchpadminimk3-firmware-407.syx` from the official Novation updater.
2. Place it at `original/launchpadminimk3-firmware-407.syx`.
3. Run `make mini`. The patched firmware is written to `build/mini-cfw.syx`.
4. Send `build/mini-cfw.syx` to the device via any SysEx tool (MIDI-OX, SysEx Librarian, etc.).

To rebuild after editing a layout JSON:

```bash
python3 tools/json_to_mode.py editor/demo.json demo
make mini
```

---

## Adding a new mode

1. Design your layout in `editor/index.html` and export it as a `.json` file inside `editor/`.
2. Run the generator: `python3 tools/json_to_mode.py editor/your_layout.json your_name`
3. Follow the printed registration steps:
   - Add `#define MODE_YOUR_NAME N` and `#include "mode/user/your_name.h"` to `include/mode/mode.h`
   - Add an entry to the `modes[]` array in `src/mode/mode.c`
   - Add `src/mode/user/your_name.c \` to `SRC` in the Makefile
   - Add `{ pad_xy, MODE_YOUR_NAME }` to `selectable_modes` in `src/mode/system/setup.c` (increment `#define MODES`)
4. `make mini`

---

## Repository layout (fork additions)

```
editor/             Browser layout editor (HTML/CSS/JS, no build step)
  index.html
  app.js
  style.css
  demo.json         Demo layout source
  basic.json        Minimal test layout
  showcase.json     Full widget showcase
tools/
  json_to_mode.py   Layout-to-C code generator
src/mode/user/
  demo.c            Generated demo mode (committed for convenience)
include/mode/user/
  demo.h
```

---

## Syncing with upstream

This fork tracks upstream on the `code` branch. To pull upstream improvements:

```bash
git fetch upstream
git merge upstream/code
```

The fork only adds files — it does not modify any upstream source files except the four registration files (`mode.h`, `mode.c`, `Makefile`, `setup.c`). Merge conflicts, if any, will be limited to those four files.
