/* SuperEssence Sheets — modèle de classeur, calcul et formats */
(function () {
  'use strict';
  const SE = window.SE;

  SE.settings = Object.assign({ dec: ',', theme: 'dark', haptics: true, beep: true }, JSON.parse(localStorage.getItem('se_settings') || '{}'));
  SE.saveSettings = () => localStorage.setItem('se_settings', JSON.stringify(SE.settings));

  // ---------- Nombres ----------
  SE.parseNumberLiteral = function (s) {
    if (s === null || s === undefined) return null;
    s = String(s).trim().replace(/ | /g, ' ');
    if (!s) return null;
    let pct = false;
    if (s.endsWith('%')) { pct = true; s = s.slice(0, -1).trim(); }
    s = s.replace(/\s?(€|\$|£)$/, '').replace(/^(€|\$|£)\s?/, '');
    if (/^[+-]?\d{1,3}( \d{3})+([.,]\d+)?$/.test(s)) s = s.replace(/ /g, '');
    if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
    const n = parseFloat(s);
    return pct ? n / 100 : n;
  };

  SE.parseDateLiteral = function (s) {
    let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s.trim());
    if (m) {
      let y = +m[3]; if (y < 100) y += 2000;
      const d = +m[1], mo = +m[2];
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return SE.dateToSerial(y, mo, d);
    }
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (m) return SE.dateToSerial(+m[1], +m[2], +m[3]);
    return null;
  };

  // Valeur littérale typée d'une saisie
  SE.literal = function (raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (raw[0] === "'") return raw.slice(1);
    const n = SE.parseNumberLiteral(raw);
    if (n !== null) return n;
    const u = raw.trim().toUpperCase();
    if (u === 'VRAI' || u === 'TRUE') return true;
    if (u === 'FAUX' || u === 'FALSE') return false;
    const d = SE.parseDateLiteral(raw);
    if (d !== null) return d;
    return raw;
  };

  function sepThousands(intStr) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function fixed(n, d, thousands) {
    let s = Math.abs(n).toFixed(d);
    let [i, f] = s.split('.');
    if (thousands) i = sepThousands(i);
    s = i + (f ? SE.settings.dec + f : '');
    return (n < 0 && /[1-9]/.test(s) ? '-' : '') + s;
  }
  SE.fixed = fixed;
  SE.fmtGeneral = function (n) {
    if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
    const a = Math.abs(n);
    if (a !== 0 && (a < 1e-6 || a >= 1e15)) return n.toExponential(4).replace('.', SE.settings.dec);
    let s = String(parseFloat(n.toPrecision(11)));
    return s.replace('.', SE.settings.dec);
  };
  const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const pad2 = (x) => String(x).padStart(2, '0');
  function fmtDate(n, kind) {
    const d = SE.serialToDate(n);
    const dd = pad2(d.getUTCDate()), mm = pad2(d.getUTCMonth() + 1), yy = d.getUTCFullYear();
    if (kind === 'dated') return DAYS[d.getUTCDay()] + ' ' + dd + '/' + mm;
    if (kind === 'datel') return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + yy;
    return dd + '/' + mm + '/' + yy;
  }
  function fmtTime(n) {
    const t = Math.round((n % 1) * 86400);
    return pad2(Math.floor(t / 3600)) + ':' + pad2(Math.floor((t % 3600) / 60));
  }

  SE.NUMBER_FORMATS = [
    { k: '', label: 'Standard' },
    { k: 'n0', label: 'Nombre (0)' },
    { k: 'n1', label: 'Nombre (0,0)' },
    { k: 'n2', label: 'Nombre (0,00)' },
    { k: 'th', label: 'Milliers (1 234)' },
    { k: 'pct', label: 'Pourcentage (75%)' },
    { k: 'pct1', label: 'Pourcentage (75,5%)' },
    { k: 'eur', label: 'Monétaire (€)' },
    { k: 'usd', label: 'Monétaire ($)' },
    { k: 'date', label: 'Date (31/12/2026)' },
    { k: 'dated', label: 'Date courte (lun. 31/12)' },
    { k: 'datel', label: 'Date longue (31 déc. 2026)' },
    { k: 'time', label: 'Heure (hh:mm)' },
    { k: 'dur', label: 'Durée (secondes → m:ss)' },
    { k: 'kg', label: 'Charge (kg)' },
    { k: 'lb', label: 'Charge (lb)' },
    { k: 'reps', label: 'Répétitions (reps)' },
    { k: 'sets', label: 'Séries (× séries)' },
    { k: 'km', label: 'Distance (km)' },
    { k: 'm', label: 'Distance (m)' },
    { k: 'kmh', label: 'Vitesse (km/h)' },
    { k: 'min', label: 'Minutes (min)' },
    { k: 'sec', label: 'Secondes (s)' },
    { k: 'bpm', label: 'Fréquence cardiaque (bpm)' },
    { k: 'kcal', label: 'Énergie (kcal)' },
    { k: 'rpe', label: 'RPE (@8)' },
    { k: 'cm', label: 'Mesure (cm)' },
    { k: 'text', label: 'Texte' }
  ];
  const UNIT = { kg: ' kg', lb: ' lb', reps: ' reps', km: ' km', m: ' m', kmh: ' km/h', min: ' min', sec: ' s', bpm: ' bpm', kcal: ' kcal', cm: ' cm' };

  SE.formatValue = function (v, nf) {
    if (v === null || v === undefined) return '';
    if (SE.isErr(v)) return v.err;
    if (v && v.empty) return '';
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    if (Array.isArray(v)) return SE.formatValue(v[0] && v[0][0], nf);
    if (typeof v !== 'number') return String(v);
    switch (nf) {
      case 'n0': return fixed(v, 0, true);
      case 'n1': return fixed(v, 1, true);
      case 'n2': return fixed(v, 2, true);
      case 'th': return fixed(v, 0, true);
      case 'pct': return fixed(v * 100, 0) + '%';
      case 'pct1': return fixed(v * 100, 1) + '%';
      case 'eur': return fixed(v, 2, true) + ' €';
      case 'usd': return '$' + fixed(v, 2, true);
      case 'date': case 'dated': case 'datel': return fmtDate(v, nf);
      case 'time': return fmtTime(v);
      case 'dur': return SE.fmtDuration(v);
      case 'sets': return SE.fmtGeneral(v) + ' ×';
      case 'rpe': return '@' + SE.fmtGeneral(v);
      default:
        if (UNIT[nf]) {
          const n = Math.round(v * 100) / 100;
          const d = Number.isInteger(n) ? 0 : Number.isInteger(n * 10) ? 1 : 2;
          return fixed(n, d, Math.abs(n) >= 10000) + UNIT[nf];
        }
        return SE.fmtGeneral(v);
    }
  };

  SE.formatWithPattern = function (n, pat) {
    const p = pat.toLowerCase();
    if (/[dmy]/.test(p) && !/0/.test(p)) {
      const d = SE.serialToDate(n);
      return p.replace(/yyyy|aaaa/g, d.getUTCFullYear()).replace(/dd|jj/g, pad2(d.getUTCDate())).replace(/mm/g, pad2(d.getUTCMonth() + 1));
    }
    const isPct = p.includes('%');
    const val = isPct ? n * 100 : n;
    const dm = /[.,](0+)/.exec(p);
    const dec = dm ? dm[1].length : 0;
    const thousands = /#[ ,.]##/.test(p) || /0 000/.test(p);
    const prefix = pat.match(/^[^0#]*/)[0], suffix = pat.match(/[^0#%]*%?[^0#]*$/)[0];
    return prefix.replace(/[#0.,]/g, '') + fixed(val, dec, thousands) + (isPct ? '%' : '') + suffix.replace(/[#0.,%]/g, '');
  };

  // ---------- Feuilles ----------
  let uid = Date.now();
  SE.uid = () => (uid++).toString(36);

  SE.newSheet = function (name, rows, cols) {
    return { id: SE.uid(), name, rows: rows || 200, cols: cols || 26, cells: {}, colW: {}, rowH: {}, merges: [], freezeR: 0, freezeC: 0, cf: [], dv: [], charts: [], tab: '', grid: true };
  };
  SE.newWorkbook = function (name) {
    return { id: SE.uid(), name: name || 'Nouveau classeur', sheets: [SE.newSheet('Feuille1')], active: 0, created: Date.now(), modified: Date.now(), v: 1 };
  };

  SE.DEFAULT_COL_W = 92;
  SE.DEFAULT_ROW_H = 26;
  SE.key = (r, c) => r + ',' + c;

  SE.cell = (sh, r, c) => sh.cells[r + ',' + c];
  SE.setRaw = function (sh, r, c, raw) {
    const k = r + ',' + c;
    let cell = sh.cells[k];
    if (raw === '' || raw === null || raw === undefined) {
      if (cell) { delete cell.v; if (!cell.s || !Object.keys(cell.s).length) delete sh.cells[k]; }
      return;
    }
    if (!cell) cell = sh.cells[k] = {};
    cell.v = String(raw);
    if (r >= sh.rows) sh.rows = r + 20;
    if (c >= sh.cols) sh.cols = c + 2;
  };
  SE.setStyle = function (sh, r, c, patch) {
    const k = r + ',' + c;
    let cell = sh.cells[k];
    if (!cell) cell = sh.cells[k] = {};
    const s = Object.assign({}, cell.s || {});
    for (const p in patch) { if (patch[p] === null || patch[p] === undefined || patch[p] === false || patch[p] === '') delete s[p]; else s[p] = patch[p]; }
    if (Object.keys(s).length) cell.s = s; else delete cell.s;
    if (cell.v === undefined && !cell.s) delete sh.cells[k];
  };
  SE.colW = (sh, c) => (sh.colW[c] !== undefined ? sh.colW[c] : SE.DEFAULT_COL_W);
  SE.rowH = (sh, r) => (sh.rowH[r] !== undefined ? sh.rowH[r] : SE.DEFAULT_ROW_H);

  SE.mergeAt = function (sh, r, c) {
    for (const m of sh.merges) if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m;
    return null;
  };

  SE.usedRange = function (sh) {
    let r2 = -1, c2 = -1;
    for (const k in sh.cells) {
      const cell = sh.cells[k];
      if (cell.v === undefined && !(cell.s && (cell.s.bg || cell.s.bd))) continue;
      const [r, c] = k.split(',').map(Number);
      if (r > r2) r2 = r;
      if (c > c2) c2 = c;
    }
    for (const m of sh.merges) { r2 = Math.max(r2, m.r2); c2 = Math.max(c2, m.c2); }
    return { r1: 0, c1: 0, r2, c2 };
  };

  // ---------- Moteur de calcul ----------
  class Calc {
    constructor(wb) { this.wb = wb; this.cache = new Map(); this.stack = new Set(); this.gen = 0; }
    invalidate() { this.cache.clear(); this.gen++; }
    sheetIndex(name) {
      if (name === null || name === undefined) return -1;
      const n = name.toLowerCase();
      return this.wb.sheets.findIndex((s) => s.name.toLowerCase() === n);
    }
    ctxFor(si) {
      const self = this;
      const res = (sheet) => (sheet === null ? si : self.sheetIndex(sheet));
      return {
        getCell(sheet, r, c) { const i = res(sheet); if (i < 0) return SE.ERR.REF; return self.value(i, r, c); },
        getRange(sheet, r1, c1, r2, c2) {
          const i = res(sheet); if (i < 0) return SE.ERR.REF;
          const sh = self.wb.sheets[i];
          r2 = Math.min(r2, Math.max(sh.rows, r1 + 1) - 1);
          const out = [];
          for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(self.value(i, r, c)); out.push(row); }
          return out;
        },
        sheetRows(sheet) { const i = res(sheet); return i < 0 ? 1 : self.wb.sheets[i].rows; }
      };
    }
    value(si, r, c) {
      const sh = this.wb.sheets[si];
      if (!sh) return SE.ERR.REF;
      const cell = sh.cells[r + ',' + c];
      if (!cell || cell.v === undefined) return null;
      const key = si * 1e10 + r * 1e5 + c;
      if (this.cache.has(key)) return this.cache.get(key);
      const raw = cell.v;
      let v;
      if (raw[0] === '=' && raw.length > 1) {
        if (this.stack.has(key)) return SE.ERR.CYCLE;
        this.stack.add(key);
        try {
          v = SE.evaluate(SE.getAst(raw.slice(1)), this.ctxFor(si));
        } catch (e) { v = SE.ERR.VALUE; }
        this.stack.delete(key);
        if (Array.isArray(v)) v = v[0] ? v[0][0] : null;
        if (v && v.empty) v = 0;
        if (v === null || v === undefined) v = 0;
      } else if (cell.s && cell.s.nf === 'text') v = raw;
      else v = SE.literal(raw);
      this.cache.set(key, v);
      return v;
    }
  }
  SE.Calc = Calc;

  // ---------- Mise en forme conditionnelle ----------
  SE.cfStyle = function (sh, calc, si, r, c, v) {
    if (!sh.cf || !sh.cf.length) return null;
    let out = null;
    for (const rule of sh.cf) {
      if (r < rule.r1 || r > rule.r2 || c < rule.c1 || c > rule.c2) continue;
      let hit = false;
      const a = SE.literal(String(rule.a ?? '')), b = SE.literal(String(rule.b ?? ''));
      if (rule.type === 'scale' || rule.type === 'bar') {
        if (typeof v !== 'number') continue;
        if (!rule._g || rule._g !== calc.gen) {
          let mn = Infinity, mx = -Infinity;
          for (let rr = rule.r1; rr <= Math.min(rule.r2, sh.rows - 1); rr++) for (let cc = rule.c1; cc <= rule.c2; cc++) {
            const x = calc.value(si, rr, cc);
            if (typeof x === 'number') { mn = Math.min(mn, x); mx = Math.max(mx, x); }
          }
          rule._mn = mn; rule._mx = mx; rule._g = calc.gen;
        }
        const t = rule._mx > rule._mn ? (v - rule._mn) / (rule._mx - rule._mn) : 1;
        out = Object.assign(out || {}, rule.type === 'bar' ? { _bar: t, _barColor: rule.color || '#FFC72C' } : { bg: SE.mixScale(rule.colors || ['#e74c3c', '#f1c40f', '#2ecc71'], t) });
        continue;
      }
      switch (rule.type) {
        case 'gt': hit = typeof v === 'number' && v > a; break;
        case 'lt': hit = typeof v === 'number' && v < a; break;
        case 'gte': hit = typeof v === 'number' && v >= a; break;
        case 'lte': hit = typeof v === 'number' && v <= a; break;
        case 'eq': hit = v !== null && String(SE.toStr(v)).toLowerCase() === String(SE.toStr(a)).toLowerCase(); break;
        case 'between': hit = typeof v === 'number' && v >= a && v <= b; break;
        case 'contains': hit = v !== null && SE.toStr(v).toLowerCase().includes(String(rule.a).toLowerCase()); break;
        case 'empty': hit = v === null || v === ''; break;
        case 'notempty': hit = !(v === null || v === ''); break;
        case 'true': hit = v === true; break;
      }
      if (hit) out = Object.assign(out || {}, rule.style);
    }
    return out;
  };
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  SE.mixScale = function (cols, t) {
    t = Math.max(0, Math.min(1, t));
    const seg = (cols.length - 1) * t;
    const i = Math.min(Math.floor(seg), cols.length - 2);
    const f = seg - i;
    const a = hex(cols[i]), b = hex(cols[i + 1]);
    const m = a.map((x, k) => Math.round(x + (b[k] - x) * f));
    return '#' + m.map((x) => x.toString(16).padStart(2, '0')).join('');
  };

  // ---------- Validation (listes déroulantes) ----------
  SE.dvAt = function (sh, r, c) {
    if (!sh.dv) return null;
    for (const d of sh.dv) if (r >= d.r1 && r <= d.r2 && c >= d.c1 && c <= d.c2) return d;
    return null;
  };

  // ---------- Insertion / suppression de lignes et colonnes ----------
  function remapKeyed(obj, fn) {
    const out = {};
    for (const k in obj) { const n = fn(+k); if (n !== null) out[n] = obj[k]; }
    return out;
  }
  SE.structural = function (wb, si, axis, at, count) {
    // axis 'r' | 'c' ; count > 0 insert, < 0 delete
    const sh = wb.sheets[si];
    const del = count < 0, n = Math.abs(count);
    const mapIdx = (i) => {
      if (i < at) return i;
      if (del) return i < at + n ? null : i - n;
      return i + n;
    };
    const cells = {};
    for (const k in sh.cells) {
      const [r, c] = k.split(',').map(Number);
      const nr = axis === 'r' ? mapIdx(r) : r, nc = axis === 'c' ? mapIdx(c) : c;
      if (nr === null || nc === null) continue;
      cells[nr + ',' + nc] = sh.cells[k];
    }
    sh.cells = cells;
    if (axis === 'r') { sh.rowH = remapKeyed(sh.rowH, mapIdx); sh.rows = Math.max(1, sh.rows + count); }
    else { sh.colW = remapKeyed(sh.colW, mapIdx); sh.cols = Math.max(1, sh.cols + count); }
    const fixRange = (m) => {
      const a1 = axis === 'r' ? 'r1' : 'c1', a2 = axis === 'r' ? 'r2' : 'c2';
      if (del) {
        if (m[a1] >= at + n) { m[a1] -= n; m[a2] -= n; }
        else if (m[a2] >= at) { m[a2] = Math.max(at - 1, m[a2] - n); if (m[a1] >= at) m[a1] = at; if (m[a2] < m[a1]) return false; }
      } else {
        if (m[a1] >= at) { m[a1] += n; m[a2] += n; } else if (m[a2] >= at) m[a2] += n;
      }
      return true;
    };
    sh.merges = sh.merges.filter(fixRange).filter((m) => m.r2 > m.r1 || m.c2 > m.c1);
    sh.cf = (sh.cf || []).filter(fixRange);
    sh.dv = (sh.dv || []).filter(fixRange);
    // Références dans toutes les formules du classeur
    wb.sheets.forEach((other, oi) => {
      for (const k in other.cells) {
        const cell = other.cells[k];
        if (!cell.v || cell.v[0] !== '=') continue;
        cell.v = SE.mapRefs(cell.v, (ref) => {
          const target = ref.sheet === null ? oi : wb.sheets.findIndex((s) => s.name.toLowerCase() === ref.sheet.toLowerCase());
          if (target !== si) return null;
          const idx = axis === 'r' ? ref.r : ref.c;
          let ni = mapIdx(idx);
          // bornes de plage supprimées : la plage se réduit (comme Excel)
          if (ni === null && ref.after === ':') ni = at;
          else if (ni === null && ref.before === ':') ni = at - 1;
          if (ni === null || ni < 0) { ref.r = -1; return SE.refText(ref); }
          if (axis === 'r') ref.r = ni; else ref.c = ni;
          return SE.refText(ref);
        });
      }
    });
  };

  // ---------- Stockage ----------
  const IDX = 'se_index';
  SE.store = {
    list() { return JSON.parse(localStorage.getItem(IDX) || '[]'); },
    saveIndex(list) { localStorage.setItem(IDX, JSON.stringify(list)); },
    load(id) { const s = localStorage.getItem('se_wb_' + id); return s ? JSON.parse(s) : null; },
    save(wb) {
      wb.modified = Date.now();
      const data = JSON.stringify(wb, (k, v) => (k[0] === '_' ? undefined : v));
      try { localStorage.setItem('se_wb_' + wb.id, data); }
      catch (e) { SE.toast && SE.toast('Stockage plein : exportez ou supprimez des classeurs', 'err'); return false; }
      const list = this.list().filter((x) => x.id !== wb.id);
      list.unshift({ id: wb.id, name: wb.name, modified: wb.modified, sheets: wb.sheets.length, icon: wb.icon || '' });
      this.saveIndex(list);
      localStorage.setItem('se_last', wb.id);
      return true;
    },
    remove(id) { localStorage.removeItem('se_wb_' + id); this.saveIndex(this.list().filter((x) => x.id !== id)); },
    last() { return localStorage.getItem('se_last'); }
  };
})();
