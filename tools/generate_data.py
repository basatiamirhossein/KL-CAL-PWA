#!/usr/bin/env python3
"""Generate js/data.js — the pipe dimension and weight tables used by the app.

Every cell is ``[wall thickness mm, weight kg/m]``; ``None`` means the size/class
combination does not exist in that standard.

Method
------
* Plastic pressure pipes (ISO 4065 series): e_min = dn / (2·S + 1), rounded up to
  0.1 mm, with S taken as the exact R10/R20 preferred number. Weight uses the mean
  wall thickness (e_min + half the ISO 11922-1 grade V tolerance) — the same method
  DIN 8074 / 8077 / 8062 use for their published weights.
* Steel and copper: nominal wall, W = π·(D − t)·t·ρ.
* PE: official KabirLoole/INSO 14427-2 table kept verbatim (one shifted row fixed).

Run:  python3 tools/generate_data.py
"""
from __future__ import annotations

import json
import math
from decimal import ROUND_CEILING, Decimal
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "js" / "data.js"
INCH = 25.4

Cell = list | None


# --------------------------------------------------------------------------- helpers
def ceil01(x: float) -> float:
    return float(Decimal(str(round(x, 6))).quantize(Decimal("0.1"), rounding=ROUND_CEILING))


def s_exact(s: float) -> float:
    """ISO 4065 pipe series S are R10/R20 preferred numbers."""
    return 10 ** (round(20 * math.log10(s)) / 20)


def iso_wall(d: float, s: float, e_min: float) -> float:
    return max(e_min, ceil01(d / (2 * s_exact(s) + 1) - 0.005))


def tol_grade_v(e: float) -> float:
    return ceil01(0.1 * e + 0.1)


def w_mean(d: float, e: float, rho: float) -> float:
    em = e + tol_grade_v(e) / 2
    return round(math.pi * (d - em) * em * rho / 1000, 3)


def w_nominal(d: float, t: float, rho: float) -> float:
    return round(math.pi * (d - t) * t * rho / 1000, 3)


def iso_cell(d: float, s: float, rho: float, e_min: float, keep_min: bool) -> Cell:
    # A series whose calculated wall is below the standard's minimum is not listed by it.
    if not keep_min and d / (2 * s_exact(s) + 1) < e_min - 0.05:
        return None
    e = iso_wall(d, s, e_min)
    return [e, w_mean(d, e, rho)]


def iso_standard(sizes, classes, rho, e_min, keep_min=False):
    """classes: list of (key, label, S or callable(d) -> S)."""
    return {
        "rho": rho,
        "sizes": [{"key": str(d), "label": str(d), "od": d} for d in sizes],
        "classes": [{"key": k, "label": lbl} for k, lbl, _ in classes],
        "cells": {
            str(d): {k: iso_cell(d, s(d) if callable(s) else s, rho, e_min, keep_min) for k, _, s in classes}
            for d in sizes
        },
    }


def fixed_standard(rows, classes, rho, size_labels=None, method=w_mean):
    """rows: {size: (od, {class: wall | None})}."""
    return {
        "rho": rho,
        "sizes": [{"key": str(k), "label": (size_labels or {}).get(k, str(k)), "od": od} for k, (od, _) in rows.items()],
        "classes": [{"key": k, "label": lbl} for k, lbl in classes],
        "cells": {
            str(k): {c: (None if t is None else [t, method(od, t, rho)]) for c, t in walls.items()}
            for k, (od, walls) in rows.items()
        },
    }


# --------------------------------------------------------------------------- PE (official table)
PE_SIZES = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 160, 200, 250, 315, 355, 400]
PE_TABLE = {"PE80":{"20":{"4":None,"6":None,"8":None,"10":None,"12.5":[2.0,0.114]},"25":{"4":None,"6":None,"8":None,"10":[2.0,0.147],"12.5":[2.3,0.168]},"32":{"4":None,"6":None,"8":[2.0,0.191],"10":[2.4,0.228],"12.5":[3.0,0.275]},"40":{"4":None,"6":[2.0,0.243],"8":[2.4,0.29],"10":[3.0,0.356],"12.5":[3.7,0.425]},"50":{"4":None,"6":[2.4,0.368],"8":[3.0,0.447],"10":[3.7,0.543],"12.5":[4.6,0.659]},"63":{"4":None,"6":[3.0,0.571],"8":[3.8,0.72],"10":[4.7,0.865],"12.5":[5.8,1.043]},"75":{"4":None,"6":[3.6,0.817],"8":[4.5,1.005],"10":[5.6,1.226],"12.5":[6.8,1.456]},"90":{"4":None,"6":[4.3,1.172],"8":[5.4,1.445],"10":[6.7,1.756],"12.5":[8.2,2.11]},"110":{"4":None,"6":[5.3,1.759],"8":[6.6,2.151],"10":[8.1,2.601],"12.5":[10.0,3.13]},"125":{"4":None,"6":[6.0,2.247],"8":[7.4,2.743],"10":[9.2,3.352],"12.5":[11.4,4.06]},"160":{"4":None,"6":[7.7,3.692],"8":[9.5,4.495],"10":[11.8,5.48],"12.5":[14.6,6.643]},"200":{"4":None,"6":[9.6,5.748],"8":[11.9,7.018],"10":[14.7,8.531],"12.5":[18.2,10.36]},"250":{"4":None,"6":[11.9,8.889],"8":[14.8,10.91],"10":[18.4,13.34],"12.5":[22.7,16.12]},"315":{"4":[9.7,9.318],"6":[15.0,14.1],"8":[18.7,17.35],"10":[23.2,21.19],"12.5":[28.6,25.58]},"355":{"4":[10.9,11.78],"6":[16.9,17.9],"8":[21.1,22.09],"10":[26.1,26.87],"12.5":[32.2,32.47]},"400":{"4":[12.3,15.01],"6":[19.1,22.83],"8":[23.7,27.91],"10":[29.4,34.07],"12.5":[36.3,41.23]}},"PE100":{"20":{"4":None,"6":None,"8":None,"10":None,"12.5":None},"25":{"4":None,"6":None,"8":None,"10":None,"12.5":[2.0,0.147]},"32":{"4":None,"6":None,"8":None,"10":[2.0,0.191],"12.5":[2.4,0.228]},"40":{"4":None,"6":None,"8":[2.0,0.243],"10":[2.4,0.29],"12.5":[3.0,0.356]},"50":{"4":None,"6":[2.0,0.307],"8":[2.4,0.368],"10":[3.0,0.447],"12.5":[3.7,0.543]},"63":{"4":None,"6":[2.5,0.486],"8":[3.0,0.571],"10":[3.8,0.72],"12.5":[4.7,0.865]},"75":{"4":None,"6":[2.9,0.665],"8":[3.6,0.817],"10":[4.5,1.005],"12.5":[5.6,1.226]},"90":{"4":None,"6":[3.5,0.965],"8":[4.3,1.172],"10":[5.4,1.445],"12.5":[6.7,1.756]},"110":{"4":None,"6":[4.2,1.416],"8":[5.3,1.759],"10":[6.6,2.151],"12.5":[8.1,2.601]},"125":{"4":None,"6":[4.8,1.824],"8":[6.0,2.247],"10":[7.4,2.743],"12.5":[9.2,3.352]},"160":{"4":None,"6":[6.2,3.02],"8":[7.7,3.692],"10":[9.5,4.495],"12.5":[11.8,5.48]},"200":{"4":None,"6":[7.7,4.664],"8":[9.6,5.748],"10":[11.9,7.018],"12.5":[14.7,8.531]},"250":{"4":None,"6":[9.6,7.262],"8":[11.9,8.889],"10":[14.8,10.91],"12.5":[18.4,13.34]},"315":{"4":[7.7,7.46],"6":[12.1,11.54],"8":[15.0,14.1],"10":[18.7,17.35],"12.5":[23.2,21.19]},"355":{"4":[8.7,9.49],"6":[13.6,14.58],"8":[16.9,17.9],"10":[21.1,22.09],"12.5":[26.1,26.87]},"400":{"4":[9.8,12.03],"6":[15.3,18.49],"8":[19.1,22.83],"10":[23.7,27.91],"12.5":[29.4,34.07]}}}  # noqa: E501
PE_SDR = {"PE80": {"4": 33, "6": 21, "8": 17, "10": 13.6, "12.5": 11},
          "PE100": {"4": 41, "6": 26, "8": 21, "10": 17, "12.5": 13.6}}


def pe_standard(grade: str) -> dict:
    return {
        "rho": 0.95,
        "sizes": [{"key": str(d), "label": str(d), "od": d} for d in PE_SIZES],
        "classes": [{"key": p, "label": f"PN{p} · SDR {sdr}"} for p, sdr in PE_SDR[grade].items()],
        "cells": PE_TABLE[grade],
    }


# --------------------------------------------------------------------------- steel (ASME / EN)
NPS = {  # NPS: (OD mm, {schedule: wall mm})
    '1/8': (10.3, {'5S': None, '10S': 1.24, '40': 1.73, '80': 2.41, '160': None}),
    '1/4': (13.7, {'5S': None, '10S': 1.65, '40': 2.24, '80': 3.02, '160': None}),
    '3/8': (17.1, {'5S': None, '10S': 1.65, '40': 2.31, '80': 3.20, '160': None}),
    '1/2': (21.3, {'5S': 1.65, '10S': 2.11, '40': 2.77, '80': 3.73, '160': 4.78}),
    '3/4': (26.7, {'5S': 1.65, '10S': 2.11, '40': 2.87, '80': 3.91, '160': 5.56}),
    '1': (33.4, {'5S': 1.65, '10S': 2.77, '40': 3.38, '80': 4.55, '160': 6.35}),
    '1 1/4': (42.2, {'5S': 1.65, '10S': 2.77, '40': 3.56, '80': 4.85, '160': 6.35}),
    '1 1/2': (48.3, {'5S': 1.65, '10S': 2.77, '40': 3.68, '80': 5.08, '160': 7.14}),
    '2': (60.3, {'5S': 1.65, '10S': 2.77, '40': 3.91, '80': 5.54, '160': 8.74}),
    '2 1/2': (73.0, {'5S': 2.11, '10S': 3.05, '40': 5.16, '80': 7.01, '160': 9.53}),
    '3': (88.9, {'5S': 2.11, '10S': 3.05, '40': 5.49, '80': 7.62, '160': 11.13}),
    '4': (114.3, {'5S': 2.11, '10S': 3.05, '40': 6.02, '80': 8.56, '160': 13.49}),
    '5': (141.3, {'5S': 2.77, '10S': 3.40, '40': 6.55, '80': 9.53, '160': 15.88}),
    '6': (168.3, {'5S': 2.77, '10S': 3.40, '40': 7.11, '80': 10.97, '160': 18.26}),
    '8': (219.1, {'5S': 2.77, '10S': 3.76, '40': 8.18, '80': 12.70, '160': 23.01}),
    '10': (273.0, {'5S': 3.40, '10S': 4.19, '40': 9.27, '80': 15.09, '160': 28.58}),
    '12': (323.8, {'5S': 3.96, '10S': 4.57, '40': 10.31, '80': 17.48, '160': 33.32}),
}
STAINLESS_40S = {'12': 9.53}            # B36.19M 40S/80S differ from B36.10M above NPS 10/8
STAINLESS_80S = {'10': 12.70, '12': 12.70}
NPS_LABELS = {n: f'{n}" · {od}' for n, (od, _) in NPS.items()}


def asme(classes: list[tuple[str, str]], rho: float, picker) -> dict:
    rows = {n: (od, {c: picker(n, w, c) for c, _ in classes}) for n, (od, w) in NPS.items()}
    return fixed_standard(rows, classes, rho, NPS_LABELS, w_nominal)


def asme_wall(n, w, c):
    return w[c]


def stainless_wall(n, w, c):
    if c == '40S':
        return STAINLESS_40S.get(n, w['40'])
    if c == '80S':
        return STAINLESS_80S.get(n, w['80'])
    return w[c]


EN10255 = {  # DN: (NPS, OD, {L (L2), M, H})
    6: ('1/8', 10.2, {'L': None, 'M': 2.0, 'H': 2.65}), 8: ('1/4', 13.5, {'L': None, 'M': 2.35, 'H': 2.9}),
    10: ('3/8', 17.2, {'L': None, 'M': 2.35, 'H': 2.9}), 15: ('1/2', 21.3, {'L': 2.0, 'M': 2.65, 'H': 3.25}),
    20: ('3/4', 26.9, {'L': 2.3, 'M': 2.65, 'H': 3.25}), 25: ('1', 33.7, {'L': 2.6, 'M': 3.25, 'H': 4.05}),
    32: ('1 1/4', 42.4, {'L': 2.6, 'M': 3.25, 'H': 4.05}), 40: ('1 1/2', 48.3, {'L': 2.9, 'M': 3.25, 'H': 4.05}),
    50: ('2', 60.3, {'L': 2.9, 'M': 3.65, 'H': 4.5}), 65: ('2 1/2', 76.1, {'L': 3.2, 'M': 3.65, 'H': 4.5}),
    80: ('3', 88.9, {'L': 3.2, 'M': 4.05, 'H': 5.0}), 100: ('4', 114.3, {'L': 3.6, 'M': 4.5, 'H': 5.4}),
    125: ('5', 139.7, {'L': None, 'M': 5.0, 'H': 5.4}), 150: ('6', 165.1, {'L': None, 'M': 5.0, 'H': 5.4}),
}

# --------------------------------------------------------------------------- copper
EN1057 = {6: [0.8, 1.0], 8: [0.8, 1.0], 10: [0.8, 1.0], 12: [0.8, 1.0], 15: [0.7, 0.8, 1.0], 18: [0.8, 1.0],
          22: [0.9, 1.0, 1.5], 28: [0.9, 1.0, 1.5], 35: [1.2, 1.5], 42: [1.2, 1.5], 54: [1.2, 1.5, 2.0],
          76.1: [1.5, 2.0], 88.9: [2.0], 108: [2.5]}
EN1057_WALLS = sorted({t for ts in EN1057.values() for t in ts})
B88 = {'1/4': (.375, .035, .030, None), '3/8': (.500, .049, .035, .025), '1/2': (.625, .049, .040, .028),
       '5/8': (.750, .049, .042, None), '3/4': (.875, .065, .045, .032), '1': (1.125, .065, .050, .035),
       '1 1/4': (1.375, .065, .055, .042), '1 1/2': (1.625, .072, .060, .049), '2': (2.125, .083, .070, .058),
       '2 1/2': (2.625, .095, .080, .065), '3': (3.125, .109, .090, .072), '4': (4.125, .134, .110, .095)}

# --------------------------------------------------------------------------- PVC drainage
EN1329 = {32: 3.0, 40: 3.0, 50: 3.0, 75: 3.0, 110: 3.2, 125: 3.2, 160: 4.0, 200: 4.9}
EN1401 = {110: (None, 3.2, 3.2), 125: (None, 3.2, 3.7), 160: (3.2, 4.0, 4.7), 200: (3.9, 4.9, 5.9),
          250: (4.9, 6.2, 7.3), 315: (6.2, 7.7, 9.2), 400: (7.9, 9.8, 11.7), 500: (9.8, 12.3, 14.6)}

# ISO 1452-2: design coefficient 2.5 (σs 10 MPa) up to dn 90, 2.0 (σs 12.5 MPa) from dn 110
UPVC_S = {"PN6": (16, 20), "PN10": (10, 12.5), "PN16": (6.3, 8)}


def upvc_s(key: str):
    small, large = UPVC_S[key]
    return lambda d: small if d <= 90 else large


SCH = [('40', 'Sch 40'), ('80', 'Sch 80')]


def build() -> dict:
    plastic_sizes = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 160, 200, 225, 250, 315]
    return {
        "pe": {"icon": "PE", "standards": {
            "PE100": {"label": "PE100 · INSO 14427-2 / ISO 4427", **pe_standard("PE100")},
            "PE80": {"label": "PE80 · INSO 14427-2 / ISO 4427", **pe_standard("PE80")},
        }},
        "ppr": {"icon": "PP", "standards": {
            "DIN8077": {"label": "PP-R · DIN 8077 / ISO 15874", **iso_standard(
                [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 160],
                [("PN10", "PN10 · SDR 11", 5), ("PN16", "PN16 · SDR 7.4", 3.2), ("PN20", "PN20 · SDR 6", 2.5)],
                0.90, 1.8)},
        }},
        "upvc": {"icon": "UPVC", "standards": {
            "ISO1452": {"label": "ISO 1452-2 / INSO 9118", **iso_standard(
                [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 140, 160, 200, 225, 250, 315, 355, 400],
                [(k, k, upvc_s(k)) for k in UPVC_S], 1.40, 1.5)},
            "D1785": {"label": "ASTM D1785 · Sch 40/80", **asme(SCH, 1.40, asme_wall)},
        }},
        "pvc": {"icon": "PVC", "standards": {
            "EN1401": {"label": "EN 1401 · SN2 / SN4 / SN8", **fixed_standard(
                {d: (d, dict(zip(["SN2", "SN4", "SN8"], w))) for d, w in EN1401.items()},
                [("SN2", "SN2 · SDR 51"), ("SN4", "SN4 · SDR 41"), ("SN8", "SN8 · SDR 34")], 1.40)},
            "EN1329": {"label": "EN 1329 · BD", **fixed_standard(
                {d: (d, {"BD": w}) for d, w in EN1329.items()}, [("BD", "BD")], 1.40)},
        }},
        "pert": {"icon": "PEX", "standards": {
            "ISO22391": {"label": "PE-RT / PEX · ISO 22391 / ISO 15875", **iso_standard(
                [16, 20, 25, 32, 40, 50, 63, 75, 90, 110],
                [("S5", "S5 · SDR 11", 5), ("S3.2", "S3.2 · SDR 7.4", 3.2)], 0.94, 1.8, keep_min=True)},
        }},
        "cpvc": {"icon": "CPVC", "standards": {
            "F441": {"label": "ASTM F441 · Sch 40/80", **asme(SCH, 1.55, asme_wall)},
        }},
        "abs": {"icon": "ABS", "standards": {
            "ISO15493": {"label": "ISO 15493", **iso_standard(
                plastic_sizes, [("PN6", "PN6 · SDR 26", 12.5), ("PN10", "PN10 · SDR 17", 8),
                                ("PN16", "PN16 · SDR 11", 5)], 1.04, 1.8)},
        }},
        "pvdf": {"icon": "PVDF", "standards": {
            "ISO10931": {"label": "ISO 10931", **iso_standard(
                plastic_sizes, [("PN10", "PN10 · SDR 33", 16), ("PN16", "PN16 · SDR 21", 10)], 1.78, 1.9)},
        }},
        "copper": {"icon": "Cu", "standards": {
            "EN1057": {"label": "EN 1057", **fixed_standard(
                {d: (d, {str(t): (t if t in ts else None) for t in EN1057_WALLS}) for d, ts in EN1057.items()},
                [(str(t), f"{t} mm") for t in EN1057_WALLS], 8.9, method=w_nominal)},
            "B88": {"label": "ASTM B88 · K / L / M", **fixed_standard(
                {n: (round(od * INCH, 2), {c: (None if t is None else round(t * INCH, 3)) for c, t in zip("KLM", ts)})
                 for n, (od, *ts) in B88.items()},
                [("K", "Type K"), ("L", "Type L"), ("M", "Type M")], 8.94,
                {n: f'{n}" · {round(od * INCH, 2)}' for n, (od, *_ ) in B88.items()}, w_nominal)},
        }},
        "steel": {"icon": "Fe", "standards": {
            "EN10255": {"label": "EN 10255 (DIN 2440/2441)", **fixed_standard(
                {dn: (od, w) for dn, (_, od, w) in EN10255.items()},
                [("L", "L"), ("M", "M"), ("H", "H")], 7.85,
                {dn: f'DN{dn} · {n}" · {od}' for dn, (n, od, _) in EN10255.items()}, w_nominal)},
            "B3610": {"label": "ASME B36.10M", **asme(
                [('40', 'Sch 40'), ('80', 'Sch 80'), ('160', 'Sch 160')], 7.85, asme_wall)},
        }},
        "stainless": {"icon": "SS", "grades": True, "standards": {
            "B3619": {"label": "ASME B36.19M", **asme(
                [('5S', 'Sch 5S'), ('10S', 'Sch 10S'), ('40S', 'Sch 40S'), ('80S', 'Sch 80S')],
                7.93, stainless_wall)},
        }},
    }


STAINLESS_GRADES = {"201": 7.80, "304": 7.93, "304L": 7.93, "308": 7.93, "309S": 7.93, "310S": 7.98,
                    "316": 7.98, "316L": 7.98, "321": 7.93, "430": 7.70}

DENSITIES = {  # g/cm³ for the free calculator
    "PE80/PE100": 0.95, "PE-RT/PEX": 0.94, "PP-R": 0.90, "PP-H": 0.91, "PVC-U": 1.40, "PVC-C (CPVC)": 1.55,
    "ABS": 1.04, "PVDF": 1.78, "GRP/GRE": 1.90, "Carbon steel": 7.85, "Stainless 304/304L/308": 7.93,
    "Stainless 316/316L/310S": 7.98, "Stainless 201": 7.80, "Stainless 430": 7.70, "Ductile iron": 7.05,
    "Grey cast iron": 7.20, "Copper": 8.94, "Brass": 8.50, "Cu-Ni 90/10": 8.90, "Aluminium": 2.70,
    "Titanium": 4.51, "Lead": 11.34,
}


def main() -> None:
    data = {"families": build(), "stainlessGrades": STAINLESS_GRADES, "densities": DENSITIES}
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(
        "// Generated by tools/generate_data.py — do not edit by hand.\n"
        f"export const DATA = Object.freeze({body});\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
