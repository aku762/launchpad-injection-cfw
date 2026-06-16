# Splicewerk

A visual layout editor, JSON-to-C mode generator, and a set of size optimizations built on top of [anthonyhfm/launchpad-injection-cfw](https://github.com/anthonyhfm/launchpad-injection-cfw)'s binary injection system. Currently supports the **Launchpad Mini Mk3** only — that's a scoping choice, not a design limit; the underlying injection technique works across the rest of the Launchpad family too (see Device Support below), it's just that Mini Mk3 is the only hardware on hand to actually test against.

The injection technique itself — extracting the stock firmware, splicing in custom code, hooking call sites to redirect execution — is upstream's reverse-engineering work, not ours. What this repo adds is everything on top of that foundation for one specific device: a browser editor non-programmers can use to lay out a controller surface, a generator that turns that layout into compiled C, a set of generated modes (Mix 1, Mix 2, Mega Faders, Mix Test) built with that editor/generator pair, and a string of cuts to claw back flash on a chip that only has ~15KB of injectable space to begin with.

> Note: This repository does **not** distribute Novation firmware.
> You must provide your own official `.syx` update file. Use at your own risk.

## Pipeline overview

End-to-end, a layout goes from "drawn in a browser" to "flashable file" in seven steps:

1. **Editor (`editor/index.html`, browser, no server)** — design a layout visually, export it as JSON (e.g. `editor/mixer1.json`). Separately, `editor/modes.json` is not a layout — it's the registry of which layout occupies which firmware slot (see Mode Registry below).
2. **`tools/sync_modes.py editor/modes.json`** — writes the registry into `mode.h`/`mode.c`'s generated regions and the Makefile's `USER_MODE_SRC` list, so the right `.c` files actually get compiled (see Mode Registry below).
3. **`tools/json_to_mode.py <layout>.json <id>`** — transforms one layout JSON into real C: `src/mode/user/<id>.c` + `include/mode/user/<id>.h`. Resolves any `mode_switch` buttons in that layout against whatever's currently registered in `mode.h` — which is why this runs after step 2, not before.
4. **`make mini`** — a real `arm-none-eabi-gcc`/`ld` compile-and-link of all the C (your generated modes plus the hand-written firmware glue — `app.c`, drivers, LED code, `mode.c`, etc.), placed at specific flash addresses via `linker/stm32f401_lpmini.ld`. The linker also pulls in two binary blobs (`blob_part1.o`/`blob_part2.o`) — literal byte-slices of the extracted *original* Novation firmware, split around the gap your code goes into. The output (`fw.elf`/`fw.bin`) is one continuous image — original-firmware-bytes, then your compiled code, then more original-firmware-bytes — not yet hooked together, just sitting adjacent in flash.
5. **`tools/patcher.py` + `patches/lpmini.json`** — the actual "injection": rewrites specific call instructions inside that merged binary (`app_tick_hook`, `midi_register_hook`) so the original firmware's existing code jumps into your new code. Output: `fw.patched.bin`.
6. **`tools/syxtool.py`** — wraps `fw.patched.bin` in Novation's SysEx update envelope → `build/mini-cfw.syx`, the file you actually flash to the device.
7. **`tools/bipa.py`** (side artifact) — produces `build/mini-cfw.bipa`, a binary-diff format against the original, used for distribution rather than flashing.

`make mini` runs steps 4-7 in one shot; steps 1-3 are manual (editor export + the two Python scripts) and only need re-running for whatever you actually changed.

## How the injection works

Official firmware updates ship as `.syx` files, convertible to raw `.bin` images. The extracted stock image is treated as the **base blob**: it stays largely intact and continues to provide the original drivers, device logic, and internal services.

Custom code is compiled and **injected into the existing firmware image**. Selected functions inside the stock firmware are **overridden** by patching call sites and/or function entry points to redirect execution into the injected implementations (hooks/detours).

The injected code can still call back into the original firmware functions, effectively using the stock firmware as a **driver layer** while replacing only the targeted behavior.

This repo's Mini Mk3 build patches `app_tick_hook` and `midi_register_hook` (see `patches/lpmini.json`) and lands injected code in the gap between the end of the stock firmware blob and the end of the chip's physical flash — confirmed at 128KB total via the STM32F4 hardware `FLASHSIZE` register, leaving roughly 6.2KB of working room after the stock firmware and our own infrastructure (up from ~3.8KB before the boot-animation removal, `#ifdef` stripping, and Setup-mode simplification described below — re-check `build/mini/fw.map` after any build if you need the exact current figure).

## What's here for Mini Mk3

### Visual Layout Editor (`editor/`)

A browser-based pad editor (`editor/index.html`) for designing MIDI controller layouts visually — open it directly in any browser, no server needed.

**Supported widget types:**

| Type | Description |
|------|-------------|
| `note` | Sends Note On/Off. Momentary, toggle, or trigger behavior. |
| `cc` | Sends a CC value on press/release. Momentary, toggle, or trigger. |
| `pc` | Sends a Program Change on press. |
| `fader` | Multi-pad fader with stepped CC output, optional curve-based slew rate. |
| `mode_switch` | Switches to another firmware mode slot. |

Each widget supports a `label` (up to 6 characters, shown on the pad) and a longer `description` shown only in the editor's properties panel.

**Behavior semantics for `note`/`cc`:**
- `momentary` — sends on-value while held, off-value on release; LED follows the same way.
- `toggle` — flips persistent state on press only; sends on/off value and lights on/off color based on the resulting state. State lives in `.cfw_bss` (see RAM notes below) and survives mode switches.
- `trigger` — fires the on-value once per press and never sends an off-value (no MIDI message at all on release). The LED still dims to the off color on release, purely visual, so it reads like a momentary pad without producing a spurious release message downstream.

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

Outputs `src/mode/user/my_mode.c` and `include/mode/user/my_mode.h`. If the layout has any `mode_switch` widgets, it resolves each one's target slot against the `MODE_*` macros currently registered in `include/mode/mode.h` (see Mode Registry below) and emits the symbolic macro name instead of a raw number — if a target slot isn't registered yet, it falls back to emitting the raw number and prints a warning so it's an obvious TODO rather than a silent miscompile. Generated modes trade flash for flexibility — each button gets its own unrolled case, so a fully-mapped 80-button layout can run several KB. Hand-written modes (see Performance/Programmer, currently unreachable — below) use a generic handler plus a lookup table instead, at a fraction of the cost — reach for the generator for one-off/custom layouts, hand-write anything meant to be a permanent, space-efficient mode.

### Mode Registry (`editor/modes.json` + `tools/sync_modes.py`)

Slot assignment — which mode lives in slot 0, 1, 2, etc. — is configured in one place: the editor's **Modes…** panel (toolbar button in `editor/index.html`). Add a row per mode with its display name and an `id` matching the name you pass to `json_to_mode.py`, and a slot number. This is deliberately a manual, user-controlled mapping, not something inferred from existing C or JSON state — the panel is the single source of truth.

Export the registry (Export modes.json) over `editor/modes.json`, then sync it into the firmware:

```bash
python3 tools/sync_modes.py editor/modes.json
```

This rewrites only the fenced `// BEGIN/END GENERATED MODES` regions inside `include/mode/mode.h` and `src/mode/mode.c` — the `#define MODE_*`/`#include` block in the header and the corresponding `modes[]` struct entries in the source — plus the Makefile's `USER_MODE_SRC` variable (its own `# BEGIN/END GENERATED MODE SRC` fence), so the right `.c` files actually get compiled. Boot and Setup are system-only modes (not built in the editor) and are always appended automatically right after your registered modes, at the next two free slots. Everything else — `struct Mode`, `mode_switch()`, `mode_refresh()`, the rest of the Makefile — is untouched. A mode removed from `modes.json` simply stops being compiled; its `.c`/`.h` pair stays on disk untouched until it's added back.

Once the registry is synced, the editor's `mode_switch` widget dropdown and on-pad labels automatically show real mode names/slots instead of bare numbers — and since `mode_switch()` clamps any out-of-range target to `MODE_DEFAULT` (slot 0, see RAM/flash safety notes), a layout that targets a slot you haven't registered yet degrades safely instead of bricking the device.

### Modes currently shipping

| Slot | Mode | Origin | Notes |
|---|---|---|---|
| 0 | Mix 1 | generated (`editor/mixer1.json`) | 8-channel CC mixer: one fader per channel plus 4 toggle pads |
| 1 | Mix 2 | generated (`editor/mixer2.json`) | second bank of the same layout, on its own slot/`mode_switch` target |
| 2 | Mega Faders | generated (`editor/mega_faders.json`) | larger multi-fader layout, momentary/toggle pads, `mode_switch` cluster |
| 3 | Mix Test | generated (`editor/mix_test.json`) | scratch layout exercising every generator widget/behavior combo (toggle, trigger, fader, pc, mode_switch) |
| — | Boot | hand-written, system-only | one-shot startup animation, not user-navigable |
| — | Setup | hand-written, system-only | long-press **Stop-Solo-Mute (pad 19)** to enter; single page, sets LED brightness only |

The Makefile only ever compiles `src/mode/user/<id>.c` for modes currently listed in `editor/modes.json` (`tools/sync_modes.py` writes that list into the Makefile's generated `USER_MODE_SRC` block — see Mode Registry below). Performance, Programmer, Showcase, and the original single-bank Mixer (the original hand-written/generated modes this device used to ship) all still have their `.c`/`.h` pairs sitting untouched in `src/mode/user/`/`include/mode/user/`, but none of them are compiled into the current build — they're not in `modes.json`. Bringing one back is just adding it to the Modes panel (with an `id` matching its existing filename) and re-running `sync_modes.py`; no source needs to change.

Each mode's own `mode_switch` pads target whichever of the other registered modes makes sense for that layout — see the `case` blocks in `mixer1.c`/`mixer2.c`/`mega_faders.c`/`mix_test.c` for the exact pad numbers, and `editor/mixer1.json`/`mixer2.json`/`mega_faders.json`/`mix_test.json` for how they're configured in the editor.

### Space-saving measures

Mini's injectable gap is small (~15KB) and most of it is gone once the stock-firmware hook scaffolding and a couple of generated modes are in. Everything below was cut specifically to keep that budget workable:

- **Removed the boot animation entirely** (`src/driver/mini/mini_boot.c`) — 2,613 lines of per-frame LED color tables, the single largest chunk of dead weight in this build. It also cost ~2.5s of boot time where the device looked alive but ignored all input, which made testing whatever mode it booted into more annoying than it needed to be. Mini now hands off straight into `MODE_DEFAULT` (whichever mode is in slot 0) on boot.
- **Simplified Setup down to a single brightness page** (`src/mode/system/setup.c`) — dropped the original mode-picker/palette page entirely now that mode switching is handled by `mode_switch` buttons placed directly in a layout via the editor, making a dedicated picker page redundant. Saved ~616 bytes of flash and a few bytes of RAM.
- **Stripped velocity-curve and aftertouch handling** out of the shared Performance/Programmer code on Mini builds only (`#if defined(LPMINI)`), since the hardware has neither — saved ~600 bytes with zero functional change. (Performance/Programmer aren't currently compiled at all — see Mode Registry below — but the strip still applies if either is ever added back via `modes.json`.)
- **Stripped non-Mini `#ifdef` branches** out of shared code that used to serve the whole device matrix — `sysex.c`, `conversion.c`, `palette.c`, `flash.c`, `led.c`, `app.c`/`app.h`, `driver.h`, `setup.c`, `performance.c`. None of those branches could ever execute on Mini; they were dead weight on every build.
- **Only compile what's registered** — the Makefile's mode source list (`USER_MODE_SRC`) is generated from `editor/modes.json`, so Performance/Programmer/Showcase/the original Mixer aren't compiled into the build at all right now, not just unregistered-but-linked. Their `.c`/`.h` files stay on disk untouched and are picked back up automatically the moment they're added back to the Modes panel.
- **Removed the lpp/lppmk3/lpx/mk2 device drivers, linker scripts, patch configs, and prebuilt binaries** from the repo entirely — this fork only ever targets Mini Mk3, and none of that ever built into the Mini image, but keeping it around was pure repo noise.
- **Moved the global hold-to-Setup gesture** off the Session button onto Stop-Solo-Mute, freeing Session to double as a normal `mode_switch` target without it feeling like an awkward overload. (Not a flash saving, but bundled with the rest of this pass.)
- **Verified the chip's real flash capacity** (128KB) directly via the hardware `FLASHSIZE` register rather than guessing from RAM size — ruled out a hoped-for ~128KB of "extra" flash that turned out not to exist.

### RAM safety on Mini

Mini's injected code patches into the **already-running** stock firmware rather than replacing it outright (unlike upstream's other targets, which get full linker-controlled RAM). Two consequences fall out of that:

1. **Plain `.bss` is shared, live RAM** — the same bytes the stock firmware was using before handoff, and its own `FW_TICK()` keeps running every tick after handoff too. Nothing zeroes that region for free, and the stock firmware can still write into it. `CFW_AppTick` (`src/driver/mini/mini_hooks.c`) explicitly zeroes plain `.bss` exactly once via `cfw_runtime_init_once()`, guarded by a magic-number pair (not a plain flag, since the guard itself can't rely on starting at zero — see point 2) stored in `.cfw_bss`.
2. **`.cfw_bss`** is a separate, dedicated region (`CFW_RAM`, `linker/stm32f401_lpmini.ld`) that the stock firmware never touches — but it is *never zero-initialized by anything*. Anything placed there must be explicitly set before use.

The practical rule this produces: mutable per-mode state that must survive mode switches without being clobbered by the stock firmware (`toggle[]`, fader position arrays) belongs in `.cfw_bss`, explicitly zeroed once by a `mode_initialized` guard — but that guard itself must stay in plain `.bss`, since it depends on actually starting at zero on the very first boot. Putting the guard in `.cfw_bss` was tried and immediately regressed (garbage-true guard skips the zero pass, mode reopens with garbage toggle/fader state) — `tools/json_to_mode.py`'s generator and the hand-written mode files all follow the corrected split now.

`CFW_AppTick` also gates `app_init()` behind confirming that **both** a press and a release callback were actually installed in the stock firmware's button table (`g_type_hooked[0] && g_type_hooked[2]`), not just that the table has any entries — on a cold boot the table can be transiently non-empty before the stock firmware finishes populating it, which used to false-positive and permanently skip retrying.

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

1. Open `editor/index.html`, click **Modes…**, and add a row for the new mode — pick a free slot, a display name, and an `id` (this is the name you'll pass to the generator in step 3). Export modes.json over `editor/modes.json`.
2. Sync the registry into the firmware: `python3 tools/sync_modes.py editor/modes.json` — this rewrites the generated regions of `include/mode/mode.h`, `src/mode/mode.c`, and the Makefile's `USER_MODE_SRC` for you, so `your_id.c` is now part of the build.
3. Design the layout in the editor and export it as `.json` into `editor/`. Run the generator: `python3 tools/json_to_mode.py editor/your_layout.json your_id` (use the same `id` from step 1). Any `mode_switch` widgets in the layout resolve automatically against the now-synced `mode.h`.
4. `make mini`

## Repository layout (Mini-relevant parts)

```
editor/             Browser layout editor (HTML/CSS/JS, no build step)
  index.html
  app.js
  style.css
  modes.json        Mode registry: slot -> name/id, edited via the Modes… panel
  mixer1.json       Mix 1 mode source (registered, slot 0)
  mixer2.json       Mix 2 mode source (registered, slot 1)
  mega_faders.json  Mega Faders mode source (registered, slot 2)
  mix_test.json     Mix Test mode source (registered, slot 3)
  mixer.json, showcase.json, basic.json, demo.json, one_fader.json   unregistered example/scratch layouts — not currently compiled
tools/
  json_to_mode.py   Layout-to-C code generator
  sync_modes.py     Writes editor/modes.json's slot assignment into mode.h/mode.c/Makefile
src/mode/user/       Generated + hand-written modes — only files for modes currently in editor/modes.json are compiled
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

## Credits

- [anthonyhfm](https://github.com/anthonyhfm) for the injection/patching system this entire project is built on
- [aku762](https://github.com/aku762) for the Mini Mk3 editor, code generator, and size optimizations in this fork
- [Kaskobi](https://youtube.com/@kaskobi) originally created the per-device boot animations upstream; Mini's copy was removed in this fork (see Space-saving measures above) but the credit stands for the work itself
