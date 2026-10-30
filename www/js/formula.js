/* SuperEssence Sheets — moteur de formules
 * Parseur + évaluateur compatible Excel (FR/EN) + fonctions sportives.
 */
(function () {
  'use strict';
  const SE = (window.SE = window.SE || {});

  // ---------- Utilitaires adresses ----------
  function colName(c) {
    let s = '';
    c = c + 1;
    while (c > 0) {
      const m = (c - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      c = Math.floor((c - 1) / 26);
    }
    return s;
  }
  function colIndex(name) {
    let n = 0;
    name = name.toUpperCase();
    for (let i = 0; i < name.length; i++) n = n * 26 + (name.charCodeAt(i) - 64);
    return n - 1;
  }
  function addr(r, c) { return colName(c) + (r + 1); }
  function parseAddr(a) {
    const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(String(a).trim());
    if (!m) return null;
    return { r: parseInt(m[2], 10) - 1, c: colIndex(m[1]) };
  }

  // ---------- Erreurs ----------
  class FErr { constructor(code) { this.err = code; } toString() { return this.err; } }
  const E = {
    DIV0: new FErr('#DIV/0!'), VALUE: new FErr('#VALUE!'), REF: new FErr('#REF!'),
    NAME: new FErr('#NAME?'), NA: new FErr('#N/A'), NUM: new FErr('#NUM!'), CYCLE: new FErr('#CYCLE!')
  };
  const isErr = (v) => v instanceof FErr;

  // ---------- Tokenizer ----------
  const RE_REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/;
  const RE_COLRANGE = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})(?![\w(])/;
  const RE_NUM = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/;
  const RE_NUM_FR = /^(\d+(?:[.,]\d+)?|\.\d+)([eE][+-]?\d+)?/;
  const RE_IDENT = /^[A-Za-z_À-ſ][\w.À-ſ]*/;

  function tokenize(src) {
    const toks = [];
    let i = 0;
    const n = src.length;
    while (i < n) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      const rest = src.slice(i);
      if (ch === '"') {
        let j = i + 1, s = '';
        while (j < n) {
          if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
          s += src[j++];
        }
        toks.push({ t: 'str', v: s });
        i = j + 1;
        continue;
      }
      // Préfixe de feuille
      let sheet = null, consumed = 0;
      if (ch === "'") {
        const j = src.indexOf("'!", i + 1);
        if (j > 0) { sheet = src.slice(i + 1, j).replace(/''/g, "'"); consumed = j + 2 - i; }
      } else {
        const m = /^([A-Za-z_À-ſ][\w.À-ſ ]*?)!/.exec(rest);
        if (m && !/^\s/.test(m[1])) { sheet = m[1]; consumed = m[0].length; }
      }
      const rest2 = sheet !== null ? src.slice(i + consumed) : rest;
      let m;
      if ((m = RE_COLRANGE.exec(rest2))) {
        toks.push({ t: 'colrange', sheet, c1: colIndex(m[2]), c2: colIndex(m[4]) });
        i += consumed + m[0].length;
        continue;
      }
      if ((m = RE_REF.exec(rest2)) && !/^[\w(]/.test(rest2.slice(m[0].length))) {
        toks.push({ t: 'ref', sheet, c: colIndex(m[2]), r: parseInt(m[4], 10) - 1 });
        i += consumed + m[0].length;
        continue;
      }
      if (sheet !== null) throw new Error('Référence invalide');
      if ((m = (SE.settings && SE.settings.dec === ',' ? RE_NUM_FR : RE_NUM).exec(rest))) { toks.push({ t: 'num', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
      if (ch === '#') {
        const em = /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!)/.exec(rest);
        if (em) { toks.push({ t: 'err', v: new FErr(em[0]) }); i += em[0].length; continue; }
      }
      if ((m = RE_IDENT.exec(rest))) {
        const id = m[0];
        const after = src.slice(i + id.length).trimStart();
        if (after[0] === '(') { toks.push({ t: 'fn', v: id.toUpperCase() }); i += id.length; continue; }
        const up = id.toUpperCase();
        if (up === 'TRUE' || up === 'VRAI') { toks.push({ t: 'bool', v: true }); i += id.length; continue; }
        if (up === 'FALSE' || up === 'FAUX') { toks.push({ t: 'bool', v: false }); i += id.length; continue; }
        toks.push({ t: 'name', v: id }); i += id.length; continue;
      }
      const two = src.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '<>') { toks.push({ t: 'op', v: two }); i += 2; continue; }
      if ('+-*/^&=<>%:'.includes(ch)) { toks.push({ t: 'op', v: ch }); i++; continue; }
      if (ch === '(') { toks.push({ t: 'lp' }); i++; continue; }
      if (ch === ')') { toks.push({ t: 'rp' }); i++; continue; }
      if (ch === ',' || ch === ';') { toks.push({ t: 'sep' }); i++; continue; }
      if (ch === '{' || ch === '}') { toks.push({ t: ch === '{' ? 'lb' : 'rb' }); i++; continue; }
      throw new Error('Caractère inattendu : ' + ch);
    }
    return toks;
  }

  // ---------- Parseur (Pratt) ----------
  const BIN = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];

    function primary() {
      const t = next();
      if (!t) throw new Error('Formule incomplète');
      if (t.t === 'num') return { t: 'num', v: t.v };
      if (t.t === 'str') return { t: 'str', v: t.v };
      if (t.t === 'bool') return { t: 'bool', v: t.v };
      if (t.t === 'err') return { t: 'err', v: t.v };
      if (t.t === 'colrange') return { t: 'range', sheet: t.sheet, r1: 0, c1: Math.min(t.c1, t.c2), r2: -1, c2: Math.max(t.c1, t.c2) };
      if (t.t === 'ref') {
        const nt = peek();
        if (nt && nt.t === 'op' && nt.v === ':' && toks[p + 1] && toks[p + 1].t === 'ref') {
          p++;
          const t2 = next();
          return { t: 'range', sheet: t.sheet, r1: Math.min(t.r, t2.r), c1: Math.min(t.c, t2.c), r2: Math.max(t.r, t2.r), c2: Math.max(t.c, t2.c) };
        }
        return { t: 'ref', sheet: t.sheet, r: t.r, c: t.c };
      }
      if (t.t === 'name') return { t: 'name', v: t.v };
      if (t.t === 'op' && (t.v === '-' || t.v === '+')) return { t: 'un', op: t.v, a: primary() };
      if (t.t === 'lp') {
        const e = expr(0);
        const r = next();
        if (!r || r.t !== 'rp') throw new Error('Parenthèse manquante');
        return e;
      }
      if (t.t === 'lb') {
        // constante tableau {1;2;3}
        const items = [];
        while (peek() && peek().t !== 'rb') {
          if (peek().t === 'sep') { p++; continue; }
          items.push(expr(0));
        }
        next();
        return { t: 'arr', items };
      }
      if (t.t === 'fn') {
        const lp = next();
        if (!lp || lp.t !== 'lp') throw new Error('( attendue');
        const args = [];
        if (peek() && peek().t === 'rp') { p++; return { t: 'fn', name: t.v, args }; }
        while (true) {
          if (peek() && (peek().t === 'sep' || peek().t === 'rp')) args.push({ t: 'empty' });
          else args.push(expr(0));
          const s = next();
          if (!s) throw new Error('Parenthèse manquante');
          if (s.t === 'rp') break;
          if (s.t !== 'sep') throw new Error('Séparateur attendu');
        }
        return { t: 'fn', name: t.v, args };
      }
      throw new Error('Syntaxe invalide');
    }

    function expr(minPrec) {
      let left = primary();
      while (true) {
        const t = peek();
        if (!t || t.t !== 'op') break;
        if (t.v === '%') { p++; left = { t: 'pct', a: left }; continue; }
        const prec = BIN[t.v];
        if (prec === undefined || prec < minPrec) break;
        p++;
        const right = expr(t.v === '^' ? prec : prec + 1);
        left = { t: 'bin', op: t.v, a: left, b: right };
      }
      return left;
    }

    const ast = expr(0);
    if (p < toks.length) throw new Error('Syntaxe invalide');
    return ast;
  }

  // ---------- Coercitions ----------
  function toNum(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === null || v === undefined || v === '') return 0;
    if (isErr(v)) return v;
    if (Array.isArray(v)) return toNum(v[0] && v[0][0]);
    const n = SE.parseNumberLiteral(String(v));
    return n === null ? E.VALUE : n;
  }
  function toStr(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'VRAI' : 'FAUX';
    if (typeof v === 'number') return SE.fmtGeneral(v);
    if (Array.isArray(v)) return toStr(v[0] && v[0][0]);
    return String(v);
  }
  function toBool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v === null || v === undefined || v === '') return false;
    if (Array.isArray(v)) return toBool(v[0] && v[0][0]);
    const u = String(v).toUpperCase();
    if (u === 'VRAI' || u === 'TRUE') return true;
    if (u === 'FAUX' || u === 'FALSE') return false;
    return E.VALUE;
  }
  function scalar(v) { return Array.isArray(v) ? (v[0] ? v[0][0] : null) : v; }

  // aplatit les arguments ; mode 'num' : seulement nombres (ignore textes des plages)
  function flat(args, out = []) {
    for (const a of args) {
      if (Array.isArray(a)) { for (const row of a) for (const x of row) out.push({ v: x, range: true }); }
      else out.push({ v: a, range: false });
    }
    return out;
  }
  function nums(args) {
    const out = [];
    for (const it of flat(args)) {
      const v = it.v;
      if (isErr(v)) throw v;
      if (typeof v === 'number') out.push(v);
      else if (!it.range) {
        if (v === null || v === undefined) continue;
        const n = toNum(v);
        if (isErr(n)) throw n;
        out.push(n);
      }
    }
    return out;
  }
  function cmp(a, b) {
    if (a === null || a === undefined) a = typeof b === 'number' ? 0 : typeof b === 'boolean' ? false : '';
    if (b === null || b === undefined) b = typeof a === 'number' ? 0 : typeof a === 'boolean' ? false : '';
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase().localeCompare(b.toLowerCase());
    if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
    const rank = (x) => (typeof x === 'number' ? 0 : typeof x === 'string' ? 1 : 2);
    return rank(a) - rank(b);
  }

  // Critères type NB.SI : ">5", "<>x", "abc*", 10
  function makeCriteria(crit) {
    if (typeof crit === 'number' || typeof crit === 'boolean') return (v) => cmp(v, crit) === 0 && v !== null && v !== '';
    const s = toStr(crit);
    const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(s);
    const op = m[1] || '=';
    const raw = m[2];
    const n = SE.parseNumberLiteral(raw);
    const val = n !== null ? n : raw;
    if (typeof val === 'string' && (op === '=' || op === '<>') && /[*?]/.test(val)) {
      const re = new RegExp('^' + val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      return op === '=' ? (v) => re.test(toStr(v)) : (v) => !re.test(toStr(v));
    }
    return (v) => {
      if (op === '=' && val === '') return v === null || v === '';
      if (op === '<>' && val === '') return !(v === null || v === '');
      if (typeof val === 'number' && typeof v !== 'number') {
        const vn = typeof v === 'string' ? SE.parseNumberLiteral(v) : null;
        if (vn === null) return op === '<>';
        v = vn;
      }
      if (typeof val === 'string' && typeof v === 'number') return op === '<>';
      const c = cmp(v, val);
      switch (op) {
        case '=': return c === 0;
        case '<>': return c !== 0;
        case '<': return c < 0;
        case '>': return c > 0;
        case '<=': return c <= 0;
        case '>=': return c >= 0;
      }
      return false;
    };
  }

  // ---------- Dates (série Excel) ----------
  const EPOCH = Date.UTC(1899, 11, 30);
  function dateToSerial(y, m, d) { return (Date.UTC(y, m - 1, d) - EPOCH) / 86400000; }
  function serialToDate(s) { return new Date(EPOCH + Math.floor(s) * 86400000); }

  // ---------- Sport : temps ----------
  function parseDuration(v) {
    if (typeof v === 'number') return v * 60; // minutes -> secondes
    const s = toStr(v).trim();
    if (!s) return 0;
    const parts = s.split(':').map(Number);
    if (parts.some((x) => isNaN(x))) return E.VALUE;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] * 60;
  }
  function fmtDuration(sec) {
    sec = Math.round(sec);
    const neg = sec < 0;
    sec = Math.abs(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (x) => String(x).padStart(2, '0');
    return (neg ? '-' : '') + (h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s));
  }
  // % du 1RM selon reps & RPE (table type RTS, interpolée)
  const RPE10 = [1, 0.955, 0.922, 0.892, 0.863, 0.837, 0.811, 0.786, 0.762, 0.739, 0.707, 0.68, 0.653, 0.626, 0.6, 0.575, 0.55];
  function rpePct(reps, rpe) {
    const eff = reps + (10 - rpe) - 1; // index 0 = 1 rep @10
    if (eff <= 0) return 1;
    const i = Math.floor(eff), f = eff - i;
    if (i >= RPE10.length - 1) return RPE10[RPE10.length - 1];
    return RPE10[i] + (RPE10[i + 1] - RPE10[i]) * f;
  }
  function roundTo(x, step) { return step ? Math.round(x / step) * step : x; }
  function normPct(p) { return p > 1.5 ? p / 100 : p; }

  // ---------- Bibliothèque de fonctions ----------
  const F = {};
  const ALIAS = {};
  const DOC = {};
  function def(names, fn, doc, cat) {
    const list = names.split('|');
    F[list[0]] = fn;
    for (const a of list.slice(1)) ALIAS[a] = list[0];
    if (doc) DOC[list[0]] = { doc, cat: cat || 'Général', aliases: list.slice(1) };
  }
  function guard(fn) {
    return function (...a) {
      try { return fn(...a); } catch (e) { if (isErr(e)) return e; throw e; }
    };
  }
  const N = (v) => { const n = toNum(scalar(v)); if (isErr(n)) throw n; return n; };
  const S = (v) => { const x = scalar(v); if (isErr(x)) throw x; return toStr(x); };
  const B = (v) => { const b = toBool(scalar(v)); if (isErr(b)) throw b; return b; };
  const opt = (v, d) => (v === undefined || v === EMPTY ? d : v);
  const EMPTY = { empty: true };
  const rng = (v) => (Array.isArray(v) ? v : [[v]]);

  // Math
  def('SUM|SOMME', guard((...a) => nums(a).reduce((s, x) => s + x, 0)), 'Somme des valeurs', 'Maths');
  def('AVERAGE|MOYENNE', guard((...a) => { const n = nums(a); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : E.DIV0; }), 'Moyenne', 'Statistiques');
  def('MIN', guard((...a) => { const n = nums(a); return n.length ? Math.min(...n) : 0; }), 'Valeur minimale', 'Statistiques');
  def('MAX', guard((...a) => { const n = nums(a); return n.length ? Math.max(...n) : 0; }), 'Valeur maximale', 'Statistiques');
  def('COUNT|NB', (...a) => flat(a).filter((x) => typeof x.v === 'number').length, 'Nombre de cellules numériques', 'Statistiques');
  def('COUNTA|NBVAL', (...a) => flat(a).filter((x) => x.v !== null && x.v !== '' && x.v !== undefined).length, 'Nombre de cellules non vides', 'Statistiques');
  def('COUNTBLANK|NB.VIDE', (...a) => flat(a).filter((x) => x.v === null || x.v === '' || x.v === undefined).length, 'Nombre de cellules vides', 'Statistiques');
  def('PRODUCT|PRODUIT', guard((...a) => nums(a).reduce((s, x) => s * x, 1)), 'Produit', 'Maths');
  def('ROUND|ARRONDI', guard((x, d) => { const p = Math.pow(10, N(opt(d, 0))); return Math.round(N(x) * p + (N(x) >= 0 ? 1e-9 : -1e-9)) / p; }), 'Arrondi à n décimales', 'Maths');
  def('ROUNDUP|ARRONDI.SUP', guard((x, d) => { const p = Math.pow(10, N(opt(d, 0))); const v = N(x); return (v >= 0 ? Math.ceil(v * p - 1e-9) : -Math.ceil(-v * p - 1e-9)) / p; }), 'Arrondi supérieur', 'Maths');
  def('ROUNDDOWN|ARRONDI.INF', guard((x, d) => { const p = Math.pow(10, N(opt(d, 0))); const v = N(x); return (v >= 0 ? Math.floor(v * p + 1e-9) : -Math.floor(-v * p + 1e-9)) / p; }), 'Arrondi inférieur', 'Maths');
  def('MROUND|ARRONDI.AU.MULTIPLE', guard((x, m) => roundTo(N(x), N(m))), 'Arrondi au multiple (ex : 2,5 kg)', 'Maths');
  def('FLOOR|PLANCHER', guard((x, m) => { const s = N(opt(m, 1)); return s ? Math.floor(N(x) / s) * s : 0; }), 'Arrondi au multiple inférieur', 'Maths');
  def('CEILING|PLAFOND', guard((x, m) => { const s = N(opt(m, 1)); return s ? Math.ceil(N(x) / s) * s : 0; }), 'Arrondi au multiple supérieur', 'Maths');
  def('INT|ENT', guard((x) => Math.floor(N(x))), 'Partie entière', 'Maths');
  def('TRUNC|TRONQUE', guard((x, d) => { const p = Math.pow(10, N(opt(d, 0))); return Math.trunc(N(x) * p) / p; }), 'Tronque', 'Maths');
  def('ABS', guard((x) => Math.abs(N(x))), 'Valeur absolue', 'Maths');
  def('SQRT|RACINE', guard((x) => { const v = N(x); return v < 0 ? E.NUM : Math.sqrt(v); }), 'Racine carrée', 'Maths');
  def('POWER|PUISSANCE', guard((x, y) => Math.pow(N(x), N(y))), 'Puissance', 'Maths');
  def('EXP', guard((x) => Math.exp(N(x))), 'Exponentielle', 'Maths');
  def('LN', guard((x) => { const v = N(x); return v <= 0 ? E.NUM : Math.log(v); }), 'Logarithme népérien', 'Maths');
  def('LOG10', guard((x) => { const v = N(x); return v <= 0 ? E.NUM : Math.log10(v); }), 'Logarithme base 10', 'Maths');
  def('LOG', guard((x, b) => { const v = N(x); return v <= 0 ? E.NUM : Math.log(v) / Math.log(N(opt(b, 10))); }), 'Logarithme', 'Maths');
  def('MOD', guard((x, y) => { const d = N(y); if (!d) return E.DIV0; const v = N(x); return v - d * Math.floor(v / d); }), 'Reste de la division', 'Maths');
  def('PI', () => Math.PI, 'Nombre π', 'Maths');
  def('RAND|ALEA', () => Math.random(), 'Nombre aléatoire 0-1', 'Maths');
  def('RANDBETWEEN|ALEA.ENTRE.BORNES', guard((a, b) => { const lo = Math.ceil(N(a)), hi = Math.floor(N(b)); return lo + Math.floor(Math.random() * (hi - lo + 1)); }), 'Entier aléatoire entre 2 bornes', 'Maths');
  def('SIGN|SIGNE', guard((x) => Math.sign(N(x))), 'Signe', 'Maths');
  def('SUMPRODUCT|SOMMEPROD', guard((...a) => {
    const arrs = a.map(rng);
    const h = arrs[0].length, w = arrs[0][0].length;
    let s = 0;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      let p = 1;
      for (const ar of arrs) { const v = ar[i] && ar[i][j]; if (isErr(v)) throw v; p *= typeof v === 'number' ? v : typeof v === 'boolean' ? +v : 0; }
      s += p;
    }
    return s;
  }), 'Somme des produits', 'Maths');
  def('SUMSQ|SOMME.CARRES', guard((...a) => nums(a).reduce((s, x) => s + x * x, 0)), 'Somme des carrés', 'Maths');

  // Stats
  def('MEDIAN|MEDIANE', guard((...a) => { const n = nums(a).sort((x, y) => x - y); if (!n.length) return E.NUM; const m = n.length >> 1; return n.length % 2 ? n[m] : (n[m - 1] + n[m]) / 2; }), 'Médiane', 'Statistiques');
  const stdev = (n, pop) => { if (n.length < (pop ? 1 : 2)) throw E.DIV0; const m = n.reduce((s, x) => s + x, 0) / n.length; return Math.sqrt(n.reduce((s, x) => s + (x - m) ** 2, 0) / (n.length - (pop ? 0 : 1))); };
  def('STDEV|ECARTYPE|STDEV.S|ECARTYPE.STANDARD', guard((...a) => stdev(nums(a), false)), 'Écart-type (échantillon)', 'Statistiques');
  def('STDEVP|ECARTYPEP|STDEV.P|ECARTYPE.PEARSON', guard((...a) => stdev(nums(a), true)), 'Écart-type (population)', 'Statistiques');
  def('VAR|VAR.S', guard((...a) => stdev(nums(a), false) ** 2), 'Variance', 'Statistiques');
  def('LARGE|GRANDE.VALEUR', guard((r, k) => { const n = nums([r]).sort((x, y) => y - x); const i = N(k) - 1; return n[i] === undefined ? E.NUM : n[i]; }), 'k-ième plus grande valeur', 'Statistiques');
  def('SMALL|PETITE.VALEUR', guard((r, k) => { const n = nums([r]).sort((x, y) => x - y); const i = N(k) - 1; return n[i] === undefined ? E.NUM : n[i]; }), 'k-ième plus petite valeur', 'Statistiques');
  def('RANK|RANG|RANK.EQ|EQUATION.RANG', guard((x, r, o) => { const v = N(x); const n = nums([r]); const asc = N(opt(o, 0)) !== 0; if (!n.includes(v)) return E.NA; return 1 + n.filter((y) => (asc ? y < v : y > v)).length; }), 'Rang d\'une valeur', 'Statistiques');
  def('PERCENTILE|CENTILE', guard((r, k) => { const n = nums([r]).sort((x, y) => x - y); const p = N(k); if (!n.length || p < 0 || p > 1) return E.NUM; const idx = p * (n.length - 1); const lo = Math.floor(idx); return n[lo] + (n[Math.min(lo + 1, n.length - 1)] - n[lo]) * (idx - lo); }), 'Centile', 'Statistiques');
  const ifAgg = (agg) => guard((range, crit, sumRange) => {
    const r = rng(range), s = sumRange === undefined || sumRange === EMPTY ? r : rng(sumRange);
    const test = makeCriteria(scalar(crit));
    const vals = [];
    for (let i = 0; i < r.length; i++) for (let j = 0; j < r[i].length; j++) if (test(r[i][j])) { const v = s[i] && s[i][j]; vals.push(v); }
    return agg(vals);
  });
  def('COUNTIF|NB.SI', ifAgg((v) => v.length), 'Compte les cellules répondant au critère', 'Statistiques');
  def('SUMIF|SOMME.SI', ifAgg((v) => v.reduce((s, x) => s + (typeof x === 'number' ? x : 0), 0)), 'Somme conditionnelle', 'Maths');
  def('AVERAGEIF|MOYENNE.SI', ifAgg((v) => { const n = v.filter((x) => typeof x === 'number'); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : E.DIV0; }), 'Moyenne conditionnelle', 'Statistiques');
  const ifsAgg = (agg, hasTarget) => guard((...a) => {
    const target = hasTarget ? rng(a.shift()) : null;
    const pairs = [];
    for (let i = 0; i + 1 < a.length; i += 2) pairs.push([rng(a[i]), makeCriteria(scalar(a[i + 1]))]);
    const base = target || pairs[0][0];
    const vals = [];
    for (let i = 0; i < base.length; i++) for (let j = 0; j < base[i].length; j++) {
      if (pairs.every(([r, t]) => t(r[i] && r[i][j]))) vals.push(target ? target[i][j] : 1);
    }
    return agg(vals);
  });
  def('SUMIFS|SOMME.SI.ENS', ifsAgg((v) => v.reduce((s, x) => s + (typeof x === 'number' ? x : 0), 0), true), 'Somme multi-critères', 'Maths');
  def('COUNTIFS|NB.SI.ENS', ifsAgg((v) => v.length, false), 'Comptage multi-critères', 'Statistiques');
  def('AVERAGEIFS|MOYENNE.SI.ENS', ifsAgg((v) => { const n = v.filter((x) => typeof x === 'number'); return n.length ? n.reduce((s, x) => s + x, 0) / n.length : E.DIV0; }, true), 'Moyenne multi-critères', 'Statistiques');
  def('MAXIFS|MAX.SI.ENS', ifsAgg((v) => { const n = v.filter((x) => typeof x === 'number'); return n.length ? Math.max(...n) : 0; }, true), 'Max multi-critères', 'Statistiques');
  def('MINIFS|MIN.SI.ENS', ifsAgg((v) => { const n = v.filter((x) => typeof x === 'number'); return n.length ? Math.min(...n) : 0; }, true), 'Min multi-critères', 'Statistiques');

  // Logique
  def('IF|SI', (c, a, b) => { const t = toBool(scalar(c)); if (isErr(t)) return t; return t ? opt(a, true) : opt(b, false); }, 'SI(condition; si_vrai; si_faux)', 'Logique');
  def('IFS|SI.CONDITIONS', (...a) => { for (let i = 0; i + 1 < a.length; i += 2) { const t = toBool(scalar(a[i])); if (isErr(t)) return t; if (t) return a[i + 1]; } return E.NA; }, 'Plusieurs conditions', 'Logique');
  def('AND|ET', guard((...a) => flat(a).every((x) => { const b = toBool(x.v); if (isErr(b)) throw b; return b; })), 'Toutes vraies', 'Logique');
  def('OR|OU', guard((...a) => flat(a).some((x) => { const b = toBool(x.v); if (isErr(b)) throw b; return b; })), 'Au moins une vraie', 'Logique');
  def('XOR|OUX', guard((...a) => flat(a).filter((x) => toBool(x.v) === true).length % 2 === 1), 'Ou exclusif', 'Logique');
  def('NOT|NON', guard((x) => !B(x)), 'Inverse', 'Logique');
  def('IFERROR|SIERREUR', (v, alt) => (isErr(scalar(v)) ? opt(alt, '') : v), 'Valeur si erreur', 'Logique');
  def('IFNA|SI.NON.DISP', (v, alt) => (scalar(v) === E.NA || (isErr(scalar(v)) && scalar(v).err === '#N/A') ? opt(alt, '') : v), 'Valeur si #N/A', 'Logique');
  def('ISBLANK|ESTVIDE', (v) => { v = scalar(v); return v === null || v === undefined || v === ''; }, 'Cellule vide ?', 'Logique');
  def('ISNUMBER|ESTNUM', (v) => typeof scalar(v) === 'number', 'Est un nombre ?', 'Logique');
  def('ISTEXT|ESTTEXTE', (v) => typeof scalar(v) === 'string' && scalar(v) !== '', 'Est du texte ?', 'Logique');
  def('ISERROR|ESTERREUR', (v) => isErr(scalar(v)), 'Est une erreur ?', 'Logique');
  def('TRUE|VRAI', () => true, 'VRAI', 'Logique');
  def('FALSE|FAUX', () => false, 'FAUX', 'Logique');
  def('CHOOSE|CHOISIR', guard((i, ...a) => { const k = N(i); return a[k - 1] === undefined ? E.VALUE : a[k - 1]; }), 'Choisit la n-ième valeur', 'Recherche');
  def('SWITCH|SI.MULTIPLE', (v, ...a) => { v = scalar(v); for (let i = 0; i + 1 < a.length; i += 2) if (cmp(v, scalar(a[i])) === 0) return a[i + 1]; return a.length % 2 ? a[a.length - 1] : E.NA; }, 'Choix selon valeur', 'Logique');

  // Texte
  def('CONCATENATE|CONCATENER|CONCAT', guard((...a) => flat(a).map((x) => { if (isErr(x.v)) throw x.v; return toStr(x.v); }).join('')), 'Concatène des textes', 'Texte');
  def('TEXTJOIN|JOINDRE.TEXTE', guard((d, ign, ...a) => flat(a).filter((x) => !(B(ign) && (x.v === null || x.v === ''))).map((x) => toStr(x.v)).join(S(d))), 'Joint avec séparateur', 'Texte');
  def('LEN|NBCAR', guard((s) => S(s).length), 'Longueur du texte', 'Texte');
  def('UPPER|MAJUSCULE', guard((s) => S(s).toUpperCase()), 'En majuscules', 'Texte');
  def('LOWER|MINUSCULE', guard((s) => S(s).toLowerCase()), 'En minuscules', 'Texte');
  def('PROPER|NOMPROPRE', guard((s) => S(s).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())), 'Majuscule à chaque mot', 'Texte');
  def('TRIM|SUPPRESPACE', guard((s) => S(s).trim().replace(/\s+/g, ' ')), 'Supprime les espaces superflus', 'Texte');
  def('LEFT|GAUCHE', guard((s, n) => S(s).slice(0, N(opt(n, 1)))), 'Caractères à gauche', 'Texte');
  def('RIGHT|DROITE', guard((s, n) => { const k = N(opt(n, 1)); return k ? S(s).slice(-k) : ''; }), 'Caractères à droite', 'Texte');
  def('MID|STXT', guard((s, i, n) => S(s).substr(N(i) - 1, N(n))), 'Extrait du texte', 'Texte');
  def('FIND|TROUVE', guard((f, s, i) => { const k = S(s).indexOf(S(f), N(opt(i, 1)) - 1); return k < 0 ? E.VALUE : k + 1; }), 'Position (sensible à la casse)', 'Texte');
  def('SEARCH|CHERCHE', guard((f, s, i) => { const k = S(s).toLowerCase().indexOf(S(f).toLowerCase(), N(opt(i, 1)) - 1); return k < 0 ? E.VALUE : k + 1; }), 'Position (insensible à la casse)', 'Texte');
  def('SUBSTITUTE|SUBSTITUE', guard((s, a, b) => S(s).split(S(a)).join(S(b))), 'Remplace un texte', 'Texte');
  def('REPT', guard((s, n) => S(s).repeat(Math.max(0, N(n)))), 'Répète un texte', 'Texte');
  def('VALUE|CNUM', guard((s) => { const v = scalar(s); if (typeof v === 'number') return v; const n = SE.parseNumberLiteral(S(v)); return n === null ? E.VALUE : n; }), 'Convertit en nombre', 'Texte');
  def('TEXT|TEXTE', guard((v, f) => SE.formatWithPattern(N(v), S(f))), 'Formate un nombre (ex : "0,00")', 'Texte');
  def('EXACT', guard((a, b) => S(a) === S(b)), 'Textes identiques ?', 'Texte');
  def('CHAR|CAR', guard((n) => String.fromCharCode(N(n))), 'Caractère depuis code', 'Texte');

  // Dates
  def('TODAY|AUJOURDHUI', () => { const d = new Date(); return dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()); }, 'Date du jour', 'Date');
  def('NOW|MAINTENANT', () => { const d = new Date(); return dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()) + (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; }, 'Date et heure', 'Date');
  def('DATE', guard((y, m, d) => dateToSerial(N(y), N(m), N(d))), 'DATE(année; mois; jour)', 'Date');
  def('YEAR|ANNEE', guard((s) => serialToDate(N(s)).getUTCFullYear()), 'Année', 'Date');
  def('MONTH|MOIS', guard((s) => serialToDate(N(s)).getUTCMonth() + 1), 'Mois', 'Date');
  def('DAY|JOUR', guard((s) => serialToDate(N(s)).getUTCDate()), 'Jour', 'Date');
  def('WEEKDAY|JOURSEM', guard((s, t) => { const d = serialToDate(N(s)).getUTCDay(); const ty = N(opt(t, 1)); return ty === 2 ? ((d + 6) % 7) + 1 : ty === 3 ? (d + 6) % 7 : d + 1; }), 'Jour de la semaine', 'Date');
  def('WEEKNUM|NO.SEMAINE|ISOWEEKNUM|NO.SEMAINE.ISO', guard((s) => { const d = serialToDate(N(s)); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3); const fy = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - fy) / 86400000 - 3 + ((fy.getUTCDay() + 6) % 7)) / 7); }), 'Numéro de semaine ISO', 'Date');
  def('EDATE|MOIS.DECALER', guard((s, m) => { const d = serialToDate(N(s)); return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + N(m), d.getUTCDate()); }), 'Date + n mois', 'Date');
  def('DAYS|JOURS', guard((a, b) => Math.floor(N(a)) - Math.floor(N(b))), 'Jours entre 2 dates', 'Date');
  def('HOUR|HEURE', guard((s) => Math.floor((N(s) % 1) * 24 + 1e-9)), 'Heure', 'Date');
  def('MINUTE', guard((s) => Math.floor(((N(s) * 1440) % 60) + 1e-9)), 'Minute', 'Date');

  // Recherche
  function lookupIdx(v, arr, mode) {
    // mode 0: exact ; 1: approx croissant
    if (mode === 0) {
      const test = typeof v === 'string' && /[*?]/.test(v) ? makeCriteria(v) : (x) => cmp(x, v) === 0 && x !== null;
      return arr.findIndex(test);
    }
    let best = -1;
    for (let i = 0; i < arr.length; i++) { if (arr[i] === null) continue; if (cmp(arr[i], v) <= 0) best = i; else break; }
    return best;
  }
  def('VLOOKUP|RECHERCHEV', guard((v, r, col, approx) => {
    const t = rng(r); const k = N(col) - 1; const ex = approx === undefined || approx === EMPTY ? 1 : B(approx) ? 1 : 0;
    const i = lookupIdx(scalar(v), t.map((row) => row[0]), ex);
    if (i < 0) return E.NA;
    return t[i][k] === undefined ? E.REF : t[i][k];
  }), 'Recherche verticale', 'Recherche');
  def('HLOOKUP|RECHERCHEH', guard((v, r, row, approx) => {
    const t = rng(r); const k = N(row) - 1; const ex = approx === undefined || approx === EMPTY ? 1 : B(approx) ? 1 : 0;
    const i = lookupIdx(scalar(v), t[0], ex);
    if (i < 0) return E.NA;
    return t[k] === undefined ? E.REF : t[k][i];
  }), 'Recherche horizontale', 'Recherche');
  def('XLOOKUP|RECHERCHEX', guard((v, look, ret, notFound) => {
    const l = rng(look), r = rng(ret);
    const vert = l.length > 1 || l[0].length === 1;
    const arr = vert ? l.map((x) => x[0]) : l[0];
    const i = lookupIdx(scalar(v), arr, 0);
    if (i < 0) return notFound === undefined || notFound === EMPTY ? E.NA : notFound;
    return vert ? r[i][0] : r[0][i];
  }), 'Recherche moderne', 'Recherche');
  def('INDEX', guard((r, row, col) => { const t = rng(r); let i = N(opt(row, 1)), j = N(opt(col, 1)); if (t.length === 1 && (col === undefined || col === EMPTY)) { j = i; i = 1; } const x = t[i - 1] && t[i - 1][j - 1]; return x === undefined ? E.REF : x; }), 'Valeur à une position', 'Recherche');
  def('MATCH|EQUIV', guard((v, r, type) => { const t = rng(r); const arr = t.length > 1 ? t.map((x) => x[0]) : t[0]; const ty = N(opt(type, 1)); let i; if (ty === -1) { i = -1; for (let k = 0; k < arr.length; k++) if (cmp(arr[k], scalar(v)) >= 0) i = k; else break; } else i = lookupIdx(scalar(v), arr, ty === 0 ? 0 : 1); return i < 0 ? E.NA : i + 1; }), 'Position d\'une valeur', 'Recherche');
  def('ROWS|LIGNES', (r) => rng(r).length, 'Nombre de lignes', 'Recherche');
  def('COLUMNS|COLONNES', (r) => rng(r)[0].length, 'Nombre de colonnes', 'Recherche');

  // ---------- Fonctions SPORT ----------
  def('ONERM|1RM|RM', guard((w, reps, m) => {
    const p = N(w), r = N(reps), mode = N(opt(m, 1));
    if (r <= 0) return E.NUM;
    if (r === 1) return p;
    const ep = p * (1 + r / 30), br = r < 37 ? (p * 36) / (37 - r) : ep, lo = p * Math.pow(r, 0.1);
    return mode === 2 ? br : mode === 3 ? lo : mode === 4 ? (ep + br + lo) / 3 : ep;
  }), 'ONERM(charge; reps; [méthode 1=Epley 2=Brzycki 3=Lombardi 4=moyenne]) → 1RM estimé', 'Sport');
  def('CHARGE|LOAD', guard((rm, pct, step) => roundTo(N(rm) * normPct(N(pct)), N(opt(step, 2.5)))), 'CHARGE(1RM; %; [arrondi=2,5]) → charge de travail arrondie', 'Sport');
  def('RPEPCT|PCTRPE', guard((reps, rpe) => rpePct(N(reps), N(opt(rpe, 10)))), 'RPEPCT(reps; RPE) → % du 1RM correspondant', 'Sport');
  def('CHARGERPE|LOADRPE', guard((rm, reps, rpe, step) => roundTo(N(rm) * rpePct(N(reps), N(opt(rpe, 10))), N(opt(step, 2.5)))), 'CHARGERPE(1RM; reps; RPE; [arrondi]) → charge conseillée', 'Sport');
  def('E1RM', guard((w, reps, rpe) => N(w) / rpePct(N(reps), N(opt(rpe, 10)))), 'E1RM(charge; reps; RPE) → 1RM estimé via RPE', 'Sport');
  def('RIR', guard((rpe) => 10 - N(rpe)), 'RIR(RPE) → répétitions en réserve', 'Sport');
  def('VOLUME', guard((s, r, w) => N(s) * N(r) * N(opt(w, 1))), 'VOLUME(séries; reps; charge) → volume (kg)', 'Sport');
  def('TONNAGE', guard((s, r, w) => F.SUMPRODUCT(s, r, w)), 'TONNAGE(plage séries; plage reps; plage charges) → tonnage total', 'Sport');
  def('INOL', guard((reps, pct) => { const p = normPct(N(pct)) * 100; return p >= 100 ? E.NUM : N(reps) / (100 - p); }), 'INOL(reps; %1RM) → indice de charge (Hristov)', 'Sport');
  def('PROGRESSION', guard((base, inc, week, deload) => {
    const w = N(week), b = N(base), i = N(inc), d = N(opt(deload, 0));
    const done = d > 0 ? w - 1 - Math.floor((w - 1) / d) : w - 1;
    if (d > 0 && w % d === 0) return (b + i * Math.max(0, done - 1)) * 0.9;
    return b + i * done;
  }), 'PROGRESSION(base; incrément; semaine; [deload toutes n sem.]) → surcharge progressive', 'Sport');
  def('ALLURE|PACE', guard((km, t) => { const sec = parseDuration(scalar(t)); if (isErr(sec)) return sec; const d = N(km); return d ? fmtDuration(sec / d) : E.DIV0; }), 'ALLURE(distance km; temps "mm:ss" ou minutes) → allure min/km', 'Sport');
  def('VITESSE|SPEED', guard((km, t) => { const sec = parseDuration(scalar(t)); if (isErr(sec)) return sec; return sec ? N(km) / (sec / 3600) : E.DIV0; }), 'VITESSE(distance km; temps) → km/h', 'Sport');
  def('TEMPSCOURSE|RACETIME', guard((km, pace) => { const s = parseDuration(scalar(pace)); if (isErr(s)) return s; return fmtDuration(N(km) * s); }), 'TEMPSCOURSE(distance km; allure "m:ss") → temps total', 'Sport');
  def('ALLUREVMA|VMAPACE', guard((vma, pct) => { const v = N(vma) * normPct(N(opt(pct, 1))); return v ? fmtDuration(3600 / v) : E.DIV0; }), 'ALLUREVMA(VMA km/h; %VMA) → allure min/km', 'Sport');
  def('RIEGEL', guard((km1, t1, km2) => { const s = parseDuration(scalar(t1)); if (isErr(s)) return s; return fmtDuration(s * Math.pow(N(km2) / N(km1), 1.06)); }), 'RIEGEL(km réf; temps réf; km cible) → prédiction de temps', 'Sport');
  def('SECONDES|SECONDS', guard((t) => parseDuration(typeof scalar(t) === 'number' ? S(t) : scalar(t))), 'SECONDES("mm:ss") → secondes', 'Sport');
  def('MMSS|DUREE', guard((s) => fmtDuration(N(s))), 'MMSS(secondes) → texte m:ss', 'Sport');
  def('IMC|BMI', guard((kg, cm) => { const h = N(cm) / (N(cm) > 3 ? 100 : 1); return h ? N(kg) / (h * h) : E.DIV0; }), 'IMC(poids kg; taille cm) → indice de masse corporelle', 'Sport');
  def('FCMAX|HRMAX', guard((age, m) => (N(opt(m, 1)) === 2 ? 208 - 0.7 * N(age) : 220 - N(age))), 'FCMAX(âge; [1=220-âge 2=Tanaka])', 'Sport');
  def('FCZONE|KARVONEN', guard((age, rest, pct) => { const max = 220 - N(age), r = N(rest); return Math.round(r + (max - r) * normPct(N(pct))); }), 'FCZONE(âge; FC repos; %) → FC cible (Karvonen)', 'Sport');
  def('KCAL', guard((met, kg, min) => (N(met) * 3.5 * N(kg) / 200) * N(min)), 'KCAL(MET; poids kg; minutes) → dépense énergétique', 'Sport');
  def('MB|BMR', guard((kg, cm, age, sex) => { const s = S(opt(sex, 'H')).toUpperCase(); return 10 * N(kg) + 6.25 * N(cm) - 5 * N(age) + (s.startsWith('F') || s.startsWith('W') ? -161 : 5); }), 'MB(poids; taille cm; âge; "H"/"F") → métabolisme de base (Mifflin)', 'Sport');
  def('DET|TDEE', guard((mb, act) => N(mb) * N(opt(act, 1.55))), 'DET(MB; coef activité 1,2-1,9) → dépense totale', 'Sport');
  def('MACROS', guard((kcal, type, pct) => { const t = S(type).toUpperCase()[0]; const div = t === 'L' || t === 'F' ? 9 : 4; return Math.round((N(kcal) * normPct(N(pct))) / div); }), 'MACROS(kcal; "P"/"G"/"L"; %) → grammes', 'Sport');
  def('DOTS', guard((total, bw, sex) => {
    const w = N(bw), f = S(opt(sex, 'H')).toUpperCase().startsWith('F');
    const c = f ? [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706] : [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
    const den = c[0] + c[1] * w + c[2] * w * w + c[3] * w ** 3 + c[4] * w ** 4;
    return (N(total) * 500) / den;
  }), 'DOTS(total; poids de corps; "H"/"F") → score powerlifting', 'Sport');
  def('MASSEMAIGRE|LEANMASS', guard((kg, bf) => N(kg) * (1 - normPct(N(bf)))), 'MASSEMAIGRE(poids; %MG) → masse maigre', 'Sport');
  def('HYDRATATION|WATER', guard((kg, min) => Math.round(N(kg) * 35 + (N(opt(min, 0)) / 30) * 350)), 'HYDRATATION(poids; min sport) → ml/jour', 'Sport');

  // ---------- Évaluation ----------
  const astCache = new Map();
  function getAst(src) {
    let a = astCache.get(src);
    if (a === undefined) {
      try { a = parse(src); } catch (e) { a = { t: 'perr', msg: e.message }; }
      if (astCache.size > 20000) astCache.clear();
      astCache.set(src, a);
    }
    return a;
  }

  // ctx: { getCell(sheetName|null, r, c) -> value, getRange(sheet, r1,c1,r2,c2) -> 2D, sheetRows(sheet) }
  function evaluate(node, ctx) {
    switch (node.t) {
      case 'num': case 'str': case 'bool': return node.v;
      case 'err': return node.v;
      case 'perr': return E.NAME;
      case 'empty': return EMPTY;
      case 'ref': return ctx.getCell(node.sheet, node.r, node.c);
      case 'range': return ctx.getRange(node.sheet, node.r1, node.c1, node.r2 < 0 ? ctx.sheetRows(node.sheet) - 1 : node.r2, node.c2);
      case 'arr': return [node.items.map((x) => scalar(evaluate(x, ctx)))];
      case 'name': return E.NAME;
      case 'pct': { const v = toNum(scalar(evaluate(node.a, ctx))); return isErr(v) ? v : v / 100; }
      case 'un': { const v = toNum(scalar(evaluate(node.a, ctx))); return isErr(v) ? v : node.op === '-' ? -v : v; }
      case 'bin': {
        const a = scalar(evaluate(node.a, ctx)), b = scalar(evaluate(node.b, ctx));
        if (isErr(a)) return a;
        if (isErr(b)) return b;
        const op = node.op;
        if (op === '&') return toStr(a) + toStr(b);
        if (op === '=' || op === '<>' || op === '<' || op === '>' || op === '<=' || op === '>=') {
          const c = cmp(a, b);
          return op === '=' ? c === 0 : op === '<>' ? c !== 0 : op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
        }
        const x = toNum(a), y = toNum(b);
        if (isErr(x)) return x;
        if (isErr(y)) return y;
        switch (op) {
          case '+': return x + y;
          case '-': return x - y;
          case '*': return x * y;
          case '/': return y === 0 ? E.DIV0 : x / y;
          case '^': return Math.pow(x, y);
        }
        return E.VALUE;
      }
      case 'fn': {
        const name = ALIAS[node.name] || node.name;
        const fn = F[name];
        if (!fn) return E.NAME;
        const args = node.args.map((a) => evaluate(a, ctx));
        let r;
        try { r = fn(...args); } catch (e) { r = isErr(e) ? e : E.VALUE; }
        if (typeof r === 'number' && !isFinite(r)) return E.NUM;
        return r === undefined ? E.VALUE : r;
      }
    }
    return E.VALUE;
  }

  // ---------- Réécriture des références (copier/coller, insertion de lignes) ----------
  // Parcourt les références hors chaînes. cb(ref) -> texte de remplacement ou null
  const RE_REFS = /((?:'(?:[^']|'')+'|[A-Za-z_À-ſ][\w.À-ſ]*)!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(!])/g;
  function mapRefs(formula, cb) {
    if (!formula || formula[0] !== '=') return formula;
    let out = '';
    const parts = formula.split('"');
    for (let k = 0; k < parts.length; k++) {
      if (k % 2 === 1) { out += '"' + parts[k] + '"'; continue; }
      out += (k > 0 ? '' : '') + parts[k].replace(RE_REFS, (m, sh, d1, col, d2, row, off, str) => {
        const prev = off > 0 ? str[off - 1] : '';
        if (prev && /[\w.]/.test(prev)) return m;
        let sheet = null;
        if (sh) { sheet = sh.slice(0, -1); if (sheet[0] === "'") sheet = sheet.slice(1, -1).replace(/''/g, "'"); }
        const res = cb({ sheet, sheetText: sh || '', absC: !!d1, absR: !!d2, c: colIndex(col), r: parseInt(row, 10) - 1, before: prev, after: str[off + m.length] || '' });
        return res === null || res === undefined ? m : res;
      });
    }
    return out;
  }
  function refText(ref) {
    if (ref.r < 0 || ref.c < 0) return (ref.sheetText || '') + '#REF!';
    return (ref.sheetText || '') + (ref.absC ? '$' : '') + colName(ref.c) + (ref.absR ? '$' : '') + (ref.r + 1);
  }
  function shiftFormula(formula, dr, dc) {
    return mapRefs(formula, (ref) => {
      if (!ref.absR) ref.r += dr;
      if (!ref.absC) ref.c += dc;
      return refText(ref);
    });
  }

  function functionList() {
    return Object.keys(DOC).sort().map((k) => ({ name: k, ...DOC[k] }));
  }

  Object.assign(SE, {
    colName, colIndex, addr, parseAddr, FErr, ERR: E, isErr, parse, getAst, evaluate, mapRefs, refText, shiftFormula,
    toNum, toStr, toBool, scalar, functionList, dateToSerial, serialToDate, fmtDuration, parseDuration, rpePct, FUNCS: F, FALIAS: ALIAS
  });
})();
