'use strict';

// ── Layout ──────────────────────────────────────────────────────────────────
// XY indices matching the CFW coordinate system
const TOP_ROW = [
  { xy: 91, label: '▲' },
  { xy: 92, label: '▼' },
  { xy: 93, label: '◀' },
  { xy: 94, label: '▶' },
  { xy: 95, label: 'Session' },
  { xy: 96, label: 'Drums' },
  { xy: 97, label: 'Keys' },
  { xy: 98, label: 'User' },
];

// Grid rows top→bottom visually, each with 8 grid pads + 1 right column pad
const GRID_ROWS = [
  { pads: [81,82,83,84,85,86,87,88], right: 89, rightLabel: '❯' },
  { pads: [71,72,73,74,75,76,77,78], right: 79, rightLabel: '❯' },
  { pads: [61,62,63,64,65,66,67,68], right: 69, rightLabel: '❯' },
  { pads: [51,52,53,54,55,56,57,58], right: 59, rightLabel: '❯' },
  { pads: [41,42,43,44,45,46,47,48], right: 49, rightLabel: '❯' },
  { pads: [31,32,33,34,35,36,37,38], right: 39, rightLabel: '❯' },
  { pads: [21,22,23,24,25,26,27,28], right: 29, rightLabel: '❯' },
  { pads: [11,12,13,14,15,16,17,18], right: 19, rightLabel: 'Stop\nSolo\nMute' },
];

// All valid XY indices on the Launchpad Mini MK3
const VALID_XYS = new Set([
  91,92,93,94,95,96,97,98,
  81,82,83,84,85,86,87,88,89,
  71,72,73,74,75,76,77,78,79,
  61,62,63,64,65,66,67,68,69,
  51,52,53,54,55,56,57,58,59,
  41,42,43,44,45,46,47,48,49,
  31,32,33,34,35,36,37,38,39,
  21,22,23,24,25,26,27,28,29,
  11,12,13,14,15,16,17,18,19,
]);

// ── Widget definitions ───────────────────────────────────────────────────────
const WIDGET_DEFS = {
  note: {
    label: 'MIDI Note',
    color: '#4488ff',
    defaults: { channel: 1, note: 60, behavior: 'momentary', color_on: '#4488ff', color_off: '#0a1533' },
  },
  cc: {
    label: 'CC Button',
    color: '#44cc66',
    defaults: { channel: 1, cc: 0, value_on: 127, value_off: 0, behavior: 'momentary', color_on: '#44cc66', color_off: '#0a2211' },
  },
  pc: {
    label: 'Program Change',
    color: '#ff6633',
    defaults: { channel: 1, program: 0, color_on: '#ff6633', color_off: '#331100' },
  },
  fader: {
    label: 'Fader',
    color: '#33cccc',
    defaults: { channel: 1, cc: 0, length: 4, direction: 'up', min_value: 0, max_value: 127, curve_mode: false, color_on: '#33cccc', color_off: '#0a2222' },
  },
  mode_switch: {
    label: 'Mode Switch',
    color: '#cc44ff',
    defaults: { target_mode: 0, color_on: '#cc44ff', color_off: '#220033' },
  },
};

// Novation's color palette from their Components UI
const PALETTE = [
  { name: 'Red',             hex: '#ff0100' },
  { name: 'Peach',           hex: '#ff918c' },
  { name: 'Orange',          hex: '#eb7b0c' },
  { name: 'Sand',            hex: '#fed49c' },
  { name: 'Pale orange',     hex: '#e8ce5d' },
  { name: 'Orange white',    hex: '#eaefaf' },
  { name: 'Pastel yellow',   hex: '#ffe05c' },
  { name: 'Yellow',          hex: '#f3f306' },
  { name: 'Sick green',      hex: '#cdff03' },
  { name: 'Lime',            hex: '#aaf11d' },
  { name: 'Teal',            hex: '#04ff89' },
  { name: 'Green',           hex: '#1fce26' },
  { name: 'Dentist green',   hex: '#c1f9cd' },
  { name: 'Green blue',      hex: '#03ffa3' },
  { name: 'Pastel teal',     hex: '#91ffe8' },
  { name: 'Cyan',            hex: '#18d9d9' },
  { name: 'Blue',            hex: '#21a7d5' },
  { name: 'Deep blue',       hex: '#4b4eff' },
  { name: 'Pastel purple',   hex: '#a379ff' },
  { name: 'Purple',          hex: '#9c30ed' },
  { name: 'Pale purple',     hex: '#cdb4ff' },
  { name: 'Pink',            hex: '#e039e0' },
  { name: 'Pastel pink',     hex: '#ff79ff' },
  { name: 'Outrageous pink', hex: '#ff00a3' },
  { name: 'Rose',            hex: '#ff4485' },
  { name: 'White',           hex: '#ffffff' },
  { name: 'Dim white',       hex: '#797979' },
  { name: 'Black',           hex: '#4f4f4f' },
];

// ── State ────────────────────────────────────────────────────────────────────
const state = new Map();       // xy -> { type, ...config }  (anchor pads only)
const faderOwner = new Map();  // satellite xy -> anchor xy
let selectedXy = null;
let draggingType = null;
let draggingFromXy = null;     // anchor xy of pad being dragged (null = sidebar drag)
let previewOff = false;

// ── Fader helpers ─────────────────────────────────────────────────────────────
function directionStep(dir) {
  return { up: 10, down: -10, right: 1, left: -1 }[dir] ?? 10;
}

function getFaderPads(xy, cfg) {
  const step = directionStep(cfg.direction || 'up');
  const len = cfg.length || 4;
  return Array.from({ length: len }, (_, i) => xy + i * step);
}

function dimHex(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function clearFaderSatellites(anchorXy) {
  [...faderOwner.entries()]
    .filter(([, v]) => v === anchorXy)
    .forEach(([sxy]) => {
      faderOwner.delete(sxy);
      const el = getPadEl(sxy);
      if (!el) return;
      el.style.background = '';
      el.style.borderColor = '';
      el.querySelectorAll('.fader-seg').forEach(d => d.remove());
      const lbl = el.querySelector('.pad-label');
      if (lbl) lbl.style.display = '';
    });
}

// Returns true if a fader with the given cfg can be placed at anchorXy.
// selfAnchor: xy of an existing fader being edited/moved (its pads are ignored in collision check).
function canPlaceFader(anchorXy, cfg, selfAnchor = null) {
  const pads = getFaderPads(anchorXy, cfg);
  for (const p of pads) {
    if (!VALID_XYS.has(p)) return false;
    if (state.has(p) && p !== selfAnchor) return false;
    const owner = faderOwner.get(p);
    if (owner !== undefined && owner !== selfAnchor) return false;
  }
  return true;
}

// ── Build grid ───────────────────────────────────────────────────────────────
function buildGrid() {
  const lp = document.getElementById('launchpad');

  // Top row (round buttons)
  const topRow = document.createElement('div');
  topRow.className = 'top-row';
  TOP_ROW.forEach(({ xy, label }) => {
    topRow.appendChild(makePad(xy, label, false));
  });
  lp.appendChild(topRow);

  // Grid rows + right column
  GRID_ROWS.forEach(({ pads, right, rightLabel }) => {
    const row = document.createElement('div');
    row.className = 'pad-row';
    pads.forEach(xy => row.appendChild(makePad(xy, null)));
    row.appendChild(makePad(right, rightLabel));
    lp.appendChild(row);
  });
}

function makePad(xy, label) {
  const el = document.createElement('div');
  el.className = 'pad';
  el.dataset.xy = xy;
  el.draggable = true;

  if (label) {
    const lbl = document.createElement('div');
    lbl.className = 'pad-label';
    lbl.style.whiteSpace = 'pre-line';
    lbl.textContent = label;
    el.appendChild(lbl);
  }

  el.addEventListener('click', () => onPadClick(xy));

  el.addEventListener('dragstart', e => {
    // Resolve satellite → anchor
    const anchorXy = faderOwner.get(xy) ?? xy;
    if (state.has(anchorXy)) {
      draggingType = state.get(anchorXy).type;
      draggingFromXy = anchorXy;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    } else {
      e.preventDefault(); // nothing here — don't drag
    }
  });
  el.addEventListener('dragend', () => {
    draggingType = null;
    draggingFromXy = null;
  });

  el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drag-over'); onDrop(xy); });

  return el;
}

// ── Drag ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildGrid();

  document.querySelectorAll('.widget-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      draggingType = item.dataset.type;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
  });

  document.getElementById('prop-close').addEventListener('click', closeProperties);
  document.getElementById('prop-remove').addEventListener('click', removeSelected);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-clear').addEventListener('click', clearAll);
  document.getElementById('btn-load').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        loadJSON(JSON.parse(ev.target.result));
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-preview').addEventListener('click', () => {
    previewOff = !previewOff;
    const btn = document.getElementById('btn-preview');
    btn.textContent = previewOff ? 'Preview: Off' : 'Preview: On';
    btn.classList.toggle('btn-active', previewOff);
    document.querySelectorAll('.pad[data-xy]').forEach(el => refreshPad(parseInt(el.dataset.xy)));
  });
});

function onDrop(xy) {
  if (!draggingType) return;
  const type = draggingType;
  const isMove = draggingFromXy !== null;
  const sourceXy = draggingFromXy;
  draggingType = null;
  draggingFromXy = null;

  if (isMove) {
    if (xy === sourceXy) return;
    const sourceCfg = state.get(sourceXy);
    if (!sourceCfg) return;

    if (sourceCfg.type === 'fader') {
      if (!canPlaceFader(xy, sourceCfg, sourceXy)) return;
    } else {
      // Non-fader: block if target is a satellite of another fader, or already occupied
      const owner = faderOwner.get(xy);
      if (owner !== undefined && owner !== sourceXy) return;
      if (state.has(xy)) return;
    }

    // Clear source
    if (sourceCfg.type === 'fader') clearFaderSatellites(sourceXy);
    state.delete(sourceXy);
    const srcEl = getPadEl(sourceXy);
    if (srcEl) {
      srcEl.querySelectorAll('.pad-info').forEach(d => d.remove());
      srcEl.style.background = '';
      srcEl.style.borderColor = '';
      const lbl = srcEl.querySelector('.pad-label');
      if (lbl) lbl.style.display = '';
    }

    // Place at target (selectPad removes 'selected' from old selectedXy automatically)
    state.set(xy, sourceCfg);
    refreshPad(xy);
    selectPad(xy);
    return;
  }

  // Sidebar drop — block on satellite pads
  if (faderOwner.has(xy)) return;

  // If overwriting a fader anchor, clear its satellites first
  const existing = state.get(xy);
  if (existing && existing.type === 'fader') clearFaderSatellites(xy);

  const def = WIDGET_DEFS[type];
  if (!def) return;
  const newCfg = { type, ...JSON.parse(JSON.stringify(def.defaults)) };

  if (type === 'fader' && !canPlaceFader(xy, newCfg)) return;

  state.set(xy, newCfg);
  refreshPad(xy);
  selectPad(xy);
}

// ── Selection ────────────────────────────────────────────────────────────────
function onPadClick(xy) {
  // Clicking a satellite pad selects the fader anchor instead
  const anchor = faderOwner.get(xy);
  if (anchor !== undefined) { selectPad(anchor); return; }
  if (state.has(xy)) {
    selectPad(xy);
  } else {
    deselect();
  }
}

function selectPad(xy) {
  if (selectedXy !== null) {
    getPadEl(selectedXy)?.classList.remove('selected');
  }
  selectedXy = xy;
  getPadEl(xy)?.classList.add('selected');
  showProperties(xy);
}

function deselect() {
  if (selectedXy !== null) {
    getPadEl(selectedXy)?.classList.remove('selected');
    selectedXy = null;
  }
  closeProperties();
}

function getPadEl(xy) {
  return document.querySelector(`.pad[data-xy="${xy}"]`);
}

// ── Properties panel ─────────────────────────────────────────────────────────
function renderAnnotationFields(xy, cfg) {
  const frag = document.createDocumentFragment();

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.maxLength = 6;
  labelInput.value = cfg.label || '';
  labelInput.placeholder = 'e.g. VOL';
  labelInput.addEventListener('input', () => {
    const v = labelInput.value;
    state.get(xy).label = v || undefined;
    refreshPad(xy);
  });
  frag.appendChild(group('Label  (max 6 chars, shows on pad)', labelInput));

  const desc = document.createElement('textarea');
  desc.rows = 2;
  desc.value = cfg.description || '';
  desc.placeholder = 'Notes about this control...';
  desc.addEventListener('input', () => {
    state.get(xy).description = desc.value || undefined;
  });
  frag.appendChild(group('Description  (panel only)', desc));

  return frag;
}

function showProperties(xy) {
  const cfg = state.get(xy);
  if (!cfg) return;

  document.getElementById('widget-browser').classList.add('hidden');
  document.getElementById('properties-panel').classList.remove('hidden');
  document.getElementById('prop-title').textContent = WIDGET_DEFS[cfg.type].label;

  const body = document.getElementById('prop-body');
  body.innerHTML = '';

  body.appendChild(renderAnnotationFields(xy, cfg));

  switch (cfg.type) {
    case 'note':   renderNoteProps(body, xy, cfg); break;
    case 'cc':     renderCCProps(body, xy, cfg);   break;
    case 'pc':     renderPCProps(body, xy, cfg);   break;
    case 'fader':  renderFaderProps(body, xy, cfg); break;
    case 'mode_switch': renderModeSwitchProps(body, xy, cfg); break;
  }

  body.appendChild(renderColorPickers(xy, cfg));
}

function closeProperties() {
  document.getElementById('widget-browser').classList.remove('hidden');
  document.getElementById('properties-panel').classList.add('hidden');
  if (selectedXy !== null) {
    getPadEl(selectedXy)?.classList.remove('selected');
    selectedXy = null;
  }
}

function removeSelected() {
  if (selectedXy === null) return;
  const cfg = state.get(selectedXy);
  if (cfg && cfg.type === 'fader') clearFaderSatellites(selectedXy);
  state.delete(selectedXy);
  refreshPad(selectedXy);
  closeProperties();
}

// ── Property field renderers ─────────────────────────────────────────────────
function group(labelText, inputEl) {
  const g = document.createElement('div');
  g.className = 'prop-group';
  const lbl = document.createElement('label');
  lbl.textContent = labelText;
  g.appendChild(lbl);
  g.appendChild(inputEl);
  return g;
}

function select(options, value, onChange) {
  const el = document.createElement('select');
  options.forEach(([val, text]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if (String(val) === String(value)) opt.selected = true;
    el.appendChild(opt);
  });
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function numberInput(min, max, value, onChange) {
  const el = document.createElement('input');
  el.type = 'number';
  el.min = min;
  el.max = max;
  el.value = value;
  el.addEventListener('change', () => onChange(parseInt(el.value)));
  return el;
}

function channelSelect(value, xy, key) {
  const opts = [['0', 'Global']];
  for (let i = 1; i <= 16; i++) opts.push([i, `Channel ${i}`]);
  return group('MIDI Channel', select(opts, value, v => { state.get(xy)[key] = parseInt(v); refreshPad(xy); }));
}

function behaviorSelect(value, xy) {
  return group('Pad Mode', select(
    [['momentary','Momentary'],['toggle','Toggle'],['trigger','Trigger']],
    value,
    v => { state.get(xy).behavior = v; }
  ));
}

function renderNoteProps(body, xy, cfg) {
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const noteName = NOTE_NAMES[cfg.note % 12];
  const octave = Math.floor(cfg.note / 12) - 2;

  body.appendChild(behaviorSelect(cfg.behavior, xy));

  const noteOpts = NOTE_NAMES.map((n, i) => [n, n]);
  body.appendChild(group('Note', select(noteOpts, noteName, v => {
    const oct = Math.floor(state.get(xy).note / 12) - 2;
    state.get(xy).note = NOTE_NAMES.indexOf(v) + (oct + 2) * 12;
    refreshPad(xy);
  })));

  body.appendChild(group('Octave', numberInput(-2, 8, octave, v => {
    const cfg2 = state.get(xy);
    const name = NOTE_NAMES[cfg2.note % 12];
    cfg2.note = NOTE_NAMES.indexOf(name) + (v + 2) * 12;
    refreshPad(xy);
  })));

  body.appendChild(channelSelect(cfg.channel, xy, 'channel'));
}

function renderCCProps(body, xy, cfg) {
  body.appendChild(behaviorSelect(cfg.behavior, xy));
  body.appendChild(group('CC Number', numberInput(0, 127, cfg.cc, v => { state.get(xy).cc = v; refreshPad(xy); })));
  body.appendChild(group('On Value',  numberInput(0, 127, cfg.value_on,  v => { state.get(xy).value_on  = v; })));
  body.appendChild(group('Off Value', numberInput(0, 127, cfg.value_off, v => { state.get(xy).value_off = v; })));
  body.appendChild(channelSelect(cfg.channel, xy, 'channel'));
}

function renderPCProps(body, xy, cfg) {
  body.appendChild(group('Program Number', numberInput(0, 127, cfg.program, v => { state.get(xy).program = v; refreshPad(xy); })));
  body.appendChild(channelSelect(cfg.channel, xy, 'channel'));
}

function renderFaderProps(body, xy, cfg) {
  const dirOpts = [['up','Up ↑'],['down','Down ↓'],['right','Right →'],['left','Left ←']];
  const dirEl = select(dirOpts, cfg.direction || 'up', v => {
    const tentative = { ...state.get(xy), direction: v };
    if (!canPlaceFader(xy, tentative, xy)) { dirEl.value = state.get(xy).direction || 'up'; return; }
    state.get(xy).direction = v;
    refreshPad(xy);
  });
  body.appendChild(group('Direction', dirEl));

  const lenOpts = [[2,'2'],[3,'3'],[4,'4'],[5,'5'],[6,'6'],[7,'7'],[8,'8'],[9,'9']];
  const lenEl = select(lenOpts, cfg.length || 4, v => {
    const tentative = { ...state.get(xy), length: parseInt(v) };
    if (!canPlaceFader(xy, tentative, xy)) { lenEl.value = String(state.get(xy).length || 4); return; }
    state.get(xy).length = parseInt(v);
    refreshPad(xy);
  });
  body.appendChild(group('Length (pads)', lenEl));

  body.appendChild(group('CC Number', numberInput(0, 127, cfg.cc, v => { state.get(xy).cc = v; refreshPad(xy); })));
  body.appendChild(channelSelect(cfg.channel, xy, 'channel'));

  // Value range
  body.appendChild(group('Min Value (first pad → snap)', numberInput(0, 127, cfg.min_value ?? 0, v => {
    state.get(xy).min_value = v;
    refreshPad(xy);
  })));
  body.appendChild(group('Max Value (last pad)', numberInput(0, 127, cfg.max_value ?? 127, v => {
    state.get(xy).max_value = v;
    refreshPad(xy);
  })));

  // Curve mode toggle
  const curveWrap = document.createElement('div');
  curveWrap.className = 'prop-group';
  const curveLbl = document.createElement('label');
  curveLbl.textContent = 'Curve Rate Button';
  curveWrap.appendChild(curveLbl);
  const curveNote = document.createElement('div');
  curveNote.style.cssText = 'font-size:10px;color:var(--text-dim);margin-bottom:6px;line-height:1.4';
  curveNote.textContent = 'Anchor pad cycles rate: instant → 1 bar → 4 bars → 16 bars. Gives up one throw position.';
  curveWrap.appendChild(curveNote);
  const curveBtn = document.createElement('button');
  curveBtn.className = 'btn' + (cfg.curve_mode ? ' btn-active' : '');
  curveBtn.textContent = cfg.curve_mode ? 'Enabled' : 'Disabled';
  curveBtn.addEventListener('click', () => {
    state.get(xy).curve_mode = !state.get(xy).curve_mode;
    curveBtn.classList.toggle('btn-active', state.get(xy).curve_mode);
    curveBtn.textContent = state.get(xy).curve_mode ? 'Enabled' : 'Disabled';
    refreshPad(xy);
  });
  curveWrap.appendChild(curveBtn);
  body.appendChild(curveWrap);
}

function renderModeSwitchProps(body, xy, cfg) {
  const modeOpts = Array.from({length: 6}, (_, i) => [i, `Mode ${i}`]);
  body.appendChild(group('Target Mode', select(modeOpts, cfg.target_mode, v => { state.get(xy).target_mode = parseInt(v); refreshPad(xy); })));
}

// ── Color pickers ─────────────────────────────────────────────────────────────
function renderColorPickers(xy, cfg) {
  const wrap = document.createElement('div');
  wrap.className = 'prop-group';

  const row = document.createElement('div');
  row.className = 'color-row';

  row.appendChild(colorPickerCol('On Color', cfg.color_on, hex => {
    state.get(xy).color_on = hex;
    refreshPad(xy);
  }));

  row.appendChild(colorPickerCol('Off Color', cfg.color_off, hex => {
    state.get(xy).color_off = hex;
    refreshPad(xy);
  }));

  wrap.appendChild(row);
  return wrap;
}

function colorPickerCol(labelText, currentHex, onChange) {
  const col = document.createElement('div');
  col.className = 'color-col';

  const lbl = document.createElement('label');
  lbl.textContent = labelText;
  col.appendChild(lbl);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'color-input';
  colorInput.value = currentHex;
  colorInput.addEventListener('input', () => {
    col.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    onChange(colorInput.value);
  });
  col.appendChild(colorInput);

  const grid = document.createElement('div');
  grid.className = 'color-picker-grid';

  PALETTE.forEach(({ name, hex }) => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (hex.toLowerCase() === currentHex.toLowerCase() ? ' selected' : '');
    sw.style.background = hex;
    sw.title = name;
    sw.addEventListener('click', () => {
      col.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      colorInput.value = hex;
      onChange(hex);
    });
    grid.appendChild(sw);
  });

  col.appendChild(grid);
  return col;
}

// ── Pad refresh ──────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function contrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 140 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)';
}

function chLabel(ch) {
  return '⬤ ' + (ch === 0 ? 'G' : 'ch' + ch);
}

function line(text) {
  const d = document.createElement('div');
  d.className = 'pad-info-text';
  d.textContent = text;
  return d;
}

function padDisplayContent(cfg) {
  const wrap = document.createElement('div');
  wrap.className = 'pad-info';
  const lbl = cfg.label && cfg.label.trim();

  switch (cfg.type) {
    case 'note':
      wrap.appendChild(line(lbl || ('♪ ' + NOTE_NAMES[cfg.note % 12] + (Math.floor(cfg.note / 12) - 2))));
      wrap.appendChild(line(chLabel(cfg.channel)));
      break;
    case 'cc':
      wrap.appendChild(line(lbl || ('CC ' + cfg.cc)));
      wrap.appendChild(line(chLabel(cfg.channel)));
      break;
    case 'pc':
      wrap.appendChild(line(lbl || ('PC ' + cfg.program)));
      wrap.appendChild(line(chLabel(cfg.channel)));
      break;
    case 'fader':
      if (lbl) {
        wrap.appendChild(line(lbl));
      } else if (cfg.curve_mode) {
        wrap.appendChild(line('⟳ RATE'));
      } else {
        wrap.appendChild(line('▤ CC' + cfg.cc));
      }
      wrap.appendChild(line((cfg.min_value ?? 0) + '→' + (cfg.max_value ?? 127)));
      break;
    case 'mode_switch':
      wrap.appendChild(line(lbl || ('⇄ M' + cfg.target_mode)));
      break;
  }

  return wrap;
}

function refreshPad(xy) {
  // Satellite pads are always rendered by their anchor's refreshFader — skip them here
  if (faderOwner.has(xy)) return;

  const cfg = state.get(xy);
  if (cfg && cfg.type === 'fader') { refreshFader(xy); return; }

  const el = getPadEl(xy);
  if (!el) return;

  el.querySelectorAll('.pad-info').forEach(d => d.remove());

  const labelEl = el.querySelector('.pad-label');

  if (!cfg) {
    el.style.background = '';
    el.style.borderColor = '';
    if (labelEl) labelEl.style.display = '';
    return;
  }

  if (labelEl) labelEl.style.display = 'none';
  const color = previewOff ? cfg.color_off : cfg.color_on;
  el.style.background = color;
  el.style.borderColor = color;
  const info = padDisplayContent(cfg);
  info.style.color = contrastColor(color);
  el.appendChild(info);
}

function refreshFader(xy) {
  // Clear old satellites first (handles length/direction changes)
  clearFaderSatellites(xy);

  const el = getPadEl(xy);
  if (!el) return;
  el.querySelectorAll('.pad-info').forEach(d => d.remove());

  const cfg = state.get(xy);
  const labelEl = el.querySelector('.pad-label');

  if (!cfg) {
    el.style.background = '';
    el.style.borderColor = '';
    if (labelEl) labelEl.style.display = '';
    return;
  }

  // Anchor pad color: in curve_mode shows white (instant rate default), otherwise normal
  const RATE_COLORS = ['#ffffff', '#22cc44', '#cccc00', '#cc2222'];
  const anchorColor = cfg.curve_mode
    ? (previewOff ? '#333333' : RATE_COLORS[0])
    : (previewOff ? cfg.color_off : cfg.color_on);

  if (labelEl) labelEl.style.display = 'none';
  el.style.background = anchorColor;
  el.style.borderColor = anchorColor;
  const info = padDisplayContent(cfg);
  info.style.color = contrastColor(anchorColor);
  el.appendChild(info);

  // Satellite pads
  const baseColor = previewOff ? cfg.color_off : cfg.color_on;
  const dimColor = dimHex(baseColor, 0.35);
  const pads = getFaderPads(xy, cfg);
  pads.slice(1).forEach((sxy, i) => {
    faderOwner.set(sxy, xy);
    const sel = getPadEl(sxy);
    if (!sel) return;
    sel.querySelectorAll('.fader-seg').forEach(d => d.remove());
    const slbl = sel.querySelector('.pad-label');
    if (slbl) slbl.style.display = 'none';
    // First satellite = min/mute position — slightly brighter to distinguish
    const satColor = (i === 0) ? dimHex(baseColor, 0.55) : dimColor;
    sel.style.background = satColor;
    sel.style.borderColor = satColor;
    const seg = document.createElement('div');
    seg.className = 'fader-seg';
    sel.appendChild(seg);
  });
}

// ── Load ─────────────────────────────────────────────────────────────────────
function loadJSON(obj) {
  deselect();
  state.clear();
  faderOwner.clear();
  document.querySelectorAll('.pad[data-xy]').forEach(el => {
    el.style.background = '';
    el.style.borderColor = '';
    el.querySelectorAll('.pad-info, .fader-seg').forEach(d => d.remove());
    el.classList.remove('selected');
    const lbl = el.querySelector('.pad-label');
    if (lbl) lbl.style.display = '';
  });
  Object.entries(obj).forEach(([xy, cfg]) => {
    state.set(parseInt(xy), cfg);
    refreshPad(parseInt(xy));
  });
}

// ── Export ───────────────────────────────────────────────────────────────────
function exportJSON() {
  const obj = {};
  state.forEach((cfg, xy) => { obj[xy] = cfg; });
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'launchpad-layout.json';
  a.click();
  URL.revokeObjectURL(url);
}

function clearAll() {
  if (!confirm('Clear all button assignments?')) return;
  state.clear();
  faderOwner.clear();
  document.querySelectorAll('.pad').forEach(el => {
    el.style.background = '';
    el.style.borderColor = '';
    el.querySelectorAll('.pad-info, .fader-seg').forEach(d => d.remove());
    el.classList.remove('selected');
    const lbl = el.querySelector('.pad-label');
    if (lbl) lbl.style.display = '';
  });
  closeProperties();
}