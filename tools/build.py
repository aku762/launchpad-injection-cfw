#!/usr/bin/env python3
"""
build.py - Run the full pipeline end to end: sync the mode registry,
regenerate every registered mode's C from its editor layout, then
compile/patch/package the firmware.

This is steps 1-3 of the pipeline in readme.md (run automatically, in
the right order) followed by `make mini`. It assumes each mode's
layout has already been designed and exported from the editor into
editor/<id>.json - this script doesn't touch the editor itself, it
just re-runs the generator/sync/build steps so a modes.json or layout
change always ends up in a fresh build/splicewerk-minimk3-cfw.syx.

Usage:
    python3 tools/build.py             # sync + regenerate + make mini
    python3 tools/build.py --clean     # same, but `make clean` first
    python3 tools/build.py editor/modes.json [--clean]
"""
import json
import os
import subprocess
import sys

MODES_JSON_DEFAULT = os.path.join('editor', 'modes.json')


def run(cmd):
    print(f"$ {' '.join(cmd)}", flush=True)
    subprocess.run(cmd, check=True)


def main():
    args = sys.argv[1:]
    clean = '--clean' in args
    positional = [a for a in args if a != '--clean']
    modes_json = positional[0] if positional else MODES_JSON_DEFAULT

    with open(modes_json) as f:
        mode_ids = [m['id'] for m in json.load(f)['modes']]

    run(['python3', 'tools/sync_modes.py', modes_json])

    for mode_id in mode_ids:
        layout = os.path.join('editor', f'{mode_id}.json')
        if not os.path.isfile(layout):
            print(f"build: skipping {mode_id} - no {layout} found")
            continue
        run(['python3', 'tools/json_to_mode.py', layout, mode_id])

    if clean:
        run(['make', 'clean'])
    run(['make', 'mini'])

    print('\nDone - build/splicewerk-minimk3-cfw.syx is ready to flash.')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f'build: {e.cmd[0]} failed with exit code {e.returncode}')
