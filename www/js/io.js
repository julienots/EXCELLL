/* SuperEssence Sheets — import / export (xlsx, csv, pdf, png, .sess) */
(function () {
  'use strict';
  const SE = window.SE;

  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  SE.isNative = isNative;
  const safeName = (s) => String(s || 'classeur').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'classeur';
  SE.safeName = safeName;

  function blobToBase64(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  // Sauvegarde / partage d'un fichier (natif : partage Android ; web : téléchargement)
  SE.saveFile = async function (filename, blob) {
    if (isNative()) {
      const P = window.Capacitor.Plugins;
      try {
        const data = await blobToBase64(blob);
        const res = await P.Filesystem.writeFile({ path: filename, data, directory: 'CACHE' });
        await P.Share.share({ title: filename, text: 'Fichier créé avec SuperEssence Sheets', url: res.uri, dialogTitle: 'Partager / enregistrer ' + filename });
        return true;
      } catch (e) {
        if (e && /cancel/i.test(String(e.message || e))) return false;
        SE.toast('Partage impossible : ' + (e.message || e), 'err');
        return false;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  };

  // ---------- Conversion de formules vers Excel (anglais) ----------
  const SPORT = new Set(SE.functionList().filter((f) => f.cat === 'Sport').map((f) => f.name));
  SE.toExcelFormula = function (f) {
    // renvoie null si la formule utilise des fonctions propres à l'application
    let custom = false;
    const parts = f.slice(1).split('"');
    const out = parts.map((p, i) => {
      if (i % 2) return p;
      if (SE.settings.dec === ',') p = p.replace(/(\d),(\d)/g, '$1.$2');
      p = p.replace(/;/g, ',');
      p = p.replace(/([A-Za-z_][\w.]*)\s*\(/g, (m, name) => {
        const up = name.toUpperCase();
        const canon = SE.FALIAS[up] || up;
        if (SPORT.has(canon)) custom = true;
        return canon + '(';
      });
      return p;
    }).join('"');
    return custom ? null : out;
  };

  const NF_XL = { n0: '#,##0', n1: '#,##0.0', n2: '#,##0.00', th: '#,##0', pct: '0%', pct1: '0.0%', eur: '#,##0.00 "€"', usd: '"$"#,##0.00', date: 'dd/mm/yyyy', dated: 'ddd dd/mm', datel: 'd mmm yyyy', time: 'hh:mm', kg: '0.## "kg"', lb: '0.## "lb"', reps: '0 "reps"', sets: '0 "×"', km: '0.## "km"', m: '0 "m"', kmh: '0.0 "km/h"', min: '0 "min"', sec: '0 "s"', bpm: '0 "bpm"', kcal: '0 "kcal"', rpe: '"@"0.#', cm: '0.# "cm"', text: '@' };
  const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase().padStart(6, '0').slice(0, 6);
  const hexOf = (c) => (c && c.argb ? '#' + c.argb.slice(-6) : null);

  SE.exportXLSX = async function (app) {
    if (!window.ExcelJS) { SE.toast('Module Excel non chargé', 'err'); return; }
    const wb = app.wb, calc = app.calc;
    const X = new ExcelJS.Workbook();
    X.creator = 'SuperEssence Sheets'; X.company = 'SuperEssence Studio'; X.created = new Date();
    wb.sheets.forEach((sh, si) => {
      const ws = X.addWorksheet(sh.name.slice(0, 31), {
        properties: { tabColor: sh.tab ? { argb: argb(sh.tab) } : undefined, defaultRowHeight: 19.5 },
        views: [{ state: sh.freezeR || sh.freezeC ? 'frozen' : 'normal', xSplit: sh.freezeC || 0, ySplit: sh.freezeR || 0, showGridLines: sh.grid !== false }]
      });
      const used = SE.usedRange(sh);
      for (let c = 0; c <= Math.max(used.c2, 0); c++) ws.getColumn(c + 1).width = Math.max(2, SE.colW(sh, c) / 7);
      for (const r in sh.rowH) ws.getRow(+r + 1).height = sh.rowH[r] * 0.75;
      for (const k in sh.cells) {
        const [r, c] = k.split(',').map(Number);
        const cell = sh.cells[k];
        const xc = ws.getCell(r + 1, c + 1);
        if (cell.v !== undefined) {
          const v = calc.value(si, r, c);
          const res = SE.isErr(v) ? { error: v.err } : v;
          if (cell.v[0] === '=' && cell.v.length > 1) {
            const f = SE.toExcelFormula(cell.v);
            if (f) xc.value = { formula: f, result: res === null ? undefined : res };
            else xc.value = SE.isErr(v) ? v.err : v;
          } else xc.value = v;
        }
        const s = cell.s;
        if (!s) continue;
        const font = {};
        if (s.b) font.bold = true;
        if (s.i) font.italic = true;
        if (s.u) font.underline = true;
        if (s.st) font.strike = true;
        if (s.fs) font.size = s.fs * 0.85;
        if (s.fc) font.color = { argb: argb(s.fc) };
        if (Object.keys(font).length) xc.font = Object.assign({ name: 'Calibri', size: 11 }, font);
        if (s.bg) xc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(s.bg) } };
        const al = {};
        if (s.ha) al.horizontal = s.ha;
        al.vertical = s.va === 'top' ? 'top' : s.va === 'bottom' ? 'bottom' : 'middle';
        if (s.wrap) al.wrapText = true;
        if (s.ind) al.indent = s.ind;
        xc.alignment = al;
        if (s.nf && NF_XL[s.nf]) xc.numFmt = NF_XL[s.nf];
        if (s.bt || s.bb || s.bl || s.br) {
          const bs = (w) => (w ? { style: w >= 3 ? 'thick' : w === 2 ? 'medium' : 'thin', color: { argb: argb(s.bdc || '#222222') } } : undefined);
          xc.border = { top: bs(s.bt), bottom: bs(s.bb), left: bs(s.bl), right: bs(s.br) };
        }
        if (s.note) xc.note = s.note;
      }
      sh.merges.forEach((m) => { try { ws.mergeCells(m.r1 + 1, m.c1 + 1, m.r2 + 1, m.c2 + 1); } catch (e) { /* chevauchement */ } });
      (sh.dv || []).forEach((d) => {
        const list = '"' + d.list.map((x) => String(x).replace(/[",]/g, ' ')).join(',') + '"';
        if (list.length > 255) return;
        for (let r = d.r1; r <= Math.min(d.r2, d.r1 + 500); r++) for (let c = d.c1; c <= d.c2; c++) ws.getCell(r + 1, c + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [list] };
      });
      (sh.cf || []).forEach((rule) => {
        const ref = SE.addr(rule.r1, rule.c1) + ':' + SE.addr(rule.r2, rule.c2);
        const style = {};
        if (rule.style) {
          if (rule.style.bg) style.fill = { type: 'pattern', pattern: 'solid', bgColor: { argb: argb(rule.style.bg) } };
          if (rule.style.fc || rule.style.b) style.font = { color: rule.style.fc ? { argb: argb(rule.style.fc) } : undefined, bold: !!rule.style.b };
        }
        const ops = { gt: 'greaterThan', lt: 'lessThan', gte: 'greaterThanOrEqual', lte: 'lessThanOrEqual', eq: 'equal', between: 'between' };
        let r = null;
        const lit = (x) => (typeof SE.literal(String(x)) === 'number' ? String(SE.literal(String(x))) : '"' + x + '"');
        if (ops[rule.type]) r = { type: 'cellIs', operator: ops[rule.type], formulae: rule.type === 'between' ? [lit(rule.a), lit(rule.b)] : [lit(rule.a)], style };
        else if (rule.type === 'contains') r = { type: 'containsText', operator: 'containsText', text: String(rule.a), style };
        else if (rule.type === 'scale') r = { type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: (rule.colors || ['#e74c3c', '#f1c40f', '#2ecc71']).map((c) => ({ argb: argb(c) })) };
        else if (rule.type === 'bar') r = { type: 'dataBar', minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: argb(rule.color || '#FFC72C') }, gradient: false };
        else if (rule.type === 'notempty') r = { type: 'expression', formulae: ['LEN(TRIM(' + SE.addr(rule.r1, rule.c1) + '))>0'], style };
        else if (rule.type === 'empty') r = { type: 'expression', formulae: ['LEN(TRIM(' + SE.addr(rule.r1, rule.c1) + '))=0'], style };
        if (r) { r.priority = 1; try { ws.addConditionalFormatting({ ref, rules: [r] }); } catch (e) { /* ignoré */ } }
      });
    });
    const buf = await X.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return SE.saveFile(safeName(wb.name) + '.xlsx', blob);
  };

  function mapNumFmt(f) {
    if (!f) return '';
    const l = f.toLowerCase();
    if (l.includes('%')) return l.includes('.0') ? 'pct1' : 'pct';
    if (l.includes('€')) return 'eur';
    if (l.includes('$')) return 'usd';
    if (/[dy]/.test(l) && l.includes('m')) return 'date';
    if (/h+:mm/.test(l)) return 'time';
    if (l.includes('kg')) return 'kg';
    if (/0\.00/.test(l)) return 'n2';
    if (/0\.0/.test(l)) return 'n1';
    if (/#,##0/.test(l)) return 'th';
    return '';
  }

  SE.importXLSX = async function (arrayBuffer, name) {
    const X = new ExcelJS.Workbook();
    await X.xlsx.load(arrayBuffer);
    const wb = SE.newWorkbook(name.replace(/\.xlsx$/i, ''));
    wb.sheets = [];
    X.eachSheet((ws) => {
      const sh = SE.newSheet(ws.name, Math.max(100, ws.rowCount + 30), Math.max(26, ws.columnCount + 4));
      ws.columns && ws.columns.forEach((col, i) => { if (col && col.width) sh.colW[i] = Math.round(col.width * 7); });
      ws.eachRow({ includeEmpty: false }, (row, rn) => {
        if (row.height) sh.rowH[rn - 1] = Math.round(row.height / 0.75);
        row.eachCell({ includeEmpty: false }, (xc, cn) => {
          const r = rn - 1, c = cn - 1;
          if (xc.isMerged && xc.master && xc.master !== xc) return;
          let v = xc.value, raw = '';
          if (v === null || v === undefined) raw = '';
          else if (v instanceof Date) raw = String(SE.dateToSerial(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate()));
          else if (typeof v === 'object') {
            if (v.formula || v.sharedFormula) raw = '=' + (v.formula || (xc.formula || ''));
            else if (v.richText) raw = v.richText.map((t) => t.text).join('');
            else if (v.text !== undefined) raw = String(v.text.richText ? v.text.richText.map((t) => t.text).join('') : v.text);
            else if (v.error) raw = v.error;
            else raw = String(v.result ?? '');
            if (raw === '=') raw = String(v.result ?? '');
          } else if (typeof v === 'boolean') raw = v ? 'VRAI' : 'FAUX';
          else raw = typeof v === 'number' ? String(v) : String(v);
          if (raw !== '') SE.setRaw(sh, r, c, raw);
          const s = {};
          const f = xc.font || {};
          if (f.bold) s.b = true;
          if (f.italic) s.i = true;
          if (f.underline) s.u = true;
          if (f.strike) s.st = true;
          if (f.size && f.size !== 11) s.fs = Math.round(f.size / 0.85);
          const fc = hexOf(f.color); if (fc && fc !== '#000000') s.fc = fc;
          const fill = xc.fill;
          if (fill && fill.type === 'pattern' && fill.pattern === 'solid') { const bg = hexOf(fill.fgColor); if (bg) s.bg = bg; }
          const al = xc.alignment || {};
          if (al.horizontal && ['left', 'center', 'right'].includes(al.horizontal)) s.ha = al.horizontal;
          if (al.vertical === 'top' || al.vertical === 'bottom') s.va = al.vertical;
          if (al.wrapText) s.wrap = true;
          if (al.indent) s.ind = al.indent;
          const nf = mapNumFmt(xc.numFmt); if (nf) s.nf = nf;
          const b = xc.border || {};
          const bw = (x) => (x && x.style ? (x.style === 'thick' ? 3 : x.style === 'medium' ? 2 : 1) : 0);
          if (bw(b.top)) s.bt = bw(b.top);
          if (bw(b.bottom)) s.bb = bw(b.bottom);
          if (bw(b.left)) s.bl = bw(b.left);
          if (bw(b.right)) s.br = bw(b.right);
          const bc = (b.top || b.bottom || b.left || b.right || {}).color; if (bc && (s.bt || s.bb || s.bl || s.br)) s.bdc = hexOf(bc) || '#222';
          if (xc.note) s.note = typeof xc.note === 'string' ? xc.note : (xc.note.texts || []).map((t) => t.text).join('');
          if (Object.keys(s).length) SE.setStyle(sh, r, c, s);
        });
      });
      const merges = (ws.model && ws.model.merges) || [];
      merges.forEach((m) => {
        const [a, b] = m.split(':');
        const p1 = SE.parseAddr(a), p2 = SE.parseAddr(b);
        if (p1 && p2) sh.merges.push({ r1: p1.r, c1: p1.c, r2: p2.r, c2: p2.c });
      });
      const view = ws.views && ws.views[0];
      if (view && view.state === 'frozen') { sh.freezeR = view.ySplit || 0; sh.freezeC = view.xSplit || 0; }
      if (view && view.showGridLines === false) sh.grid = false;
      if (ws.properties && ws.properties.tabColor) sh.tab = hexOf(ws.properties.tabColor) || '';
      wb.sheets.push(sh);
    });
    if (!wb.sheets.length) wb.sheets.push(SE.newSheet('Feuille1'));
    return wb;
  };

  // ---------- CSV ----------
  SE.parseCSV = function (text) {
    text = text.replace(/^﻿/, '');
    const first = text.split('\n')[0];
    const cand = [';', ',', '\t'];
    const delim = cand.sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows;
  };
  SE.importCSV = function (text, name) {
    const wb = SE.newWorkbook(name.replace(/\.(csv|txt)$/i, ''));
    const sh = wb.sheets[0];
    sh.name = 'Données';
    const rows = SE.parseCSV(text);
    rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '') SE.setRaw(sh, r, c, v); }));
    if (rows.length) for (let c = 0; c < rows[0].length; c++) SE.setStyle(sh, 0, c, { b: true, bg: '#F4F4F5' });
    sh.rows = Math.max(200, rows.length + 50);
    return wb;
  };
  SE.exportCSV = function (app) {
    const sh = app.sheet, used = SE.usedRange(sh);
    const lines = [];
    for (let r = 0; r <= used.r2; r++) {
      const cells = [];
      for (let c = 0; c <= used.c2; c++) {
        const cell = sh.cells[r + ',' + c];
        const v = cell && cell.v !== undefined ? app.calc.value(app.si, r, c) : null;
        let t = SE.formatValue(v, cell && cell.s && cell.s.nf);
        if (/[";\n]/.test(t)) t = '"' + t.replace(/"/g, '""') + '"';
        cells.push(t);
      }
      lines.push(cells.join(';'));
    }
    return SE.saveFile(safeName(app.wb.name + ' - ' + sh.name) + '.csv', new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  };

  // ---------- Format natif ----------
  SE.exportSess = function (app) {
    const data = JSON.stringify({ app: 'SuperEssence Sheets', format: 1, workbook: app.wb }, (k, v) => (k[0] === '_' ? undefined : v));
    return SE.saveFile(safeName(app.wb.name) + '.sess', new Blob([data], { type: 'application/json' }));
  };
  SE.importSess = function (text) {
    const o = JSON.parse(text);
    const wb = o.workbook || o;
    if (!wb.sheets) throw new Error('Fichier invalide');
    wb.id = SE.uid();
    return wb;
  };

  // ---------- Image / PDF ----------
  function exportRange(app) {
    const s = app.sel;
    if (s && (s.r1 !== s.r2 || s.c1 !== s.c2)) return { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 };
    const u = SE.usedRange(app.sheet);
    return { r1: 0, c1: 0, r2: Math.max(0, u.r2), c2: Math.max(0, u.c2) };
  }
  function brandCanvas(cv, scale) {
    const pad = 18 * scale, foot = 26 * scale;
    const out = document.createElement('canvas');
    out.width = cv.width + pad * 2; out.height = cv.height + pad * 2 + foot;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(cv, pad, pad);
    ctx.font = '600 ' + 11 * scale + 'px system-ui, Roboto, Arial';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    const y = out.height - foot / 2 - pad / 3;
    ctx.fillStyle = '#9a9aa6';
    const t2 = 'Essence.';
    const w2 = ctx.measureText(t2).width;
    ctx.fillText('SuperEssence Sheets · ', out.width - pad - w2 - ctx.measureText('Super').width, y);
    ctx.fillStyle = '#111'; ctx.fillText('Super', out.width - pad - w2, y);
    ctx.fillStyle = '#E0A400'; ctx.fillText(t2, out.width - pad, y);
    return out;
  }
  SE.exportPNG = async function (app) {
    const rg = exportRange(app);
    const cv = brandCanvas(app.grid.renderRangeImage(rg, 2), 2);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    return SE.saveFile(safeName(app.wb.name + ' - ' + app.sheet.name) + '.png', blob);
  };
  SE.exportPDF = async function (app, allSheets) {
    if (!window.jspdf) { SE.toast('Module PDF non chargé', 'err'); return; }
    const { jsPDF } = window.jspdf;
    let pdf = null;
    const prevSi = app.si, prevSel = app.sel;
    const list = allSheets ? app.wb.sheets.map((_, i) => i) : [app.si];
    for (const si of list) {
      if (si !== app.si) app.switchSheet(si, true);
      const rg = allSheets ? (() => { const u = SE.usedRange(app.sheet); return { r1: 0, c1: 0, r2: Math.max(0, u.r2), c2: Math.max(0, u.c2) }; })() : exportRange(app);
      if (rg.r2 < 0) continue;
      const scale = 2;
      const cv = app.grid.renderRangeImage(rg, scale);
      // positions des lignes à l'échelle 1 (indépendantes du zoom de l'écran)
      const rowPos = [0];
      for (let r = 0; r <= rg.r2 + 1; r++) rowPos.push(rowPos[r] + SE.rowH(app.sheet, r));
      const landscape = cv.width > cv.height * 1.1 || cv.width / scale > 700;
      const orient = landscape ? 'l' : 'p';
      if (!pdf) pdf = new jsPDF({ orientation: orient, unit: 'pt', format: 'a4' });
      else pdf.addPage('a4', orient);
      const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight();
      const margin = 28, headH = 26;
      const availW = PW - margin * 2, availH = PH - margin * 2 - headH;
      const k = Math.min(1, availW / (cv.width / scale)) / scale; // pt par pixel canvas
      // découpe aux limites de lignes
      let startRow = rg.r1;
      let first = true;
      while (startRow <= rg.r2) {
        let endRow = startRow;
        const y0 = rowPos[startRow] - rowPos[rg.r1];
        while (endRow + 1 <= rg.r2 && (rowPos[endRow + 2] - rowPos[rg.r1] - y0) * scale * k <= availH) endRow++;
        const y1 = rowPos[endRow + 1] - rowPos[rg.r1];
        const slice = document.createElement('canvas');
        slice.width = cv.width; slice.height = Math.max(1, Math.round((y1 - y0) * scale));
        slice.getContext('2d').drawImage(cv, 0, -Math.round(y0 * scale));
        if (!first) pdf.addPage('a4', orient);
        first = false;
        // en-tête
        pdf.setFillColor(17, 17, 20); pdf.rect(0, 0, PW, 20, 'F');
        pdf.setFontSize(9); pdf.setTextColor(255, 199, 44);
        pdf.text('SuperEssence Sheets', margin, 13);
        pdf.setTextColor(220, 220, 225);
        pdf.text((app.wb.name + ' — ' + app.sheet.name).slice(0, 90), PW - margin, 13, { align: 'right' });
        pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin + headH - 4, slice.width * k, slice.height * k);
        pdf.setFontSize(8); pdf.setTextColor(150, 150, 160);
        pdf.text('Page ' + pdf.internal.getNumberOfPages() + ' · SuperEssence Studio', PW / 2, PH - 12, { align: 'center' });
        startRow = endRow + 1;
      }
    }
    if (allSheets) { app.switchSheet(prevSi, true); app.sel = prevSel; app.grid.draw(); }
    if (!pdf) { SE.toast('Rien à exporter', 'err'); return; }
    return SE.saveFile(safeName(app.wb.name) + '.pdf', pdf.output('blob'));
  };
})();
