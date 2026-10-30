/* SuperEssence Sheets — application : état, sélection, édition, interactions */
(function () {
  'use strict';
  const SE = window.SE;
  const $ = SE.$;

  const App = {
    wb: null, si: 0, sel: null, calc: null, grid: null,
    undoStack: [], redoStack: [], editing: null, clip: null, touchMode: false,
    showFormulas: false, painter: null, selectMode: false, refHighlights: null,

    get sheet() { return this.wb ? this.wb.sheets[this.si] : null; },

    // ---------- Démarrage ----------
    init() {
      SE.app = this;
      document.querySelectorAll('[data-act]').forEach((b) => {
        const icons = { settings: 'settings', wizard: 'wand-sparkles', newBlank: 'file-plus', import: 'upload', home: 'layout-grid', undo: 'undo-2', redo: 'redo-2', exportMenu: 'share-2', addSheet: 'plus', timer: 'timer', commit: 'check', cancelEdit: 'x' };
        const labels = { wizard: 'Générer un programme', newBlank: 'Classeur vide', import: 'Importer' };
        if (icons[b.dataset.act] && !b.innerHTML.trim()) b.innerHTML = SE.icon(icons[b.dataset.act], b.classList.contains('fab') ? 26 : 20) + (labels[b.dataset.act] ? '<span>' + labels[b.dataset.act] + '</span>' : '');
        b.addEventListener('click', (e) => { e.preventDefault(); SE.run(b.dataset.act, b); });
      });
      this.grid = new SE.Grid(this, $('#gridWrap'));
      this.bindGrid();
      this.bindEditor();
      this.bindKeys();
      $('#fileInput').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) SE.importFile(f); });
      $('#wbName').addEventListener('change', (e) => { this.wb.name = e.target.value.trim() || 'Sans titre'; this.save(); });
      $('#wbName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
      SE.renderHome();
      const last = SE.store.last();
      const wb = last && SE.store.load(last);
      if (wb && sessionStorage.getItem('se_open')) this.open(wb); else SE.showScreen('home');
      setTimeout(() => $('#splash').classList.add('out'), 900);
      setTimeout(() => $('#splash').remove(), 1500);
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        window.Capacitor.Plugins.App.addListener('backButton', () => {
          if (document.querySelector('.ctx')) { document.querySelectorAll('.ctx').forEach((x) => x.remove()); return; }
          if (SE.modalOpen()) { SE.closeAllModals(); return; }
          if (this.editing) { this.cancelEdit(); return; }
          if (!$('#editor').classList.contains('hidden')) { SE.run('home'); return; }
          window.Capacitor.Plugins.App.exitApp();
        });
      }
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
        try { window.Capacitor.Plugins.StatusBar.setBackgroundColor({ color: '#000000' }); window.Capacitor.Plugins.StatusBar.setStyle({ style: 'DARK' }); } catch (e) { /* ignoré */ }
      }
    },

    open(wb) {
      this.wb = wb;
      this.calc = new SE.Calc(wb);
      this.undoStack = []; this.redoStack = [];
      this.clip = null; this.painter = null;
      if (!this._zoomSet) { this._zoomSet = true; this.grid.zoom = window.innerWidth < 600 ? 0.85 : 1; }
      this.si = Math.min(wb.active || 0, wb.sheets.length - 1);
      this.sel = null;
      SE.showScreen('editor');
      $('#wbName').value = wb.name;
      sessionStorage.setItem('se_open', '1');
      this.switchSheet(this.si);
      SE.buildRibbon();
      this.save(true);
    },

    switchSheet(i, silent) {
      if (this.editing) this.commitEdit(null);
      this.si = i;
      this.wb.active = i;
      const sh = this.sheet;
      this.grid.scroller.scrollLeft = 0; this.grid.scroller.scrollTop = 0;
      this.sel = sh._sel || { r: sh.freezeR || 0, c: 0, ar: sh.freezeR || 0, ac: 0, r1: sh.freezeR || 0, c1: 0, r2: sh.freezeR || 0, c2: 0 };
      this.grid.layout();
      if (!silent) { this.renderTabs(); this.updateBars(); }
    },

    // ---------- Sauvegarde / annulation ----------
    snapshot() {
      this.undoStack.push(JSON.stringify({ wb: this.wb, si: this.si }, (k, v) => (k[0] === '_' ? undefined : v)));
      if (this.undoStack.length > 40) this.undoStack.shift();
      this.redoStack = [];
    },
    restore(json) {
      const o = JSON.parse(json);
      const name = this.wb.name;
      this.wb = o.wb; this.wb.name = this.wb.name || name;
      this.calc = new SE.Calc(this.wb);
      this.si = Math.min(o.si, this.wb.sheets.length - 1);
      const sel = this.sel;
      this.grid.layout();
      this.sel = sel;
      this.clampSel();
      this.renderTabs(); this.updateBars(); this.renderCharts();
      $('#wbName').value = this.wb.name;
      this.save();
    },
    undo() {
      if (this.editing) { this.cancelEdit(); return; }
      if (!this.undoStack.length) { SE.toast('Rien à annuler'); return; }
      this.redoStack.push(JSON.stringify({ wb: this.wb, si: this.si }, (k, v) => (k[0] === '_' ? undefined : v)));
      this.restore(this.undoStack.pop());
    },
    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(JSON.stringify({ wb: this.wb, si: this.si }, (k, v) => (k[0] === '_' ? undefined : v)));
      this.restore(this.redoStack.pop());
    },
    // Toute modification passe par ici
    change(fn, opts) {
      this.snapshot();
      fn(this.sheet);
      this.calc.invalidate();
      if (opts && opts.layout) this.grid.layout(); else this.grid.draw();
      this.refreshCharts();
      this.updateBars();
      this.save();
    },
    save(now) {
      clearTimeout(this._saveT);
      $('#saveState').textContent = '…';
      const doit = () => { if (SE.store.save(this.wb)) $('#saveState').textContent = 'Enregistré ✓'; };
      if (now) doit(); else this._saveT = setTimeout(doit, 600);
    },

    // ---------- Sélection ----------
    clampSel() {
      const sh = this.sheet, s = this.sel;
      if (!s) return;
      for (const k of ['r', 'ar', 'r1', 'r2']) s[k] = Math.max(0, Math.min(s[k], sh.rows - 1));
      for (const k of ['c', 'ac', 'c1', 'c2']) s[k] = Math.max(0, Math.min(s[k], sh.cols - 1));
    },
    setSel(r, c, ar, ac) {
      const sh = this.sheet;
      r = Math.max(0, Math.min(r, sh.rows - 1)); c = Math.max(0, Math.min(c, sh.cols - 1));
      if (ar === undefined) { ar = r; ac = c; }
      let r1 = Math.min(r, ar), r2 = Math.max(r, ar), c1 = Math.min(c, ac), c2 = Math.max(c, ac);
      // étendre aux fusions
      let changed = true;
      while (changed) {
        changed = false;
        for (const m of sh.merges) {
          if (m.r2 < r1 || m.r1 > r2 || m.c2 < c1 || m.c1 > c2) continue;
          if (m.r1 < r1) { r1 = m.r1; changed = true; }
          if (m.r2 > r2) { r2 = m.r2; changed = true; }
          if (m.c1 < c1) { c1 = m.c1; changed = true; }
          if (m.c2 > c2) { c2 = m.c2; changed = true; }
        }
      }
      const m = SE.mergeAt(sh, r, c);
      if (m && ar === r && ac === c) { r = m.r1; c = m.c1; ar = r; ac = c; }
      this.sel = { r, c, ar, ac, r1, c1, r2, c2 };
      sh._sel = this.sel;
      this.grid.draw();
      this.updateBars();
    },
    selectCell(r, c, extend) {
      const s = this.sel;
      if (extend && s) this.setSel(r, c, s.ar, s.ac); else this.setSel(r, c);
    },
    move(dr, dc, extend, jump) {
      const s = this.sel, sh = this.sheet;
      let r = extend ? s.r : s.r, c = extend ? s.c : s.c;
      if (extend) { r = s.ar === s.r1 ? s.r2 : s.r1; c = s.ac === s.c1 ? s.c2 : s.c1; }
      const m = SE.mergeAt(sh, r, c);
      if (m && !extend) { if (dr > 0) r = m.r2; if (dc > 0) c = m.c2; }
      if (jump) {
        const has = (rr, cc) => { const x = sh.cells[rr + ',' + cc]; return x && x.v !== undefined && x.v !== ''; };
        const step = () => { r += dr; c += dc; };
        const inb = () => r >= 0 && c >= 0 && r < sh.rows && c < sh.cols;
        if (has(r, c) && inb() && has(r + dr, c + dc)) { while (inb() && has(r + dr, c + dc)) step(); }
        else { step(); while (inb() && !has(r, c) && r + dr >= 0 && c + dc >= 0 && r + dr < sh.rows && c + dc < sh.cols) step(); }
      } else { r += dr; c += dc; }
      // ignorer les lignes masquées
      while (dr && r > 0 && r < sh.rows - 1 && SE.rowH(sh, r) === 0) r += dr;
      r = Math.max(0, Math.min(r, sh.rows - 1)); c = Math.max(0, Math.min(c, sh.cols - 1));
      if (extend) this.setSel(r, c, s.ar, s.ac); else this.setSel(r, c);
      this.grid.scrollToCell(r, c);
    },

    // ---------- Barres ----------
    updateBars() {
      const s = this.sel, sh = this.sheet;
      if (!s) return;
      const multi = s.r1 !== s.r2 || s.c1 !== s.c2;
      $('#nameBox').value = multi ? SE.addr(s.r1, s.c1) + ':' + SE.addr(s.r2, s.c2) : SE.addr(s.r, s.c);
      if (!this.editing) {
        $('#formulaInput').value = SE.editText(sh.cells[s.r + ',' + s.c]);
      }
      // statut
      let html = '';
      if (multi) {
        let sum = 0, n = 0, cnt = 0, mn = Infinity, mx = -Infinity;
        const area = (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
        if (area < 200000) {
          for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) {
            if (!sh.cells[r + ',' + c]) continue;
            const v = this.calc.value(this.si, r, c);
            if (v !== null && v !== '') cnt++;
            if (typeof v === 'number') { sum += v; n++; mn = Math.min(mn, v); mx = Math.max(mx, v); }
          }
        }
        if (n) html = 'Somme <b>' + SE.formatValue(Math.round(sum * 1000) / 1000, '') + '</b> · Moy. <b>' + SE.formatValue(Math.round((sum / n) * 100) / 100, '') + '</b> · Max <b>' + SE.fmtGeneral(mx) + '</b> · Nb <b>' + cnt + '</b>';
        else html = 'Nb <b>' + cnt + '</b>';
      } else {
        const cell = sh.cells[s.r + ',' + s.c];
        if (cell && cell.s && cell.s.note) html = '📝 ' + SE.esc(cell.s.note.slice(0, 60));
        else if (this.painter) html = '<b>Pinceau</b> : sélectionnez la cible';
        else if (this.selectMode) html = '<b>Mode sélection</b> actif';
      }
      $('#status').innerHTML = html;
      SE.refreshRibbonState && SE.refreshRibbonState();
    },
    renderTabs() {
      const box = $('#sheetTabs');
      box.innerHTML = '';
      this.wb.sheets.forEach((sh, i) => {
        const b = SE.h('<button class="sheet-tab ' + (i === this.si ? 'on' : '') + '">' + SE.esc(sh.name) + (sh.tab ? '<i style="background:' + sh.tab + '"></i>' : '') + '</button>');
        let lp;
        b.onclick = () => { if (i !== this.si) { this.switchSheet(i); } else SE.sheetMenu(i, b); };
        b.oncontextmenu = (e) => { e.preventDefault(); SE.sheetMenu(i, b); };
        b.addEventListener('touchstart', () => { lp = setTimeout(() => SE.sheetMenu(i, b), 550); }, { passive: true });
        b.addEventListener('touchend', () => clearTimeout(lp));
        b.addEventListener('touchmove', () => clearTimeout(lp));
        box.appendChild(b);
        if (i === this.si) setTimeout(() => b.scrollIntoView({ inline: 'nearest', block: 'nearest' }), 0);
      });
    },

    // ---------- Graphiques ----------
    renderCharts() {
      const layer = this.grid.chartLayer;
      layer.innerHTML = '';
      const sh = this.sheet;
      if (!sh || !sh.charts) return;
      sh.charts.forEach((ch) => {
        const z = this.grid.zoom;
        const box = SE.h('<div class="chart-box"><canvas></canvas><div class="chart-tools"><button class="drag" title="Déplacer">' + SE.icon('move', 15) + '</button><button data-a="edit" title="Modifier">' + SE.icon('paintbrush', 15) + '</button><button data-a="del" title="Supprimer">' + SE.icon('trash-2', 15) + '</button></div><div class="resize"></div></div>');
        const place = () => {
          box.style.left = this.grid.HW + (this.grid.colPos[Math.min(ch.c, sh.cols)] || 0) + (ch.dx || 0) + 'px';
          box.style.top = this.grid.HH + (this.grid.rowPos[Math.min(ch.r, sh.rows)] || 0) + (ch.dy || 0) + 'px';
          box.style.width = ch.w * z + 'px'; box.style.height = ch.h * z + 'px';
        };
        place();
        box._spec = ch;
        layer.appendChild(box);
        this.drawChartBox(box);
        box.addEventListener('pointerdown', (e) => { e.stopPropagation(); document.querySelectorAll('.chart-box.on').forEach((x) => x.classList.remove('on')); box.classList.add('on'); });
        box.querySelector('[data-a=del]').onclick = (e) => { e.stopPropagation(); this.change((s) => { s.charts = s.charts.filter((x) => x.id !== ch.id); }); this.renderCharts(); };
        box.querySelector('[data-a=edit]').onclick = (e) => { e.stopPropagation(); SE.chartDialog(ch); };
        const drag = (handle, onMove, onEnd) => {
          handle.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            handle.setPointerCapture(e.pointerId);
            const sx = e.clientX, sy = e.clientY;
            const mv = (ev) => onMove(ev.clientX - sx, ev.clientY - sy);
            const up = (ev) => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); onEnd(ev.clientX - sx, ev.clientY - sy); };
            handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
          });
        };
        const startL = () => parseFloat(box.style.left), startT = () => parseFloat(box.style.top);
        let l0, t0;
        drag(box.querySelector('.drag'), (dx, dy) => { if (l0 === undefined) { l0 = startL(); t0 = startT(); } box.style.left = l0 + dx + 'px'; box.style.top = t0 + dy + 'px'; }, () => {
          const x = parseFloat(box.style.left) - this.grid.HW, y = parseFloat(box.style.top) - this.grid.HH;
          const c = this.grid.bsearch(this.grid.colPos, Math.max(0, x)), r = this.grid.bsearch(this.grid.rowPos, Math.max(0, y));
          l0 = undefined;
          this.change(() => { ch.c = c; ch.r = r; ch.dx = 0; ch.dy = 0; });
          this.renderCharts();
        });
        let w0, h0;
        drag(box.querySelector('.resize'), (dx, dy) => { if (w0 === undefined) { w0 = ch.w; h0 = ch.h; } box.style.width = Math.max(200, w0 * z + dx) + 'px'; box.style.height = Math.max(150, h0 * z + dy) + 'px'; this.drawChartBox(box); }, () => {
          const w = parseFloat(box.style.width) / z, h = parseFloat(box.style.height) / z; w0 = undefined;
          this.change(() => { ch.w = Math.round(w); ch.h = Math.round(h); });
          this.renderCharts();
        });
      });
    },
    drawChartBox(box) {
      const ch = box._spec;
      SE.drawChart(box.querySelector('canvas'), ch, SE.chartData(this, this.si, ch), parseFloat(box.style.width), parseFloat(box.style.height));
    },
    refreshCharts() {
      clearTimeout(this._chT);
      this._chT = setTimeout(() => this.grid.chartLayer.querySelectorAll('.chart-box').forEach((b) => this.drawChartBox(b)), 120);
    },

    // ---------- Édition ----------
    canEdit() { return !!this.sel; },
    startEdit(text, opts) {
      const s = this.sel;
      if (!s) return;
      const sh = this.sheet;
      const cell = sh.cells[s.r + ',' + s.c];
      if (cell && cell.s && cell.s.lock) { SE.toast('Cellule verrouillée'); return; }
      const raw = SE.editText(cell);
      this.editing = { r: s.r, c: s.c, original: raw, si: this.si };
      const ed = $('#cellEditor');
      const val = text !== undefined && text !== null ? text : raw;
      ed.value = val;
      $('#formulaInput').value = val;
      const st = (cell && cell.s) || {};
      ed.style.fontWeight = st.b ? '700' : '400';
      ed.style.fontStyle = st.i ? 'italic' : 'normal';
      ed.style.fontSize = ((st.fs || 13) * this.grid.zoom) + 'px';
      ed.style.textAlign = st.ha || 'left';
      ed.classList.remove('hidden');
      $('#fbOk').classList.remove('hidden');
      $('#fbCancel').classList.remove('hidden');
      this.grid.scrollToCell(s.r, s.c);
      this.positionEditor();
      const target = opts && opts.bar ? $('#formulaInput') : ed;
      target.focus();
      const L = target.value.length;
      try { target.setSelectionRange(L, L); } catch (e) { /* ignoré */ }
      this.onEditInput();
    },
    positionEditor() {
      if (!this.editing) return;
      const ed = $('#cellEditor');
      if (this.editing.si !== this.si) { ed.style.left = '-9999px'; return; }
      const rc = this.grid.cellRect(this.editing.r, this.editing.c);
      const minW = Math.max(rc.w + 1, 80);
      ed.style.left = rc.x - 1 + 'px';
      ed.style.top = rc.y - 1 + 'px';
      ed.style.height = Math.max(rc.h + 1, 28) + 'px';
      const lines = ed.value.split('\n');
      const font = (ed.style.fontWeight || '400') + ' ' + ed.style.fontSize + ' system-ui, Roboto, Arial';
      const tw = Math.max(...lines.map((l) => this.grid.measure(l, font))) + 24;
      ed.style.width = Math.min(Math.max(minW, tw), this.grid.W - rc.x - 4) + 'px';
      if (lines.length > 1) ed.style.height = Math.max(rc.h + 1, lines.length * 18 + 8) + 'px';
    },
    getEditText() { return $('#cellEditor').value; },
    setEditText(t, caret) {
      const ed = $('#cellEditor'), fb = $('#formulaInput');
      ed.value = t; fb.value = t;
      const active = document.activeElement === fb ? fb : ed;
      if (caret !== undefined) { try { active.setSelectionRange(caret, caret); } catch (e) { /* ignoré */ } }
      this.onEditInput();
    },
    activeInput() { return document.activeElement === $('#formulaInput') ? $('#formulaInput') : $('#cellEditor'); },
    onEditInput() {
      if (!this.editing) return;
      const t = this.getEditText();
      this.positionEditor();
      // références colorées
      if (t[0] === '=') {
        const refs = [];
        const re = /(\$?[A-Za-z]{1,3}\$?\d+)(?::(\$?[A-Za-z]{1,3}\$?\d+))?/g;
        const noStr = t.replace(/"[^"]*"/g, (m) => ' '.repeat(m.length));
        let m;
        while ((m = re.exec(noStr))) {
          const prev = noStr[m.index - 1] || '';
          if (/[A-Za-z_.!]/.test(prev) || noStr[m.index + m[0].length] === '(') continue;
          const a = SE.parseAddr(m[1].replace(/\$/g, '')), b = m[2] ? SE.parseAddr(m[2].replace(/\$/g, '')) : a;
          if (a && b) refs.push({ r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) });
        }
        this.refHighlights = refs.length ? refs : null;
      } else this.refHighlights = null;
      this.grid.draw();
      SE.updateFnHint(t, this.activeInput().selectionStart);
    },
    canPoint() {
      if (!this.editing) return false;
      const inp = this.activeInput();
      const t = inp.value;
      if (t[0] !== '=') return false;
      const pos = inp.selectionStart;
      if (this.pointRef && this.pointRef.end === pos && this.pointRef.text === t) return true;
      const prev = t.slice(0, pos).trimEnd().slice(-1);
      return '=(;,+-*/^&<>:'.includes(prev);
    },
    insertRef(r1, c1, r2, c2) {
      const inp = this.activeInput();
      const t = inp.value;
      let start = inp.selectionStart, end = inp.selectionEnd;
      if (this.pointRef && this.pointRef.end === start && this.pointRef.text === t) start = this.pointRef.start;
      let ref = SE.addr(r1, c1) + (r2 !== undefined && (r2 !== r1 || c2 !== c1) ? ':' + SE.addr(r2, c2) : '');
      if (this.editing.si !== this.si) ref = (/^[A-Za-z_][\w.]*$/.test(this.sheet.name) ? this.sheet.name : "'" + this.sheet.name.replace(/'/g, "''") + "'") + '!' + ref;
      const nt = t.slice(0, start) + ref + t.slice(end);
      const caret = start + ref.length;
      this.pointRef = { start, end: caret, text: nt };
      this.setEditText(nt, caret);
      inp.focus();
      this.pointRef.text = this.getEditText();
    },
    commitEdit(move) {
      const e = this.editing;
      if (!e) return;
      let text = this.getEditText();
      this.editing = null;
      this.pointRef = null;
      this.refHighlights = null;
      $('#cellEditor').classList.add('hidden');
      $('#fbOk').classList.add('hidden');
      $('#fbCancel').classList.add('hidden');
      $('#fnHint').classList.add('hidden');
      $('#cellEditor').blur(); $('#formulaInput').blur();
      if (e.si !== this.si) this.switchSheet(e.si);
      // fermeture automatique des parenthèses
      if (text[0] === '=') {
        const open = (text.replace(/"[^"]*"/g, '').match(/\(/g) || []).length - (text.replace(/"[^"]*"/g, '').match(/\)/g) || []).length;
        if (open > 0) text += ')'.repeat(open);
      }
      if (text !== e.original) {
        const sh = this.sheet;
        this.change(() => {
          const fillAll = move === 'fillsel';
          const targets = [];
          if (fillAll) { const s = this.sel; for (let r = s.r1; r <= s.r2; r++) for (let c = s.c1; c <= s.c2; c++) targets.push([r, c]); }
          else targets.push([e.r, e.c]);
          for (const [r, c] of targets) {
            const raw = text[0] === '=' ? SE.shiftFormula(text, r - e.r, c - e.c) : text;
            SE.setRaw(sh, r, c, raw);
            this.autoFormat(sh, r, c, raw);
          }
        });
        const dv = SE.dvAt(sh, e.r, e.c);
        if (dv && text && text[0] !== '=' && !dv.list.map(String).includes(text)) SE.toast('Valeur hors de la liste déroulante');
      } else this.grid.draw();
      if (move === 'down') this.move(1, 0);
      else if (move === 'up') this.move(-1, 0);
      else if (move === 'right') this.move(0, 1);
      else if (move === 'left') this.move(0, -1);
      else this.updateBars();
    },
    autoFormat(sh, r, c, raw) {
      const cell = sh.cells[r + ',' + c];
      if (!cell || (cell.s && cell.s.nf) || !raw || raw[0] === '=') return;
      const t = raw.trim();
      if (/%$/.test(t) && SE.parseNumberLiteral(t) !== null) SE.setStyle(sh, r, c, { nf: /[.,]\d/.test(t) ? 'pct1' : 'pct' });
      else if (/€/.test(t) && SE.parseNumberLiteral(t) !== null) SE.setStyle(sh, r, c, { nf: 'eur' });
      else if (SE.parseNumberLiteral(t) === null && SE.parseDateLiteral(t) !== null) SE.setStyle(sh, r, c, { nf: 'date' });
    },
    cancelEdit() {
      if (!this.editing) return;
      const si = this.editing.si;
      this.editing = null; this.pointRef = null; this.refHighlights = null;
      $('#cellEditor').classList.add('hidden');
      $('#fbOk').classList.add('hidden');
      $('#fbCancel').classList.add('hidden');
      $('#fnHint').classList.add('hidden');
      $('#cellEditor').blur(); $('#formulaInput').blur();
      if (si !== this.si) this.switchSheet(si);
      this.updateBars();
      this.grid.draw();
    },

    // ---------- Grille : souris & tactile ----------
    bindGrid() {
      const sc = this.grid.scroller, wrap = $('#gridWrap');
      let drag = null, tap = null, lpTimer = null, pinch = null;

      // empêcher le défilement natif quand le geste commence sur une poignée
      sc.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          const [a, b] = e.touches;
          pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: this.grid.zoom };
          clearTimeout(lpTimer); tap = null;
          e.preventDefault();
          return;
        }
        const t = e.touches[0];
        const h = this.grid.hit(t.clientX, t.clientY, true);
        if (h.type === 'fill' || h.type === 'colresize' || h.type === 'rowresize' || (this.selectMode && h.type === 'cell')) e.preventDefault();
      }, { passive: false });
      sc.addEventListener('touchmove', (e) => {
        if (pinch && e.touches.length === 2) {
          e.preventDefault();
          const [a, b] = e.touches;
          const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          this.setZoom(pinch.z * (d / pinch.d));
        }
      }, { passive: false });
      sc.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; });

      sc.addEventListener('wheel', (e) => {
        if (e.ctrlKey) { e.preventDefault(); this.setZoom(this.grid.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }
      }, { passive: false });

      sc.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        if (pinch) return;
        document.querySelectorAll('.chart-box.on').forEach((x) => x.classList.remove('on'));
        const touch = e.pointerType !== 'mouse';
        if (this.touchMode !== touch) { this.touchMode = touch; this.grid.draw(); }
        const h = this.grid.hit(e.clientX, e.clientY, touch);
        // bouton de liste déroulante
        const db = this.grid.dvButton;
        if (db) {
          const b = wrap.getBoundingClientRect();
          const x = e.clientX - b.left, y = e.clientY - b.top;
          if (x >= db.x - 4 && x <= db.x + db.w + 4 && y >= db.y - 4 && y <= db.y + db.h + 4) { e.preventDefault(); SE.dvPicker(); return; }
        }
        // mode pointage pendant l'édition d'une formule
        if (this.editing && h.type === 'cell' && this.canPoint()) {
          e.preventDefault();
          this.insertRef(h.r, h.c);
          const anchor = { r: h.r, c: h.c };
          if (!touch) {
            sc.setPointerCapture(e.pointerId);
            drag = { kind: 'point', anchor };
          }
          return;
        }
        if (this.editing) this.commitEdit(null);
        if (h.type === 'colresize' || h.type === 'rowresize') {
          e.preventDefault();
          sc.setPointerCapture(e.pointerId);
          const sh = this.sheet;
          drag = { kind: h.type, idx: h.type === 'colresize' ? h.c : h.r, start: h.type === 'colresize' ? e.clientX : e.clientY, orig: h.type === 'colresize' ? SE.colW(sh, h.c) : SE.rowH(sh, h.r), snap: false };
          return;
        }
        if (h.type === 'fill') {
          e.preventDefault();
          sc.setPointerCapture(e.pointerId);
          drag = { kind: 'fill' };
          return;
        }
        if (touch && !this.selectMode) {
          tap = { x: e.clientX, y: e.clientY, h, t: Date.now() };
          clearTimeout(lpTimer);
          lpTimer = setTimeout(() => {
            if (!tap) return;
            const t0 = tap; tap = null;
            if (t0.h.type === 'cell') { const s = this.sel; if (!s || t0.h.r < s.r1 || t0.h.r > s.r2 || t0.h.c < s.c1 || t0.h.c > s.c2) this.selectCell(t0.h.r, t0.h.c); }
            if (navigator.vibrate && SE.settings.haptics) navigator.vibrate(15);
            SE.contextMenu(t0.x, t0.y, t0.h);
          }, 520);
          return;
        }
        e.preventDefault();
        sc.setPointerCapture(e.pointerId);
        if (h.type === 'cell') {
          const extend = e.shiftKey || (this.selectMode && touch);
          if (!extend && !touch && this.toggleCheck(h.r, h.c)) return;
          this.selectCell(h.r, h.c, extend);
          drag = { kind: 'select' };
        } else if (h.type === 'colhdr') {
          const sh = this.sheet;
          if (e.shiftKey && this.sel) this.setSel(sh.rows - 1, h.c, 0, this.sel.ac); else this.setSel(sh.rows - 1, h.c, 0, h.c);
          this.sel.r = 0; this.sel.c = h.c;
          drag = { kind: 'colsel', c0: e.shiftKey && this.sel ? this.sel.ac : h.c };
        } else if (h.type === 'rowhdr') {
          const sh = this.sheet;
          if (e.shiftKey && this.sel) this.setSel(h.r, sh.cols - 1, this.sel.ar, 0); else this.setSel(h.r, sh.cols - 1, h.r, 0);
          this.sel.r = h.r; this.sel.c = 0;
          drag = { kind: 'rowsel', r0: e.shiftKey && this.sel ? this.sel.ar : h.r };
        } else if (h.type === 'corner') {
          const sh = this.sheet;
          this.setSel(sh.rows - 1, sh.cols - 1, 0, 0); this.sel.r = 0; this.sel.c = 0;
        }
      });

      sc.addEventListener('pointermove', (e) => {
        if (tap) {
          if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10) { tap = null; clearTimeout(lpTimer); }
          return;
        }
        if (!drag) {
          if (e.pointerType === 'mouse') {
            const h = this.grid.hit(e.clientX, e.clientY, false);
            sc.style.cursor = h.type === 'colresize' ? 'col-resize' : h.type === 'rowresize' ? 'row-resize' : h.type === 'fill' ? 'crosshair' : h.type === 'cell' ? 'cell' : 'default';
          }
          return;
        }
        const b = wrap.getBoundingClientRect();
        // défilement automatique près des bords
        const edge = 24;
        if (e.clientX > b.right - edge) sc.scrollLeft += 18; else if (e.clientX < b.left + this.grid.HW + 4 && drag.kind !== 'rowresize') sc.scrollLeft -= 18;
        if (e.clientY > b.bottom - edge) sc.scrollTop += 18; else if (e.clientY < b.top + this.grid.HH + 4 && drag.kind !== 'colresize') sc.scrollTop -= 18;
        const x = Math.max(this.grid.HW + 1, e.clientX - b.left), y = Math.max(this.grid.HH + 1, e.clientY - b.top);
        const r = Math.min(this.grid.rowAtY(y), this.sheet.rows - 1), c = Math.min(this.grid.colAtX(x), this.sheet.cols - 1);
        if (drag.kind === 'select') this.setSel(r, c, this.sel.ar, this.sel.ac);
        else if (drag.kind === 'point') { this.insertRef(Math.min(drag.anchor.r, r), Math.min(drag.anchor.c, c), Math.max(drag.anchor.r, r), Math.max(drag.anchor.c, c)); }
        else if (drag.kind === 'colsel') { this.setSel(this.sheet.rows - 1, c, 0, drag.c0); this.sel.r = 0; }
        else if (drag.kind === 'rowsel') { this.setSel(r, this.sheet.cols - 1, drag.r0, 0); this.sel.c = 0; }
        else if (drag.kind === 'colresize' || drag.kind === 'rowresize') {
          const d = ((drag.kind === 'colresize' ? e.clientX : e.clientY) - drag.start) / this.grid.zoom;
          const v = Math.max(drag.kind === 'colresize' ? 16 : 10, Math.round(drag.orig + d));
          if (!drag.snap) { this.snapshot(); drag.snap = true; }
          const sh = this.sheet;
          const s = this.sel;
          const multi = drag.kind === 'colresize' ? s.r1 === 0 && s.r2 >= sh.rows - 1 && drag.idx >= s.c1 && drag.idx <= s.c2 : s.c1 === 0 && s.c2 >= sh.cols - 1 && drag.idx >= s.r1 && drag.idx <= s.r2;
          if (drag.kind === 'colresize') { if (multi) for (let k = s.c1; k <= s.c2; k++) sh.colW[k] = v; else sh.colW[drag.idx] = v; }
          else { if (multi) for (let k = s.r1; k <= s.r2; k++) sh.rowH[k] = v; else sh.rowH[drag.idx] = v; }
          this.grid.layout();
        } else if (drag.kind === 'fill') {
          const s = this.sel;
          const dr = r > s.r2 ? r - s.r2 : r < s.r1 ? r - s.r1 : 0;
          const dc = c > s.c2 ? c - s.c2 : c < s.c1 ? c - s.c1 : 0;
          if (Math.abs(dr) >= Math.abs(dc) && dr !== 0) this.fillPreview = dr > 0 ? { r1: s.r1, c1: s.c1, r2: r, c2: s.c2 } : { r1: r, c1: s.c1, r2: s.r2, c2: s.c2 };
          else if (dc !== 0) this.fillPreview = dc > 0 ? { r1: s.r1, c1: s.c1, r2: s.r2, c2: c } : { r1: s.r1, c1: c, r2: s.r2, c2: s.c2 };
          else this.fillPreview = null;
          this.grid.draw();
        }
      });

      const end = (e) => {
        clearTimeout(lpTimer);
        if (tap && e.type === 'pointerup') {
          const t0 = tap; tap = null;
          const h = t0.h;
          if (h.type === 'cell') {
            const s = this.sel;
            const same = s && s.r === h.r && s.c === h.c && s.r1 === s.r2 && s.c1 === s.c2;
            const m = SE.mergeAt(this.sheet, h.r, h.c);
            const sameMerged = m && s && s.r === m.r1 && s.c === m.c1;
            if (this.toggleCheck(h.r, h.c)) { if (!same) this.selectCell(h.r, h.c); return; }
            if (same || sameMerged) {
              if (SE.dvAt(this.sheet, h.r, h.c)) SE.dvPicker();
              else this.startEdit();
            } else this.selectCell(h.r, h.c);
          } else if (h.type === 'colhdr') { const sh = this.sheet; this.setSel(sh.rows - 1, h.c, 0, h.c); this.sel.r = 0; this.sel.c = h.c; }
          else if (h.type === 'rowhdr') { const sh = this.sheet; this.setSel(h.r, sh.cols - 1, h.r, 0); this.sel.r = h.r; this.sel.c = 0; }
          else if (h.type === 'corner') { const sh = this.sheet; this.setSel(sh.rows - 1, sh.cols - 1, 0, 0); this.sel.r = 0; this.sel.c = 0; }
          return;
        }
        tap = null;
        if (!drag) return;
        const d = drag; drag = null;
        if (d.kind === 'fill' && this.fillPreview) { const f = this.fillPreview; this.fillPreview = null; this.fill(f); }
        if (d.kind === 'colresize' || d.kind === 'rowresize') { this.calc.invalidate(); this.save(); this.renderCharts(); }
        if (this.painter && (d.kind === 'select' || d.kind === 'colsel' || d.kind === 'rowsel')) SE.applyPainter();
        this.grid.draw();
      };
      sc.addEventListener('pointerup', end);
      sc.addEventListener('pointercancel', (e) => { tap = null; clearTimeout(lpTimer); if (drag && drag.kind !== 'select') end(e); drag = null; });
      sc.addEventListener('dblclick', (e) => {
        const h = this.grid.hit(e.clientX, e.clientY, false);
        if (h.type === 'cell') { this.selectCell(h.r, h.c); if (SE.dvAt(this.sheet, h.r, h.c)) SE.dvPicker(); else this.startEdit(); }
        else if (h.type === 'colresize') SE.run('autofit');
      });
      sc.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.pointerType === 'touch' || this.touchMode) return;
        const h = this.grid.hit(e.clientX, e.clientY, false);
        const s = this.sel;
        if (h.type === 'cell' && (!s || h.r < s.r1 || h.r > s.r2 || h.c < s.c1 || h.c > s.c2)) this.selectCell(h.r, h.c);
        SE.contextMenu(e.clientX, e.clientY, h);
      });
    },

    toggleCheck(r, c) {
      const sh = this.sheet;
      const cell = sh.cells[r + ',' + c];
      if (!cell || !cell.s || !cell.s.chk) return false;
      if (cell.v && cell.v[0] === '=') return false;
      const v = this.calc.value(this.si, r, c);
      const on = v === true || (typeof v === 'number' && v !== 0);
      this.setSel(r, c);
      this.change((s) => SE.setRaw(s, r, c, on ? 'FAUX' : 'VRAI'));
      if (!on && SE.settings.haptics && navigator.vibrate) navigator.vibrate(12);
      return true;
    },

    setZoom(z) {
      z = Math.max(0.5, Math.min(2.2, z));
      if (Math.abs(z - this.grid.zoom) < 0.005) return;
      this.grid.zoom = z;
      this.grid.measureCache.clear();
      this.grid.layout();
    },

    // ---------- Recopie ----------
    fill(target) {
      const s = this.sel;
      const src = { r1: s.r1, c1: s.c1, r2: s.r2, c2: s.c2 };
      this.change((sh) => SE.fillRange(sh, this.calc, this.si, src, target));
      this.setSel(target.r2 >= s.r2 && target.r1 === s.r1 ? target.r2 : target.r1, target.c2 >= s.c2 && target.c1 === s.c1 ? target.c2 : target.c1, target.r1 === s.r1 ? target.r1 : target.r2, target.c1 === s.c1 ? target.c1 : target.c2);
    },

    // ---------- Éditeur & barre de formule ----------
    bindEditor() {
      const ed = $('#cellEditor'), fb = $('#formulaInput');
      const keys = (e) => {
        if (!this.editing) return;
        if (e.key === 'Enter' && !e.altKey && !e.shiftKey) { e.preventDefault(); this.commitEdit(e.ctrlKey || e.metaKey ? 'fillsel' : 'down'); }
        else if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); this.commitEdit('up'); }
        else if (e.key === 'Enter' && e.altKey) { e.preventDefault(); const p = e.target.selectionStart; const t = e.target.value; this.setEditText(t.slice(0, p) + '\n' + t.slice(e.target.selectionEnd), p + 1); }
        else if (e.key === 'Tab') { e.preventDefault(); this.commitEdit(e.shiftKey ? 'left' : 'right'); }
        else if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
        else if (e.target === ed && ['ArrowUp', 'ArrowDown'].includes(e.key) && !this.getEditText().startsWith('=') && this.editing.quick) { e.preventDefault(); this.commitEdit(e.key === 'ArrowUp' ? 'up' : 'down'); }
        else if (e.target === ed && ['ArrowLeft', 'ArrowRight'].includes(e.key) && this.editing.quick && !this.getEditText().startsWith('=')) { e.preventDefault(); this.commitEdit(e.key === 'ArrowLeft' ? 'left' : 'right'); }
        else if (e.key === 'F4' && this.getEditText().startsWith('=')) { e.preventDefault(); SE.toggleAbsolute(); }
      };
      ed.addEventListener('keydown', keys);
      fb.addEventListener('keydown', (e) => {
        if (!this.editing && e.key === 'Enter') { e.preventDefault(); return; }
        keys(e);
      });
      ed.addEventListener('input', () => { this.pointRef = this.pointRef && this.pointRef.text === ed.value ? this.pointRef : null; fb.value = ed.value; this.onEditInput(); });
      fb.addEventListener('input', () => { if (!this.editing) { const v = fb.value; this.startEdit(v, { bar: true }); return; } ed.value = fb.value; this.onEditInput(); });
      fb.addEventListener('focus', () => { if (!this.editing && this.sel) { const t = fb.value; this.startEdit(t, { bar: true }); } });
      ed.addEventListener('click', () => this.onEditInput());
      fb.addEventListener('click', () => this.onEditInput());
      ed.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) this.onEditInput(); });
      $('#nameBox').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const v = e.target.value.trim().toUpperCase();
        const [a, b] = v.split(':');
        const p1 = SE.parseAddr(a), p2 = b ? SE.parseAddr(b) : p1;
        if (!p1 || !p2) { SE.toast('Adresse invalide', 'err'); return; }
        const sh = this.sheet;
        if (p2.r >= sh.rows) { sh.rows = p2.r + 50; } if (p2.c >= sh.cols) { sh.cols = p2.c + 5; }
        this.grid.layout();
        this.setSel(p2.r, p2.c, p1.r, p1.c);
        this.sel.r = p1.r; this.sel.c = p1.c;
        this.grid.scrollToCell(p1.r, p1.c);
        e.target.blur();
      });
      $('#nameBox').addEventListener('focus', (e) => e.target.select());
    },

    // ---------- Clavier ----------
    bindKeys() {
      document.addEventListener('keydown', (e) => {
        if ($('#editor').classList.contains('hidden')) return;
        if (SE.modalOpen()) return;
        const tg = e.target;
        if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT')) return;
        if (this.editing) return;
        const mod = e.ctrlKey || e.metaKey;
        const k = e.key;
        if (mod) {
          const map = { z: 'undo', y: 'redo', b: 'bold', i: 'italic', u: 'underline', s: 'saveNow', d: 'fillDown', r: 'fillRight', f: 'find', h: 'find', a: 'selectAll', p: 'exportPdf' };
          const act = map[k.toLowerCase()];
          if (k.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); SE.run('redo'); return; }
          if (act) { e.preventDefault(); SE.run(act); return; }
          if (k === 'ArrowDown') { e.preventDefault(); this.move(1, 0, e.shiftKey, true); return; }
          if (k === 'ArrowUp') { e.preventDefault(); this.move(-1, 0, e.shiftKey, true); return; }
          if (k === 'ArrowLeft') { e.preventDefault(); this.move(0, -1, e.shiftKey, true); return; }
          if (k === 'ArrowRight') { e.preventDefault(); this.move(0, 1, e.shiftKey, true); return; }
          if (k === 'Home') { e.preventDefault(); this.setSel(0, 0); this.grid.scrollToCell(0, 0); return; }
          if (k === ';') { e.preventDefault(); SE.run('today'); return; }
          if (k === '+' || k === '=') { e.preventDefault(); this.setZoom(this.grid.zoom * 1.1); return; }
          if (k === '-') { e.preventDefault(); this.setZoom(this.grid.zoom / 1.1); return; }
          return;
        }
        switch (k) {
          case 'ArrowDown': e.preventDefault(); this.move(1, 0, e.shiftKey); return;
          case 'ArrowUp': e.preventDefault(); this.move(-1, 0, e.shiftKey); return;
          case 'ArrowLeft': e.preventDefault(); this.move(0, -1, e.shiftKey); return;
          case 'ArrowRight': e.preventDefault(); this.move(0, 1, e.shiftKey); return;
          case 'Enter': e.preventDefault(); this.move(e.shiftKey ? -1 : 1, 0); return;
          case 'Tab': e.preventDefault(); this.move(0, e.shiftKey ? -1 : 1); return;
          case 'PageDown': e.preventDefault(); this.move(Math.floor(this.grid.H / 26), 0, e.shiftKey); return;
          case 'PageUp': e.preventDefault(); this.move(-Math.floor(this.grid.H / 26), 0, e.shiftKey); return;
          case 'Home': e.preventDefault(); this.setSel(this.sel.r, 0); this.grid.scrollToCell(this.sel.r, 0); return;
          case 'Delete': case 'Backspace': e.preventDefault(); SE.run('clearContents'); return;
          case 'F2': e.preventDefault(); this.startEdit(); return;
          case 'Escape': this.clip && (this.clip.showAnts = false); this.painter = null; this.grid.draw(); this.updateBars(); return;
          case ' ': if (this.toggleCheck(this.sel.r, this.sel.c)) { e.preventDefault(); return; } break;
        }
        if (k.length === 1 && !e.altKey) {
          e.preventDefault();
          if (SE.dvAt(this.sheet, this.sel.r, this.sel.c) && k === ' ') { SE.dvPicker(); return; }
          this.startEdit(k);
          this.editing.quick = true;
        }
      });
      document.addEventListener('copy', (e) => { if (this.canClipboardEvent(e)) { e.preventDefault(); SE.copy(false, e.clipboardData); } });
      document.addEventListener('cut', (e) => { if (this.canClipboardEvent(e)) { e.preventDefault(); SE.copy(true, e.clipboardData); } });
      document.addEventListener('paste', (e) => {
        if (!this.canClipboardEvent(e)) return;
        e.preventDefault();
        SE.paste(e.clipboardData.getData('text/plain'));
      });
    },
    canClipboardEvent(e) {
      if ($('#editor').classList.contains('hidden') || SE.modalOpen() || this.editing) return false;
      const tg = e.target;
      return !(tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA'));
    }
  };

  // ---------- Recopie incrémentée (série) ----------
  SE.fillRange = function (sh, calc, si, src, tgt) {
    const vertical = tgt.c1 === src.c1 && tgt.c2 === src.c2;
    const H = src.r2 - src.r1 + 1, W = src.c2 - src.c1 + 1;
    const lines = vertical ? W : H;
    for (let l = 0; l < lines; l++) {
      const srcCells = [];
      const len = vertical ? H : W;
      for (let i = 0; i < len; i++) {
        const r = vertical ? src.r1 + i : src.r1 + l, c = vertical ? src.c1 + l : src.c1 + i;
        srcCells.push({ r, c, cell: sh.cells[r + ',' + c] });
      }
      const lits = srcCells.map((x) => (x.cell && x.cell.v !== undefined && x.cell.v[0] !== '=' ? SE.literal(x.cell.v) : undefined));
      const allNum = lits.every((v) => typeof v === 'number');
      let step = 0;
      if (allNum && lits.length >= 2) step = (lits[lits.length - 1] - lits[0]) / (lits.length - 1);
      const single = srcCells.length === 1 ? srcCells[0] : null;
      const textNum = single && single.cell && single.cell.v && single.cell.v[0] !== '=' ? /^(.*?)(\d+)(\s*)$/.exec(single.cell.v) : null;
      const isDate = single && typeof lits[0] === 'number' && single.cell.s && /^date/.test(single.cell.s.nf || '');
      const from = vertical ? tgt.r1 : tgt.c1, to = vertical ? tgt.r2 : tgt.c2;
      const s0 = vertical ? src.r1 : src.c1, s1 = vertical ? src.r2 : src.c2;
      for (let p = from; p <= to; p++) {
        if (p >= s0 && p <= s1) continue;
        const off = p - s0;
        const idx = ((off % len) + len) % len;
        const sc = srcCells[idx];
        const r = vertical ? p : src.r1 + l, c = vertical ? src.c1 + l : p;
        const k = r + ',' + c;
        if (!sc.cell) { delete sh.cells[k]; continue; }
        const nc = { };
        if (sc.cell.s) nc.s = Object.assign({}, sc.cell.s);
        if (sc.cell.v !== undefined) {
          const raw = sc.cell.v;
          if (raw[0] === '=') nc.v = SE.shiftFormula(raw, r - sc.r, c - sc.c);
          else if (allNum && lits.length >= 2) nc.v = String(Math.round((lits[0] + step * off) * 1e9) / 1e9);
          else if (textNum && !(typeof lits[0] === 'number' && !isDate)) { const n = parseInt(textNum[2], 10) + off; nc.v = textNum[1] + (n < 0 ? 0 : String(n).padStart(textNum[2].length, '0')) + textNum[3]; }
          else if (isDate) nc.v = String(lits[0] + off);
          else nc.v = raw;
        }
        sh.cells[k] = nc;
        if (r >= sh.rows) sh.rows = r + 20;
        if (c >= sh.cols) sh.cols = c + 2;
      }
    }
  };

  // texte affiché en édition (dates lisibles au lieu du numéro de série)
  SE.editText = function (cell) {
    if (!cell || cell.v === undefined) return '';
    const nf = cell.s && cell.s.nf;
    if (nf && /^date/.test(nf) && cell.v[0] !== '=') {
      const n = SE.parseNumberLiteral(cell.v);
      if (n !== null) return SE.formatValue(n, 'date');
    }
    return cell.v;
  };

  SE.showScreen = function (name) {
    $('#home').classList.toggle('hidden', name !== 'home');
    $('#editor').classList.toggle('hidden', name !== 'editor');
    if (name === 'editor') setTimeout(() => SE.app.grid.resize(), 0);
  };

  SE.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init());
})();
