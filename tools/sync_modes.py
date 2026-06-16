#!/usr/bin/env python3
"""
sync_modes.py - Write the slot assignment from the editor's Modes panel
(editor/modes.json) into the generated regions of include/mode/mode.h and
src/mode/mode.c.

Slot numbers are configured by hand in the editor, never inferred from
existing C/JSON state. This script only rewrites the text between the
"BEGIN GENERATED MODES" / "END GENERATED MODES" markers in each file -
everything else (Boot/Setup's actual .c/.h files, mode_switch(), the
struct Mode definition, the Makefile's SRC list, etc.) is untouched.

Usage:
    python3 tools/sync_modes.py [editor/modes.json]
"""
import json
import os
import re
import sys

MODE_H = os.path.join('include', 'mode', 'mode.h')
MODE_C = os.path.join('src', 'mode', 'mode.c')

BEGIN_MARKER = 'BEGIN GENERATED MODES'
END_MARKER = 'END GENERATED MODES'

# Boot/Setup are system housekeeping modes, not built in the editor, so they
# aren't part of editor/modes.json - they're always appended after the
# user modes, at the next two free slots.
SYSTEM_MODES = [
    {'id': 'boot', 'name': 'Boot', 'header': 'mode/system/boot.h'},
    {'id': 'setup', 'name': 'Setup', 'header': 'mode/system/setup.h'},
]


def load_user_modes(path):
    with open(path) as f:
        data = json.load(f)
    entries = data['modes']
    if not entries:
        sys.exit(f'sync_modes: {path} has no modes registered')

    seen_slots = set()
    for e in entries:
        if e['slot'] in seen_slots:
            sys.exit(f"sync_modes: duplicate slot {e['slot']} in {path}")
        seen_slots.add(e['slot'])
        if not e.get('id'):
            sys.exit(f"sync_modes: mode in slot {e['slot']} has no id")

    entries = sorted(entries, key=lambda e: e['slot'])
    expected = list(range(len(entries)))
    if [e['slot'] for e in entries] != expected:
        sys.exit(f"sync_modes: slots must be contiguous starting at 0, got {[e['slot'] for e in entries]}")
    return entries


def full_registry(user_modes):
    full = list(user_modes)
    n = len(user_modes)
    for i, sysmode in enumerate(SYSTEM_MODES):
        full.append({'slot': n + i, **sysmode})
    return full


def replace_block(text, marker_prefix, new_inner_lines, path):
    lines = text.splitlines(keepends=True)
    begin_idx = end_idx = None
    for i, line in enumerate(lines):
        if BEGIN_MARKER in line:
            begin_idx = i
        elif END_MARKER in line:
            end_idx = i
            break
    if begin_idx is None or end_idx is None:
        sys.exit(f'sync_modes: {path} markers not found')

    indent_match = re.match(r'\s*', lines[begin_idx])
    indent = indent_match.group(0) if indent_match else ''

    new_lines = [lines[begin_idx]]
    for inner in new_inner_lines:
        new_lines.append((indent + inner if inner else '') + '\n')
    new_lines.append(lines[end_idx])

    return ''.join(lines[:begin_idx] + new_lines + lines[end_idx + 1:])


def gen_mode_h_lines(full):
    lines = []
    for m in full:
        header = m.get('header', f"mode/user/{m['id']}.h")
        lines.append(f"#define MODE_{m['id'].upper()} {m['slot']}")
        lines.append(f'#include "{header}"')
        lines.append('')
    lines.append(f"#define MODES_COUNT {len(full)}")
    return lines


def gen_mode_c_lines(full):
    lines = []
    for m in full:
        ident = m['id']
        name = m['name'].replace('"', '\\"')
        lines += [
            '{',
            f'    .name = "{name}",',
            '    .color = 0x000000,',
            '    .color_dimmed = 0x000000,',
            f'    .init = {ident}_init,',
            f'    .timer_event = {ident}_timer_event,',
            f'    .surface_event = {ident}_surface_event,',
            f'    .midi_event = {ident}_midi_event,',
            f'    .aftertouch_event = {ident}_aftertouch_event',
            '},',
        ]
    return lines


def main():
    json_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join('editor', 'modes.json')
    user_modes = load_user_modes(json_path)
    full = full_registry(user_modes)

    with open(MODE_H) as f:
        h_text = f.read()
    h_text = replace_block(h_text, BEGIN_MARKER, gen_mode_h_lines(full), MODE_H)
    with open(MODE_H, 'w') as f:
        f.write(h_text)

    with open(MODE_C) as f:
        c_text = f.read()
    c_text = replace_block(c_text, BEGIN_MARKER, gen_mode_c_lines(full), MODE_C)
    with open(MODE_C, 'w') as f:
        f.write(c_text)

    print(f'Synced {len(user_modes)} user mode(s) + Boot/Setup into:')
    print(f'  {MODE_H}')
    print(f'  {MODE_C}')
    for m in full:
        print(f"  slot {m['slot']}: MODE_{m['id'].upper()} ({m['name']})")


if __name__ == '__main__':
    main()
