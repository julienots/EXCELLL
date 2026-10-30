/* SuperEssence Sheets — commandes, ruban, dialogues */
(function () {
  'use strict';
  const SE = window.SE;
  const $ = SE.$;
  const A = () => SE.app;
  const sel = () => A().sel;
  const forSel = (fn) => { const s = sel(); for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) fn(r, c); };
  const selArea = () => { const s = sel(); return (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1); };
  const activeStyle = () => { const s = sel(); const c = A().sheet.cells[s.r + ',' + s.c]; return (c && c.s) || {}; };
  const styleSel = (patch) => A().change((sh) => {
    const s = sel();
    // sélection de colonnes/lignes entières : limiter à la zone utilisée + marge
    const u = SE.usedRange(sh);
    const r2 = s.r2 >= sh.rows - 1 ? Math.max(s.r1, Math.min(s.r2, u.r2 + 50)) : s.r2;
    const c2 = s.c2 >= sh.cols - 1 ? Math.max(s.c1, Math.min(s.c2, u.c2 + 5)) : s.c2;
    for (let r = s.r1; r <= r2; r++) for (let c = s.c1; c <= c2; c++) SE.setStyle(sh, r, c, typeof patch === 'function' ? patch(r, c) : patch);
  });
  const toggleStyle = (k) => { const on = !activeStyle()[k]; styleSel({ [k]: on || null }); };

  // ---------- Commandes ----------
  const CMD = {
    home() { if (A().editing) A().commitEdit(null); A().save(true); sessionStorage.removeItem('se_open'); SE.renderHome(); SE.showScreen('home'); },
    settings: () => SE.settingsDialog(),
    wizard: () => SE.wizard(),
    newBlank() { A().open(SE.newWorkbook('Nouveau classeur')); },
    import() { $('#fileInput').click(); },
    undo: () => A().undo(),
    redo: () => A().redo(),
    saveNow() { A().save(true); SE.toast('Enregistré', 'ok'); },
    exportMenu: (btn) => SE.exportMenu(btn),
    commit: () => A().commitEdit('down'),
    cancelEdit: () => A().cancelEdit(),
    addSheet() {
      const wb = A().wb;
      let n = wb.sheets.length + 1;
      while (wb.sheets.some((s) => s.name === 'Feuille' + n)) n++;
      A().change(() => { wb.sheets.push(SE.newSheet('Feuille' + n)); });
      A().switchSheet(wb.sheets.length - 1);
    },
    timer: () => SE.timerDialog(),
    // presse-papiers
    copy: () => SE.copy(false),
    cut: () => SE.copy(true),
    paste: () => SE.paste(null),
    pasteValues: () => SE.paste(null, 'values'),
    pasteFormats: () => SE.paste(null, 'formats'),
    // format
    bold: () => toggleStyle('b'),
    italic: () => toggleStyle('i'),
    underline: () => toggleStyle('u'),
    strike: () => toggleStyle('st'),
    wrap: () => toggleStyle('wrap'),
    alignLeft: () => styleSel({ ha: activeStyle().ha === 'left' ? null : 'left' }),
    alignCenter: () => styleSel({ ha: activeStyle().ha === 'center' ? null : 'center' }),
    alignRight: () => styleSel({ ha: activeStyle().ha === 'right' ? null : 'right' }),
    vAlign() { const v = activeStyle().va; styleSel({ va: v === 'top' ? 'bottom' : v === 'bottom' ? null : 'top' }); SE.toast('Alignement vertical : ' + (v === 'top' ? 'bas' : v === 'bottom' ? 'milieu' : 'haut')); },
    indent: () => styleSel((r, c) => { const cl = A().sheet.cells[r + ',' + c]; return { ind: Math.min(6, ((cl && cl.s && cl.s.ind) || 0) + 1) }; }),
    outdent: () => styleSel((r, c) => { const cl = A().sheet.cells[r + ',' + c]; const v = ((cl && cl.s && cl.s.ind) || 0) - 1; return { ind: v > 0 ? v : null }; }),
    async fontColor() { const c = await SE.pickColor('Couleur du texte', true); if (c !== undefined) styleSel({ fc: c || null }); },
    async fillColor() { const c = await SE.pickColor('Couleur de remplissage', true); if (c !== undefined) styleSel({ bg: c || null }); },
    fontBigger: () => styleSel((r, c) => { const cl = A().sheet.cells[r + ',' + c]; return { fs: Math.min(48, ((cl && cl.s && cl.s.fs) || 13) + 1) }; }),
    fontSmaller: () => styleSel((r, c) => { const cl = A().sheet.cells[r + ',' + c]; const v = ((cl && cl.s && cl.s.fs) || 13) - 1; return { fs: v === 13 ? null : Math.max(7, v) }; }),
    clearFormat() { A().change((sh) => forSel((r, c) => { const cl = sh.cells[r + ',' + c]; if (cl) { delete cl.s; if (cl.v === undefined) delete sh.cells[r + ',' + c]; } })); },
    clearContents() {
      if (selArea() > 1 || A().sheet.cells[sel().r + ',' + sel().c]) A().change((sh) => forSel((r, c) => SE.setRaw(sh, r, c, '')));
    },
    clearAll() { A().change((sh) => forSel((r, c) => { delete sh.cells[r + ',' + c]; })); },
    merge() {
      const s = sel(), sh = A().sheet;
      const inside = sh.merges.filter((m) => !(m.r2 < s.r1 || m.r1 > s.r2 || m.c2 < s.c1 || m.c1 > s.c2));
      if (inside.length) { A().change((x) => { x.merges = x.merges.filter((m) => !inside.includes(m)); }); SE.toast('Cellules séparées'); return; }
      if (selArea() < 2) { SE.toast('Sélectionnez plusieurs cellules'); return; }
      A().change((x) => {
        for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) if (r !== s.r1 || c !== s.c1) SE.setRaw(x, r, c, '');
        x.merges.push({ r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 });
        const cur = (x.cells[s.r1 + ',' + s.c1] || {}).s || {};
        if (!cur.ha) SE.setStyle(x, s.r1, s.c1, { ha: 'center' });
      });
      A().setSel(s.r1, s.c1, s.r2, s.c2); A().sel.r = s.r1; A().sel.c = s.c1;
    },
    borders: (btn) => SE.bordersMenu(btn),
    numFormat: (btn) => SE.numFormatMenu(btn),
    fmtPct: () => styleSel({ nf: 'pct' }),
    fmtEur: () => styleSel({ nf: 'eur' }),
    fmtKg: () => styleSel({ nf: 'kg' }),
    decMore: () => styleSel((r, c) => { const cl = A().sheet.cells[r + ',' + c]; const nf = (cl && cl.s && cl.s.nf) || ''; return { nf: nf === 'n0' || nf === '' ? 'n1' : nf === 'n1' ? 'n2' : nf === 'pct' ? 'pct1' : nf || 'n1' }; }),
    decLess: () => styleSel((r, c) => { const cl = A().sheet.cells[r + ',' + c]; const nf = (cl && cl.s && cl.s.nf) || ''; return { nf: nf === 'n2' ? 'n1' : nf === 'n1' ? 'n0' : nf === 'pct1' ? 'pct' : nf === '' ? 'n0' : nf }; }),
    painter() {
      const a = A();
      if (a.painter) { a.painter = null; a.updateBars(); return; }
      const s = sel();
      a.painter = { style: Object.assign({}, activeStyle()) };
      SE.toast('Pinceau : sélectionnez les cellules à mettre en forme');
      a.updateBars();
      void s;
    },
    tableStyle: () => SE.tableStyleDialog(),
    // insertion
    insRowAbove: () => SE.insertDelete('r', sel().r1, sel().r2 - sel().r1 + 1),
    insRowBelow: () => SE.insertDelete('r', sel().r2 + 1, sel().r2 - sel().r1 + 1),
    insColLeft: () => SE.insertDelete('c', sel().c1, sel().c2 - sel().c1 + 1),
    insColRight: () => SE.insertDelete('c', sel().c2 + 1, sel().c2 - sel().c1 + 1),
    delRows: () => SE.insertDelete('r', sel().r1, -(Math.min(sel().r2, A().sheet.rows - 2) - sel().r1 + 1)),
    delCols: () => SE.insertDelete('c', sel().c1, -(Math.min(sel().c2, A().sheet.cols - 2) - sel().c1 + 1)),
    checkbox() {
      const on = activeStyle().chk;
      A().change((sh) => forSel((r, c) => { SE.setStyle(sh, r, c, { chk: on ? null : true, ha: on ? null : 'center' }); if (!on && !(sh.cells[r + ',' + c] || {}).v) SE.setRaw(sh, r, c, 'FAUX'); }));
    },
    async note() {
      const cur = activeStyle().note || '';
      const v = await SE.prompt('Note / consigne', 'Texte affiché sur la cellule (triangle rouge)', cur, { icon: 'sticky-note' });
      if (v !== null) styleSel({ note: v.trim() || null });
    },
    async link() {
      const v = await SE.prompt('Lien', 'Adresse (vidéo d\'exercice, site…)', 'https://', { icon: 'link', type: 'url' });
      if (v && v !== 'https://') A().change((sh) => SE.setRaw(sh, sel().r, sel().c, v.trim()));
    },
    openLink() {
      const v = A().calc.value(A().si, sel().r, sel().c);
      if (typeof v === 'string' && /^https?:\/\//i.test(v)) window.open(v, '_blank'); else SE.toast('Pas de lien dans cette cellule');
    },
    today() { const d = new Date(); A().change((sh) => { SE.setRaw(sh, sel().r, sel().c, String(SE.dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()))); SE.setStyle(sh, sel().r, sel().c, { nf: 'date' }); }); },
    chart: () => SE.chartDialog(null),
    validation: () => SE.validationDialog(),
    // formules
    autosum: () => SE.autoFn('SUM'),
    autoavg: () => SE.autoFn('AVERAGE'),
    automax: () => SE.autoFn('MAX'),
    automin: () => SE.autoFn('MIN'),
    autocount: () => SE.autoFn('COUNT'),
    functions: () => SE.functionsDialog(),
    sportFunctions: () => SE.functionsDialog('Sport'),
    showFormulas() { A().showFormulas = !A().showFormulas; A().grid.draw(); SE.refreshRibbonState(); },
    recalc() { A().calc.invalidate(); A().grid.draw(); A().refreshCharts(); SE.toast('Recalculé'); },
    // données
    sortAsc: () => SE.sortSel(true),
    sortDesc: () => SE.sortSel(false),
    sortCustom: () => SE.sortDialog(),
    filter: () => SE.filterDialog(),
    clearFilter() {
      const sh = A().sheet;
      if (!sh.hidden) { SE.toast('Aucun filtre actif'); return; }
      A().change((x) => { for (const r in x.hidden) { if (x.hidden[r] === null) delete x.rowH[r]; else x.rowH[r] = x.hidden[r]; } delete x.hidden; }, { layout: true });
    },
    find: () => SE.findDialog(),
    cf: () => SE.cfDialog(),
    fillDown() { const s = sel(); if (s.r2 > s.r1) A().change((sh) => SE.fillRange(sh, A().calc, A().si, { r1: s.r1, c1: s.c1, r2: s.r1, c2: s.c2 }, s)); },
    fillRight() { const s = sel(); if (s.c2 > s.c1) A().change((sh) => SE.fillRange(sh, A().calc, A().si, { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c1 }, s)); },
    dedupe: () => SE.dedupe(),
    selectAll() { const sh = A().sheet; A().setSel(sh.rows - 1, sh.cols - 1, 0, 0); sel().r = 0; sel().c = 0; },
    // sport
    exercises: () => SE.exerciseDialog(),
    rmCalc: () => SE.rmDialog(),
    paceCalc: () => SE.paceDialog(),
    sessionBlock: () => SE.sessionBlockDialog(),
    templates() { SE.templatesDialog(); },
    // affichage
    freeze() {
      const s = sel(), sh = A().sheet;
      if (sh.freezeR || sh.freezeC) A().change((x) => { x.freezeR = 0; x.freezeC = 0; }, { layout: true });
      else { A().change((x) => { x.freezeR = s.r; x.freezeC = s.c; }, { layout: true }); SE.toast(s.r || s.c ? 'Volets figés au-dessus et à gauche de ' + SE.addr(s.r, s.c) : 'Sélectionnez la cellule sous/à droite de la zone à figer'); }
    },
    freezeRow() { A().change((x) => { x.freezeR = x.freezeR ? 0 : 1; }, { layout: true }); },
    gridlines() { A().change((x) => { x.grid = x.grid === false; }); },
    zoomIn: () => A().setZoom(A().grid.zoom * 1.15),
    zoomOut: () => A().setZoom(A().grid.zoom / 1.15),
    zoom100: () => A().setZoom(1),
    async colWidth() {
      const v = await SE.prompt('Largeur de colonne', 'Largeur en pixels', String(SE.colW(A().sheet, sel().c)), { type: 'number', icon: 'columns-3' });
      if (v && +v > 0) A().change((sh) => { for (let c = sel().c1; c <= Math.min(sel().c2, sh.cols - 1); c++) sh.colW[c] = +v; }, { layout: true });
    },
    async rowHeight() {
      const v = await SE.prompt('Hauteur de ligne', 'Hauteur en pixels', String(SE.rowH(A().sheet, sel().r)), { type: 'number', icon: 'rows-3' });
      if (v && +v > 0) A().change((sh) => { for (let r = sel().r1; r <= Math.min(sel().r2, sh.rows - 1); r++) sh.rowH[r] = +v; }, { layout: true });
    },
    autofit() {
      const a = A(), sh = a.sheet, s = sel();
      a.change((x) => {
        for (let c = s.c1; c <= Math.min(s.c2, sh.cols - 1); c++) {
          let w = 40;
          for (const k in x.cells) {
            const [r, cc] = k.split(',').map(Number);
            if (cc !== c || SE.mergeAt(x, r, c)) continue;
            const cell = x.cells[k];
            const v = a.calc.value(a.si, r, c);
            const t = SE.formatValue(v, cell.s && cell.s.nf);
            w = Math.max(w, a.grid.measure(t, a.grid.font(cell.s, 1)) + 14 + ((cell.s && cell.s.ind) || 0) * 10);
          }
          x.colW[c] = Math.min(500, Math.ceil(w));
        }
      }, { layout: true });
    },
    selectMode() { A().selectMode = !A().selectMode; A().grid.scroller.classList.toggle('selecting', A().selectMode); SE.toast(A().selectMode ? 'Mode sélection : touchez/glissez pour étendre la sélection' : 'Mode sélection désactivé'); A().updateBars(); },
    exportXlsx: () => SE.withBusy(() => SE.exportXLSX(A()), 'Export Excel…'),
    exportPdf: () => SE.withBusy(() => SE.exportPDF(A(), false), 'Création du PDF…'),
    exportPdfAll: () => SE.withBusy(() => SE.exportPDF(A(), true), 'Création du PDF…'),
    exportPng: () => SE.withBusy(() => SE.exportPNG(A()), 'Création de l\'image…'),
    exportCsv: () => SE.exportCSV(A()),
    exportSess: () => SE.exportSess(A()),
    lock() { const on = !activeStyle().lock; styleSel({ lock: on || null }); SE.toast(on ? 'Cellules verrouillées (non modifiables)' : 'Cellules déverrouillées'); }
  };
  SE.CMD = CMD;
  SE.run = function (act, btn) {
    const f = CMD[act];
    if (!f) { console.warn('Commande inconnue', act); return; }
    if (A() && A().editing && !['commit', 'cancelEdit', 'functions', 'sportFunctions'].includes(act)) A().commitEdit(null);
    try { const r = f(btn); if (r && r.catch) r.catch((e) => SE.toast(String(e.message || e), 'err')); }
    catch (e) { console.error(e); SE.toast('Erreur : ' + (e.message || e), 'err'); }
  };
  SE.withBusy = async (fn, msg) => { SE.toast(msg); try { await fn(); } catch (e) { console.error(e); SE.toast('Erreur : ' + (e.message || e), 'err'); } };

  SE.applyPainter = function () {
    const a = A();
    if (!a.painter) return;
    const st = a.painter.style;
    a.painter = null;
    a.change((sh) => forSel((r, c) => {
      const cl = sh.cells[r + ',' + c];
      if (cl) delete cl.s;
      if (Object.keys(st).length) SE.setStyle(sh, r, c, st); else if (cl && cl.v === undefined) delete sh.cells[r + ',' + c];
    }));
  };

  SE.insertDelete = function (axis, at, count) {
    const a = A();
    if (!count) return;
    a.change((sh) => {
      SE.structural(a.wb, a.si, axis, at, count);
      (sh.charts || []).forEach((ch) => {
        const k = axis === 'r' ? 'r' : 'c';
        if (ch[k] >= at) ch[k] = Math.max(0, ch[k] + count);
      });
    }, { layout: true });
    a.renderCharts();
  };

  // ---------- Presse-papiers ----------
  SE.copy = function (cut, clipboardData) {
    const a = A(), s = sel(), sh = a.sheet;
    const r2 = Math.min(s.r2, SE.usedRange(sh).r2), c2 = Math.min(s.c2, SE.usedRange(sh).c2);
    const R2 = Math.max(s.r1, r2), C2 = Math.max(s.c1, c2);
    const cells = [], lines = [];
    for (let r = s.r1; r <= R2; r++) {
      const row = [], txt = [];
      for (let c = s.c1; c <= C2; c++) {
        const cl = sh.cells[r + ',' + c];
        row.push(cl ? JSON.parse(JSON.stringify(cl)) : null);
        const v = cl && cl.v !== undefined ? a.calc.value(a.si, r, c) : null;
        txt.push(SE.formatValue(v, cl && cl.s && cl.s.nf));
      }
      cells.push(row); lines.push(txt.join('\t'));
    }
    const text = lines.join('\n');
    a.clip = { si: a.si, r1: s.r1, c1: s.c1, r2: R2, c2: C2, cells, text, cut, showAnts: true, merges: sh.merges.filter((m) => m.r1 >= s.r1 && m.r2 <= R2 && m.c1 >= s.c1 && m.c2 <= C2).map((m) => ({ r1: m.r1 - s.r1, c1: m.c1 - s.c1, r2: m.r2 - s.r1, c2: m.c2 - s.c1 })) };
    if (clipboardData) clipboardData.setData('text/plain', text);
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    a.grid.draw();
    SE.toast(cut ? 'Coupé' : 'Copié — ' + cells.length + ' × ' + (cells[0] ? cells[0].length : 0));
  };
  SE.paste = async function (externalText, mode) {
    const a = A(), s = sel();
    let clip = a.clip;
    if (externalText === null && (!clip) && navigator.clipboard && navigator.clipboard.readText) {
      try { externalText = await navigator.clipboard.readText(); } catch (e) { externalText = ''; }
    }
    if (externalText && (!clip || externalText.replace(/\r/g, '') !== clip.text)) {
      const rows = externalText.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((l) => l.split('\t'));
      a.change((sh) => rows.forEach((row, i) => row.forEach((v, j) => { SE.setRaw(sh, s.r + i, s.c + j, v); a.autoFormat(sh, s.r + i, s.c + j, v); })), { layout: true });
      return;
    }
    if (!clip) { SE.toast('Presse-papiers vide'); return; }
    const H = clip.cells.length, W = clip.cells[0].length;
    // coller en répétant sur une sélection plus grande multiple
    const repR = (s.r2 - s.r1 + 1) % H === 0 && s.r2 - s.r1 + 1 > H ? (s.r2 - s.r1 + 1) / H : 1;
    const repC = (s.c2 - s.c1 + 1) % W === 0 && s.c2 - s.c1 + 1 > W ? (s.c2 - s.c1 + 1) / W : 1;
    a.change((sh) => {
      const srcSh = a.wb.sheets[clip.si];
      if (clip.cut && srcSh) { for (let r = clip.r1; r <= clip.r2; r++) for (let c = clip.c1; c <= clip.c2; c++) delete srcSh.cells[r + ',' + c]; srcSh.merges = srcSh.merges.filter((m) => !(m.r1 >= clip.r1 && m.r2 <= clip.r2 && m.c1 >= clip.c1 && m.c2 <= clip.c2)); }
      for (let ir = 0; ir < repR; ir++) for (let ic = 0; ic < repC; ic++) {
        const br = s.r1 + ir * H, bc = s.c1 + ic * W;
        clip.cells.forEach((row, i) => row.forEach((cl, j) => {
          const r = br + i, c = bc + j, k = r + ',' + c;
          const dr = r - (clip.r1 + i), dc = c - (clip.c1 + j);
          if (mode === 'formats') { const cur = sh.cells[k] || {}; if (cl && cl.s) { cur.s = Object.assign({}, cl.s); sh.cells[k] = cur; } else if (sh.cells[k]) delete sh.cells[k].s; return; }
          if (mode === 'values') { const v = cl && cl.v !== undefined ? a.calc.value(clip.si, clip.r1 + i, clip.c1 + j) : null; SE.setRaw(sh, r, c, v === null ? '' : typeof v === 'boolean' ? (v ? 'VRAI' : 'FAUX') : SE.isErr(v) ? v.err : String(v)); return; }
          if (!cl) { delete sh.cells[k]; return; }
          const n = {};
          if (cl.s) n.s = Object.assign({}, cl.s);
          if (cl.v !== undefined) n.v = cl.v[0] === '=' && !clip.cut ? SE.shiftFormula(cl.v, dr, dc) : cl.v;
          sh.cells[k] = n;
          if (r >= sh.rows) sh.rows = r + 20;
          if (c >= sh.cols) sh.cols = c + 2;
        }));
        if (!mode) clip.merges.forEach((m) => { sh.merges = sh.merges.filter((x) => x.r2 < br + m.r1 || x.r1 > br + m.r2 || x.c2 < bc + m.c1 || x.c1 > bc + m.c2); sh.merges.push({ r1: br + m.r1, c1: bc + m.c1, r2: br + m.r2, c2: bc + m.c2 }); });
      }
    }, { layout: true });
    a.setSel(s.r1 + H * repR - 1, s.c1 + W * repC - 1, s.r1, s.c1); a.sel.r = s.r1; a.sel.c = s.c1;
    if (clip.cut) a.clip = null; else clip.showAnts = true;
  };

  // ---------- Fonctions automatiques ----------
  SE.autoFn = function (name) {
    const a = A(), s = sel(), sh = a.sheet;
    const isNum = (r, c) => typeof a.calc.value(a.si, r, c) === 'number';
    if (s.r1 !== s.r2 || s.c1 !== s.c2) {
      // une formule sous chaque colonne sélectionnée
      a.change((x) => { for (let c = s.c1; c <= s.c2; c++) SE.setRaw(x, s.r2 + 1, c, '=' + name + '(' + SE.addr(s.r1, c) + ':' + SE.addr(s.r2, c) + ')'); });
      a.setSel(s.r2 + 1, s.c1);
      return;
    }
    let r = s.r - 1;
    while (r >= 0 && isNum(r, s.c)) r--;
    let range;
    if (r < s.r - 1) range = SE.addr(r + 1, s.c) + ':' + SE.addr(s.r - 1, s.c);
    else {
      let c = s.c - 1;
      while (c >= 0 && isNum(s.r, c)) c--;
      if (c < s.c - 1) range = SE.addr(s.r, c + 1) + ':' + SE.addr(s.r, s.c - 1);
    }
    void sh;
    a.startEdit('=' + name + '(' + (range || '') + ')');
    if (!range) { const ed = a.activeInput(); const p = ed.value.length - 1; ed.setSelectionRange(p, p); }
  };

  SE.toggleAbsolute = function () {
    const a = A();
    const inp = a.activeInput();
    const t = inp.value, pos = inp.selectionStart;
    const re = /(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g;
    let m, best = null;
    while ((m = re.exec(t))) if (pos >= m.index && pos <= m.index + m[0].length) best = m;
    if (!best) return;
    const state = (best[1] ? 2 : 0) + (best[3] ? 1 : 0);
    const next = [3, 0, 1, 2][state];
    const rep = (next & 2 ? '$' : '') + best[2] + (next & 1 ? '$' : '') + best[4];
    a.setEditText(t.slice(0, best.index) + rep + t.slice(best.index + best[0].length), best.index + rep.length);
  };

  // ---------- Aide à la saisie des fonctions ----------
  const DOCS = () => SE._fnDocs || (SE._fnDocs = SE.functionList());
  SE.updateFnHint = function (text, caret) {
    const box = $('#fnHint');
    if (!text || text[0] !== '=') { box.classList.add('hidden'); return; }
    const before = text.slice(0, caret);
    const word = /([A-Za-z][\w.]*)$/.exec(before);
    const all = DOCS();
    if (word && word[1].length >= 1 && !/\d$/.test(word[1]) && !/^[A-Za-z]{1,3}\d/.test(word[1])) {
      const w = word[1].toUpperCase();
      const hits = [];
      for (const f of all) {
        const names = [f.name].concat(f.aliases);
        const n = names.find((x) => x.startsWith(w));
        if (n) hits.push({ n, f });
        if (hits.length >= 8) break;
      }
      if (hits.length) {
        box.innerHTML = '';
        hits.forEach((h) => {
          const b = SE.h('<button class="chip">' + SE.esc(h.n) + '</button>');
          b.onpointerdown = (e) => { e.preventDefault(); const a = A(); const t = a.getEditText(); const st = caret - word[1].length; const nt = t.slice(0, st) + h.n + '(' + t.slice(caret); a.setEditText(nt, st + h.n.length + 1); a.activeInput().focus(); };
          box.appendChild(b);
        });
        box.classList.remove('hidden');
        return;
      }
    }
    // fonction englobante
    let depth = 0;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === ')') depth++;
      else if (ch === '(') {
        if (depth === 0) {
          const m = /([A-Za-z][\w.]*)$/.exec(before.slice(0, i));
          if (m) {
            const up = m[1].toUpperCase();
            const canon = SE.FALIAS[up] || up;
            const f = all.find((x) => x.name === canon);
            if (f) { box.innerHTML = '<b>' + SE.esc(up) + '</b><span>' + SE.esc(f.doc) + '</span>'; box.classList.remove('hidden'); return; }
          }
          break;
        }
        depth--;
      }
    }
    box.classList.add('hidden');
  };

  // ---------- Ruban ----------
  const RIBBON = {
    'Accueil': [
      ['paste', 'clipboard-paste', 'Coller'], ['cut', 'scissors', 'Couper'], ['copy', 'copy', 'Copier'], ['painter', 'paintbrush', 'Pinceau', 'painter'], '|',
      ['bold', 'bold', 'Gras', 'b'], ['italic', 'italic', 'Italique', 'i'], ['underline', 'underline', 'Souligné', 'u'], ['strike', 'strikethrough', 'Barré', 'st'], ['fontBigger', 'type', 'Taille +'], ['fontSmaller', 'type', 'Taille −'], ['fontColor', 'baseline', 'Texte', null, 'fc'], ['fillColor', 'paint-bucket', 'Fond', null, 'bg'], '|',
      ['alignLeft', 'align-left', 'Gauche', 'ha:left'], ['alignCenter', 'align-center', 'Centre', 'ha:center'], ['alignRight', 'align-right', 'Droite', 'ha:right'], ['vAlign', 'chevrons-left-right', 'Vertical'], ['wrap', 'wrap-text', 'Renvoi', 'wrap'], ['merge', 'table-cells-merge', 'Fusionner'], '|',
      ['numFormat', 'hash', 'Format'], ['fmtPct', 'percent', '%'], ['fmtKg', 'dumbbell', 'kg'], ['decMore', 'plus', ',00'], ['decLess', 'list-minus', ',0'], ['borders', 'grid-3x3', 'Bordures'], ['tableStyle', 'layout-template', 'Styles'], ['cf', 'sparkles', 'Cond.'], ['clearFormat', 'eraser', 'Effacer']
    ],
    'Insertion': [
      ['insRowAbove', 'arrow-up', 'Ligne ↑'], ['insRowBelow', 'arrow-down', 'Ligne ↓'], ['insColLeft', 'chevron-left', 'Col. ←'], ['insColRight', 'chevron-right', 'Col. →'], ['delRows', 'list-minus', 'Suppr. lignes'], ['delCols', 'trash-2', 'Suppr. col.'], '|',
      ['chart', 'chart-column', 'Graphique'], ['checkbox', 'square-check', 'Case', 'chk'], ['validation', 'list-checks', 'Liste'], ['note', 'sticky-note', 'Note'], ['link', 'link', 'Lien'], ['today', 'calendar-days', 'Aujourd\'hui'], ['addSheet', 'file-plus', 'Feuille']
    ],
    'Formules': [
      ['autosum', 'sigma', 'Somme'], ['autoavg', 'activity', 'Moyenne'], ['automax', 'arrow-up', 'Max'], ['automin', 'arrow-down', 'Min'], ['autocount', 'hash', 'Nombre'], '|',
      ['functions', 'square-function', 'Fonctions'], ['sportFunctions', 'dumbbell', 'Fn. sport', null, null, 'y'], '|', ['showFormulas', 'eye', 'Afficher', 'showFormulas'], ['recalc', 'rotate-ccw', 'Recalculer']
    ],
    'Données': [
      ['sortAsc', 'arrow-up-down', 'Tri A→Z'], ['sortDesc', 'arrow-up-down', 'Tri Z→A'], ['sortCustom', 'list-plus', 'Trier…'], ['filter', 'filter', 'Filtrer'], ['clearFilter', 'x', 'Sans filtre'], '|',
      ['find', 'search', 'Rechercher'], ['validation', 'list-checks', 'Validation'], ['cf', 'sparkles', 'Mise en forme cond.'], ['dedupe', 'copy', 'Doublons'], '|', ['fillDown', 'arrow-down', 'Recopier ↓'], ['fillRight', 'chevron-right', 'Recopier →'], ['lock', 'lock', 'Verrouiller', 'lock']
    ],
    '💪 Sport': [
      ['wizard', 'wand-sparkles', 'Générateur', null, null, 'y'], ['templates', 'layout-template', 'Modèles'], ['exercises', 'dumbbell', 'Exercices'], ['sessionBlock', 'clipboard-list', 'Bloc séance'], '|',
      ['rmCalc', 'calculator', '1RM'], ['paceCalc', 'footprints', 'Allure'], ['timer', 'timer', 'Chrono'], ['sportFunctions', 'square-function', 'Fonctions'], '|',
      ['checkbox', 'square-check', 'Case Fait', 'chk'], ['tableStyle', 'palette', 'Styles'], ['chart', 'chart-line', 'Progression']
    ],
    'Affichage': [
      ['freeze', 'snowflake', 'Figer', 'freeze'], ['freezeRow', 'rows-3', 'Figer L1'], ['gridlines', 'grid-3x3', 'Quadrillage', 'grid'], ['selectMode', 'move', 'Sélection', 'selectMode'], '|',
      ['zoomOut', 'list-minus', 'Zoom −'], ['zoom100', 'maximize-2', '100%'], ['zoomIn', 'plus', 'Zoom +'], '|',
      ['colWidth', 'columns-3', 'Largeur'], ['rowHeight', 'rows-3', 'Hauteur'], ['autofit', 'chevrons-left-right', 'Ajuster'], '|', ['settings', 'settings', 'Réglages']
    ]
  };
  let currentTab = 'Accueil';
  SE.buildRibbon = function (tab) {
    if (tab) currentTab = tab;
    const tabs = $('#ribbonTabs');
    tabs.innerHTML = '';
    Object.keys(RIBBON).forEach((t) => {
      const b = SE.h('<button class="' + (t === currentTab ? 'on ' : '') + (t.includes('Sport') ? 'sport' : '') + '">' + t + '</button>');
      b.onclick = () => SE.buildRibbon(t);
      tabs.appendChild(b);
    });
    const rb = $('#ribbon');
    rb.innerHTML = '';
    RIBBON[currentTab].forEach((it) => {
      if (it === '|') { rb.appendChild(SE.h('<div class="rb-sep"></div>')); return; }
      const [act, icon, label, stateKey, swatch, cls] = it;
      const b = SE.h('<button class="rb ' + (cls || '') + '" title="' + SE.esc(label) + '">' + SE.icon(icon, 19) + '<span>' + SE.esc(label) + '</span>' + (swatch ? '<i class="sw"></i>' : '') + '</button>');
      b.dataset.state = stateKey || '';
      b.dataset.sw = swatch || '';
      b.addEventListener('pointerdown', (e) => { if (A().editing) e.preventDefault(); });
      b.onclick = () => SE.run(act, b);
      rb.appendChild(b);
    });
    SE.refreshRibbonState();
  };
  SE.refreshRibbonState = function () {
    const a = A();
    if (!a || !a.sel) return;
    const st = activeStyle(), sh = a.sheet;
    document.querySelectorAll('#ribbon .rb').forEach((b) => {
      const k = b.dataset.state;
      let on = false;
      if (k === 'painter') on = !!a.painter;
      else if (k === 'showFormulas') on = a.showFormulas;
      else if (k === 'freeze') on = !!(sh.freezeR || sh.freezeC);
      else if (k === 'grid') on = sh.grid !== false;
      else if (k === 'selectMode') on = a.selectMode;
      else if (k && k.startsWith('ha:')) on = st.ha === k.slice(3);
      else if (k) on = !!st[k];
      b.classList.toggle('on', on);
      if (b.dataset.sw) { const i = b.querySelector('.sw'); i.style.background = st[b.dataset.sw] || (b.dataset.sw === 'fc' ? '#e4e4e7' : 'transparent'); }
    });
    $('[data-act=undo]').disabled = !a.undoStack.length;
    $('[data-act=redo]').disabled = !a.redoStack.length;
  };

  // ---------- Menus ----------
  SE.contextMenu = function (x, y, h) {
    const a = A();
    if (h && h.type === 'colhdr') {
      return SE.menu(x, y, [
        { icon: 'chevron-left', label: 'Insérer colonne à gauche', run: () => SE.run('insColLeft') },
        { icon: 'chevron-right', label: 'Insérer colonne à droite', run: () => SE.run('insColRight') },
        { icon: 'trash-2', label: 'Supprimer colonne(s)', run: () => SE.run('delCols') },
        '-', { icon: 'columns-3', label: 'Largeur…', run: () => SE.run('colWidth') }, { icon: 'chevrons-left-right', label: 'Ajuster au contenu', run: () => SE.run('autofit') },
        { icon: 'arrow-up-down', label: 'Trier A→Z', run: () => SE.run('sortAsc') }, { icon: 'arrow-up-down', label: 'Trier Z→A', run: () => SE.run('sortDesc') }
      ]);
    }
    if (h && h.type === 'rowhdr') {
      return SE.menu(x, y, [
        { icon: 'arrow-up', label: 'Insérer ligne au-dessus', run: () => SE.run('insRowAbove') },
        { icon: 'arrow-down', label: 'Insérer ligne en dessous', run: () => SE.run('insRowBelow') },
        { icon: 'trash-2', label: 'Supprimer ligne(s)', run: () => SE.run('delRows') },
        '-', { icon: 'rows-3', label: 'Hauteur…', run: () => SE.run('rowHeight') }, { icon: 'snowflake', label: 'Figer jusqu\'ici', run: () => a.change((sh) => { sh.freezeR = sel().r2 + 1; sh.freezeC = 0; }, { layout: true }) }
      ]);
    }
    const v = a.calc.value(a.si, sel().r, sel().c);
    SE.menu(x, y, [
      { icon: 'pencil', label: 'Modifier', run: () => a.startEdit() },
      { icon: 'scissors', label: 'Couper', key: 'Ctrl+X', run: () => SE.run('cut') },
      { icon: 'copy', label: 'Copier', key: 'Ctrl+C', run: () => SE.run('copy') },
      { icon: 'clipboard-paste', label: 'Coller', key: 'Ctrl+V', run: () => SE.run('paste') },
      a.clip ? { icon: 'clipboard-paste', label: 'Coller les valeurs', run: () => SE.run('pasteValues') } : null,
      a.clip ? { icon: 'paintbrush', label: 'Coller la mise en forme', run: () => SE.run('pasteFormats') } : null,
      '-',
      { icon: 'eraser', label: 'Effacer le contenu', key: 'Suppr', run: () => SE.run('clearContents') },
      { icon: 'brush-cleaning', label: 'Tout effacer (contenu + format)', run: () => SE.run('clearAll') },
      '-',
      { icon: 'arrow-up', label: 'Insérer ligne au-dessus', run: () => SE.run('insRowAbove') },
      { icon: 'arrow-down', label: 'Insérer ligne en dessous', run: () => SE.run('insRowBelow') },
      { icon: 'trash-2', label: 'Supprimer ligne(s)', run: () => SE.run('delRows') },
      { icon: 'chevron-right', label: 'Insérer colonne', run: () => SE.run('insColLeft') },
      '-',
      { icon: 'arrow-down', label: 'Recopier vers le bas', key: 'Ctrl+D', run: () => SE.run('fillDown') },
      { icon: 'table-cells-merge', label: 'Fusionner / séparer', run: () => SE.run('merge') },
      { icon: 'sticky-note', label: 'Note / consigne', run: () => SE.run('note') },
      { icon: 'dumbbell', label: 'Insérer un exercice', run: () => SE.run('exercises') },
      typeof v === 'string' && /^https?:\/\//i.test(v) ? { icon: 'link', label: 'Ouvrir le lien', run: () => SE.run('openLink') } : null,
      { icon: 'move', label: a.selectMode ? 'Quitter le mode sélection' : 'Mode sélection (étendre)', run: () => SE.run('selectMode') }
    ]);
  };
  SE.sheetMenu = function (i, btn) {
    const a = A(), wb = a.wb;
    const r = btn.getBoundingClientRect();
    SE.menu(r.left, r.top - 10 - 300, [
      { icon: 'type', label: 'Renommer', run: async () => {
        const n = await SE.prompt('Renommer la feuille', 'Nom', wb.sheets[i].name, { icon: 'type' });
        if (!n || !n.trim()) return;
        const name = n.trim().replace(/[!'[\]*?/\\:]/g, '');
        if (wb.sheets.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) { SE.toast('Ce nom existe déjà', 'err'); return; }
        const old = wb.sheets[i].name;
        a.change(() => {
          wb.sheets[i].name = name;
          // mettre à jour les références
          wb.sheets.forEach((s) => { for (const k in s.cells) { const c = s.cells[k]; if (c.v && c.v[0] === '=') c.v = SE.mapRefs(c.v, (ref) => (ref.sheet && ref.sheet.toLowerCase() === old.toLowerCase() ? SE.refText(Object.assign(ref, { sheetText: (/^[A-Za-z_][\w.]*$/.test(name) ? name : "'" + name + "'") + '!' })) : null)); } });
        });
        a.renderTabs();
      } },
      { icon: 'palette', label: 'Couleur de l\'onglet', run: async () => { const c = await SE.pickColor('Couleur de l\'onglet', true); if (c !== undefined) { a.change(() => { wb.sheets[i].tab = c; }); a.renderTabs(); } } },
      { icon: 'copy', label: 'Dupliquer', run: () => {
        a.change(() => { const cp = JSON.parse(JSON.stringify(wb.sheets[i])); cp.id = SE.uid(); let n = 2; while (wb.sheets.some((s) => s.name === cp.name + ' (' + n + ')')) n++; cp.name = cp.name + ' (' + n + ')'; wb.sheets.splice(i + 1, 0, cp); });
        a.switchSheet(i + 1);
      } },
      { icon: 'chevron-left', label: 'Déplacer à gauche', run: () => { if (i > 0) { a.change(() => { const [s] = wb.sheets.splice(i, 1); wb.sheets.splice(i - 1, 0, s); }); a.si = i - 1; a.renderTabs(); } } },
      { icon: 'chevron-right', label: 'Déplacer à droite', run: () => { if (i < wb.sheets.length - 1) { a.change(() => { const [s] = wb.sheets.splice(i, 1); wb.sheets.splice(i + 1, 0, s); }); a.si = i + 1; a.renderTabs(); } } },
      '-',
      { icon: 'trash-2', label: 'Supprimer la feuille', run: async () => {
        if (wb.sheets.length < 2) { SE.toast('Un classeur doit garder au moins une feuille'); return; }
        if (!(await SE.confirm('Supprimer la feuille', 'Supprimer « ' + wb.sheets[i].name + ' » ? (annulable avec Ctrl+Z)', 'Supprimer', true))) return;
        a.change(() => { wb.sheets.splice(i, 1); });
        a.switchSheet(Math.max(0, i - 1));
      } }
    ]);
  };
  SE.bordersMenu = function (btn) {
    const r = btn.getBoundingClientRect();
    const a = A();
    const apply = (fn) => a.change((sh) => { const s = sel(); for (let rr = s.r1; rr <= s.r2; rr++) for (let c = s.c1; c <= s.c2; c++) SE.setStyle(sh, rr, c, fn(rr, c, s)); });
    const col = () => SE._bdc || '#222222';
    SE.menu(r.left, r.bottom + 4, [
      { icon: 'grid-3x3', label: 'Toutes les bordures', run: () => apply(() => ({ bt: 1, bb: 1, bl: 1, br: 1, bdc: col() })) },
      { icon: 'square', label: 'Bordure extérieure', run: () => apply((rr, c, s) => ({ bt: rr === s.r1 ? 1 : undefined, bb: rr === s.r2 ? 1 : undefined, bl: c === s.c1 ? 1 : undefined, br: c === s.c2 ? 1 : undefined, bdc: col() })) },
      { icon: 'square', label: 'Bordure épaisse extérieure', run: () => apply((rr, c, s) => ({ bt: rr === s.r1 ? 2 : undefined, bb: rr === s.r2 ? 2 : undefined, bl: c === s.c1 ? 2 : undefined, br: c === s.c2 ? 2 : undefined, bdc: col() })) },
      { icon: 'arrow-down', label: 'Bordure inférieure', run: () => apply((rr, c, s) => (rr === s.r2 ? { bb: 1, bdc: col() } : {})) },
      { icon: 'arrow-down', label: 'Bordure inférieure épaisse', run: () => apply((rr, c, s) => (rr === s.r2 ? { bb: 3, bdc: col() } : {})) },
      { icon: 'arrow-up', label: 'Bordure supérieure', run: () => apply((rr, c, s) => (rr === s.r1 ? { bt: 1, bdc: col() } : {})) },
      { icon: 'x', label: 'Aucune bordure', run: () => apply(() => ({ bt: null, bb: null, bl: null, br: null, bdc: null })) },
      '-',
      { icon: 'palette', label: 'Couleur des bordures…', run: async () => { const c = await SE.pickColor('Couleur des bordures'); if (c) { SE._bdc = c; SE.toast('Couleur appliquée aux prochaines bordures'); } } }
    ]);
  };
  SE.numFormatMenu = function (btn) {
    const r = btn.getBoundingClientRect();
    const v = A().calc.value(A().si, sel().r, sel().c);
    SE.menu(r.left, r.bottom + 4, SE.NUMBER_FORMATS.map((f) => ({ label: f.label + (typeof v === 'number' && f.k !== 'text' ? '  →  ' + SE.formatValue(v, f.k) : ''), run: () => styleSel({ nf: f.k || null }) })));
  };
  SE.exportMenu = function (btn) {
    const r = btn.getBoundingClientRect();
    SE.menu(r.right - 260, r.bottom + 4, [
      { icon: 'file-spreadsheet', label: 'Excel (.xlsx)', run: () => SE.run('exportXlsx') },
      { icon: 'file-down', label: 'PDF — feuille / sélection', run: () => SE.run('exportPdf') },
      { icon: 'file-text', label: 'PDF — classeur entier', run: () => SE.run('exportPdfAll') },
      { icon: 'image', label: 'Image PNG (à partager)', run: () => SE.run('exportPng') },
      { icon: 'file-text', label: 'CSV (feuille active)', run: () => SE.run('exportCsv') },
      { icon: 'save', label: 'Sauvegarde SuperEssence (.sess)', run: () => SE.run('exportSess') },
      '-',
      { icon: 'copy', label: 'Dupliquer le classeur', run: () => { const a = A(); const cp = JSON.parse(JSON.stringify(a.wb, (k, v) => (k[0] === '_' ? undefined : v))); cp.id = SE.uid(); cp.name += ' (copie)'; SE.store.save(cp); a.open(cp); SE.toast('Copie créée', 'ok'); } },
      { icon: 'upload', label: 'Importer un fichier', run: () => SE.run('import') }
    ]);
  };

  // ---------- Liste déroulante ----------
  SE.dvPicker = function () {
    const a = A(), s = sel();
    const dv = SE.dvAt(a.sheet, s.r, s.c);
    if (!dv) return;
    const body = SE.h('<div><input class="search" placeholder="Rechercher…"><div class="list"></div></div>');
    const list = body.querySelector('.list');
    const cur = (a.sheet.cells[s.r + ',' + s.c] || {}).v || '';
    const m = SE.modal({ title: 'Choisir une valeur', icon: 'list-checks', body, buttons: [{ label: 'Effacer', onClick: () => { a.change((sh) => SE.setRaw(sh, s.r, s.c, '')); } }] });
    const render = (q) => {
      list.innerHTML = '';
      const ql = (q || '').toLowerCase();
      dv.list.filter((x) => String(x).toLowerCase().includes(ql)).slice(0, 300).forEach((x) => {
        const b = SE.h('<button class="li">' + (String(x) === cur ? SE.icon('check', 16) : '<span style="width:16px"></span>') + SE.esc(x) + '</button>');
        b.onclick = () => { a.change((sh) => SE.setRaw(sh, s.r, s.c, String(x))); m.close(); a.move(1, 0); };
        list.appendChild(b);
      });
    };
    render('');
    const inp = body.querySelector('input');
    inp.oninput = () => render(inp.value);
    if (dv.list.length > 12 && !A().touchMode) setTimeout(() => inp.focus(), 50);
  };

  // ---------- Tri / filtre / doublons ----------
  function region() {
    const a = A(), s = sel(), sh = a.sheet;
    if (s.r1 !== s.r2 || s.c1 !== s.c2) {
      const u = SE.usedRange(sh);
      return { r1: s.r1, c1: s.c1, r2: Math.min(s.r2, u.r2), c2: Math.min(s.c2, u.c2) };
    }
    // zone contiguë autour de la cellule
    const has = (r, c) => { const x = sh.cells[r + ',' + c]; return x && x.v !== undefined && x.v !== ''; };
    let r1 = s.r, r2 = s.r, c1 = s.c, c2 = s.c, grow = true;
    while (grow) {
      grow = false;
      const rowHas = (r) => { for (let c = c1; c <= c2; c++) if (has(r, c)) return true; return false; };
      const colHas = (c) => { for (let r = r1; r <= r2; r++) if (has(r, c)) return true; return false; };
      if (r1 > 0 && rowHas(r1 - 1)) { r1--; grow = true; }
      if (r2 < sh.rows - 1 && rowHas(r2 + 1)) { r2++; grow = true; }
      if (c1 > 0 && colHas(c1 - 1)) { c1--; grow = true; }
      if (c2 < sh.cols - 1 && colHas(c2 + 1)) { c2++; grow = true; }
    }
    return { r1, c1, r2, c2 };
  }
  function hasHeader(rg) {
    const a = A();
    let txt = 0, n = 0;
    for (let c = rg.c1; c <= rg.c2; c++) { const v = a.calc.value(a.si, rg.r1, c); const v2 = a.calc.value(a.si, rg.r1 + 1, c); if (typeof v === 'string' && v !== '') txt++; if (typeof v2 === 'number') n++; }
    return txt > 0 && (n > 0 || txt === rg.c2 - rg.c1 + 1);
  }
  SE.sortRange = function (rg, col, asc, header) {
    const a = A();
    a.change((sh) => {
      const start = header ? rg.r1 + 1 : rg.r1;
      const rows = [];
      for (let r = start; r <= rg.r2; r++) {
        const cells = {};
        for (let c = rg.c1; c <= rg.c2; c++) cells[c] = sh.cells[r + ',' + c];
        rows.push({ r, key: a.calc.value(a.si, r, col), cells });
      }
      rows.sort((x, y) => {
        const p = x.key, q = y.key;
        const pe = p === null || p === '', qe = q === null || q === '';
        if (pe || qe) return pe && qe ? 0 : pe ? 1 : -1;
        let d;
        if (typeof p === 'number' && typeof q === 'number') d = p - q;
        else d = SE.toStr(p).localeCompare(SE.toStr(q), 'fr', { numeric: true, sensitivity: 'base' });
        return asc ? d : -d;
      });
      rows.forEach((row, i) => {
        const nr = start + i;
        for (let c = rg.c1; c <= rg.c2; c++) {
          const cl = row.cells[c];
          const k = nr + ',' + c;
          if (!cl) { delete sh.cells[k]; continue; }
          const n = { };
          if (cl.s) n.s = cl.s;
          if (cl.v !== undefined) n.v = cl.v[0] === '=' ? SE.shiftFormula(cl.v, nr - row.r, 0) : cl.v;
          sh.cells[k] = n;
        }
      });
    });
  };
  SE.sortSel = function (asc) {
    const rg = region();
    if (rg.r2 <= rg.r1) { SE.toast('Rien à trier'); return; }
    SE.sortRange(rg, sel().c, asc, hasHeader(rg));
    SE.toast('Trié ' + (asc ? 'A→Z' : 'Z→A') + ' sur la colonne ' + SE.colName(sel().c));
  };
  SE.sortDialog = function () {
    const rg = region(), a = A();
    const head = hasHeader(rg);
    const opts = [];
    for (let c = rg.c1; c <= rg.c2; c++) opts.push('<option value="' + c + '"' + (c === sel().c ? ' selected' : '') + '>' + SE.colName(c) + (head ? ' — ' + SE.esc(SE.toStr(a.calc.value(a.si, rg.r1, c))) : '') + '</option>');
    SE.modal({
      title: 'Trier ' + SE.addr(rg.r1, rg.c1) + ':' + SE.addr(rg.r2, rg.c2), icon: 'arrow-up-down',
      body: '<div class="field"><label>Colonne</label><select id="sCol">' + opts.join('') + '</select></div><div class="field"><label>Ordre</label><select id="sOrd"><option value="1">Croissant (A→Z, 1→9)</option><option value="0">Décroissant (Z→A, 9→1)</option></select></div><label class="hint"><input type="checkbox" id="sHead"' + (head ? ' checked' : '') + '> La première ligne contient des en-têtes</label>',
      buttons: [{ label: 'Annuler' }, { label: 'Trier', cls: 'primary', onClick: (m) => SE.sortRange(rg, +m.querySelector('#sCol').value, m.querySelector('#sOrd').value === '1', m.querySelector('#sHead').checked) }]
    });
  };
  SE.filterDialog = function () {
    const rg = region(), a = A();
    const head = hasHeader(rg);
    const opts = [];
    for (let c = rg.c1; c <= rg.c2; c++) opts.push('<option value="' + c + '"' + (c === sel().c ? ' selected' : '') + '>' + SE.colName(c) + (head ? ' — ' + SE.esc(SE.toStr(a.calc.value(a.si, rg.r1, c))) : '') + '</option>');
    const cur = a.calc.value(a.si, sel().r, sel().c);
    SE.modal({
      title: 'Filtrer', icon: 'filter',
      body: '<div class="field"><label>Colonne</label><select id="fCol">' + opts.join('') + '</select></div><div class="row2"><div class="field"><label>Condition</label><select id="fOp"><option value="contains">contient</option><option value="eq">est égal à</option><option value="neq">est différent de</option><option value="gt">supérieur à</option><option value="lt">inférieur à</option><option value="notempty">n\'est pas vide</option></select></div><div class="field"><label>Valeur</label><input id="fVal" value="' + SE.esc(cur === null ? '' : SE.toStr(cur)) + '"></div></div><p class="hint">Les lignes qui ne correspondent pas sont masquées. Données → « Sans filtre » pour tout réafficher.</p>',
      buttons: [{ label: 'Annuler' }, { label: 'Filtrer', cls: 'primary', onClick: (m) => {
        const col = +m.querySelector('#fCol').value, op = m.querySelector('#fOp').value, val = m.querySelector('#fVal').value;
        const lit = SE.literal(val);
        a.change((sh) => {
          sh.hidden = sh.hidden || {};
          let n = 0;
          for (let r = head ? rg.r1 + 1 : rg.r1; r <= rg.r2; r++) {
            const v = a.calc.value(a.si, r, col);
            const t = SE.toStr(v).toLowerCase();
            let ok = true;
            if (op === 'contains') ok = t.includes(val.toLowerCase());
            else if (op === 'eq') ok = t === String(SE.toStr(lit)).toLowerCase();
            else if (op === 'neq') ok = t !== String(SE.toStr(lit)).toLowerCase();
            else if (op === 'gt') ok = typeof v === 'number' && v > lit;
            else if (op === 'lt') ok = typeof v === 'number' && v < lit;
            else if (op === 'notempty') ok = !(v === null || v === '');
            if (!ok) { if (!(r in sh.hidden)) sh.hidden[r] = sh.rowH[r] !== undefined ? sh.rowH[r] : null; sh.rowH[r] = 0; n++; }
          }
          SE.toast(n + ' ligne(s) masquée(s)');
        }, { layout: true });
      } }]
    });
  };
  SE.dedupe = function () {
    const rg = region(), a = A();
    const head = hasHeader(rg);
    a.change((sh) => {
      const seen = new Set();
      const keep = [];
      for (let r = head ? rg.r1 + 1 : rg.r1; r <= rg.r2; r++) {
        const key = [];
        for (let c = rg.c1; c <= rg.c2; c++) key.push(SE.toStr(a.calc.value(a.si, r, c)));
        const k = key.join('\u0001');
        const cells = {};
        for (let c = rg.c1; c <= rg.c2; c++) cells[c] = sh.cells[r + ',' + c];
        if (!seen.has(k)) { seen.add(k); keep.push(cells); }
      }
      const start = head ? rg.r1 + 1 : rg.r1;
      const removed = rg.r2 - start + 1 - keep.length;
      for (let i = 0; i <= rg.r2 - start; i++) for (let c = rg.c1; c <= rg.c2; c++) {
        const k = start + i + ',' + c;
        if (i < keep.length && keep[i][c]) sh.cells[k] = keep[i][c]; else delete sh.cells[k];
      }
      SE.toast(removed + ' doublon(s) supprimé(s)');
    });
  };

  // ---------- Rechercher / remplacer ----------
  SE.findDialog = function () {
    const a = A();
    const body = SE.h('<div><div class="field"><label>Rechercher</label><input id="fq"></div><div class="field"><label>Remplacer par</label><input id="fr"></div><label class="hint"><input type="checkbox" id="fall"> Dans tout le classeur</label><p class="hint" id="fres"></p></div>');
    let last = null;
    const find = () => {
      const q = body.querySelector('#fq').value.toLowerCase();
      if (!q) return null;
      const all = body.querySelector('#fall').checked;
      const sheets = all ? a.wb.sheets.map((_, i) => i) : [a.si];
      const hits = [];
      sheets.forEach((si) => {
        const sh = a.wb.sheets[si];
        for (const k in sh.cells) {
          const cl = sh.cells[k];
          if (cl.v === undefined) continue;
          const [r, c] = k.split(',').map(Number);
          const shown = SE.formatValue(a.calc.value(si, r, c), cl.s && cl.s.nf).toLowerCase();
          if (shown.includes(q) || cl.v.toLowerCase().includes(q)) hits.push({ si, r, c });
        }
      });
      hits.sort((x, y) => x.si - y.si || x.r - y.r || x.c - y.c);
      return hits;
    };
    const next = () => {
      const hits = find();
      if (!hits || !hits.length) { body.querySelector('#fres').textContent = 'Aucun résultat'; return; }
      let i = 0;
      if (last) { i = hits.findIndex((h) => h.si > last.si || (h.si === last.si && (h.r > last.r || (h.r === last.r && h.c > last.c)))); if (i < 0) i = 0; }
      last = hits[i];
      if (last.si !== a.si) a.switchSheet(last.si);
      a.setSel(last.r, last.c); a.grid.scrollToCell(last.r, last.c);
      body.querySelector('#fres').textContent = 'Résultat ' + (i + 1) + ' / ' + hits.length + ' — ' + a.wb.sheets[last.si].name + '!' + SE.addr(last.r, last.c);
    };
    SE.modal({
      title: 'Rechercher / remplacer', icon: 'search', body,
      buttons: [
        { label: 'Tout remplacer', onClick: () => {
          const q = body.querySelector('#fq').value, rep = body.querySelector('#fr').value;
          const hits = find();
          if (!hits || !hits.length) { body.querySelector('#fres').textContent = 'Aucun résultat'; return false; }
          const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          a.change(() => hits.forEach((h) => { const sh = a.wb.sheets[h.si]; const cl = sh.cells[h.r + ',' + h.c]; cl.v = cl.v.replace(re, rep); }));
          SE.toast(hits.length + ' cellule(s) modifiée(s)', 'ok');
        } },
        { label: 'Suivant', cls: 'primary', onClick: () => { next(); return false; } }
      ]
    });
    setTimeout(() => body.querySelector('#fq').focus(), 50);
    body.querySelector('#fq').onkeydown = (e) => { if (e.key === 'Enter') next(); };
  };

  // ---------- Mise en forme conditionnelle ----------
  SE.cfDialog = function () {
    const a = A(), s = sel(), sh = a.sheet;
    const presets = [
      { k: 'green', label: 'Vert', style: { bg: '#DFF5E3', fc: '#1E8E3E', b: true } },
      { k: 'red', label: 'Rouge', style: { bg: '#FDE2E1', fc: '#C62828', b: true } },
      { k: 'yellow', label: 'Jaune', style: { bg: '#FFE38A', fc: '#111114', b: true } },
      { k: 'blue', label: 'Bleu', style: { bg: '#E3EEFF', fc: '#1A5FD0', b: true } },
      { k: 'bold', label: 'Gras rouge', style: { fc: '#C62828', b: true } },
      { k: 'black', label: 'Noir / jaune', style: { bg: '#111114', fc: '#FFC72C', b: true } }
    ];
    const types = [['gt', 'Supérieur à'], ['lt', 'Inférieur à'], ['gte', 'Supérieur ou égal à'], ['lte', 'Inférieur ou égal à'], ['between', 'Entre'], ['eq', 'Égal à'], ['contains', 'Contient le texte'], ['notempty', 'N\'est pas vide'], ['empty', 'Est vide'], ['true', 'Case cochée (VRAI)'], ['scale', 'Échelle de couleurs'], ['bar', 'Barres de données']];
    const rules = (sh.cf || []).map((r, i) => '<button class="li" data-del="' + i + '">' + SE.icon('trash-2', 16) + '<span>' + SE.addr(r.r1, r.c1) + ':' + SE.addr(r.r2, r.c2) + ' — ' + (types.find((t) => t[0] === r.type) || [0, r.type])[1] + (r.a !== undefined ? ' ' + SE.esc(r.a) : '') + (r.b !== undefined ? ' et ' + SE.esc(r.b) : '') + '</span></button>').join('');
    const body = SE.h('<div><p class="hint">Plage : <b>' + SE.addr(s.r1, s.c1) + ':' + SE.addr(s.r2, s.c2) + '</b></p><div class="field"><label>Règle</label><select id="cfT">' + types.map((t) => '<option value="' + t[0] + '">' + t[1] + '</option>').join('') + '</select></div><div class="row2"><div class="field" id="cfAw"><label>Valeur</label><input id="cfA" value="8"></div><div class="field" id="cfBw"><label>Et</label><input id="cfB" value="10"></div></div><div class="field" id="cfSw"><label>Style</label><div class="seg" id="cfS">' + presets.map((p, i) => '<button data-p="' + i + '" class="' + (i === 0 ? 'on' : '') + '" style="background:' + (p.style.bg || '#222') + ';color:' + p.style.fc + '">' + p.label + '</button>').join('') + '</div></div><div class="field" id="cfCw"><label>Couleurs</label><div class="seg" id="cfC"><button data-c="0" class="on">Rouge → Vert</button><button data-c="1">Vert → Rouge</button><button data-c="2">Blanc → Jaune</button><button data-c="3">Blanc → Bleu</button></div></div>' + (rules ? '<div class="grp" style="margin-top:10px;color:var(--y);font-weight:800;font-size:11px;letter-spacing:1.5px">RÈGLES DE LA FEUILLE (toucher pour supprimer)</div><div class="list">' + rules + '</div>' : '') + '</div>');
    let pi = 0, ci = 0;
    const scales = [['#e74c3c', '#f1c40f', '#2ecc71'], ['#2ecc71', '#f1c40f', '#e74c3c'], ['#ffffff', '#FFC72C'], ['#ffffff', '#1A5FD0']];
    const upd = () => {
      const t = body.querySelector('#cfT').value;
      body.querySelector('#cfAw').style.display = ['notempty', 'empty', 'true', 'scale', 'bar'].includes(t) ? 'none' : '';
      body.querySelector('#cfBw').style.display = t === 'between' ? '' : 'none';
      body.querySelector('#cfSw').style.display = ['scale', 'bar'].includes(t) ? 'none' : '';
      body.querySelector('#cfCw').style.display = t === 'scale' ? '' : 'none';
    };
    body.querySelector('#cfT').onchange = upd; upd();
    body.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { pi = +b.dataset.p; body.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); }));
    body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { ci = +b.dataset.c; body.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }));
    const m = SE.modal({
      title: 'Mise en forme conditionnelle', icon: 'sparkles', body,
      buttons: [{ label: 'Effacer les règles de la sélection', onClick: () => a.change((x) => { x.cf = (x.cf || []).filter((r) => r.r2 < s.r1 || r.r1 > s.r2 || r.c2 < s.c1 || r.c1 > s.c2); }) },
        { label: 'Appliquer', cls: 'primary', onClick: () => {
          const t = body.querySelector('#cfT').value;
          const rule = { r1: s.r1, c1: s.c1, r2: Math.min(s.r2, sh.rows - 1), c2: Math.min(s.c2, sh.cols - 1), type: t };
          if (!['notempty', 'empty', 'true', 'scale', 'bar'].includes(t)) rule.a = body.querySelector('#cfA').value;
          if (t === 'between') rule.b = body.querySelector('#cfB').value;
          if (t === 'scale') rule.colors = scales[ci];
          else if (t === 'bar') rule.color = '#FFC72C';
          else rule.style = presets[pi].style;
          a.change((x) => { x.cf = x.cf || []; x.cf.push(rule); });
        } }]
    });
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { const i = +b.dataset.del; a.change((x) => { x.cf.splice(i, 1); }); m.close(); SE.cfDialog(); }));
  };

  // ---------- Validation (liste déroulante) ----------
  SE.validationDialog = function () {
    const a = A(), s = sel();
    const groups = Object.keys(SE.EXERCISES);
    const presets = [['Exercices (tous)', SE.allExercises()]].concat(groups.map((g) => ['Exercices — ' + g, SE.EXERCISES[g]])).concat([
      ['RPE (6 → 10)', ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10']], ['Oui / Non', ['Oui', 'Non']], ['Statut', ['À faire', 'En cours', 'Fait', 'Annulé']],
      ['Ressenti', ['😀 Excellent', '🙂 Bien', '😐 Moyen', '😫 Difficile', '🤕 Douleur']], ['Jours', ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']],
      ['Type de séance', ['Force', 'Hypertrophie', 'Cardio', 'HIIT', 'Mobilité', 'Course', 'Repos']], ['Paiement', ['Payé', 'En attente', 'En retard', 'Offert']]
    ]);
    const cur = SE.dvAt(a.sheet, s.r, s.c);
    const body = SE.h('<div><p class="hint">Plage : <b>' + SE.addr(s.r1, s.c1) + ':' + SE.addr(s.r2, s.c2) + '</b> — une flèche ▾ permettra de choisir la valeur.</p><div class="field"><label>Liste prédéfinie</label><select id="dvP"><option value="">— Personnalisée —</option>' + presets.map((p, i) => '<option value="' + i + '">' + SE.esc(p[0]) + '</option>').join('') + '</select></div><div class="field"><label>Valeurs (une par ligne) ou plage (ex : A2:A20)</label><textarea id="dvL" rows="7">' + SE.esc(cur ? cur.list.join('\n') : '') + '</textarea></div></div>');
    body.querySelector('#dvP').onchange = (e) => { if (e.target.value !== '') body.querySelector('#dvL').value = presets[+e.target.value][1].join('\n'); };
    SE.modal({
      title: 'Liste déroulante', icon: 'list-checks', body,
      buttons: [{ label: 'Supprimer', onClick: () => a.change((sh) => { sh.dv = (sh.dv || []).filter((d) => d.r2 < s.r1 || d.r1 > s.r2 || d.c2 < s.c1 || d.c1 > s.c2); }) },
        { label: 'Appliquer', cls: 'primary', onClick: () => {
          let txt = body.querySelector('#dvL').value.trim();
          let list;
          const rm = /^([A-Za-z]{1,3}\d+):([A-Za-z]{1,3}\d+)$/.exec(txt);
          if (rm) {
            const p1 = SE.parseAddr(rm[1]), p2 = SE.parseAddr(rm[2]);
            list = [];
            for (let r = p1.r; r <= p2.r; r++) for (let c = p1.c; c <= p2.c; c++) { const v = a.calc.value(a.si, r, c); if (v !== null && v !== '') list.push(SE.toStr(v)); }
          } else list = txt.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
          if (!list.length) { SE.toast('Liste vide', 'err'); return false; }
          a.change((sh) => { sh.dv = (sh.dv || []).filter((d) => d.r2 < s.r1 || d.r1 > s.r2 || d.c2 < s.c1 || d.c1 > s.c2); sh.dv.push({ r1: s.r1, c1: s.c1, r2: Math.min(s.r2, sh.rows - 1), c2: Math.min(s.c2, sh.cols - 1), list }); });
        } }]
    });
  };

  // ---------- Graphique ----------
  SE.chartDialog = function (existing) {
    const a = A(), s = sel(), sh = a.sheet;
    let spec = existing ? JSON.parse(JSON.stringify(existing)) : null;
    if (!spec) {
      const rg = (s.r1 === s.r2 && s.c1 === s.c2) ? region() : { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 };
      if (rg.r2 <= rg.r1 && rg.c2 <= rg.c1) { SE.toast('Sélectionnez des données (étiquettes + valeurs)', 'err'); return; }
      const head = hasHeader(rg);
      const firstColText = (() => { for (let r = rg.r1 + (head ? 1 : 0); r <= rg.r2; r++) { const v = a.calc.value(a.si, r, rg.c1); if (typeof v === 'string' && v !== '') return true; if (typeof v === 'number' && /^date/.test(((sh.cells[r + ',' + rg.c1] || {}).s || {}).nf || '')) return true; } return false; })();
      const d0 = rg.r1 + (head ? 1 : 0);
      const labels = firstColText && rg.c2 > rg.c1 ? { r1: d0, c1: rg.c1, r2: rg.r2, c2: rg.c1 } : null;
      const series = [];
      for (let c = labels ? rg.c1 + 1 : rg.c1; c <= rg.c2; c++) series.push({ r1: d0, c1: c, r2: rg.r2, c2: c, name: head ? SE.toStr(a.calc.value(a.si, rg.r1, c)) : 'Série ' + (series.length + 1) });
      spec = { id: SE.uid(), type: 'line', title: head && series.length === 1 ? series[0].name : 'Progression', r: rg.r1, c: rg.c2 + 2, w: 460, h: 260, labels, series };
    }
    const prev = SE.h('<canvas style="width:100%;border-radius:12px;background:#fff"></canvas>');
    const body = SE.h('<div><div class="field"><label>Type</label><div class="seg" id="chT"><button data-t="line">Courbe</button><button data-t="bar">Barres</button><button data-t="area">Aire</button><button data-t="pie">Secteurs</button></div></div><div class="field"><label>Titre</label><input id="chTitle" value="' + SE.esc(spec.title) + '"></div><div class="prev"></div><p class="hint">Données : ' + spec.series.map((x) => SE.esc(x.name) + ' (' + SE.addr(x.r1, x.c1) + ':' + SE.addr(x.r2, x.c2) + ')').join(', ') + '. Le graphique se met à jour automatiquement.</p></div>');
    body.querySelector('.prev').appendChild(prev);
    const draw = () => { const w = Math.min(560, body.clientWidth || 520); SE.drawChart(prev, spec, SE.chartData(a, a.si, spec), w, 240); };
    body.querySelectorAll('[data-t]').forEach((b) => { b.classList.toggle('on', b.dataset.t === spec.type); b.onclick = () => { spec.type = b.dataset.t; body.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }; });
    body.querySelector('#chTitle').oninput = (e) => { spec.title = e.target.value; draw(); };
    SE.modal({
      title: existing ? 'Modifier le graphique' : 'Insérer un graphique', icon: 'chart-line', body,
      buttons: [{ label: 'Annuler' }, { label: existing ? 'Enregistrer' : 'Insérer', cls: 'primary', onClick: () => {
        a.change((x) => { x.charts = x.charts || []; const i = x.charts.findIndex((c) => c.id === spec.id); if (i >= 0) x.charts[i] = spec; else x.charts.push(spec); });
        a.renderCharts();
        if (!existing) { a.grid.scrollToCell(spec.r, Math.min(spec.c + 2, sh.cols - 1)); }
      } }],
      onOpen: () => setTimeout(draw, 30)
    });
  };

  // ---------- Fonctions ----------
  SE.functionsDialog = function (cat) {
    const a = A();
    const all = SE.functionList();
    const cats = ['Toutes', 'Sport', 'Maths', 'Statistiques', 'Logique', 'Texte', 'Date', 'Recherche'];
    let curCat = cat || 'Toutes';
    const body = SE.h('<div><input class="search" placeholder="Rechercher une fonction (ex : charge, somme, allure)"><div class="chips">' + cats.map((c) => '<button data-c="' + c + '" class="' + (c === curCat ? 'on' : '') + '">' + (c === 'Sport' ? '💪 ' : '') + c + '</button>').join('') + '</div><div class="list"></div></div>');
    const list = body.querySelector('.list');
    const m = SE.modal({ title: 'Insérer une fonction', icon: 'square-function', body, wide: true });
    const render = () => {
      const q = body.querySelector('input').value.toLowerCase();
      list.innerHTML = '';
      all.filter((f) => (curCat === 'Toutes' || f.cat === curCat) && (!q || f.name.toLowerCase().includes(q) || f.doc.toLowerCase().includes(q) || f.aliases.some((x) => x.toLowerCase().includes(q))))
        .forEach((f) => {
          const fr = f.aliases.find((x) => /[A-Z]/.test(x) && x !== f.name);
          const b = SE.h('<button class="li"><div><b style="font-family:ui-monospace,Menlo,monospace">' + f.name + '</b>' + (fr ? ' <span style="color:var(--muted);font-size:12px">· ' + fr + '</span>' : '') + '<small>' + SE.esc(f.doc) + '</small></div><span class="k">' + f.cat + '</span></button>');
          b.onclick = () => {
            m.close();
            const name = f.name;
            if (a.editing) { const inp = a.activeInput(); const p = inp.selectionStart; const t = inp.value; const ins = (t ? '' : '=') + name + '('; a.setEditText(t.slice(0, p) + ins + t.slice(inp.selectionEnd), p + ins.length); inp.focus(); }
            else { a.startEdit('=' + name + '('); }
          };
          list.appendChild(b);
        });
    };
    body.querySelector('input').oninput = render;
    body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { curCat = b.dataset.c; body.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); render(); }));
    render();
  };

  // ---------- Bibliothèque d'exercices ----------
  SE.exerciseDialog = function () {
    const a = A();
    const groups = Object.keys(SE.EXERCISES);
    let g = 'Tous';
    const custom = JSON.parse(localStorage.getItem('se_custom_ex') || '[]');
    const body = SE.h('<div><input class="search" placeholder="Rechercher un exercice…"><div class="chips">' + ['Tous', 'Mes exercices'].concat(groups).map((x) => '<button data-g="' + SE.esc(x) + '" class="' + (x === g ? 'on' : '') + '">' + SE.esc(x) + '</button>').join('') + '</div><p class="hint">Touchez un exercice pour l\'insérer dans la cellule active (puis passage à la ligne suivante).</p><div class="list"></div></div>');
    const list = body.querySelector('.list');
    const render = () => {
      const q = body.querySelector('input').value.toLowerCase();
      list.innerHTML = '';
      const src = g === 'Tous' ? [['Mes exercices', custom]].concat(groups.map((x) => [x, SE.EXERCISES[x]])) : g === 'Mes exercices' ? [['Mes exercices', custom]] : [[g, SE.EXERCISES[g]]];
      src.forEach(([grp, items]) => {
        const f = items.filter((x) => x.toLowerCase().includes(q));
        if (!f.length) return;
        list.appendChild(SE.h('<div class="grp">' + SE.esc(grp) + '</div>'));
        f.forEach((ex) => {
          const b = SE.h('<button class="li">' + SE.icon('dumbbell', 16) + '<span>' + SE.esc(ex) + '</span><span class="k">' + SE.esc(grp) + '</span></button>');
          b.onclick = () => { a.change((sh) => SE.setRaw(sh, a.sel.r, a.sel.c, ex)); a.move(1, 0); SE.toast('« ' + ex + ' » inséré', 'ok'); };
          list.appendChild(b);
        });
      });
    };
    body.querySelector('input').oninput = render;
    body.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { g = b.dataset.g; body.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('on', x === b)); render(); }));
    render();
    SE.modal({
      title: 'Bibliothèque d\'exercices', icon: 'dumbbell', body,
      buttons: [
        { label: 'Ajouter mon exercice', icon: 'plus', onClick: () => { SE.prompt('Nouvel exercice', 'Nom', '', { icon: 'dumbbell' }).then((n) => { if (n && n.trim()) { custom.push(n.trim()); localStorage.setItem('se_custom_ex', JSON.stringify(custom)); SE.toast('Ajouté à « Mes exercices »', 'ok'); } }); return false; } },
        { label: 'Liste déroulante sur la sélection', onClick: () => { const s = sel(); a.change((sh) => { sh.dv = sh.dv || []; sh.dv.push({ r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2, list: custom.concat(SE.allExercises()) }); }); SE.toast('Liste d\'exercices ajoutée', 'ok'); } }
      ]
    });
  };

  // ---------- Calculateurs ----------
  SE.rmDialog = function () {
    const a = A();
    const body = SE.h('<div><div class="row2"><div class="field"><label>Charge soulevée (kg)</label><input id="rw" type="number" inputmode="decimal" value="100"></div><div class="field"><label>Répétitions</label><input id="rr" type="number" inputmode="numeric" value="5"></div></div><div class="row2"><div class="field"><label>RPE (optionnel)</label><input id="rp" type="number" inputmode="decimal" placeholder="ex : 8"></div><div class="field"><label>Arrondi (kg)</label><input id="rs" type="number" inputmode="decimal" value="2.5"></div></div><div id="rres"></div></div>');
    const calc = () => {
      const w = +body.querySelector('#rw').value, r = +body.querySelector('#rr').value, rpe = +body.querySelector('#rp').value, st = +body.querySelector('#rs').value || 2.5;
      if (!w || !r) { body.querySelector('#rres').innerHTML = ''; return null; }
      const F = SE.FUNCS;
      const rm = rpe ? F.E1RM(w, r, rpe) : F.ONERM(w, r, 4);
      const rows = [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5].map((p) => '<div style="display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid var(--line)"><span>' + Math.round(p * 100) + '%</span><b>' + SE.fmtGeneral(F.CHARGE(rm, p, st)) + ' kg</b><span style="color:var(--muted)">' + ['1', '2', '3-4', '5-6', '7-8', '9-10', '11-12', '13-15', '16-20', '20+'][[1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5].indexOf(p)] + ' reps</span></div>').join('');
      body.querySelector('#rres').innerHTML = '<div style="text-align:center;margin:6px 0 12px"><div class="hint">1RM estimé ' + (rpe ? '(via RPE)' : '(moyenne Epley / Brzycki / Lombardi)') + '</div><div style="font-size:44px;font-weight:900;color:var(--y)">' + SE.fmtGeneral(Math.round(rm * 10) / 10) + ' kg</div></div>' + rows;
      return { w, r, rpe, rm };
    };
    body.querySelectorAll('input').forEach((i) => (i.oninput = calc));
    calc();
    SE.modal({
      title: 'Calculateur 1RM', icon: 'calculator', body,
      buttons: [{ label: 'Insérer la formule', cls: 'primary', onClick: () => {
        const v = calc(); if (!v) return false;
        a.change((sh) => { SE.setRaw(sh, a.sel.r, a.sel.c, v.rpe ? '=ROUND(E1RM(' + v.w + ';' + v.r + ';' + v.rpe + ');1)' : '=ROUND(ONERM(' + v.w + ';' + v.r + ';4);1)'); SE.setStyle(sh, a.sel.r, a.sel.c, { nf: 'kg' }); });
      } }]
    });
  };
  SE.paceDialog = function () {
    const a = A();
    const body = SE.h('<div><div class="row2"><div class="field"><label>Distance (km)</label><input id="pd" type="number" inputmode="decimal" value="10"></div><div class="field"><label>Temps (h:mm:ss ou mm:ss)</label><input id="pt" value="50:00"></div></div><div class="field"><label>VMA (km/h, optionnel)</label><input id="pv" type="number" inputmode="decimal" placeholder="ex : 15"></div><div id="pres"></div></div>');
    const F = SE.FUNCS;
    const calc = () => {
      const d = +body.querySelector('#pd').value, t = body.querySelector('#pt').value, v = +body.querySelector('#pv').value;
      let html = '';
      if (d && t) {
        const pace = F.ALLURE(d, t), speed = F.VITESSE(d, t);
        if (!SE.isErr(pace)) {
          html += '<div style="text-align:center;margin:6px 0 12px"><div class="hint">Allure</div><div style="font-size:44px;font-weight:900;color:var(--y)">' + pace + ' /km</div><div class="hint">' + SE.fixed(speed, 1) + ' km/h</div></div>';
          html += [['5 km', 5], ['10 km', 10], ['Semi-marathon', 21.0975], ['Marathon', 42.195]].map((x) => '<div style="display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid var(--line)"><span>' + x[0] + '</span><b>' + F.RIEGEL(d, t, x[1]) + '</b><span style="color:var(--muted)">prédiction Riegel</span></div>').join('');
        }
      }
      if (v) html += '<div class="grp" style="margin-top:14px;color:var(--y);font-weight:800;font-size:11px;letter-spacing:1.5px">ALLURES SELON % VMA</div>' + [0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1.05].map((p) => '<div style="display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px solid var(--line)"><span>' + Math.round(p * 100) + '% VMA</span><b>' + F.ALLUREVMA(v, p) + ' /km</b><span style="color:var(--muted)">' + SE.fixed(v * p, 1) + ' km/h</span></div>').join('');
      body.querySelector('#pres').innerHTML = html;
    };
    body.querySelectorAll('input').forEach((i) => (i.oninput = calc));
    calc();
    SE.modal({
      title: 'Calculateur d\'allure', icon: 'footprints', body,
      buttons: [{ label: 'Insérer la formule d\'allure', cls: 'primary', onClick: () => {
        const d = body.querySelector('#pd').value, t = body.querySelector('#pt').value;
        a.change((sh) => SE.setRaw(sh, a.sel.r, a.sel.c, '=ALLURE(' + d + ';"' + t + '")'));
      } }]
    });
  };

  // ---------- Bloc séance ----------
  SE.sessionBlockDialog = function () {
    const a = A();
    const body = SE.h('<div><div class="field"><label>Titre de la séance</label><input id="sbT" value="Séance 1 — Haut du corps"></div><div class="row2"><div class="field"><label>Nombre d\'exercices</label><input id="sbN" type="number" value="6"></div><div class="field"><label>Couleur</label><select id="sbC">' + SE.TABLE_STYLES.map((s, i) => '<option value="' + i + '">' + s.name + '</option>').join('') + '</select></div></div><div class="field"><label>Colonnes</label><div class="seg" id="sbCols"><button data-k="pct" class="on">% 1RM</button><button data-k="rpe" class="on">RPE</button><button data-k="rest" class="on">Repos</button><button data-k="tempo" class="on">Tempo</button><button data-k="done" class="on">Fait ✓</button><button data-k="notes" class="on">Notes</button></div></div><p class="hint">Le bloc est inséré à partir de la cellule active (' + SE.addr(a.sel.r, a.sel.c) + ') avec un calcul de tonnage automatique.</p></div>');
    body.querySelectorAll('#sbCols button').forEach((b) => (b.onclick = () => b.classList.toggle('on')));
    SE.modal({
      title: 'Insérer un bloc séance', icon: 'clipboard-list', body,
      buttons: [{ label: 'Annuler' }, { label: 'Insérer', cls: 'primary', onClick: () => {
        const on = (k) => body.querySelector('#sbCols [data-k=' + k + ']').classList.contains('on');
        const st = SE.TABLE_STYLES[+body.querySelector('#sbC').value];
        const n = Math.max(1, Math.min(30, +body.querySelector('#sbN').value || 6));
        const title = body.querySelector('#sbT').value;
        const cols = [['Exercice', 200], ['Séries', 62], ['Reps', 62]];
        if (on('pct')) cols.push(['% 1RM', 66]);
        cols.push(['Charge', 78]);
        if (on('rpe')) cols.push(['RPE', 52]);
        if (on('rest')) cols.push(['Repos', 62]);
        if (on('tempo')) cols.push(['Tempo', 76]);
        if (on('done')) cols.push(['Fait', 46]);
        if (on('notes')) cols.push(['Notes', 200]);
        const r0 = a.sel.r, c0 = a.sel.c;
        a.change((sh) => {
          const B = new SE.Builder(sh);
          const W = cols.length;
          B.merge(r0, c0, r0, c0 + W - 1, title, { bg: st.head.bg, fc: st.head.fc, b: true, fs: 14, ind: 1 });
          B.h(r0, 32);
          B.row(r0 + 1, c0, cols.map((x) => x[0]), { bg: '#E4E4E7', b: true, ha: 'center', fs: 11 });
          cols.forEach((x, i) => { if (!sh.colW[c0 + i] || sh.colW[c0 + i] === SE.DEFAULT_COL_W) sh.colW[c0 + i] = x[1]; });
          const ci = (name) => cols.findIndex((x) => x[0] === name);
          for (let i = 0; i < n; i++) {
            const r = r0 + 2 + i;
            B.style(r, c0, r, c0 + W - 1, { bg: st.band[i % 2] });
            cols.forEach((x, j) => { if (j > 0 && x[0] !== 'Notes') SE.setStyle(sh, r, c0 + j, { ha: 'center' }); });
            SE.setStyle(sh, r, c0 + ci('Charge'), { nf: 'kg', b: true });
            if (ci('% 1RM') >= 0) SE.setStyle(sh, r, c0 + ci('% 1RM'), { nf: 'pct' });
            if (ci('RPE') >= 0) SE.setStyle(sh, r, c0 + ci('RPE'), { nf: 'rpe' });
            if (ci('Fait') >= 0) B.set(r, c0 + ci('Fait'), 'FAUX', { chk: true });
          }
          const last = r0 + 1 + n;
          B.grid(r0 + 1, c0, last, c0 + W - 1, st.line);
          B.dv(r0 + 2, c0, last, c0, SE.allExercises());
          if (ci('RPE') >= 0) B.dv(r0 + 2, c0 + ci('RPE'), last, c0 + ci('RPE'), ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10']);
          const col = (name) => SE.colName(c0 + ci(name));
          B.set(last + 1, c0 + ci('Charge') - 1, 'Tonnage', { ha: 'right', i: true, fc: '#52525B' });
          B.set(last + 1, c0 + ci('Charge'), '=TONNAGE(' + col('Séries') + (r0 + 3) + ':' + col('Séries') + (last + 1) + ';' + col('Reps') + (r0 + 3) + ':' + col('Reps') + (last + 1) + ';' + col('Charge') + (r0 + 3) + ':' + col('Charge') + (last + 1) + ')', { nf: 'kg', b: true, ha: 'center' });
        }, { layout: true });
        a.setSel(r0 + 2, c0);
      } }]
    });
  };

  // ---------- Styles de tableau ----------
  SE.tableStyleDialog = function () {
    const a = A();
    const body = SE.h('<div><p class="hint">Appliqué à la sélection (' + SE.addr(sel().r1, sel().c1) + ':' + SE.addr(sel().r2, sel().c2) + ') : 1re ligne = en-tête, puis lignes alternées.</p><div class="ts-grid">' + SE.TABLE_STYLES.map((s, i) => '<button class="ts" data-i="' + i + '"><div style="background:' + s.head.bg + '"></div><div style="background:' + s.band[0] + '"></div><div style="background:' + s.band[1] + '"></div><div style="background:' + s.band[0] + '"></div><span>' + s.name + '</span></button>').join('') + '</div></div>');
    const m = SE.modal({ title: 'Styles de tableau', icon: 'palette', body });
    body.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => {
      const s = sel();
      if (s.r1 === s.r2) { const rg = region(); a.setSel(rg.r2, rg.c2, rg.r1, rg.c1); }
      a.change((sh) => SE.applyTableStyle(sh, sel(), SE.TABLE_STYLES[+b.dataset.i]));
      m.close();
    }));
  };

  // ---------- Modèles & assistant ----------
  SE.templatesDialog = function () {
    const body = SE.h('<div class="tpl-grid"></div>');
    const m = SE.modal({ title: 'Modèles', icon: 'layout-template', body, wide: true });
    SE.renderTemplates(body, () => m.close());
  };
  SE.renderTemplates = function (box, before) {
    box.innerHTML = '';
    SE.TEMPLATES.forEach((t) => {
      const b = SE.h('<button class="tpl ' + (t.wizard ? 'featured' : '') + '"><div class="ti" style="background:' + t.color + '">' + SE.icon(t.icon, 20) + '</div><b>' + SE.esc(t.name) + '</b><span>' + SE.esc(t.desc) + '</span></button>');
      b.onclick = () => {
        before && before();
        if (t.wizard) { SE.wizard(); return; }
        const wb = t.make();
        SE.app.open(wb);
        SE.toast('Modèle « ' + t.name + ' » créé', 'ok');
      };
      box.appendChild(b);
    });
  };

  SE.wizard = function () {
    const st = { athlete: '', coach: localStorage.getItem('se_coach') || '', goal: 'hypertrophie', level: 'inter', days: 3, weeks: 6, deload: 4, bw: 75, rm: [100, 80, 120, 50], step: 2.5, start: (() => { const d = new Date(); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() + (wd ? 7 - wd : 0)); return d.toISOString().slice(0, 10); })() };
    const goals = [['force', '🏋️ Force'], ['hypertrophie', '💪 Hypertrophie'], ['perte', '🔥 Perte de poids'], ['endurance', '🫀 Endurance musculaire'], ['debutant', '🌱 Remise en forme']];
    const body = SE.h(`<div>
      <div class="wiz-dots"><i class="on"></i><i></i><i></i><i></i></div>
      <div class="wiz-step on" data-s="0">
        <div class="field"><label>Nom de l'athlète / client</label><input id="wA" placeholder="ex : Camille Martin"></div>
        <div class="field"><label>Coach</label><input id="wC" placeholder="Votre nom ou votre marque"></div>
        <div class="field"><label>Date de début</label><input id="wD" type="date"></div>
      </div>
      <div class="wiz-step" data-s="1">
        <div class="field"><label>Objectif</label><div class="seg" id="wG">${goals.map((g) => `<button data-v="${g[0]}">${g[1]}</button>`).join('')}</div></div>
        <div class="field"><label>Niveau</label><div class="seg" id="wL"><button data-v="debutant">Débutant</button><button data-v="inter">Intermédiaire</button><button data-v="avance">Avancé</button></div></div>
      </div>
      <div class="wiz-step" data-s="2">
        <div class="field"><label>Séances par semaine</label><div class="seg" id="wJ">${[2, 3, 4, 5, 6].map((n) => `<button data-v="${n}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Durée du programme (semaines)</label><div class="seg" id="wW">${[4, 6, 8, 10, 12].map((n) => `<button data-v="${n}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Semaine de décharge</label><div class="seg" id="wDl"><button data-v="0">Aucune</button><button data-v="3">Toutes les 3 sem.</button><button data-v="4">Toutes les 4 sem.</button><button data-v="5">Toutes les 5 sem.</button></div></div>
      </div>
      <div class="wiz-step" data-s="3">
        <p class="hint">Records actuels (1RM) — toutes les charges du programme seront calculées à partir de ces valeurs, modifiables ensuite dans l'onglet Profil.</p>
        <div class="row2"><div class="field"><label>Squat</label><input id="r0" type="number" inputmode="decimal"></div><div class="field"><label>Développé couché</label><input id="r1" type="number" inputmode="decimal"></div></div>
        <div class="row2"><div class="field"><label>Soulevé de terre</label><input id="r2" type="number" inputmode="decimal"></div><div class="field"><label>Développé militaire</label><input id="r3" type="number" inputmode="decimal"></div></div>
        <div class="row2"><div class="field"><label>Poids de corps (kg)</label><input id="wBw" type="number" inputmode="decimal"></div><div class="field"><label>Arrondi des charges (kg)</label><input id="wSt" type="number" inputmode="decimal"></div></div>
      </div></div>`);
    const $b = (s) => body.querySelector(s);
    $b('#wA').value = st.athlete; $b('#wC').value = st.coach; $b('#wD').value = st.start;
    st.rm.forEach((v, i) => ($b('#r' + i).value = v));
    $b('#wBw').value = st.bw; $b('#wSt').value = st.step;
    const seg = (id, key, num) => {
      body.querySelectorAll(id + ' button').forEach((b) => {
        b.classList.toggle('on', String(st[key]) === b.dataset.v);
        b.onclick = () => { st[key] = num ? +b.dataset.v : b.dataset.v; body.querySelectorAll(id + ' button').forEach((x) => x.classList.toggle('on', x === b)); };
      });
    };
    seg('#wG', 'goal'); seg('#wL', 'level'); seg('#wJ', 'days', true); seg('#wW', 'weeks', true); seg('#wDl', 'deload', true);
    let step = 0;
    const show = () => {
      body.querySelectorAll('.wiz-step').forEach((x) => x.classList.toggle('on', +x.dataset.s === step));
      body.querySelectorAll('.wiz-dots i').forEach((x, i) => x.classList.toggle('on', i <= step));
      m.querySelector('.modal-foot .btn.primary').lastChild.textContent = step === 3 ? 'Créer le programme' : 'Suivant';
    };
    const m = SE.modal({
      title: 'Générateur de programme', icon: 'wand-sparkles', body,
      buttons: [
        { label: 'Retour', onClick: () => { if (step > 0) { step--; show(); } return false; } },
        { label: 'Suivant', cls: 'primary', icon: 'chevron-right', onClick: () => {
          if (step < 3) { step++; show(); return false; }
          const d = new Date($b('#wD').value || st.start);
          const o = {
            athlete: $b('#wA').value.trim() || 'Athlète', coach: $b('#wC').value.trim(), goal: st.goal, level: st.level, days: st.days, weeks: st.weeks, deload: st.deload,
            start: SE.dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()),
            rm: [0, 1, 2, 3].map((i) => +$b('#r' + i).value || st.rm[i]), bw: +$b('#wBw').value || 75, step: +$b('#wSt').value || 2.5
          };
          if (o.coach) localStorage.setItem('se_coach', o.coach);
          const wb = SE.generateProgram(o);
          SE.app.open(wb);
          SE.toast('Programme créé : ' + o.weeks + ' semaines × ' + o.days + ' séances', 'ok');
        } }
      ]
    });
    show();
  };

  // ---------- Chrono / minuteur ----------
  const T = SE.Timer = { mode: 'rest', running: false, end: 0, total: 90, remain: 90, swStart: 0, swAcc: 0, laps: [], iv: { work: 40, rest: 20, rounds: 8 }, ivState: null, tick: null, ui: null };
  function fmt(sec, tenths) { sec = Math.max(0, sec); const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ':' + String(s).padStart(2, '0') + (tenths ? ',' + Math.floor((sec * 10) % 10) : ''); }
  T.loop = function () {
    clearInterval(T.tick);
    T.tick = setInterval(() => {
      const now = Date.now();
      if (T.mode === 'rest' && T.running) {
        T.remain = (T.end - now) / 1000;
        if (T.remain <= 3.05 && T.remain > 0 && Math.ceil(T.remain) !== T._lastBeep) { T._lastBeep = Math.ceil(T.remain); SE.beep(660, 0.08); }
        if (T.remain <= 0) { T.running = false; T.remain = 0; SE.beep(990, 0.25, 3); SE.toast('⏱ Repos terminé — c\'est reparti !', 'ok'); }
      }
      if (T.mode === 'iv' && T.running && T.ivState) {
        const s = T.ivState;
        s.remain = (s.end - now) / 1000;
        if (s.remain <= 3.05 && s.remain > 0 && Math.ceil(s.remain) !== T._lastBeep) { T._lastBeep = Math.ceil(s.remain); SE.beep(660, 0.08); }
        if (s.remain <= 0) {
          if (s.phase === 'work') { if (s.round >= T.iv.rounds) { T.running = false; SE.beep(990, 0.3, 3); SE.toast('🏁 Circuit terminé !', 'ok'); } else if (T.iv.rest > 0) { s.phase = 'rest'; s.end = now + T.iv.rest * 1000; SE.beep(520, 0.2, 2); } else { s.round++; s.end = now + T.iv.work * 1000; SE.beep(880, 0.2, 2); } }
          else { s.phase = 'work'; s.round++; s.end = now + T.iv.work * 1000; SE.beep(880, 0.2, 2); }
        }
      }
      const fab = document.querySelector('.fab');
      if (fab) fab.classList.toggle('running', T.running);
      T.ui && T.ui();
      if (!T.running && T.mode !== 'sw') { clearInterval(T.tick); T.tick = null; }
    }, 100);
  };
  SE.timerDialog = function () {
    const body = SE.h(`<div>
      <div class="seg" id="tm" style="justify-content:center;margin-bottom:6px"><button data-m="rest">Repos</button><button data-m="sw">Chrono</button><button data-m="iv">Intervalles / Tabata</button></div>
      <div class="timer-phase" id="tph"></div>
      <div class="timer-display" id="td">0:00</div>
      <div class="timer-ring"><i id="tr"></i></div>
      <div id="tpanel"></div>
      <div class="timer-ctrl"><button class="btn" id="treset">${SE.icon('rotate-ccw', 18)}Reset</button><button class="btn primary" id="tgo">${SE.icon('play', 18)}Démarrer</button></div>
      <div class="laps" id="tlaps"></div></div>`);
    const $b = (s) => body.querySelector(s);
    const panel = () => {
      const p = $b('#tpanel');
      if (T.mode === 'rest') {
        p.innerHTML = '<div class="seg" style="justify-content:center">' + [30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => '<button data-s="' + s + '" class="' + (s === T.total ? 'on' : '') + '">' + fmt(s) + '</button>').join('') + '</div>';
        p.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { T.total = +b.dataset.s; T.remain = T.total; T.running = false; panel(); upd(); }));
      } else if (T.mode === 'iv') {
        p.innerHTML = '<div class="row4" style="grid-template-columns:repeat(3,1fr)"><div class="field"><label>Travail (s)</label><input id="iw" type="number" value="' + T.iv.work + '"></div><div class="field"><label>Repos (s)</label><input id="ir" type="number" value="' + T.iv.rest + '"></div><div class="field"><label>Tours</label><input id="in" type="number" value="' + T.iv.rounds + '"></div></div><div class="seg" style="justify-content:center"><button data-p="20,10,8">Tabata 20/10×8</button><button data-p="40,20,8">40/20×8</button><button data-p="30,30,10">30/30×10</button><button data-p="60,0,10">EMOM 10</button></div>';
        p.querySelectorAll('input').forEach((i) => (i.onchange = () => { T.iv = { work: +$b('#iw').value || 20, rest: +$b('#ir').value || 0, rounds: +$b('#in').value || 1 }; }));
        p.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { const [w, r, n] = b.dataset.p.split(',').map(Number); T.iv = { work: w, rest: r, rounds: n }; T.running = false; T.ivState = null; panel(); upd(); }));
      } else p.innerHTML = '';
    };
    const upd = () => {
      body.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === T.mode));
      const d = $b('#td'), ph = $b('#tph'), ring = $b('#tr');
      d.className = 'timer-display';
      if (T.mode === 'rest') { d.textContent = fmt(Math.ceil(T.remain)); ph.textContent = T.running ? 'Récupération' : 'Temps de repos'; ring.style.width = (T.total ? (1 - T.remain / T.total) * 100 : 0) + '%'; d.classList.add('rest'); }
      else if (T.mode === 'sw') { const el = (T.swAcc + (T.running ? Date.now() - T.swStart : 0)) / 1000; d.textContent = fmt(el, true); ph.textContent = 'Chronomètre'; ring.style.width = ((el % 60) / 60) * 100 + '%'; }
      else { const s = T.ivState; if (s) { d.textContent = fmt(Math.ceil(s.remain)); d.classList.add(s.phase); ph.textContent = (s.phase === 'work' ? '🔥 Travail' : '😮‍💨 Repos') + ' — tour ' + s.round + ' / ' + T.iv.rounds; ring.style.width = (1 - s.remain / (s.phase === 'work' ? T.iv.work : T.iv.rest || 1)) * 100 + '%'; } else { d.textContent = fmt(T.iv.work); ph.textContent = T.iv.rounds + ' tours · ' + T.iv.work + 's / ' + T.iv.rest + 's'; ring.style.width = '0%'; } }
      $b('#tgo').innerHTML = (T.running ? SE.icon('pause', 18) + 'Pause' : SE.icon('play', 18) + (T.mode === 'sw' && T.swAcc ? 'Reprendre' : 'Démarrer'));
      $b('#tlaps').innerHTML = T.mode === 'sw' ? T.laps.map((l, i) => '<div><span>Tour ' + (i + 1) + '</span><b>' + fmt(l, true) + '</b></div>').reverse().join('') : '';
      if (T.mode === 'sw') $b('#treset').innerHTML = T.running ? SE.icon('flag', 18) + 'Tour' : SE.icon('rotate-ccw', 18) + 'Reset';
    };
    body.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { if (T.running) { SE.toast('Mettez en pause avant de changer de mode'); return; } T.mode = b.dataset.m; panel(); upd(); }));
    $b('#tgo').onclick = () => {
      SE.beep(0.0001, 0.01); // déverrouille l'audio sur mobile
      const now = Date.now();
      if (T.mode === 'rest') { if (T.running) { T.running = false; } else { if (T.remain <= 0) T.remain = T.total; T.end = now + T.remain * 1000; T.running = true; T._lastBeep = null; } }
      else if (T.mode === 'sw') { if (T.running) { T.swAcc += now - T.swStart; T.running = false; } else { T.swStart = now; T.running = true; } }
      else {
        if (T.running) { T.running = false; T.ivState.remain = (T.ivState.end - now) / 1000; }
        else { if (!T.ivState) T.ivState = { phase: 'work', round: 1, remain: T.iv.work }; T.ivState.end = now + T.ivState.remain * 1000; T.running = true; SE.beep(880, 0.2, 2); }
      }
      T.loop(); upd();
    };
    $b('#treset').onclick = () => {
      if (T.mode === 'sw' && T.running) { const el = T.swAcc + Date.now() - T.swStart; const prev = T.laps.reduce((s, x) => s + x, 0); T.laps.push(el / 1000 - prev); upd(); return; }
      T.running = false; T.remain = T.total; T.swAcc = 0; T.laps = []; T.ivState = null; upd();
    };
    panel(); upd();
    T.ui = upd;
    SE.modal({ title: 'Chrono & minuteur', icon: 'timer', body, onClose: () => { T.ui = null; } });
  };

  // ---------- Paramètres ----------
  SE.settingsDialog = function () {
    const s = SE.settings;
    const used = (() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (localStorage.getItem(k) || '').length; } return n; })();
    const body = SE.h(`<div>
      <div class="field"><label>Séparateur décimal</label><div class="seg" id="sDec"><button data-v=",">Virgule (2,5) — FR</button><button data-v=".">Point (2.5) — EN</button></div></div>
      <div class="field"><label>Sons du chrono</label><div class="seg" id="sBeep"><button data-v="1">Activés</button><button data-v="0">Coupés</button></div></div>
      <div class="field"><label>Vibrations</label><div class="seg" id="sHap"><button data-v="1">Activées</button><button data-v="0">Coupées</button></div></div>
      <p class="hint">Stockage utilisé : ${(used / 1024).toFixed(0)} Ko. Les classeurs sont enregistrés sur l'appareil, automatiquement.</p>
      <div style="margin-top:18px;padding:16px;border-radius:14px;background:#000;border:1px solid var(--line);text-align:center">
        <div class="brand" style="font-size:26px"><span class="w">Super</span><span class="y">Essence</span><span class="y">.</span></div>
        <div class="hint" style="margin-top:6px">SuperEssence Sheets · version 1.0.0<br>Le tableur des coachs sportifs — conçu par <b style="color:var(--y)">SuperEssence Studio</b>.</div>
        <div class="hint" style="margin-top:8px;font-size:11px">Composants : ExcelJS (MIT), jsPDF (MIT), Lucide (ISC).</div>
      </div></div>`);
    const seg = (id, get, set) => body.querySelectorAll(id + ' button').forEach((b) => { b.classList.toggle('on', get() === b.dataset.v); b.onclick = () => { set(b.dataset.v); SE.saveSettings(); body.querySelectorAll(id + ' button').forEach((x) => x.classList.toggle('on', x === b)); if (SE.app && SE.app.calc) { SE.app.calc.invalidate(); SE.app.grid.draw(); } }; });
    seg('#sDec', () => s.dec, (v) => (s.dec = v));
    seg('#sBeep', () => (s.beep ? '1' : '0'), (v) => (s.beep = v === '1'));
    seg('#sHap', () => (s.haptics ? '1' : '0'), (v) => (s.haptics = v === '1'));
    SE.modal({ title: 'Réglages', icon: 'settings', body });
  };

  // ---------- Accueil ----------
  SE.renderHome = function () {
    SE.renderTemplates($('#tplGrid'));
    const list = SE.store.list();
    $('#fileCount').textContent = list.length ? '(' + list.length + ')' : '';
    const box = $('#fileList');
    box.innerHTML = '';
    if (!list.length) { box.appendChild(SE.h('<div class="empty">Aucun classeur pour l\'instant. Choisissez un modèle ou lancez le générateur de programme ✨</div>')); return; }
    list.forEach((f) => {
      const d = new Date(f.modified);
      const el = SE.h('<div class="file"><div class="fi">' + SE.icon(f.icon || 'file-spreadsheet', 18) + '</div><div class="fm"><b>' + SE.esc(f.name) + '</b><small>' + f.sheets + ' feuille' + (f.sheets > 1 ? 's' : '') + ' · ' + d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '</small></div><button class="icon-btn small">' + SE.icon('more-vertical', 18) + '</button></div>');
      el.querySelector('.fm').onclick = () => { const wb = SE.store.load(f.id); if (wb) SE.app.open(wb); else SE.toast('Fichier introuvable', 'err'); };
      el.querySelector('button').onclick = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        SE.menu(r.right - 220, r.bottom, [
          { icon: 'folder-open', label: 'Ouvrir', run: () => { const wb = SE.store.load(f.id); if (wb) SE.app.open(wb); } },
          { icon: 'type', label: 'Renommer', run: async () => { const n = await SE.prompt('Renommer', 'Nom du classeur', f.name); if (n && n.trim()) { const wb = SE.store.load(f.id); wb.name = n.trim(); SE.store.save(wb); SE.renderHome(); } } },
          { icon: 'copy', label: 'Dupliquer', run: () => { const wb = SE.store.load(f.id); wb.id = SE.uid(); wb.name += ' (copie)'; SE.store.save(wb); SE.renderHome(); } },
          '-',
          { icon: 'trash-2', label: 'Supprimer', run: async () => { if (await SE.confirm('Supprimer', 'Supprimer définitivement « ' + f.name + ' » ?', 'Supprimer', true)) { SE.store.remove(f.id); SE.renderHome(); } } }
        ]);
      };
      box.appendChild(el);
    });
  };

  SE.importFile = async function (file) {
    const name = file.name || 'import';
    try {
      let wb;
      if (/\.xlsx$/i.test(name)) { SE.toast('Import Excel…'); wb = await SE.importXLSX(await file.arrayBuffer(), name); }
      else if (/\.(sess|json)$/i.test(name)) wb = SE.importSess(await file.text());
      else wb = SE.importCSV(await file.text(), name);
      SE.store.save(wb);
      SE.app.open(wb);
      SE.toast('« ' + wb.name + ' » importé', 'ok');
    } catch (e) { console.error(e); SE.toast('Import impossible : ' + (e.message || e), 'err'); }
  };
})();
