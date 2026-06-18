#!/usr/bin/env python3
"""
json_to_mode.py  - Convert a Splicewerk Editor JSON layout to a C mode.

Usage:
    python3 tools/json_to_mode.py <layout.json> [mode_name]

Outputs:
    src/mode/user/<mode_name>.c
    include/mode/user/<mode_name>.h

Then follow the printed instructions to register the mode.
"""

import json
import os
import re
import sys

NOTE_NAMES     = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
DIRECTION_STEP = {'up': 10, 'down': -10, 'right': 1, 'left': -1}
MODE_H_PATH    = os.path.join('include', 'mode', 'mode.h')


def load_mode_registry(path=MODE_H_PATH):
    """Map slot number -> MODE_* macro name, read straight out of mode.h.

    This is the single source of truth for slot assignment, so generated
    mode_switch() targets can reference modes by name instead of by a raw
    number that has to be hand-checked against mode.h after every build.
    """
    registry = {}
    if not os.path.isfile(path):
        return registry
    with open(path) as f:
        for line in f:
            m = re.match(r'\s*#define\s+(MODE_\w+)\s+(\d+)', line)
            if m:
                registry[int(m.group(2))] = m.group(1)
    return registry

def note_label(n):
    return NOTE_NAMES[n % 12] + str(n // 12 - 2)

def hex_c(h):
    return '0x' + h.lstrip('#').upper()

def midi_ch(channel):
    """Editor stores 1-based; 0 = global (treat as ch 1 = index 0)."""
    return max(0, int(channel) - 1)

def send(status, d1, d2):
    # Routed through the shared send_midi3() helper (see generate()) instead
    # of inlining a (uint8_t[]){...} compound literal at every call site —
    # with 80+ widgets in a layout, the duplicated array-setup code is what
    # blows the flash budget.
    return f'send_midi3({status:#04X}, {d1}, {d2});'

def fader_value_at(pos, throw_count, min_val, max_val):
    """Precompute the exact CC value for throw position pos (0-indexed)."""
    if throw_count <= 1 or pos == 0:
        return min_val
    if pos >= throw_count - 1:
        return max_val
    return min_val + pos * (max_val - min_val) // (throw_count - 1)


# ── Non-fader surface cases ──────────────────────────────────────────────────

def gen_surface_case(xy, b, mode_registry, unresolved_targets):
    btype    = b['type']
    ch       = midi_ch(b.get('channel', 1))
    color_on  = hex_c(b.get('color_on',  '#ffffff'))
    color_off = hex_c(b.get('color_off', '#000000'))
    behavior  = b.get('behavior', 'momentary')

    lines = [f'        case {xy}:']

    if btype == 'note':
        note = int(b.get('note', 60))
        s    = 0x90 | ch
        if behavior == 'momentary':
            lines += [
                f'            if (type) {{',
                f'                {send(s, note, "value")}',
                f'                set_led({xy}, {color_on});',
                f'            }} else {{',
                f'                {send(s, note, 0)}',
                f'                set_led({xy}, {color_off});',
                f'            }}',
            ]
        elif behavior == 'toggle':
            lines += [
                f'            if (type) {{',
                f'                toggle[{xy}] ^= 1;',
                f'                if (toggle[{xy}]) {{',
                f'                    {send(s, note, 127)}',
                f'                    set_led({xy}, {color_on});',
                f'                }} else {{',
                f'                    {send(s, note, 0)}',
                f'                    set_led({xy}, {color_off});',
                f'                }}',
                f'            }}',
            ]
        else:  # trigger - fires once on press, no release message, but still
                # dims back to color_off on release (visual only, like momentary)
            lines += [
                f'            if (type) {{',
                f'                {send(s, note, "value")}',
                f'                set_led({xy}, {color_on});',
                f'            }} else {{',
                f'                set_led({xy}, {color_off});',
                f'            }}',
            ]

    elif btype == 'cc':
        cc      = int(b.get('cc', 0))
        val_on  = int(b.get('value_on', 127))
        val_off = int(b.get('value_off', 0))
        s       = 0xB0 | ch
        if behavior == 'momentary':
            lines += [
                f'            if (type) {{',
                f'                {send(s, cc, val_on)}',
                f'                set_led({xy}, {color_on});',
                f'            }} else {{',
                f'                {send(s, cc, val_off)}',
                f'                set_led({xy}, {color_off});',
                f'            }}',
            ]
        elif behavior == 'toggle':
            lines += [
                f'            if (type) {{',
                f'                toggle[{xy}] ^= 1;',
                f'                if (toggle[{xy}]) {{',
                f'                    {send(s, cc, val_on)}',
                f'                    set_led({xy}, {color_on});',
                f'                }} else {{',
                f'                    {send(s, cc, val_off)}',
                f'                    set_led({xy}, {color_off});',
                f'                }}',
                f'            }}',
            ]
        else:  # trigger - fires once on press, no release message, but still
                # dims back to color_off on release (visual only, like momentary)
            lines += [
                f'            if (type) {{',
                f'                {send(s, cc, val_on)}',
                f'                set_led({xy}, {color_on});',
                f'            }} else {{',
                f'                set_led({xy}, {color_off});',
                f'            }}',
            ]

    elif btype == 'pc':
        program = int(b.get('program', 0))
        s       = 0xC0 | ch
        lines += [
            f'            if (type) {{',
            f'                {send(s, program, 0)}',
            f'                set_led({xy}, {color_on});',
            f'            }} else {{',
            f'                set_led({xy}, {color_off});',
            f'            }}',
        ]

    elif btype == 'mode_switch':
        target = int(b.get('target_mode', 0))
        target_str = mode_registry.get(target)
        if target_str is None:
            # Not in mode.h yet (e.g. this mode isn't registered, or the
            # layout targets a slot that doesn't exist) - emit the raw
            # number so it's still obviously a manual TODO, not silently
            # wrong.
            target_str = str(target)
            unresolved_targets.append((xy, target))
        lines += [
            f'            if (type) mode_switch({target_str});',
        ]

    lines.append('            break;')
    return lines


# ── Fader extraction ─────────────────────────────────────────────────────────

def extract_faders(layout):
    """Parse all fader entries. Returns (faders_list, set_of_all_fader_xys)."""
    faders    = []
    fader_xys = set()

    for xy_str, b in layout.items():
        if b['type'] != 'fader':
            continue
        xy         = int(xy_str)
        step       = DIRECTION_STEP.get(b.get('direction', 'up'), 10)
        length     = int(b.get('length', 4))
        curve_mode = bool(b.get('curve_mode', False))
        min_val    = int(b.get('min_value', 0))
        max_val    = int(b.get('max_value', 127))
        cc         = int(b.get('cc', 0))
        ch         = midi_ch(b.get('channel', 1))

        # Always treat all pads as throw pads (no curve_mode in generated code)
        throw_count = length
        values     = [fader_value_at(i, throw_count, min_val, max_val)
                      for i in range(throw_count)]
        throw_pads = [xy + i * step for i in range(throw_count)]
        all_pads   = throw_pads

        faders.append({
            'idx':         len(faders),
            'anchor_xy':   xy,
            'length':      length,
            'pad_step':    step,
            'cc':          cc,
            'channel':     ch,
            'min_value':   min_val,
            'max_value':   max_val,
            'color_on':    hex_c(b.get('color_on',  '#33cccc')),
            'color_off':   hex_c(b.get('color_off', '#000000')),
            'throw_count': throw_count,
            'values':      values,
            'throw_pads':  throw_pads,
            'all_pads':    all_pads,
        })
        fader_xys.update(all_pads)

    return faders, fader_xys


# ── Code block generators ─────────────────────────────────────────────────────

def gen_fader_struct():
    # Injection firmware has no .data initializer — split into const config
    # (goes to .rodata in flash, always correct) and a separate runtime current[]
    # that is explicitly set in init().
    return [
        'typedef struct {',
        '    uint8_t  anchor_xy;',
        '    uint8_t  length;',
        '    int8_t   pad_step;',
        '    uint8_t  cc;',
        '    uint8_t  channel;',
        '    uint8_t  min_value;',
        '    uint8_t  max_value;',
        '    uint32_t color_on;',
        '    uint32_t color_off;',
        '} FaderCfg;',
    ]


def gen_update_fader_leds():
    # fill is the exact throw position (0-indexed), passed directly by the
    # caller — never re-derived from the MIDI value, since that round-trip
    # through fader_value_at()'s integer division loses precision and lights
    # the segment one behind the one actually pressed.
    return [
        'static void update_fader_leds(uint8_t fi, uint8_t fill) {',
        '    const FaderCfg *f = &FADERS[fi];',
        '    for (uint8_t i = 0; i < f->length; i++) {',
        '        uint8_t pad = (uint8_t)((int)f->anchor_xy + i * f->pad_step);',
        '        set_led(pad, (i <= fill) ? f->color_on : f->color_off);',
        '    }',
        '}',
    ]


# ── Main generator ────────────────────────────────────────────────────────────

def generate(layout, name):
    mode_registry = load_mode_registry()
    unresolved_targets = []

    faders, fader_xys = extract_faders(layout)
    has_faders = len(faders) > 0

    non_fader = {xy_str: b for xy_str, b in layout.items()
                 if int(xy_str) not in fader_xys}

    has_toggle = any(b.get('behavior') == 'toggle' for b in non_fader.values())

    sorted_non_fader = sorted(non_fader.items(), key=lambda kv: int(kv[0]))

    c = []
    c.append(f'/* {name}.c - generated by tools/json_to_mode.py */')
    c.append(f'#include <mode/user/{name}.h>')
    c.append(f'#include <mode/mode.h>')
    c.append(f'#include <led/led.h>')
    c.append(f'#include <driver/driver.h>')
    c.append('')

    c.append('static void send_midi3(uint8_t status, uint8_t d1, uint8_t d2) {')
    c.append('    uint8_t buf[3] = { status, d1, d2 };')
    c.append('    driver_send_midi(1, buf, 3);')
    c.append('}')
    c.append('')

    if has_toggle:
        # Plain .bss on Mini shares physical RAM the stock firmware keeps
        # using after handoff (see mini_hooks.c) — anything mutable that
        # needs to survive across mode switches must live in .cfw_bss
        # instead, or the stock firmware's own tick will eventually
        # clobber it.
        c.append('__attribute__((section(".cfw_bss"))) static uint8_t toggle[100];')
        c.append('')

    if has_faders:
        c += gen_fader_struct()
        c.append('')

        # const config table — lives in .rodata (flash), no startup copy needed
        c.append(f'#define N_FADERS {len(faders)}')
        c.append(f'static const FaderCfg FADERS[N_FADERS] = {{')
        for f in faders:
            c.append(f'    {{')
            c.append(f'        .anchor_xy  = {f["anchor_xy"]},')
            c.append(f'        .length     = {f["length"]},')
            c.append(f'        .pad_step   = {f["pad_step"]},')
            c.append(f'        .cc         = {f["cc"]},')
            c.append(f'        .channel    = {f["channel"]},')
            c.append(f'        .min_value  = {f["min_value"]},')
            c.append(f'        .max_value  = {f["max_value"]},')
            c.append(f'        .color_on   = {f["color_on"]},')
            c.append(f'        .color_off  = {f["color_off"]},')
            c.append(f'    }},')
        c.append(f'}};')
        c.append('')
        # mutable runtime state — explicitly set in init(), no .data init needed.
        # Must live in .cfw_bss, not plain .bss (see toggle[] comment above).
        c.append(f'__attribute__((section(".cfw_bss"))) static uint8_t fader_current[N_FADERS];')
        c.append(f'__attribute__((section(".cfw_bss"))) static uint8_t fader_fill[N_FADERS];')
        # bitfield: bit i set once fader i has received its first CC (via touch or external MIDI).
        # uint32_t supports up to 32 faders.
        c.append(f'__attribute__((section(".cfw_bss"))) static uint32_t fader_activated;')
        c.append('')
        c += gen_update_fader_leds()
        c.append('')
        c.append('static void handle_fader_cc(uint8_t channel, uint8_t cc, uint8_t value) {')
        c.append('    for (uint8_t fi = 0; fi < N_FADERS; fi++) {')
        c.append('        const FaderCfg *f = &FADERS[fi];')
        c.append('        if (f->channel != channel || f->cc != cc) continue;')
        c.append('        fader_current[fi] = value;')
        c.append('        fader_activated |= (1u << fi);')
        c.append('        if (value < f->min_value) {')
        c.append('            fader_fill[fi] = 0;')
        c.append('            for (uint8_t i = 0; i < f->length; i++)')
        c.append('                set_led((uint8_t)((int)f->anchor_xy + i * f->pad_step), f->color_off);')
        c.append('        } else if (value >= f->max_value) {')
        c.append('            fader_fill[fi] = (uint8_t)(f->length - 1u);')
        c.append('            update_fader_leds(fi, (uint8_t)(f->length - 1u));')
        c.append('        } else {')
        c.append('            uint8_t best = 0, best_diff = 255;')
        c.append('            for (uint8_t t = 0; t < f->length; t++) {')
        c.append('                uint8_t cv = (t == 0) ? f->min_value :')
        c.append('                             (t >= f->length - 1u) ? f->max_value :')
        c.append('                             (uint8_t)(f->min_value + t * (f->max_value - f->min_value) / (f->length - 1u));')
        c.append('                uint8_t diff = (value >= cv) ? (value - cv) : (cv - value);')
        c.append('                if (diff < best_diff) { best_diff = diff; best = t; }')
        c.append('            }')
        c.append('            fader_fill[fi] = best;')
        c.append('            update_fader_leds(fi, best);')
        c.append('        }')
        c.append('    }')
        c.append('}')
        c.append('')

    # ── init ────────────────────────────────────────────────────────────────
    # Re-entering a mode (switching away and back) must not reset toggle/fader
    # state — only the very first activation should apply defaults. A static
    # guard (zero by default, like every other uninitialized global here)
    # tracks that per mode. Every call still redraws LEDs from current state.
    c.append(f'void {name}_init() {{')
    if has_toggle or has_faders:
        # This guard must stay in plain .bss, NOT .cfw_bss: plain .bss is
        # explicitly zeroed once by cfw_runtime_init_once() (see mini_hooks.c),
        # while .cfw_bss is never zeroed by anything and starts as garbage. A
        # garbage-nonzero guard here would skip the toggle/fader zero-init below.
        c.append('    static uint8_t mode_initialized;')
        c.append('    if (!mode_initialized) {')
        if has_toggle:
            c.append('        for (int i = 0; i < 100; i++) toggle[i] = 0;')
        if has_faders:
            c.append('        for (uint8_t i = 0; i < N_FADERS; i++) {')
            c.append('            fader_current[i] = FADERS[i].min_value;')
            c.append('            fader_fill[i] = 0;')
            c.append('        }')
            c.append('        fader_activated = 0;')
        c.append('        mode_initialized = 1;')
        c.append('    }')
    for xy_str, b in sorted_non_fader:
        xy = int(xy_str)
        if b.get('behavior') == 'toggle':
            color_on  = hex_c(b.get('color_on',  '#ffffff'))
            color_off = hex_c(b.get('color_off', '#000000'))
            c.append(f'    set_led({xy}, toggle[{xy}] ? {color_on} : {color_off});')
        else:
            c.append(f'    set_led({xy}, {hex_c(b.get("color_off", "#000000"))});')
    if has_faders:
        c.append('    for (uint8_t i = 0; i < N_FADERS; i++) {')
        c.append('        if (fader_activated & (1u << i)) {')
        c.append('            update_fader_leds(i, fader_fill[i]);')
        c.append('        } else {')
        c.append('            const FaderCfg *f = &FADERS[i];')
        c.append('            for (uint8_t j = 0; j < f->length; j++)')
        c.append('                set_led((uint8_t)((int)f->anchor_xy + j * f->pad_step), f->color_off);')
        c.append('        }')
        c.append('    }')
    c.append('}')
    c.append('')

    # ── timer_event ─────────────────────────────────────────────────────────
    c.append(f'void {name}_timer_event() {{ }}')
    c.append('')

    # ── surface_event ────────────────────────────────────────────────────────
    c.append(f'void {name}_surface_event(uint8_t type, uint8_t index, uint8_t value) {{')
    c.append('    switch (index) {')

    for xy_str, b in sorted_non_fader:
        for line in gen_surface_case(int(xy_str), b, mode_registry, unresolved_targets):
            c.append(line)

    if has_faders:
        c.append('        default:')
        c.append('            if (type) {')
        c.append('                for (uint8_t fi = 0; fi < N_FADERS; fi++) {')
        c.append('                    const FaderCfg *f = &FADERS[fi];')
        c.append('                    int16_t delta = (int16_t)index - (int16_t)f->anchor_xy;')
        c.append('                    int8_t  step  = f->pad_step;')
        c.append('                    uint8_t throw_pos;')
        c.append('                    if (step > 0) {')
        c.append('                        if (delta < 0 || delta >= (int16_t)f->length * step || delta % step != 0) continue;')
        c.append('                        throw_pos = (uint8_t)(delta / step);')
        c.append('                    } else {')
        c.append('                        if (delta > 0 || delta <= (int16_t)f->length * step || (-delta) % (-step) != 0) continue;')
        c.append('                        throw_pos = (uint8_t)((-delta) / (-step));')
        c.append('                    }')
        c.append('                    uint8_t val = (throw_pos == 0) ? f->min_value :')
        c.append('                                  (throw_pos >= f->length - 1u) ? f->max_value :')
        c.append('                                  (uint8_t)(f->min_value + throw_pos * (f->max_value - f->min_value) / (f->length - 1u));')
        c.append('                    handle_fader_cc(f->channel, f->cc, val);')
        c.append('                    send_midi3((uint8_t)(0xB0 | f->channel), f->cc, val);')
        c.append('                    return;')
        c.append('                }')
        c.append('            }')
        c.append('            break;')
    else:
        c.append('        default: break;')
    c.append('    }')
    # Suppress unused warning when no note momentary/trigger buttons present
    uses_value = any(
        b['type'] == 'note' and b.get('behavior', 'momentary') in ('momentary', 'trigger')
        for b in non_fader.values()
    )
    if not uses_value:
        c.append('    (void)value;')
    c.append('}')
    c.append('')

    # ── midi_event ───────────────────────────────────────────────────────────
    c.append(f'void {name}_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2) {{')
    c.append('    (void)port;')
    if has_faders:
        c.append('    if ((status & 0xF0) == 0xB0)')
        c.append('        handle_fader_cc((uint8_t)(status & 0x0F), d1, d2);')
    else:
        c.append('    (void)status; (void)d1; (void)d2;')
    c.append('}')
    c.append('')

    # ── aftertouch stub ──────────────────────────────────────────────────────
    c.append(f'void {name}_aftertouch_event(uint8_t index, uint8_t value) {{')
    c.append('    (void)index; (void)value;')
    c.append('}')
    c.append('')

    c_src = '\n'.join(c)

    # ── .h file ──────────────────────────────────────────────────────────────
    guard = name.upper() + '_H'
    h = [
        f'#ifndef {guard}',
        f'#define {guard}',
        '',
        '#include <stdint.h>',
        '',
        f'void {name}_init();',
        f'void {name}_timer_event();',
        f'void {name}_surface_event(uint8_t type, uint8_t index, uint8_t value);',
        f'void {name}_midi_event(uint8_t port, uint8_t status, uint8_t d1, uint8_t d2);',
        f'void {name}_aftertouch_event(uint8_t index, uint8_t value);',
        '',
        f'#endif',
    ]
    h_src = '\n'.join(h)

    return c_src, h_src, unresolved_targets


def sanitize_name(s):
    s = os.path.splitext(os.path.basename(s))[0]
    s = re.sub(r'[^a-zA-Z0-9_]', '_', s).lower()
    if s[0].isdigit():
        s = '_' + s
    return s


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    json_path = sys.argv[1]
    name      = sys.argv[2] if len(sys.argv) > 2 else sanitize_name(json_path)

    with open(json_path) as f:
        layout = json.load(f)

    c_src, h_src, unresolved_targets = generate(layout, name)

    c_out = os.path.join('src',     'mode', 'user', f'{name}.c')
    h_out = os.path.join('include', 'mode', 'user', f'{name}.h')

    with open(c_out, 'w') as f: f.write(c_src)
    with open(h_out, 'w') as f: f.write(h_src)

    print(f'Generated:')
    print(f'  {c_out}')
    print(f'  {h_out}')
    print()

    if unresolved_targets:
        print('--- WARNING: unresolved mode_switch targets ----------------------')
        print()
        print("These target slot numbers aren't in include/mode/mode.h yet -")
        print('emitted as raw numbers and need hand-patching once the target')
        print('mode is registered (mode_switch() has no bounds check):')
        for xy, target in unresolved_targets:
            print(f'  pad {xy}: mode_switch({target})')
        print()
    print('--- Register the mode -------------------------------------------')
    print()
    print('1. include/mode/mode.h  - add before the struct definition:')
    print(f'   #include "mode/user/{name}.h"')
    print()
    print('2. src/mode/mode.c  - add an entry to the modes[] array:')
    print(f'   {{')
    print(f'       .name              = "{name}",')
    print(f'       .color             = 0x00ff88,')
    print(f'       .color_dimmed      = 0x003322,')
    print(f'       .init              = {name}_init,')
    print(f'       .timer_event       = {name}_timer_event,')
    print(f'       .surface_event     = {name}_surface_event,')
    print(f'       .midi_event        = {name}_midi_event,')
    print(f'       .aftertouch_event  = {name}_aftertouch_event,')
    print(f'   }},')
    print()
    print('3. Makefile  - add the source file:')
    print(f'   src/mode/user/{name}.c \\')
    print()
    print('Then run:  make mini')


if __name__ == '__main__':
    main()
