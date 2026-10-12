import { DATA } from './data.js';

/**
 * @typedef {[number, number]} Cell  wall thickness (mm), weight (kg/m)
 * @typedef {{key: string, label: string, od: number}} Size
 * @typedef {{key: string, label: string}} PipeClass
 * @typedef {{label: string, rho: number, sizes: Size[], classes: PipeClass[], cells: Record<string, Record<string, Cell|null>>}} Standard
 * @typedef {{icon: string, grades?: boolean, standards: Record<string, Standard>}} Family
 * @typedef {{od: number, wall: number, id: number, kgm: number, classLabel: string}} PipeSpec
 */

export const CUSTOM = 'custom';
export const CURRENCIES = ['IRR', 'IRT', 'USD', 'EUR', 'TRY', 'AED', 'SAR', 'IQD'];

/** @type {Record<string, Family>} */
export const FAMILIES = DATA.families;
/** @type {Record<string, number>} */
export const GRADES = DATA.stainlessGrades;
/** @type {Record<string, number>} */
export const DENSITIES = DATA.densities;

const DIGITS = { '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9,
  '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };

/**
 * Parses user input written with Latin, Persian or Arabic digits and common separators.
 * @param {string} raw
 * @returns {number} NaN when empty or invalid
 */
export function parseNumber(raw) {
  const ascii = String(raw ?? '')
    .trim()
    .replace(/[۰-۹٠-٩]/g, (d) => String(DIGITS[d]))
    .replace(/[٬,\s']/g, '')
    .replace(/٫/g, '.');
  return ascii === '' ? NaN : Number(ascii);
}

/** @param {string} family @param {string} std */
export function getStandard(family, std) {
  return FAMILIES[family]?.standards[std] ?? null;
}

/**
 * Looks up a pipe in a standard table. Stainless weights scale with the grade density.
 * @returns {PipeSpec|null}
 */
export function lookup(family, std, sizeKey, classKey, grade) {
  const standard = getStandard(family, std);
  const cell = standard?.cells[sizeKey]?.[classKey];
  const size = standard?.sizes.find((s) => s.key === sizeKey);
  if (!standard || !cell || !size) return null;
  const [wall, kgm] = cell;
  const scale = FAMILIES[family].grades && GRADES[grade] ? GRADES[grade] / standard.rho : 1;
  const pipeClass = standard.classes.find((c) => c.key === classKey);
  return {
    od: size.od,
    wall,
    id: round(size.od - 2 * wall, 2),
    kgm: round(kgm * scale, 3),
    classLabel: pipeClass?.label ?? classKey,
  };
}

/**
 * Weight of any tube from its geometry: W = π·(D − t)·t·ρ.
 * @returns {PipeSpec|null} null when the geometry is impossible
 */
export function customPipe(od, wall, rho) {
  if (!(od > 0) || !(wall > 0) || !(rho > 0) || wall * 2 >= od) return null;
  return {
    od,
    wall,
    id: round(od - 2 * wall, 2),
    kgm: round((Math.PI * (od - wall) * wall * rho) / 1000, 3),
    classLabel: `ρ ${rho}`,
  };
}

/** @param {number} kgm @param {number} length @param {number} price NaN when not given */
export function totals(kgm, length, price) {
  const hasPrice = Number.isFinite(price) && price > 0;
  return {
    weight: kgm * length,
    pricePerMeter: hasPrice ? kgm * price : null,
    total: hasPrice ? kgm * price * length : null,
  };
}

/** @param {number} value @param {number} digits */
function round(value, digits) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
