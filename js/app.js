import { LANGS, detectLang, isLang, t } from './i18n.js';
import { CURRENCIES, CUSTOM, DENSITIES, FAMILIES, GRADES, customPipe, getStandard, lookup, parseNumber, totals } from './calc.js';

const STORAGE_KEY = 'datadev-pipe:v1';
const FAMILY_KEYS = [...Object.keys(FAMILIES), CUSTOM];
const SOURCES = [
  'INSO 14427-2 / ISO 4427 — PE80, PE100',
  'DIN 8077 / ISO 15874-2 — PP-R',
  'ISO 1452-2 / INSO 9118 — PVC-U pressure',
  'EN 1401-1, EN 1329-1 — PVC-U drainage',
  'ISO 22391-2 / ISO 15875-2 — PE-RT, PEX',
  'ASTM D1785, ASTM F441 — PVC / CPVC Sch 40/80',
  'ISO 15493 — ABS · ISO 10931 — PVDF',
  'EN 1057, ASTM B88 — copper',
  'EN 10255, ASME B36.10M — carbon steel',
  'ASME B36.19M — stainless steel',
  'ISO 4065, ISO 11922-1 — wall series & tolerances',
];

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/** @typedef {import('./i18n.js').Lang} Lang */
const state = {
  /** @type {Lang} */ lang: 'fa',
  currency: 'IRR',
  family: 'pe',
  /** @type {Record<string, string>} */ std: {},
  /** @type {Record<string, {size: string, cls: string}>} last size/class per family+standard */ picks: {},
  size: '110',
  cls: '10',
  grade: '304',
  material: 'Aluminium',
  od: '',
  wall: '',
  price: '',
  length: '1',
  view: 'calc',
  tFamily: 'pe',
  tStd: '',
};

// ------------------------------------------------------------------ persistence
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') Object.assign(state, saved);
  } catch { /* storage unavailable — keep defaults */ }
  if (!isLang(state.lang)) state.lang = detectLang();
  if (!FAMILY_KEYS.includes(state.family)) state.family = 'pe';
  if (!CURRENCIES.includes(state.currency)) state.currency = 'IRR';
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ formatting
const tr = (key) => t(state.lang, key);
const locale = () => LANGS[state.lang].locale;

function fmt(value, digits = 3) {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: digits }).format(value);
}

function money(value) {
  if (state.currency === 'IRR' || state.currency === 'IRT') return `${fmt(value, 0)} ${tr(`cur.${state.currency}`)}`;
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency: state.currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${fmt(value, 2)} ${state.currency}`;
  }
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  node.append(...children);
  return node;
}

function fillSelect(select, options, value) {
  select.replaceChildren(...options.map(([v, label]) => el('option', { value: v, text: label })));
  if (options.some(([v]) => v === value)) select.value = value;
  return select.value;
}

// ------------------------------------------------------------------ i18n
function applyLanguage() {
  const { dir } = LANGS[state.lang];
  document.documentElement.lang = state.lang;
  document.documentElement.dir = dir;
  document.title = `${tr('app.title')} | DataDev`;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = tr(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((n) => { n.innerHTML = tr(n.dataset.i18nHtml); });
  const langOptions = Object.entries(LANGS).map(([k, v]) => [k, v.name]);
  fillSelect($('langSelect'), langOptions, state.lang);
  fillSelect($('setLang'), langOptions, state.lang);
  fillSelect($('currency'), CURRENCIES.map((c) => [c, c === 'IRR' || c === 'IRT' ? tr(`cur.${c}`) : c]), state.currency);
}

// ------------------------------------------------------------------ calculator form
const isCustom = () => state.family === CUSTOM;
const familyLabel = (key) => tr(`fam.${key}`);
const shortStd = (label) => label.split(' · ')[0];

function currentStdKey(family = state.family) {
  const stds = Object.keys(FAMILIES[family]?.standards ?? {});
  if (!stds.includes(state.std[family])) state.std[family] = stds[0];
  return state.std[family];
}

function renderChips() {
  const chips = FAMILY_KEYS.map((key) => {
    const icon = key === CUSTOM ? 'ρ' : FAMILIES[key].icon;
    const chip = el('button', { type: 'button', role: 'tab', className: 'chip glass', 'data-family': key, 'aria-selected': String(key === state.family) },
      [el('span', { className: 'ic', text: icon }), familyLabel(key)]);
    chip.addEventListener('click', () => selectFamily(key));
    return chip;
  });
  $('familyChips').replaceChildren(...chips);
}

function selectFamily(key) {
  state.family = key;
  renderChips();
  renderForm();
  document.querySelector(`.chip[data-family="${key}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  calculate();
}

function renderStandardSeg() {
  const seg = $('standardSeg');
  if (isCustom()) { seg.hidden = true; $('standardLabel').textContent = 'W = π·(D − t)·t·ρ'; return; }
  const stds = FAMILIES[state.family].standards;
  const active = currentStdKey();
  seg.hidden = Object.keys(stds).length < 2;
  seg.replaceChildren(...Object.entries(stds).map(([key, std]) => {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(key === active), text: shortStd(std.label) });
    b.addEventListener('click', () => { state.std[state.family] = key; renderForm(); calculate(); });
    return b;
  }));
  $('standardLabel').textContent = stds[active].label;
}

const pickKey = () => `${state.family}/${currentStdKey()}`;

function rememberPick() {
  if (!isCustom()) state.picks[pickKey()] = { size: state.size, cls: state.cls };
}

function renderSizeAndClass() {
  const std = getStandard(state.family, currentStdKey());
  if (!std) return;
  const pick = state.picks[pickKey()];
  if (pick) ({ size: state.size, cls: state.cls } = pick);
  // Keep the chosen size when the new standard has it; otherwise start a third of the way into the range.
  const fallback = std.sizes[Math.floor(std.sizes.length / 3)].key;
  const wanted = std.sizes.some((s) => s.key === state.size) ? state.size : fallback;
  state.size = fillSelect($('size'), std.sizes.map((s) => [s.key, s.label]), wanted);
  renderClasses(std);
}

function renderClasses(std) {
  const row = std.cells[state.size] ?? {};
  const available = std.classes.filter((c) => row[c.key]);
  const options = (available.length ? available : std.classes).map((c) => [c.key, c.label]);
  state.cls = fillSelect($('pipeClass'), options, state.cls);
}

function renderForm() {
  const custom = isCustom();
  document.querySelectorAll('[data-std]').forEach((n) => { n.hidden = custom; });
  document.querySelectorAll('[data-custom]').forEach((n) => { n.hidden = !custom; });
  const graded = !custom && Boolean(FAMILIES[state.family].grades);
  $('gradeField').hidden = !graded;
  if (graded) state.grade = fillSelect($('grade'), Object.keys(GRADES).map((g) => [g, `AISI ${g} · ρ ${GRADES[g]}`]), state.grade);
  if (custom) state.material = fillSelect($('material'), Object.entries(DENSITIES).map(([m, rho]) => [m, `${m} · ${rho} g/cm³`]), state.material);
  renderStandardSeg();
  if (!custom) renderSizeAndClass();
  $('calcMeta').textContent = familyLabel(state.family);
  $('priceUnit').textContent = state.currency === 'IRR' || state.currency === 'IRT' ? tr(`cur.${state.currency}`) : state.currency;
  renderPreview();
}

// ------------------------------------------------------------------ calculation
function readInputs() {
  state.price = /** @type {HTMLInputElement} */ ($('price')).value;
  state.length = /** @type {HTMLInputElement} */ ($('length')).value;
  state.od = /** @type {HTMLInputElement} */ ($('od')).value;
  state.wall = /** @type {HTMLInputElement} */ ($('wall')).value;
}

function resolvePipe() {
  if (isCustom()) return customPipe(parseNumber(state.od), parseNumber(state.wall), DENSITIES[state.material]);
  return lookup(state.family, currentStdKey(), state.size, state.cls, state.grade);
}

function setStatus(message, isError = false) {
  const s = $('status');
  s.textContent = message;
  s.classList.toggle('err', isError);
}

function markInvalid(id, invalid) {
  $(id).setAttribute('aria-invalid', String(invalid));
}

function validate() {
  const length = parseNumber(state.length);
  const price = parseNumber(state.price);
  const lengthOk = length > 0;
  const priceOk = state.price.trim() === '' || price >= 0;
  markInvalid('length', !lengthOk);
  markInvalid('price', !priceOk);
  if (!lengthOk) return { error: tr('e.length') };
  if (!priceOk) return { error: tr('e.price') };
  return { length, price };
}

function calculate() {
  readInputs();
  rememberPick();
  saveState();
  const input = validate();
  const pipe = resolvePipe();
  if (isCustom()) { markInvalid('od', !pipe); markInvalid('wall', !pipe); }
  if ('error' in input) return showResult(null, input.error);
  if (!pipe) return showResult(null, isCustom() ? tr('e.dims') : tr('e.noData'));
  showResult({ pipe, ...totals(pipe.kgm, input.length, input.price) });
}

function showResult(result, error = '') {
  const set = (id, v) => { $(id).textContent = v; };
  if (!result) {
    ['rClass', 'rWall', 'rId', 'rKgm', 'rWeight', 'rPm', 'rTotal'].forEach((id) => set(id, '—'));
    setStatus(error, true);
    return;
  }
  const { pipe, weight, pricePerMeter, total } = result;
  set('rClass', shortStd(pipe.classLabel));
  set('rWall', `${fmt(pipe.wall, 2)} mm`);
  set('rId', `${fmt(pipe.id, 2)} mm`);
  set('rKgm', `${fmt(pipe.kgm)} kg`);
  set('rWeight', `${fmt(weight, 2)} kg`);
  set('rPm', pricePerMeter == null ? '—' : money(pricePerMeter));
  set('rTotal', total == null ? '—' : money(total));
  setStatus(total == null ? tr('r.noPrice') : `${fmt(pipe.od, 2)} × ${fmt(pipe.wall, 2)} mm`);
  const res = $('result');
  res.classList.remove('flash');
  void res.offsetWidth;
  res.classList.add('flash');
  renderPreview();
  if (state.view === 'compare') renderCompare();
}

// ------------------------------------------------------------------ tables
function cellNode(cell, highlight) {
  if (!cell) return el('td', { className: 'na', text: '—' });
  return el('td', { className: highlight ? 'hl' : '' }, [fmt(cell[1]), el('small', { text: fmt(cell[0], 2) })]);
}

function buildTable(std, rows, selection) {
  const head = el('tr', {}, [el('th', { text: tr('t.size') }), ...std.classes.map((c) => el('th', { text: c.label }))]);
  const body = rows.map((size) => {
    const isRow = selection && size.key === selection.size;
    return el('tr', { className: isRow ? 'hl' : '' }, [
      el('th', { text: size.label }),
      ...std.classes.map((c) => cellNode(std.cells[size.key]?.[c.key], isRow && c.key === selection.cls)),
    ]);
  });
  return el('table', {}, [el('thead', {}, [head]), el('tbody', {}, body)]);
}

function renderPreview() {
  const wrap = $('preview');
  if (isCustom()) { wrap.replaceChildren(); wrap.hidden = true; $('previewTitle').textContent = ''; return; }
  wrap.hidden = false;
  const std = getStandard(state.family, currentStdKey());
  const i = Math.max(0, std.sizes.findIndex((s) => s.key === state.size));
  const rows = std.sizes.slice(Math.max(0, i - 1), i + 2);
  $('previewTitle').textContent = shortStd(std.label);
  wrap.replaceChildren(buildTable(std, rows, { size: state.size, cls: state.cls }));
}

function renderFullTable() {
  const families = Object.keys(FAMILIES);
  if (!families.includes(state.tFamily)) state.tFamily = families[0];
  state.tFamily = fillSelect($('tFamily'), families.map((k) => [k, familyLabel(k)]), state.tFamily);
  const stds = FAMILIES[state.tFamily].standards;
  state.tStd = fillSelect($('tStandard'), Object.entries(stds).map(([k, s]) => [k, s.label]), state.tStd);
  const selection = state.tFamily === state.family && state.tStd === currentStdKey() ? { size: state.size, cls: state.cls } : null;
  $('fullTable').replaceChildren(buildTable(stds[state.tStd], stds[state.tStd].sizes, selection));
}

function renderCompare() {
  const wrap = $('compareTable');
  if (isCustom()) { wrap.replaceChildren(el('p', { className: 'hint', text: tr('e.noData') })); return; }
  const stdKey = currentStdKey();
  const std = getStandard(state.family, stdKey);
  const length = parseNumber(state.length) > 0 ? parseNumber(state.length) : 1;
  const price = parseNumber(state.price);
  const size = std.sizes.find((s) => s.key === state.size);
  $('compareMeta').textContent = `${familyLabel(state.family)} · ${shortStd(std.label)} · ${size?.label ?? ''}`;
  const head = el('tr', {}, [tr('r.class'), tr('r.wall'), tr('r.wm'), tr('r.wt'), tr('r.pm')].map((h) => el('th', { text: h })));
  const rows = std.classes.map((c) => {
    const pipe = lookup(state.family, stdKey, state.size, c.key, state.grade);
    if (!pipe) return el('tr', {}, [el('th', { text: c.label }), ...Array.from({ length: 4 }, () => el('td', { className: 'na', text: '—' }))]);
    const sum = totals(pipe.kgm, length, price);
    return el('tr', { className: c.key === state.cls ? 'hl' : '' }, [
      el('th', { text: c.label }),
      el('td', { text: `${fmt(pipe.wall, 2)}` }),
      el('td', { text: fmt(pipe.kgm) }),
      el('td', { text: fmt(sum.weight, 2) }),
      el('td', { text: sum.pricePerMeter == null ? '—' : money(sum.pricePerMeter) }),
    ]);
  });
  wrap.replaceChildren(el('table', {}, [el('thead', {}, [head]), el('tbody', {}, rows)]));
}

// ------------------------------------------------------------------ navigation
function showView(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== view; });
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
  if (view === 'tables') {
    if (!isCustom()) { state.tFamily = state.family; state.tStd = currentStdKey(); }
    renderFullTable();
  }
  if (view === 'compare') renderCompare();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  saveState();
}

function renderAll() {
  applyLanguage();
  renderChips();
  renderForm();
  $('sources').replaceChildren(...SOURCES.map((s) => el('li', { text: s })));
  calculate();
  if (state.view !== 'calc') showView(state.view);
}

// ------------------------------------------------------------------ events
function setLanguage(lang) {
  if (!isLang(lang)) return;
  state.lang = lang;
  renderAll();
}

function bindEvents() {
  $('langSelect').addEventListener('change', (e) => setLanguage(e.target.value));
  $('setLang').addEventListener('change', (e) => setLanguage(e.target.value));
  $('currency').addEventListener('change', (e) => { state.currency = e.target.value; renderForm(); calculate(); });
  $('size').addEventListener('change', (e) => {
    state.size = e.target.value;
    renderClasses(getStandard(state.family, currentStdKey()));
    calculate();
  });
  $('pipeClass').addEventListener('change', (e) => { state.cls = e.target.value; calculate(); });
  $('grade').addEventListener('change', (e) => { state.grade = e.target.value; calculate(); });
  $('material').addEventListener('change', (e) => { state.material = e.target.value; calculate(); });
  ['price', 'length', 'od', 'wall'].forEach((id) => $(id).addEventListener('input', calculate));
  $('calcForm').addEventListener('submit', (e) => {
    e.preventDefault();
    calculate();
    $('result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  $('tFamily').addEventListener('change', (e) => { state.tFamily = e.target.value; state.tStd = ''; renderFullTable(); });
  $('tStandard').addEventListener('change', (e) => { state.tStd = e.target.value; renderFullTable(); });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.go)));
}

function restoreInputs() {
  /** @type {HTMLInputElement} */ ($('price')).value = state.price;
  /** @type {HTMLInputElement} */ ($('length')).value = state.length || '1';
  /** @type {HTMLInputElement} */ ($('od')).value = state.od;
  /** @type {HTMLInputElement} */ ($('wall')).value = state.wall;
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (err) {
    console.warn('Service worker registration failed', err);
  }
}

loadState();
restoreInputs();
bindEvents();
renderAll();
registerServiceWorker();
