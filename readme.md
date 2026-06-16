# Launchpad Injection CFW — Mini Mk3 Edition

A front-end on top of [anthonyhfm/launchpad-injection-cfw](https://github.com/anthonyhfm/launchpad-injection-cfw)'s binary injection system, focused entirely on the **Launchpad Mini Mk3** and built out with a visual layout editor, a JSON-to-C mode generator, and a set of Mini-specific size optimizations.

The injection technique itself — extracting the stock firmware, splicing in custom code, hooking call sites to redirect execution — is upstream's reverse-engineering work, not ours. What this repo adds is everything on top of that foundation for one specific device: a browser editor non-programmers can use to lay out a controller surface, a generator that turns that layout into compiled C, a couple of hand-built modes (Mixer-style and otherwise), and a string of cuts to claw back flash on a chip that only has ~15KB of injectable space to begin with.

> Note: This repository does **not** distribute Novation firmware.
> You must provide your own official `.syx` update file. Use at your own risk.

## How the injection works

Official firmware updates ship as `.syx` files, convertible to raw `.bin` images. The extracted stock image is treated as the **base blob**: it stays largely intact and continues to provide the original drivers, device logic, and internal services.

Custom code is compiled and **injected into the existing firmware image**. Selected functions inside the stock firmware are **overridden** by patching call sites and/or function entry points to redirect execution into the injected implementations (hooks/detours).

The injected code can still call back into the original firmware functions, effectively using the stock firmware as a **driver layer** while replacing only the targeted behavior.

This repo's Mini Mk3 build patches `app_tick_hook` and `midi_register_hook` (see `patches/lpmini.json`) and lands injected code in the gap between the end of the stock firmware blob and the end of the chip's physical flash — confirmed at 128KB total via the STM32F4 hardware `FLASHSIZE` register, leaving roughly 3.8KB of working room after the stock firmware and our own infrastructure.

## What's here for Mini Mk3

### Visual Layout Editor (`editor/`)

A browser-based pad editor (`editor/index.html`) for designing MIDI controller layouts visually — open it directly in any browser, no server needed.

**Supported widget types:**

| Type | Description |
|------|-------------|
| `note` | Sends Note On/Off. Momentary, toggle, or trigger behavior. |
| `cc` | Sends a CC value on press/release. Momentary or toggle. |
| `pc` | Sends a Program Change on press. |
| `fader` | Multi-pad fader with stepped CC output, optional curve-based slew rate. |
| `mode_switch` | Switches to another firmware mode slot. |

Each widget supports a `label` (up to 6 characters, shown on the pad) and a longer `description` shown only in the editor's properties panel.

**Fader features:**
- Variable length (2–9 pads), vertical or horizontal
- Snaps instantly to the pressed position — this part works on device (see Mega Faders mode).
- `curve_mode` (anchor pad as a slew-rate selector — instant/slow/medium/fast, shown via anchor LED color) is parsed from the JSON but **not implemented in the generator yet** — `tools/json_to_mode.py` always emits instant-snap behavior regardless of this flag. Setting it in the editor currently has no effect on device.

Save a layout as `.json` (File > Export, or copy straight from the browser) into `editor/`.

### Code Generator (`tools/json_to_mode.py`)

Converts a layout `.json` into a ready-to-compile C firmware mode:

```
python3 tools/json_to_mode.py editor/my_layout.json my_mode
```

Outputs `src/mode/user/my_mode.c` and `include/mode/user/my_mode.h`, and prints the manual registration steps (below). Generated modes trade flash for flexibility — each button gets its own unrolled case, so a fully-mapped 80-button layout can run several KB. Hand-written modes (see Performance/Programmer/Mixer-style code) use a generic handler plus a lookup table instead, at a fraction of the cost — reach for the generator for one-off/custom layouts, hand-write anything meant to be a permanent, space-efficient mode.

### Modes currently shipping

| Slot | Mode | Origin | Notes |
|---|---|---|---|
| 0 | Showcase | generated | full-grid widget demo |
| 1 | Mega Faders | generated | multi-fader layout |
| 2 | Performance | stock CFW | velocity-curve code stripped on Mini (no hardware velocity/aftertouch support) |
| 3 | Programmer | stock CFW | same |
| — | Boot | hand-written | one-shot startup animation, not user-navigable |
| — | Setup | hand-written | long-press **Stop-Solo-Mute (pad 19)** to enter; page 0 picks a mode, page 1 sets LED brightness |

Session/Drums/Keys/User (the four top-row buttons under the "Custom" silkscreen) are wired as the four `mode_switch` targets in Mega Faders, matching the physical button cluster.

### Mini-specific optimizations

- Stripped velocity-curve and aftertouch handling out of the shared Performance/Programmer code on Mini builds only (`#if defined(LPMINI)`), since the hardware has neither — saved ~600 bytes with zero functional change.
- Collapsed the mode registry from 8 slots (two unused placeholders) down to exactly the modes that are reachable.
- Moved the global hold-to-Setup gesture off the Session button onto Stop-Solo-Mute, freeing Session to double as a normal `mode_switch` target without it feeling like an awkward overload.
- Verified the chip's real flash capacity (128KB) directly via the hardware `FLASHSIZE` register rather than guessing from RAM size — ruled out a hoped-for ~128KB of "extra" flash that turned out not to exist.

## Building (Mini Mk3)

Requirements: `arm-none-eabi-gcc`, `python3`, `make`.

You need to supply the original firmware yourself (Novation does not allow redistribution):

1. Download `launchpadminimk3-firmware-407.syx` from the official Novation updater.
2. Place it at `original/launchpadminimk3-firmware-407.syx`.
3. Run `make mini`. The patched firmware is written to `build/mini-cfw.syx`.
4. Send `build/mini-cfw.syx` to the device via any SysEx tool (MIDI-OX, SysEx Librarian, Novation Components, etc.).

To rebuild after editing a layout JSON:

```bash
python3 tools/json_to_mode.py editor/mega_faders.json mega_faders
make mini
```

## Adding a new mode

1. Design the layout in `editor/index.html` and export it as `.json` into `editor/`.
2. Run the generator: `python3 tools/json_to_mode.py editor/your_layout.json your_name`
3. Register it manually:
   - Add `#define MODE_YOUR_NAME N` and `#include "mode/user/your_name.h"` to `include/mode/mode.h`
   - Add an entry to the `modes[]` array in `src/mode/mode.c`
   - Add `src/mode/user/your_name.c \` to `SRC` in the `Makefile`
   - Optionally add `{ pad_xy, MODE_YOUR_NAME }` to `selectable_modes` in `src/mode/system/setup.c` (increment `#define MODES`) so it shows up on the Setup picker page
4. `make mini`

## Repository layout (Mini-relevant parts)

```
editor/             Browser layout editor (HTML/CSS/JS, no build step)
  index.html
  app.js
  style.css
  mega_faders.json  Mega Faders mode source
  showcase.json     Showcase mode source
tools/
  json_to_mode.py   Layout-to-C code generator
src/mode/user/       Generated + hand-written modes
src/mode/system/      Boot and Setup (hand-written, not generated)
src/driver/mini/      Mini Mk3 hardware hooks, LED driver, storage/velocity stubs
linker/stm32f401_lpmini.ld   Linker script defining the injectable flash region
patches/lpmini.json   Patch addresses for the Mini Mk3 binary patcher
```

## Device Support (upstream)

The injection technique above also supports other Launchpad devices — that work belongs to upstream, not this fork. See [anthonyhfm/launchpad-injection-cfw](https://github.com/anthonyhfm/launchpad-injection-cfw) for the full device matrix (Pro Mk3, Pro Mk1, Launchpad X, Mk2). For reference, Mini Mk3's own status in that matrix:

| LEDs | Buttons | MIDI | Flash (persistent settings) | BSP |
|:----:|:-------:|:----:|:----------------------------:|:---:|
| ✅   | ✅      | ✅   | 🚧                            | 🚧  |

"Flash" here means persisting user settings/custom palettes to onboard storage across power cycles via Novation's own filesystem — unrelated to the injectable code-space budget discussed above. Pro Mk3 has this working because its stock firmware exposes that filesystem through callable functions; Mini's equivalent hasn't been reverse-engineered (or may not exist), so settings currently reset on every power cycle.

## Syncing with upstream

This fork tracks upstream on the `code` branch:

```bash
git fetch upstream
git merge upstream/code
```

Recent work here has gone well beyond additive changes — the global event routing (`app.c`), mode registry (`mode.c`/`mode.h`), Setup menu (`setup.c`), and the shared Performance/Programmer code have all been modified for Mini specifically. Expect merge conflicts in those files when pulling upstream changes, not just in the four original registration points.

## Open note to Novation (a love letter, kind of)

*From upstream's maintainer, [anthonyhfm](https://github.com/anthonyhfm):*

I love the Launchpad platform. The Lightshow community has used and supported Launchpads for years, and many of us bought newer devices expecting the same reliability and workflow.

In the specific workflows we rely on for performances, the Launchpad Pro Mk3 has been a frustrating experience. This project exists because we needed practical fixes and community-driven improvements, while still keeping the stock firmware as the underlying driver layer.

I am genuinely open to collaboration. If Novation is interested, I'm happy to share findings, repro cases, and proposals that could help improve the official firmware for performance and lightshow use-cases.

**Contact:** contact@anthonyhfm.dev

## Credits

- [anthonyhfm](https://github.com/anthonyhfm) for the injection/patching system this entire project is built on
- [aku762](https://github.com/aku762) for the Mini Mk3 editor, code generator, and size optimizations in this fork
- [Kaskobi](https://youtube.com/@kaskobi) for creating the individual boot animations for all launchpads

The creation of this project was inspired by:

- [Gabriel Valky (gabonator)](https://github.com/gabonator)
- [mat1jaczyyy](https://github.com/mat1jaczyyy)
