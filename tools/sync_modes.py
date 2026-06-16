#!/usr/bin/env python3
"""
sync_modes.py - Write the slot assignment from the editor's Modes panel
(editor/modes.json) into the generated regions of include/mode/mode.h,
src/mode/mode.c, and the Makefile's user-mode source list.

Slot numbers are configured by hand in the editor, never inferred from
existing C/JSON state. This script only rewrites the text between each
file's own BEGIN/END marker pair - everything else (Boot/Setup's actual
.c/.h files, mode_switch(), the struct Mode definition, etc.) is
untouched.

The Makefile's SRC list only ever compiles src/mode/user/<id>.c for
modes currently listed in editor/modes.json (via USER_MODE_SRC below).
A mode removed from modes.json simply stops being compiled - its .c/.h
pair stays on disk untouched, ready to be re-added (or regenerated from
its editor/<id>.json layout via json_to_mode.py) if it's ever chosen as
a mode again.

mode.h also gets a MODE_DEFAULT macro aliased to whichever mode is in
slot 0. Hand-written files that need a "fall back to something safe"
mode (mini_boot.c's boot_init, mode.c's mode_switch out-of-range clamp)
should reference MODE_DEFAULT instead of a literal mode name, so they
never go stale when slot 0 changes.

Usage:
    python3 tools/sync_modes.py [editor/modes.json]
"""
import json
import os
import re
import sys

MODE_H = os.path.join('include', 'mode', 'mode.h')
MODE_C = os.path.join('src', 'mode', 'mode.c')
MAKEFILE = 'Makefile'

BEGIN_MARKER = 'BEGIN GENERATED MODES'
END_MARKER = 'END GENERATED MODES'

MAKEFILE_BEGIN_MARKER = 'BEGIN GENERATED MODE SRC'
MAKEFILE_END_MARKER = 'END GENERATED MODE SRC'

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


def replace_block(text, new_inner_lines, path, begin_marker=BEGIN_MARKER, end_marker=END_MARKER):
    lines = text.splitlines(keepends=True)
    begin_idx = end_idx = None
    for i, line in enumerate(lines):
        if begin_marker in line:
            begin_idx = i
        elif end_marker in line:
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
    lines.append(f"#define MODE_DEFAULT MODE_{full[0]['id'].upper()}")
    lines.append(f"#define MODES_COUNT {len(full)}")
    return lines


def gen_makefile_lines(user_modes):
    lines = ['USER_MODE_SRC=' + ' \\']
    for i, m in enumerate(user_modes):
        suffix = '' if i == len(user_modes) - 1 else ' \\'
        lines.append(f"\tsrc/mode/user/{m['id']}.c{suffix}")
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
    h_text = replace_block(h_text, gen_mode_h_lines(full), MODE_H)
    with open(MODE_H, 'w') as f:
        f.write(h_text)

    with open(MODE_C) as f:
        c_text = f.read()
    c_text = replace_block(c_text, gen_mode_c_lines(full), MODE_C)
    with open(MODE_C, 'w') as f:
        f.write(c_text)

    with open(MAKEFILE) as f:
        mk_text = f.read()
    mk_text = replace_block(mk_text, gen_makefile_lines(user_modes), MAKEFILE,
                             begin_marker=MAKEFILE_BEGIN_MARKER, end_marker=MAKEFILE_END_MARKER)
    with open(MAKEFILE, 'w') as f:
        f.write(mk_text)

    print(f'Synced {len(user_modes)} user mode(s) + Boot/Setup into:')
    print(f'  {MODE_H}')
    print(f'  {MODE_C}')
    print(f'  {MAKEFILE}')
    for m in full:
        print(f"  slot {m['slot']}: MODE_{m['id'].upper()} ({m['name']})")
    print(f"  MODE_DEFAULT -> MODE_{full[0]['id'].upper()}")


if __name__ == '__main__':
    main()
