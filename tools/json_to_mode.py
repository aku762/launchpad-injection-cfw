#!/usr/bin/env python3
"""
json_to_mode.py  - Convert a Launchpad CFW Editor JSON layout to a C mode.

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

def note_label(n):
    return NOTE_NAMES[n % 12] + str(n // 12 - 2)

def hex_c(h):
    return '0x' + h.lstrip('#').upper()

def midi_ch(channel):
    """Editor stores 1-based; 0 = global (treat as ch 1 = index 0)."""
    return max(0, int(channel) - 1)

def send(status, d1, d2):
    return f'driver_send_midi(1, (uint8_t[]){{{status:#04X}, {d1}, {d2}}}, 3);'

def fader_value_at(pos, throw_count, min_val, max_val):
    """Precompute the exact CC value for throw position pos (0-indexed)."""
    if throw_count <= 1 or pos == 0:
        return min_val
    if pos >= throw_count - 1:
        return max_val
    return min_val + pos * (max_val - min_val) // (throw_count - 1)


# ── Non-fader surface cases ──────────────────────────────────────────────────

def gen_surface_case(xy, b):
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
        else:  # trigger
            lines += [
                f'            if (type) {{',
                f'                {send(s, note, "value")}',
                f'                set_led({xy}, {color_on});',
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
        else:  # trigger
            lines += [
                f'            if (type) {{',
                f'                {send(s, cc, val_on)}',
                f'                set_led({xy}, {color_on});',
                f'            }}',
            ]

    elif btype == 'pc':
        program = int(b.get('program', 0))
        s       = 0xC0 | ch
        lines += [
            f'            if (type) {{',
            f'                {send(s, program, 0)}',
            f'                set_led({xy}, {color_on});',
            f'            }}',
        ]

    elif btype == 'mode_switch':
        target = int(b.get('target_mode', 0))
        lines += [
            f'            if (type) mode_switch({target});',
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

        throw_start = 1 if curve_mode else 0
        throw_count = length - throw_start

        values     = [fader_value_at(i, throw_count, min_val, max_val)
                      for i in range(throw_count)]
        throw_pads = [xy + (throw_start + i) * step for i in range(throw_count)]
        all_pads   = [xy + i * step for i in range(length)]

        faders.append({
            'idx':         len(faders),
            'anchor_xy':   xy,
            'length':      length,
            'pad_step':    step,
            'cc':          cc,
            'channel':     ch,
            'min_value':   min_val,
            'max_value':   max_val,
            'curve_mode':  int(curve_mode),
            'color_on':    hex_c(b.get('color_on',  '#33cccc')),
            'color_off':   hex_c(b.get('color_off', '#000000')),
            'throw_start': throw_start,
            'throw_count': throw_count,
            'values':      values,
            'throw_pads':  throw_pads,
            'all_pads':    all_pads,
        })
        fader_xys.update(all_pads)

    return faders, fader_xys


# ── Code block generators ─────────────────────────────────────────────────────

def gen_fader_struct():
    return [
        'typedef struct {',
        '    uint8_t  anchor_xy;',
        '    uint8_t  length;',
        '    int8_t   pad_step;',
        '    uint8_t  cc;',
        '    uint8_t  channel;',
        '    uint8_t  min_value;',
        '    uint8_t  max_value;',
        '    uint8_t  curve_mode;',
        '    uint32_t color_on;',
        '    uint32_t color_off;',
        '    /* runtime state (reset in init) */',
        '    uint8_t  current;',
        '    uint8_t  target;',
        '    uint8_t  rate;',
        '    uint8_t  timer_accum;',
        '} Fader;',
    ]


def gen_update_fader_leds():
    return [
        '/* Rate colors: instant=white  1-bar=green  4-bar=yellow  16-bar=red */',
        'static const uint32_t RATE_COLORS[4] = { 0xFFFFFF, 0x22CC44, 0xCCCC00, 0xCC2222 };',
        '',
        'static void update_fader_leds(Fader *f) {',
        '    uint8_t throw_start = f->curve_mode ? 1 : 0;',
        '    uint8_t throw_count = f->length - throw_start;',
        '    uint8_t fill = 0;',
        '    uint8_t range = f->max_value - f->min_value;',
        '    if (range > 0 && throw_count > 1) {',
        '        fill = (uint8_t)((uint16_t)(f->current - f->min_value)',
        '                         * (throw_count - 1) / range);',
        '    } else if (f->current >= f->max_value) {',
        '        fill = throw_count > 0 ? throw_count - 1 : 0;',
        '    }',
        '    for (uint8_t i = 0; i < throw_count; i++) {',
        '        uint8_t pad = (uint8_t)((int)f->anchor_xy',
        '                                + (throw_start + i) * f->pad_step);',
        '        set_led(pad, (i <= fill) ? f->color_on : f->color_off);',
        '    }',
        '    if (f->curve_mode) {',
        '        set_led(f->anchor_xy, RATE_COLORS[f->rate]);',
        '    }',
        '}',
    ]


# ── Main generator ────────────────────────────────────────────────────────────

def generate(layout, name):
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

    if has_toggle:
        c.append('static uint8_t toggle[100];')
        c.append('')

    if has_faders:
        c += gen_fader_struct()
        c.append('')
        c += gen_update_fader_leds()
        c.append('')

        # Rate tables
        c.append('/* Timer divisors per rate (tune if timer freq differs from ~360 Hz): */')
        c.append('/* rate 0=instant  1=~1 bar@120bpm  2=~4 bars  3=~16 bars           */')
        c.append('static const uint8_t  TIMER_DIV[4]   = {  0,   6,  24,  96 };')
        c.append('')

        # Fader array
        c.append(f'#define N_FADERS {len(faders)}')
        c.append(f'static Fader faders[N_FADERS] = {{')
        for f in faders:
            c.append(f'    {{')
            c.append(f'        .anchor_xy  = {f["anchor_xy"]},')
            c.append(f'        .length     = {f["length"]},')
            c.append(f'        .pad_step   = {f["pad_step"]},')
            c.append(f'        .cc         = {f["cc"]},')
            c.append(f'        .channel    = {f["channel"]},')
            c.append(f'        .min_value  = {f["min_value"]},')
            c.append(f'        .max_value  = {f["max_value"]},')
            c.append(f'        .curve_mode = {f["curve_mode"]},')
            c.append(f'        .color_on   = {f["color_on"]},')
            c.append(f'        .color_off  = {f["color_off"]},')
            c.append(f'    }},')
        c.append(f'}};')
        c.append('')

    # ── init ────────────────────────────────────────────────────────────────
    c.append(f'void {name}_init() {{')
    if has_toggle:
        c.append('    for (int i = 0; i < 100; i++) toggle[i] = 0;')
    for xy_str, b in sorted_non_fader:
        c.append(f'    set_led({int(xy_str)}, {hex_c(b.get("color_off", "#000000"))});')
    if has_faders:
        c.append('    for (uint8_t i = 0; i < N_FADERS; i++) {')
        c.append('        faders[i].current     = faders[i].min_value;')
        c.append('        faders[i].target      = faders[i].min_value;')
        c.append('        faders[i].rate        = 0;')
        c.append('        faders[i].timer_accum = 0;')
        c.append('        update_fader_leds(&faders[i]);')
        c.append('        driver_send_midi(1,')
        c.append('            (uint8_t[]){(uint8_t)(0xB0 | faders[i].channel),')
        c.append('                        faders[i].cc, faders[i].min_value}, 3);')
        c.append('    }')
    c.append('}')
    c.append('')

    # ── timer_event ─────────────────────────────────────────────────────────
    c.append(f'void {name}_timer_event() {{')
    if has_faders:
        c.append('    for (uint8_t i = 0; i < N_FADERS; i++) {')
        c.append('        Fader *f = &faders[i];')
        c.append('        if (f->rate == 0 || f->current == f->target) continue;')
        c.append('        if (++f->timer_accum < TIMER_DIV[f->rate]) continue;')
        c.append('        f->timer_accum = 0;')
        c.append('        if (f->current < f->target) f->current++;')
        c.append('        else                        f->current--;')
        c.append('        update_fader_leds(f);')
        c.append('        driver_send_midi(1,')
        c.append('            (uint8_t[]){(uint8_t)(0xB0 | f->channel), f->cc, f->current}, 3);')
        c.append('    }')
    c.append('}')
    c.append('')

    # ── surface_event ────────────────────────────────────────────────────────
    c.append(f'void {name}_surface_event(uint8_t type, uint8_t index, uint8_t value) {{')
    c.append('    switch (index) {')

    for xy_str, b in sorted_non_fader:
        for line in gen_surface_case(int(xy_str), b):
            c.append(line)

    if has_faders:
        # Build flat xy -> (fader, throw_pos) map; -1 = rate-cycler anchor
        pad_cases = {}
        for f in faders:
            if f['curve_mode']:
                pad_cases[f['anchor_xy']] = (f, -1)
            for i, pad_xy in enumerate(f['throw_pads']):
                pad_cases[pad_xy] = (f, i)

        for xy in sorted(pad_cases):
            f, throw_pos = pad_cases[xy]
            fi  = f['idx']
            s   = 0xB0 | f['channel']
            cc  = f['cc']

            c.append(f'        case {xy}:')
            c.append(f'            if (type) {{')

            if throw_pos == -1:
                # Curve mode anchor: cycle rate
                c += [
                    f'                faders[{fi}].rate = (faders[{fi}].rate + 1) % 4;',
                    f'                faders[{fi}].timer_accum = 0;',
                    f'                set_led({xy}, RATE_COLORS[faders[{fi}].rate]);',
                ]
            elif throw_pos == 0:
                # First throw: always snap to min_value instantly, ignore rate
                val = f['min_value']
                c += [
                    f'                faders[{fi}].current     = {val};',
                    f'                faders[{fi}].target      = {val};',
                    f'                faders[{fi}].timer_accum = 0;',
                    f'                update_fader_leds(&faders[{fi}]);',
                    f'                {send(s, cc, val)}',
                ]
            else:
                # Intermediate or max throw: set target; instant rate also sets current
                val = f['values'][throw_pos]
                c += [
                    f'                faders[{fi}].target = {val};',
                    f'                if (faders[{fi}].rate == 0) {{',
                    f'                    faders[{fi}].current = {val};',
                    f'                    update_fader_leds(&faders[{fi}]);',
                    f'                    {send(s, cc, val)}',
                    f'                }}',
                ]

            c.append(f'            }}')
            c.append(f'            break;')

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
    c.append('    (void)port; (void)status; (void)d1; (void)d2;')
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

    return c_src, h_src


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

    c_src, h_src = generate(layout, name)

    c_out = os.path.join('src',     'mode', 'user', f'{name}.c')
    h_out = os.path.join('include', 'mode', 'user', f'{name}.h')

    with open(c_out, 'w') as f: f.write(c_src)
    with open(h_out, 'w') as f: f.write(h_src)

    print(f'Generated:')
    print(f'  {c_out}')
    print(f'  {h_out}')
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
