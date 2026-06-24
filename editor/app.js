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
    defaults: { channel: 1, cc: 0, length: 4, direction: 'up', min_value: 0, max_value: 127, smooth_group: -1, color_on: '#33cccc', color_off: '#0a2222' },
  },
  smooth_fader: {  /* legacy alias — loads fine, treated as fader */
    label: 'Fader',
    color: '#33cccc',
    defaults: { channel: 1, cc: 0, length: 4, direction: 'up', min_value: 0, max_value: 127, smooth_group: -1, color_on: '#33cccc', color_off: '#0a2222' },
  },
  mode_switch: {
    label: 'Mode Switch',
    color: '#cc44ff',
    defaults: { target_mode: 0, color_on: '#cc44ff', color_off: '#220033' },
  },
  curve_btn: {
    label: 'Curve Button',
    color: '#22cc44',
    defaults: {
      smooth_group: 0,
      rates: [
        { ms: 127,  color: '#ffffff' },
        { ms: 508,  color: '#22cc44' },
        { ms: 2032, color: '#cccc00' },
        { ms: 8001, color: '#cc2222' },
      ],
    },
  },
  lfo: {
    label: 'LFO',
    color: '#22ffcc',
    defaults: {
      channel: 1, cc: 10,
      length: 4, direction: 'up',
      min_val: 0, max_val: 127, start_val: 63,
      rate_channel: 1, rate_cc: 20,
      rate_min_ms: 100, rate_max_ms: 5000,
      color_on: '#22ffcc', color_off: '#001a16',
    },
  },
};

function isFaderType(type) { return type === 'fader' || type === 'smooth_fader'; }
function isMultiPadType(type) { return isFaderType(type) || type === 'lfo'; }

// Palette: true RGB maxes first, then Novation's curated primaries/pastels
const PALETTE = [
  // ── True RGB (maxed channels, for distinguishing adjacent widgets) ──
  { name: 'True Red',        hex: '#ff0000' },
  { name: 'True Orange',     hex: '#ff8000' },
  { name: 'True Yellow',     hex: '#ffff00' },
  { name: 'True Green',      hex: '#00ff00' },
  { name: 'True Cyan',       hex: '#00ffff' },
  { name: 'True Blue',       hex: '#0000ff' },
  { name: 'True Purple',     hex: '#8000ff' },
  { name: 'True Magenta',    hex: '#ff00ff' },
  { name: 'True White',      hex: '#ffffff' },
  { name: 'True Black',      hex: '#000000' },
  // ── Primaries ──────────────────────────────────────────────────
  { name: 'Red',             hex: '#ff0100' },
  { name: 'Orange',          hex: '#eb7b0c' },
  { name: 'Yellow',          hex: '#f3f306' },
  { name: 'Lime',            hex: '#aaf11d' },
  { name: 'Green',           hex: '#1fce26' },
  { name: 'Teal',            hex: '#04ff89' },
  { name: 'Cyan',            hex: '#18d9d9' },
  { name: 'Blue',            hex: '#21a7d5' },
  { name: 'Deep blue',       hex: '#4b4eff' },
  { name: 'Purple',          hex: '#9c30ed' },
  { name: 'Pink',            hex: '#e039e0' },
  { name: 'Hot pink',        hex: '#ff00a3' },
  { name: 'Rose',            hex: '#ff4485' },
  { name: 'White',           hex: '#ffffff' },
  // ── Pastels / lights ───────────────────────────────────────────
  { name: 'Peach',           hex: '#ff918c' },
  { name: 'Sand',            hex: '#fed49c' },
  { name: 'Pastel yellow',   hex: '#ffe05c' },
  { name: 'Sick green',      hex: '#cdff03' },
  { name: 'Dentist green',   hex: '#c1f9cd' },
  { name: 'Pastel teal',     hex: '#91ffe8' },
  { name: 'Green blue',      hex: '#03ffa3' },
  { name: 'Pale orange',     hex: '#e8ce5d' },
  { name: 'Pastel purple',   hex: '#a379ff' },
  { name: 'Pale purple',     hex: '#cdb4ff' },
  { name: 'Pastel pink',     hex: '#ff79ff' },
  { name: 'Orange white',    hex: '#eaefaf' },
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

// modeRegistry: [{ slot, name, id }] — array order is the source of truth for
// slot assignment (slot = array index, see reindexSlots), reordered via
// drag-and-drop in the Modes panel and consumed by tools/sync_modes.py to
// write mode.h/mode.c. Persisted to localStorage so it survives a page reload
// without needing to reload modes.json every time.
const MODE_REGISTRY_KEY = 'lpcfw_mode_registry';
let modeRegistry = [];
let dragModeIndex = null;  // index of the mode row currently being dragged, in the Modes panel

// ── Fader helpers ─────────────────────────────────────────────────────────────
function directionStep(dir) {
  return { up: 10, down: -10, right: 1, left: -1 }[dir] ?? 10;
}

function getFaderPads(xy, cfg) {
  const step = directionStep(cfg.direction || 'up');
  const len = cfg.length || 4;
  return Array.from({ length: len }, (_, i) => xy + i * step);
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// Pushes lightness toward white (deltaL > 0) or black (deltaL < 0) while
// preserving hue/saturation — plain RGB multiplication can't lighten a
// channel that's already 0 or 255, which is why pure red wouldn't lighten.
function adjustLightness(hex, deltaL) {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const newL = Math.max(0, Math.min(1, l + deltaL));
  const [nr, ng, nb] = hslToRgb(h, s, newL);
  return rgbToHex(nr, ng, nb);
}

// Used by fader preview rendering to dim a color for unfilled segments.
function dimHex(hex, factor) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
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
  loadModeRegistry();

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

  document.getElementById('btn-modes').addEventListener('click', openModesPanel);
  document.getElementById('modes-close').addEventListener('click', closeModesPanel);
  document.getElementById('modes-add').addEventListener('click', () => {
    modeRegistry.push({ slot: modeRegistry.length, name: '', id: '' });
    saveModeRegistry();
    renderModesPanel();
  });
  document.getElementById('modes-export').addEventListener('click', exportModesJSON);
  document.getElementById('modes-load').addEventListener('click', () => document.getElementById('modes-file-input').click());
  document.getElementById('modes-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        loadModesJSON(JSON.parse(ev.target.result));
      } catch {
        alert('Invalid modes.json file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

    if (isMultiPadType(sourceCfg.type)) {
      if (!canPlaceFader(xy, sourceCfg, sourceXy)) return;
    } else {
      // Non-fader: block if target is a satellite of another fader/lfo, or already occupied
      const owner = faderOwner.get(xy);
      if (owner !== undefined && owner !== sourceXy) return;
      if (state.has(xy)) return;
    }

    // Clear source
    if (isMultiPadType(sourceCfg.type)) clearFaderSatellites(sourceXy);
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

  // If overwriting a fader/lfo anchor, clear its satellites first
  const existing = state.get(xy);
  if (existing && isMultiPadType(existing.type)) clearFaderSatellites(xy);

  const def = WIDGET_DEFS[type];
  if (!def) return;
  const newCfg = { type, ...JSON.parse(JSON.stringify(def.defaults)) };

  if (isMultiPadType(type) && !canPlaceFader(xy, newCfg)) return;

  // Auto-increment smooth_group for curve_btn so each button gets a unique ID
  if (type === 'curve_btn') {
    let maxGroup = -1;
    state.forEach(cfg => { if (cfg.type === 'curve_btn' && cfg.smooth_group > maxGroup) maxGroup = cfg.smooth_group; });
    newCfg.smooth_group = maxGroup + 1;
  }

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
    case 'fader':
    case 'smooth_fader': renderFaderProps(body, xy, cfg); break;
    case 'curve_btn':    renderCurveBtnProps(body, xy, cfg); break;
    case 'mode_switch':  renderModeSwitchProps(body, xy, cfg); break;
    case 'lfo':          renderLfoProps(body, xy, cfg); break;
  }

  if (cfg.type !== 'curve_btn') body.appendChild(renderColorPickers(xy, cfg));
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
  if (cfg && isMultiPadType(cfg.type)) clearFaderSatellites(selectedXy);
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

  // Smooth group selector — works for all fader types now.
  const groups = [];
  state.forEach(c => { if (c.type === 'curve_btn' && !groups.includes(c.smooth_group)) groups.push(c.smooth_group); });
  groups.sort((a, b) => a - b);
  const sgWrap = document.createElement('div');
  sgWrap.className = 'prop-group';
  const sgLbl = document.createElement('label');
  sgLbl.textContent = 'Curve Button Group';
  sgWrap.appendChild(sgLbl);
  if (groups.length === 0) {
    const sgNote = document.createElement('div');
    sgNote.style.cssText = 'font-size:10px;color:var(--text-dim);line-height:1.4';
    sgNote.textContent = 'Place a Curve Button on the grid to assign a rate group. Without one, fader uses instant speed.';
    sgWrap.appendChild(sgNote);
  } else {
    const opts = [[-1, 'None (instant)'], ...groups.map(g => [g, `Group ${g}`])];
    const cur = cfg.smooth_group ?? -1;
    sgWrap.appendChild(select(opts, cur, v => { state.get(xy).smooth_group = parseInt(v); }));
  }
  body.appendChild(sgWrap);
}

function renderCurveBtnProps(body, xy, cfg) {
  // Migrate old format (no rates field)
  if (!cfg.rates || !cfg.rates.length) {
    cfg.rates = JSON.parse(JSON.stringify(WIDGET_DEFS.curve_btn.defaults.rates));
  }

  const note = document.createElement('div');
  note.style.cssText = 'font-size:10px;color:var(--text-dim);margin-bottom:10px;line-height:1.4';
  note.textContent = `Group ${cfg.smooth_group} — tap pad to cycle rates. Assign smooth faders to group ${cfg.smooth_group}.`;
  body.appendChild(note);

  const ratesWrap = document.createElement('div');
  ratesWrap.style.cssText = 'display:flex;flex-direction:column;gap:5px';

  function renderRates() {
    ratesWrap.innerHTML = '';
    cfg.rates.forEach((rate, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:5px';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = rate.color;
      colorInput.title = 'Rate color';
      colorInput.style.cssText = 'width:32px;height:26px;padding:1px;border:1px solid var(--border);cursor:pointer;flex-shrink:0';
      colorInput.addEventListener('input', () => {
        cfg.rates[i].color = colorInput.value;
        if (i === 0) refreshPad(xy);
      });
      row.appendChild(colorInput);

      const msInput = document.createElement('input');
      msInput.type = 'number';
      msInput.min = 50;
      msInput.max = 30000;
      msInput.step = 1;
      msInput.value = rate.ms;
      msInput.style.cssText = 'width:72px;';
      msInput.title = 'Full sweep duration (ms)';
      msInput.addEventListener('change', () => {
        cfg.rates[i].ms = Math.max(50, parseInt(msInput.value) || 127);
        msInput.value = cfg.rates[i].ms;
      });
      row.appendChild(msInput);

      const msLbl = document.createElement('span');
      msLbl.textContent = 'ms';
      msLbl.style.cssText = 'font-size:10px;color:var(--text-dim);flex-shrink:0';
      row.appendChild(msLbl);

      if (cfg.rates.length > 1) {
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.cssText = 'padding:1px 5px;cursor:pointer;flex-shrink:0';
        removeBtn.addEventListener('click', () => {
          cfg.rates.splice(i, 1);
          if (i === 0) refreshPad(xy);
          renderRates();
        });
        row.appendChild(removeBtn);
      }

      ratesWrap.appendChild(row);
    });

    if (cfg.rates.length < 4) {
      const addBtn = document.createElement('button');
      addBtn.textContent = '+ Add Rate';
      addBtn.style.cssText = 'margin-top:3px;cursor:pointer;width:100%';
      addBtn.addEventListener('click', () => {
        cfg.rates.push({ ms: 1000, color: '#888888' });
        renderRates();
      });
      ratesWrap.appendChild(addBtn);
    }
  }

  renderRates();

  const grpEl = document.createElement('div');
  grpEl.className = 'prop-group';
  const lbl = document.createElement('label');
  lbl.textContent = 'Rates (fast → slow)';
  grpEl.appendChild(lbl);
  grpEl.appendChild(ratesWrap);
  body.appendChild(grpEl);
}

function renderModeSwitchProps(body, xy, cfg) {
  const modeOpts = modeRegistry.length
    ? modeRegistry.map((m, i) => [i, `${i}: ${m.name || m.id || 'unnamed'}`])
    : Array.from({length: 6}, (_, i) => [i, `Mode ${i} (open Modes… to name slots)`]);
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

  // Native color picker (free pick override)
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'color-input';
  colorInput.value = currentHex;
  colorInput.addEventListener('input', () => {
    col.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    currentHex = colorInput.value;
    onChange(colorInput.value);
  });
  col.appendChild(colorInput);

  // Brightness controls: − / +
  const brightRow = document.createElement('div');
  brightRow.className = 'brightness-row';

  const darkenBtn = document.createElement('button');
  darkenBtn.className = 'brightness-btn';
  darkenBtn.textContent = '−';
  darkenBtn.title = 'Darken';
  darkenBtn.addEventListener('click', () => {
    const next = adjustLightness(colorInput.value, -0.12);
    col.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    colorInput.value = next;
    currentHex = next;
    onChange(next);
  });

  const brightenBtn = document.createElement('button');
  brightenBtn.className = 'brightness-btn';
  brightenBtn.textContent = '+';
  brightenBtn.title = 'Brighten';
  brightenBtn.addEventListener('click', () => {
    const next = adjustLightness(colorInput.value, 0.12);
    col.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    colorInput.value = next;
    currentHex = next;
    onChange(next);
  });

  brightRow.appendChild(darkenBtn);
  brightRow.appendChild(brightenBtn);
  col.appendChild(brightRow);

  // Palette swatch grid
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
      currentHex = hex;
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
    case 'smooth_fader':
      wrap.appendChild(line(lbl || ('▤ CC' + cfg.cc)));
      wrap.appendChild(line((cfg.min_value ?? 0) + '→' + (cfg.max_value ?? 127)));
      break;
    case 'mode_switch': {
      const entry = modeRegistry.find(m => m.slot === cfg.target_mode);
      wrap.appendChild(line(lbl || (entry ? `⇄ ${entry.name || entry.id}` : '⇄ M' + cfg.target_mode)));
      break;
    }
    case 'curve_btn':
      wrap.appendChild(line(lbl || `⟳ G${cfg.smooth_group}`));
      break;
    case 'lfo':
      wrap.appendChild(line(lbl || ('◎ CC' + cfg.cc)));
      wrap.appendChild(line(chLabel(cfg.channel)));
      break;
  }

  return wrap;
}

function refreshPad(xy) {
  // Satellite pads are always rendered by their anchor's refreshFader — skip them here
  if (faderOwner.has(xy)) return;

  const cfg = state.get(xy);
  if (cfg && isFaderType(cfg.type)) { refreshFader(xy); return; }
  if (cfg && cfg.type === 'lfo') { refreshLfo(xy); return; }

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
  let color;
  if (cfg.type === 'curve_btn') {
    const r0 = (cfg.rates && cfg.rates[0]) ? cfg.rates[0].color : '#22cc44';
    color = previewOff ? dimHex(r0, 0.25) : r0;
  } else {
    color = previewOff ? cfg.color_off : cfg.color_on;
  }
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

  // Anchor pad color: smooth_fader and fader both use color_on (rate control is on
  // a separate curve_btn widget, not embedded in the fader). Legacy fader curve_mode
  // is visually kept as-is for now but not generated.
  const RATE_COLORS = ['#ffffff', '#22cc44', '#cccc00', '#cc2222'];
  const anchorColor = cfg.curve_mode && cfg.type === 'fader'
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

function refreshLfo(xy) {
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

  const len   = cfg.length || 4;
  const minV  = cfg.min_val ?? 0;
  const maxV  = cfg.max_val ?? 127;
  const startV = cfg.start_val ?? Math.round((minV + maxV) / 2);

  let dotIdx = 0;
  if (maxV > minV && len > 1) {
    dotIdx = Math.round((startV - minV) * (len - 1) / (maxV - minV));
    dotIdx = Math.max(0, Math.min(len - 1, dotIdx));
  }

  const onColor  = previewOff ? cfg.color_off : cfg.color_on;
  const offColor = cfg.color_off;

  if (labelEl) labelEl.style.display = 'none';

  // Anchor pad (index 0)
  const anchorColor = (dotIdx === 0) ? onColor : offColor;
  el.style.background  = anchorColor;
  el.style.borderColor = anchorColor;
  const info = padDisplayContent(cfg);
  info.style.color = contrastColor(anchorColor);
  el.appendChild(info);

  // Satellite pads
  const pads = getFaderPads(xy, cfg);
  pads.slice(1).forEach((sxy, i) => {
    faderOwner.set(sxy, xy);
    const sel = getPadEl(sxy);
    if (!sel) return;
    const slbl = sel.querySelector('.pad-label');
    if (slbl) slbl.style.display = 'none';
    sel.querySelectorAll('.pad-info, .fader-seg').forEach(d => d.remove());
    const satColor = (i + 1 === dotIdx) ? onColor : offColor;
    sel.style.background  = satColor;
    sel.style.borderColor = satColor;
  });
}

function renderLfoProps(body, xy, cfg) {
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

  body.appendChild(group('CC Number (output)', numberInput(0, 127, cfg.cc, v => { state.get(xy).cc = v; refreshPad(xy); })));
  body.appendChild(channelSelect(cfg.channel, xy, 'channel'));

  body.appendChild(group('Min Value', numberInput(0, 127, cfg.min_val ?? 0, v => { state.get(xy).min_val = v; refreshPad(xy); })));
  body.appendChild(group('Max Value', numberInput(0, 127, cfg.max_val ?? 127, v => { state.get(xy).max_val = v; refreshPad(xy); })));
  body.appendChild(group('Start Value (initial position)', numberInput(0, 127, cfg.start_val ?? 63, v => { state.get(xy).start_val = v; refreshPad(xy); })));

  const sep = document.createElement('div');
  sep.style.cssText = 'margin:8px 0 4px;font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.05em';
  sep.textContent = 'Rate Control (reads a CC from cc_state)';
  body.appendChild(sep);

  body.appendChild(group('Rate CC# (assign a fader to this)', numberInput(0, 127, cfg.rate_cc ?? 20, v => { state.get(xy).rate_cc = v; })));

  // Rate channel selector (reuses the opts pattern without the refreshPad call)
  const rateChanOpts = [['0', 'Global']];
  for (let i = 1; i <= 16; i++) rateChanOpts.push([i, `Channel ${i}`]);
  body.appendChild(group('Rate Channel', select(rateChanOpts, cfg.rate_channel ?? 1, v => { state.get(xy).rate_channel = parseInt(v); })));

  body.appendChild(group('Fastest speed — CC=127 (ms for full sweep)', numberInput(1, 30000, cfg.rate_min_ms ?? 100, v => { state.get(xy).rate_min_ms = Math.max(1, v); })));
  body.appendChild(group('Slowest speed — CC=1 (ms for full sweep)', numberInput(1, 60000, cfg.rate_max_ms ?? 5000, v => { state.get(xy).rate_max_ms = Math.max(state.get(xy).rate_min_ms ?? 1, v); })));
}

// ── Mode registry ────────────────────────────────────────────────────────────
// This is the only place mode slot assignment is decided. tools/sync_modes.py
// reads the exported JSON and rewrites the generated regions of mode.h/mode.c
// to match. Slot numbers are never typed in directly — a mode's slot is just
// its position in modeRegistry, reassigned via drag-and-drop and recomputed
// by reindexSlots() any time the order changes.
function slugifyModeId(name) {
  let s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!s) s = 'mode';
  if (/^[0-9]/.test(s)) s = '_' + s;
  return s;
}

function loadModeRegistry() {
  try {
    const raw = localStorage.getItem(MODE_REGISTRY_KEY);
    if (raw) modeRegistry = JSON.parse(raw);
  } catch {
    modeRegistry = [];
  }
}

function saveModeRegistry() {
  localStorage.setItem(MODE_REGISTRY_KEY, JSON.stringify(modeRegistry));
}

function reindexSlots() {
  modeRegistry.forEach((m, i) => { m.slot = i; });
}

function openModesPanel() {
  renderModesPanel();
  document.getElementById('modes-modal').classList.remove('hidden');
}

function closeModesPanel() {
  document.getElementById('modes-modal').classList.add('hidden');
  saveModeRegistry();
  state.forEach((cfg, xy) => { if (cfg.type === 'mode_switch') refreshPad(xy); });
  if (selectedXy !== null && state.get(selectedXy)?.type === 'mode_switch') {
    showProperties(selectedXy);
  }
}

function renderModesPanel() {
  const body = document.getElementById('modes-body');
  body.innerHTML = '';

  if (modeRegistry.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'modes-empty';
    empty.textContent = 'No modes registered yet. Add one for each mode you\'ve built (matching the name passed to tools/json_to_mode.py), then assign it a slot number.';
    body.appendChild(empty);
  }

  reindexSlots();
  modeRegistry.forEach((entry, i) => body.appendChild(renderModeRow(entry, i)));
}

function renderModeRow(entry, index) {
  const row = document.createElement('div');
  row.className = 'mode-row';

  const handle = document.createElement('span');
  handle.className = 'mode-row-handle';
  handle.title = 'Drag to reorder';
  handle.textContent = '⠿';
  handle.draggable = true;
  row.appendChild(handle);

  const slotLabel = document.createElement('span');
  slotLabel.className = 'mode-row-slot';
  slotLabel.title = 'Slot number (set by position — drag to reorder)';
  slotLabel.textContent = index;
  row.appendChild(slotLabel);

  handle.addEventListener('dragstart', e => {
    dragModeIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    row.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => row.classList.remove('dragging'));
  row.addEventListener('dragover', e => {
    e.preventDefault();
    if (dragModeIndex !== null && dragModeIndex !== index) row.classList.add('drag-over');
  });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', e => {
    e.preventDefault();
    row.classList.remove('drag-over');
    if (dragModeIndex === null || dragModeIndex === index) return;
    const [moved] = modeRegistry.splice(dragModeIndex, 1);
    modeRegistry.splice(index, 0, moved);
    dragModeIndex = null;
    saveModeRegistry();
    renderModesPanel();
  });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Display name, e.g. Mixer';
  nameInput.value = entry.name;
  nameInput.addEventListener('input', () => {
    entry.name = nameInput.value;
    saveModeRegistry();
  });
  row.appendChild(nameInput);

  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.placeholder = 'id, matches json_to_mode.py name';
  idInput.value = entry.id;
  idInput.addEventListener('change', () => {
    entry.id = slugifyModeId(idInput.value);
    idInput.value = entry.id;
    saveModeRegistry();
  });
  row.appendChild(idInput);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-danger';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => {
    modeRegistry = modeRegistry.filter(m => m !== entry);
    saveModeRegistry();
    renderModesPanel();
  });
  row.appendChild(removeBtn);

  return row;
}

function exportModesJSON() {
  reindexSlots();
  const blob = new Blob([JSON.stringify({ modes: modeRegistry }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'modes.json';
  a.click();
  URL.revokeObjectURL(url);
}

function loadModesJSON(obj) {
  if (!obj || !Array.isArray(obj.modes)) throw new Error('bad format');
  modeRegistry = obj.modes
    .map(m => ({
      slot: parseInt(m.slot) || 0,
      name: String(m.name || ''),
      id: slugifyModeId(String(m.id || m.name || '')),
    }))
    .sort((a, b) => a.slot - b.slot);
  reindexSlots();
  saveModeRegistry();
  renderModesPanel();
  state.forEach((cfg, xy) => { if (cfg.type === 'mode_switch') refreshPad(xy); });
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