# Ideas / Roadmap

## ✅ 1. Verify timer tick rate
Confirmed: `timer_event()` fires at **1ms per tick** (1kHz), measured via a toggle mode outputting CC every 1000 ticks = 1000ms interval.

## 2. Multi-level faders + ping-pong
Each pad has N sub-levels cycling through it on repeated press.
- Adds `levels` field to fader widget (default 1 = current behavior)
- Ping-pong: bounce direction at extremes instead of wrapping (avoids 127→120 jump)
- State: `fader_sublevel[fi]` + `fader_dir[fi]` (~2 bytes per fader)
- Value calc: `min + (throw_pos * levels + sublevel) * (max - min) / (length * levels - 1)`
- Fine resolution on tight ranges (e.g. min=80 max=127 + levels=3 = ~2 CC per step)

## ✅ 3. MIDI feedback (incoming CC updates fader display)
Implemented. `midi_event` routes incoming `0xBx` CC messages through `handle_fader_cc`, updating display and `cc_state` for all faders sharing the same channel+CC. Faders on different mode pages auto-sync on next entry via the global `cc_state` table.

## ✅ 4. `lfo` widget
Implemented. Timer-driven oscillating dot on a row of pads (triangle wave). Rate controlled by an assignable CC read live from `cc_state` — point any fader or external CC source at the same channel+CC to control speed in real time. CC=0 = stopped. Steps through pad positions so every pad gets equal dwell time. Separate tick queue (`lfo_tick`) from the fade queue (`fader_tick`). LFO output writes to `cc_state`, so a fader widget on the same CC will display the LFO position live.

## ✅ 5. `smooth_fader` + `curve_btn` (was `lfo_rate` companion button)
Implemented as two widget types:

**`smooth_fader`** — like `fader` but touch sets a target; the global automation queue (see below) steps CC and LEDs toward it smoothly.
- `smooth_group` field assigns which `curve_btn` controls this fader's rate
- Full throw range preserved (no pads repurposed for rate control)

**`curve_btn`** — standalone pad that cycles rate presets for its `smooth_group`.
- 1–4 configurable rates, each with a `ms` (full-sweep duration) and `color`
- Default: white (127ms) → green (508ms) → yellow (2032ms) → red (8001ms)
- Multiple faders share one button via matching `smooth_group` ID
- Color configurable per-rate in the editor

**Global fade queue** (`src/utils/fader.c`):
- `fader_tick()` fires from `CFW_AppTick` every 1ms — independently of which mode is active
- Each entry stores its own `ticks_per_step` locked at fade initiation — changing the rate mid-fade only affects new fades
- MIDI CC is sent at every step; `cc_state` stays current so all modes see correct position on re-entry
- External incoming CC cancels the fade and jumps immediately
- Fades survive mode page switches

## 6. RAM shadow config (runtime-mutable widget params)
`FaderRuntimeCfg` array copied from const flash defaults at init, mutable during session.
- Allows live parameter changes without reflash
- Session-only (resets to compiled defaults on power cycle) — intentional, not a bug

## 7. Long-hold setup mode per widget
Long-hold any pad on a smooth/lfo fader enters per-widget config mode.
- Nav up/down: cycle rate presets live
- Nav left/right: change CC number live
- Exit on timeout or any other press
- Turns the Mini into a self-configuring instrument — no computer needed to reassign targets

## 8. `fader_bipolar` widget
Manual bipolar fader — fill extends from center pad outward.
- `color_pos` / `color_neg` for above/below center
- Center value derived as `(min + max) / 2` or explicit `"center_value"` field
- Multi-level + ping-pong applies naturally

## 9. Fader zoom mode
Dedicated pad (e.g. bottom of column) zooms the fader into a tight range around the current value.
- `zoom_span` config field — how many CC values the zoomed view covers (e.g. 16 = ±8 from current)
- `zoom_anchor` stored at zoom entry — center of the window
- Full pad resolution now maps to `zoom_anchor ± zoom_span/2`
- Stacks with multi-level: 8 pads × 3 levels over 16 CC values ≈ sub-integer CC stepping
- Exit on second bottom-pad press or timeout
- State: `fader_zoomed` flag + `zoom_anchor` value per fader

## 10. Flash persistence (future)
Implement `driver_write_flash` / `driver_read_flash` in `mini_storage.c`.
- Requires finding a spare STM32F401 flash page outside CFW region
- Page-erase must happen off-tick to avoid glitches
- Not blocking any of the above

## 11. Multi-device linking
Ch16 as control channel — stack two Mini Mk3 units and have one mirror or extend the other's fader layout.
- Unit A sends ch16 CC on pad press; Unit B listens on ch16 and maps to its own faders
- No extra hardware; pure MIDI routing via a DAW or merge box
- Could allow a 16-channel mixer from two units side by side