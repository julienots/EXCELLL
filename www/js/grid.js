/* SuperEssence Sheets — grille canvas virtualisée */
(function () {
  'use strict';
  const SE = window.SE;
  const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

  class Grid {
    constructor(app, wrap) {
      this.app = app;
      this.wrap = wrap;
      this.canvas = wrap.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.scroller = wrap.querySelector('.scroller');
      this.spacer = wrap.querySelector('.spacer');
      this.chartLayer = wrap.querySelector('.chart-layer');
      this.zoom = 1;
      this.colPos = [0];
      this.rowPos = [0];
      this.pending = false;
      this.measureCache = new Map();
      this.scroller.addEventListener('scroll', () => { this.onScroll(); });
      new ResizeObserver(() => this.resize()).observe(wrap);
      this.resize();
    }
    get sh() { return this.app.sheet; }
    get HW() { return Math.round(44 * this.zoom); }
    get HH() { return Math.round(24 * this.zoom); }

    resize() {
      const r = this.wrap.getBoundingClientRect();
      this.W = r.width; this.H = r.height;
      const dpr = window.devicePixelRatio || 1;
      this.dpr = dpr;
      this.canvas.width = Math.max(1, Math.round(r.width * dpr));
      this.canvas.height = Math.max(1, Math.round(r.height * dpr));
      this.canvas.style.width = r.width + 'px';
      this.canvas.style.height = r.height + 'px';
      this.draw();
    }

    layout() {
      const sh = this.sh, z = this.zoom;
      if (!sh) return;
      const cp = new Array(sh.cols + 1); cp[0] = 0;
      for (let c = 0; c < sh.cols; c++) cp[c + 1] = cp[c] + Math.round(SE.colW(sh, c) * z);
      const rp = new Array(sh.rows + 1); rp[0] = 0;
      for (let r = 0; r < sh.rows; r++) rp[r + 1] = rp[r] + Math.round(SE.rowH(sh, r) * z);
      this.colPos = cp; this.rowPos = rp;
      this.spacer.style.width = this.HW + cp[sh.cols] + 60 + 'px';
      this.spacer.style.height = this.HH + rp[sh.rows] + 80 + 'px';
      this.app.renderCharts && this.app.renderCharts();
      this.draw();
    }

    onScroll() {
      const sh = this.sh;
      if (!sh) return;
      const sc = this.scroller;
      // Extension automatique de la feuille
      if (sc.scrollTop + sc.clientHeight > this.rowPos[sh.rows] - 200 && sh.rows < 50000) { sh.rows += 100; this.layout(); return; }
      if (sc.scrollLeft + sc.clientWidth > this.colPos[sh.cols] - 150 && sh.cols < 1000) { sh.cols += 10; this.layout(); return; }
      this.draw();
    }

    draw() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => { this.pending = false; this.paint(); });
    }

    // position écran d'une colonne / ligne
    sx(c) { return this.HW + this.colPos[c] - (c >= this.sh.freezeC ? this.scroller.scrollLeft : 0); }
    sy(r) { return this.HH + this.rowPos[r] - (r >= this.sh.freezeR ? this.scroller.scrollTop : 0); }
    bsearch(arr, v) {
      let lo = 0, hi = arr.length - 2;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid - 1; }
      return Math.max(0, lo);
    }
    colAtX(x) {
      const sh = this.sh;
      const fw = this.colPos[sh.freezeC];
      if (x - this.HW < fw) return this.bsearch(this.colPos, x - this.HW);
      return this.bsearch(this.colPos, x - this.HW + this.scroller.scrollLeft);
    }
    rowAtY(y) {
      const sh = this.sh;
      const fh = this.rowPos[sh.freezeR];
      if (y - this.HH < fh) return this.bsearch(this.rowPos, y - this.HH);
      return this.bsearch(this.rowPos, y - this.HH + this.scroller.scrollTop);
    }

    cellRect(r, c) {
      const m = SE.mergeAt(this.sh, r, c);
      if (m) { r = m.r1; c = m.c1; }
      const x = this.sx(c), y = this.sy(r);
      const r2 = m ? m.r2 : r, c2 = m ? m.c2 : c;
      return { x, y, w: this.colPos[c2 + 1] - this.colPos[c], h: this.rowPos[r2 + 1] - this.rowPos[r] };
    }

    hit(clientX, clientY, touch) {
      const b = this.wrap.getBoundingClientRect();
      const x = clientX - b.left, y = clientY - b.top;
      const tol = touch ? 12 : 4;
      const sh = this.sh;
      if (x < this.HW && y < this.HH) return { type: 'corner' };
      if (y < this.HH) {
        const c = this.colAtX(x);
        const right = this.sx(c) + this.colPos[c + 1] - this.colPos[c];
        if (Math.abs(x - right) <= tol) return { type: 'colresize', c };
        if (Math.abs(x - this.sx(c)) <= tol && c > 0) return { type: 'colresize', c: c - 1 };
        return { type: 'colhdr', c };
      }
      if (x < this.HW) {
        const r = this.rowAtY(y);
        const bottom = this.sy(r) + this.rowPos[r + 1] - this.rowPos[r];
        if (Math.abs(y - bottom) <= tol) return { type: 'rowresize', r };
        if (Math.abs(y - this.sy(r)) <= tol && r > 0) return { type: 'rowresize', r: r - 1 };
        return { type: 'rowhdr', r };
      }
      const r = Math.min(this.rowAtY(y), sh.rows - 1), c = Math.min(this.colAtX(x), sh.cols - 1);
      // poignée de recopie
      const s = this.app.sel;
      if (s) {
        const rr = this.rangeRect(s.r1, s.c1, s.r2, s.c2);
        const hx = rr.x + rr.w, hy = rr.y + rr.h;
        const ht = touch ? 18 : 7;
        if (Math.abs(x - hx) <= ht && Math.abs(y - hy) <= ht) return { type: 'fill', r, c };
      }
      return { type: 'cell', r, c, x, y };
    }

    rangeRect(r1, c1, r2, c2) {
      // étend aux fusions
      const a = this.cellRect(r1, c1);
      const m2 = SE.mergeAt(this.sh, r2, c2);
      if (m2) { r2 = Math.max(r2, m2.r2); c2 = Math.max(c2, m2.c2); }
      const x2 = this.sx(c2) + this.colPos[c2 + 1] - this.colPos[c2];
      const y2 = this.sy(r2) + this.rowPos[r2 + 1] - this.rowPos[r2];
      return { x: a.x, y: a.y, w: x2 - a.x, h: y2 - a.y };
    }

    scrollToCell(r, c) {
      const sh = this.sh, sc = this.scroller;
      const fw = this.colPos[sh.freezeC], fh = this.rowPos[sh.freezeR];
      const vw = this.W - this.HW - fw, vh = this.H - this.HH - fh;
      if (c >= sh.freezeC) {
        const left = this.colPos[c] - fw, right = this.colPos[c + 1] - fw;
        if (left < sc.scrollLeft) sc.scrollLeft = left;
        else if (right > sc.scrollLeft + vw) sc.scrollLeft = right - vw;
      }
      if (r >= sh.freezeR) {
        const top = this.rowPos[r] - fh, bot = this.rowPos[r + 1] - fh;
        if (top < sc.scrollTop) sc.scrollTop = top;
        else if (bot > sc.scrollTop + vh) sc.scrollTop = bot - vh;
      }
    }

    font(s, z) {
      const fs = ((s && s.fs) || 13) * z;
      return (s && s.i ? 'italic ' : '') + (s && s.b ? '700 ' : '400 ') + fs.toFixed(1) + 'px ' + (s && s.ff ? s.ff + ',' : '') + FONT;
    }
    measure(text, font) {
      const k = font + '|' + text;
      let w = this.measureCache.get(k);
      if (w === undefined) {
        this.ctx.font = font;
        w = this.ctx.measureText(text).width;
        if (this.measureCache.size > 5000) this.measureCache.clear();
        this.measureCache.set(k, w);
      }
      return w;
    }

    // ---------- Peinture ----------
    paint() {
      const ctx = this.ctx, sh = this.sh, app = this.app, z = this.zoom;
      if (!sh) return;
      const W = this.W, H = this.H, HW = this.HW, HH = this.HH;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      const fr = sh.freezeR, fc = sh.freezeC;
      const fw = this.colPos[fc], fh = this.rowPos[fr];
      const sl = this.scroller.scrollLeft, st = this.scroller.scrollTop;
      const c0 = this.bsearch(this.colPos, fw + sl), r0 = this.bsearch(this.rowPos, fh + st);
      let c1 = c0; while (c1 < sh.cols - 1 && this.colPos[c1 + 1] - sl < W - HW) c1++;
      let r1 = r0; while (r1 < sh.rows - 1 && this.rowPos[r1 + 1] - st < H - HH) r1++;
      const regions = [];
      const scrollCols = [Math.max(c0, fc), c1], scrollRows = [Math.max(r0, fr), r1];
      regions.push({ rows: scrollRows, cols: scrollCols, x: HW + fw, y: HH + fh, w: W - HW - fw, h: H - HH - fh });
      if (fc > 0) regions.push({ rows: scrollRows, cols: [0, fc - 1], x: HW, y: HH + fh, w: fw, h: H - HH - fh });
      if (fr > 0) regions.push({ rows: [0, fr - 1], cols: scrollCols, x: HW + fw, y: HH, w: W - HW - fw, h: fh });
      if (fr > 0 && fc > 0) regions.push({ rows: [0, fr - 1], cols: [0, fc - 1], x: HW, y: HH, w: fw, h: fh });

      const covered = new Set();
      for (const m of sh.merges) for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) covered.add(r * 100000 + c);

      for (const rg of regions) {
        if (rg.w <= 0 || rg.h <= 0) continue;
        ctx.save();
        ctx.beginPath(); ctx.rect(rg.x, rg.y, rg.w, rg.h); ctx.clip();
        this.paintRegion(rg, covered);
        ctx.restore();
      }

      // Sélection
      this.paintSelection();

      // En-têtes
      ctx.font = '500 ' + (11 * z).toFixed(1) + 'px ' + FONT;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const sel = app.sel;
      // colonnes
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(0, 0, W, HH);
      const drawColHdr = (from, to) => {
        for (let c = from; c <= to; c++) {
          const x = this.sx(c), w = this.colPos[c + 1] - this.colPos[c];
          const on = sel && c >= sel.c1 && c <= sel.c2;
          const full = sel && sel.r1 === 0 && sel.r2 >= sh.rows - 1 && on;
          if (on) { ctx.fillStyle = full ? '#FFC72C' : '#FFF0C0'; ctx.fillRect(x, 0, w, HH); }
          ctx.fillStyle = on ? '#111' : '#5b5b66';
          ctx.fillText(SE.colName(c), x + w / 2, HH / 2 + 0.5);
          ctx.fillStyle = '#d9d9de';
          ctx.fillRect(x + w - 1, 0, 1, HH);
          if (on) { ctx.fillStyle = '#E0A400'; ctx.fillRect(x, HH - 2, w, 2); }
        }
      };
      ctx.save(); ctx.beginPath(); ctx.rect(HW + fw, 0, W, HH); ctx.clip(); drawColHdr(scrollCols[0], scrollCols[1]); ctx.restore();
      if (fc > 0) { ctx.save(); ctx.beginPath(); ctx.rect(HW, 0, fw, HH); ctx.clip(); drawColHdr(0, fc - 1); ctx.restore(); }
      // lignes
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(0, HH, HW, H);
      const drawRowHdr = (from, to) => {
        for (let r = from; r <= to; r++) {
          const y = this.sy(r), h = this.rowPos[r + 1] - this.rowPos[r];
          const on = sel && r >= sel.r1 && r <= sel.r2;
          const full = sel && sel.c1 === 0 && sel.c2 >= sh.cols - 1 && on;
          if (on) { ctx.fillStyle = full ? '#FFC72C' : '#FFF0C0'; ctx.fillRect(0, y, HW, h); }
          ctx.fillStyle = on ? '#111' : '#5b5b66';
          if (h > 6) ctx.fillText(String(r + 1), HW / 2, y + h / 2 + 0.5);
          ctx.fillStyle = '#d9d9de';
          ctx.fillRect(0, y + h - 1, HW, 1);
          if (on) { ctx.fillStyle = '#E0A400'; ctx.fillRect(HW - 2, y, 2, h); }
        }
      };
      ctx.save(); ctx.beginPath(); ctx.rect(0, HH + fh, HW, H); ctx.clip(); drawRowHdr(scrollRows[0], scrollRows[1]); ctx.restore();
      if (fr > 0) { ctx.save(); ctx.beginPath(); ctx.rect(0, HH, HW, fh); ctx.clip(); drawRowHdr(0, fr - 1); ctx.restore(); }
      // coin
      ctx.fillStyle = '#e8e8ec';
      ctx.fillRect(0, 0, HW, HH);
      ctx.fillStyle = '#c4c4cc';
      ctx.beginPath(); ctx.moveTo(HW - 4, 4); ctx.lineTo(HW - 4, HH - 4); ctx.lineTo(HW - 4 - (HH - 8), HH - 4); ctx.fill();
      ctx.fillStyle = '#cfcfd6';
      ctx.fillRect(0, HH - 1, W, 1);
      ctx.fillRect(HW - 1, 0, 1, H);
      // lignes de figement
      if (fr > 0) { ctx.fillStyle = '#9a9aa6'; ctx.fillRect(0, HH + fh - 1, W, 2); }
      if (fc > 0) { ctx.fillStyle = '#9a9aa6'; ctx.fillRect(HW + fw - 1, 0, 2, H); }

      this.app.positionEditor && this.app.positionEditor();
    }

    cellDisplay(r, c) {
      const app = this.app, sh = this.sh;
      const cell = sh.cells[r + ',' + c];
      let v = cell && cell.v !== undefined ? app.calc.value(app.si, r, c) : null;
      let s = cell && cell.s;
      if (app.showFormulas && cell && cell.v && cell.v[0] === '=') { v = cell.v; s = Object.assign({}, s || {}, { ha: 'left', nf: '', chk: null, fc: '#1A5FD0' }); }
      const cf = sh.cf && sh.cf.length ? SE.cfStyle(sh, app.calc, app.si, r, c, v) : null;
      if (cf) s = Object.assign({}, s || {}, cf);
      return { cell, v, s };
    }

    paintRegion(rg, covered) {
      const ctx = this.ctx, sh = this.sh, z = this.zoom;
      const [ra, rb] = rg.rows, [ca, cb] = rg.cols;
      const showGrid = sh.grid !== false;
      // 1. lignes de grille
      if (showGrid) {
        ctx.fillStyle = '#e3e5e8';
        for (let c = ca; c <= cb; c++) { const x = this.sx(c + 1) - 1; ctx.fillRect(x, rg.y, 1, rg.h); }
        for (let r = ra; r <= rb; r++) { const y = this.sy(r + 1) - 1; ctx.fillRect(rg.x, y, rg.w, 1); }
      }
      // 2. fonds
      const disp = [];
      for (let r = ra; r <= rb; r++) {
        const y = this.sy(r), h = this.rowPos[r + 1] - this.rowPos[r];
        if (h <= 0) continue;
        for (let c = Math.max(0, ca - 8); c <= cb; c++) {
          const w = this.colPos[c + 1] - this.colPos[c];
          if (w <= 0) continue;
          if (covered.has(r * 100000 + c)) continue;
          const cell = sh.cells[r + ',' + c];
          if (!cell && !(sh.cf && sh.cf.length)) continue;
          const d = this.cellDisplay(r, c);
          if (!d.cell && !d.s) continue;
          const x = this.sx(c);
          if (c >= ca && d.s && d.s.bg) { ctx.fillStyle = d.s.bg; ctx.fillRect(x, y, w, h); }
          if (c >= ca && d.s && d.s._bar !== undefined) {
            ctx.fillStyle = d.s._barColor; ctx.globalAlpha = 0.55;
            ctx.fillRect(x + 2, y + 3, Math.max(2, (w - 4) * d.s._bar), h - 6);
            ctx.globalAlpha = 1;
          }
          disp.push({ r, c, x, y, w, h, d });
        }
      }
      // 3. fusions
      const merges = [];
      for (const m of sh.merges) {
        if (m.r2 < ra || m.r1 > rb || m.c2 < ca || m.c1 > cb) continue;
        const rect = this.rangeRectRaw(m);
        const d = this.cellDisplay(m.r1, m.c1);
        ctx.fillStyle = (d.s && d.s.bg) || '#ffffff';
        ctx.fillRect(rect.x, rect.y, rect.w - (showGrid && !(d.s && d.s.bg) ? 1 : 0), rect.h - (showGrid && !(d.s && d.s.bg) ? 1 : 0));
        merges.push({ r: m.r1, c: m.c1, ...rect, d, merged: true });
      }
      // 4. bordures
      const drawBorders = (it) => {
        const s = it.d.s; if (!s) return;
        if (!(s.bt || s.bb || s.bl || s.br)) return;
        ctx.fillStyle = s.bdc || '#222';
        const { x, y, w, h } = it;
        if (s.bt) ctx.fillRect(x - 1, y - Math.ceil(s.bt / 2), w + 1, s.bt);
        if (s.bb) ctx.fillRect(x - 1, y + h - 1 - Math.floor(s.bb / 2), w + 1, s.bb);
        if (s.bl) ctx.fillRect(x - Math.ceil(s.bl / 2), y - 1, s.bl, h + 1);
        if (s.br) ctx.fillRect(x + w - 1 - Math.floor(s.br / 2), y - 1, s.br, h + 1);
      };
      // 5. textes
      ctx.textBaseline = 'middle';
      for (const it of disp) if (it.c >= ca) drawBorders(it);
      for (const it of merges) drawBorders(it);
      for (const it of disp) this.paintCellText(it, covered, cb);
      for (const it of merges) this.paintCellText(it, covered, cb);
    }

    rangeRectRaw(m) {
      const x = this.sx(m.c1), y = this.sy(m.r1);
      return { x, y, w: this.colPos[m.c2 + 1] - this.colPos[m.c1], h: this.rowPos[m.r2 + 1] - this.rowPos[m.r1] };
    }

    paintCellText(it, covered, cmax) {
      const ctx = this.ctx, z = this.zoom, sh = this.sh;
      const { d, x, y, w, h } = it;
      const s = d.s || {};
      const v = d.v;
      // case à cocher
      if (s.chk) {
        const sz = Math.min(16 * z, h - 6), bx = x + (w - sz) / 2, by = y + (h - sz) / 2;
        const on = v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && /^(x|oui|ok|✓)$/i.test(v));
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = on ? '#E0A400' : '#9a9aa6';
        ctx.fillStyle = on ? '#FFC72C' : '#fff';
        roundRect(ctx, bx, by, sz, sz, 3 * z); ctx.fill(); ctx.stroke();
        if (on) {
          ctx.strokeStyle = '#111'; ctx.lineWidth = 2 * z;
          ctx.beginPath(); ctx.moveTo(bx + sz * 0.22, by + sz * 0.52); ctx.lineTo(bx + sz * 0.42, by + sz * 0.72); ctx.lineTo(bx + sz * 0.78, by + sz * 0.3); ctx.stroke();
        }
        return;
      }
      if (v === null || v === undefined || v === '') { if (s.note) this.paintNote(x, y, w); return; }
      let text = SE.formatValue(v, s.nf);
      if (text === '') return;
      const font = this.font(s, z);
      ctx.font = font;
      const isNum = typeof v === 'number', isErr = SE.isErr(v);
      let ha = s.ha || (isNum ? 'right' : typeof v === 'boolean' || isErr ? 'center' : 'left');
      const pad = 4 * z;
      let color = s.fc || (isErr ? '#c0392b' : '#1d1d22');
      const isLink = typeof v === 'string' && /^https?:\/\//i.test(v);
      if (isLink && !s.fc) color = '#1a5fd0';
      // zone de débordement
      let clipX = x, clipW = w;
      const tw = this.measure(text, font);
      if (!it.merged && !s.wrap && tw > w - pad * 2 && typeof v === 'string' && ha === 'left') {
        let c = it.c + 1, ext = 0;
        while (c < sh.cols && c <= cmax + 1 && tw > w + ext - pad * 2) {
          if (covered.has(it.r * 100000 + c)) break;
          const n = sh.cells[it.r + ',' + c];
          if (n && n.v !== undefined && n.v !== '') break;
          ext += this.colPos[c + 1] - this.colPos[c];
          c++;
        }
        clipW = w + ext;
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(clipX, y, clipW, h); ctx.clip();
      ctx.fillStyle = color;
      const lines = s.wrap ? this.wrapText(text, font, w - pad * 2) : [text];
      const lh = ((s.fs || 13) * 1.25) * z;
      const totalH = lh * lines.length;
      let ty;
      const va = s.va || 'middle';
      if (va === 'top') ty = y + pad + lh / 2;
      else if (va === 'bottom') ty = y + h - pad - totalH + lh / 2;
      else ty = y + (h - totalH) / 2 + lh / 2;
      if (isNum && !s.wrap && tw > w - pad && !it.merged) { lines[0] = '###'; ha = 'center'; }
      for (const line of lines) {
        let tx;
        ctx.textAlign = ha;
        if (ha === 'right') tx = x + w - pad - (s.ind || 0) * 10 * z;
        else if (ha === 'center') tx = x + w / 2;
        else tx = x + pad + (s.ind || 0) * 10 * z;
        ctx.fillText(line, tx, ty + 0.5);
        if (s.u || isLink || s.st) {
          const lw = this.measure(line, font);
          const lx = ha === 'right' ? tx - lw : ha === 'center' ? tx - lw / 2 : tx;
          ctx.fillRect(lx, s.st ? ty : ty + ((s.fs || 13) * z) / 2 + 1, lw, Math.max(1, z));
        }
        ty += lh;
      }
      ctx.restore();
      if (s.note) this.paintNote(x, y, w);
    }

    paintNote(x, y, w) {
      const ctx = this.ctx, k = 7 * this.zoom;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.moveTo(x + w - k - 1, y); ctx.lineTo(x + w - 1, y); ctx.lineTo(x + w - 1, y + k); ctx.fill();
    }

    wrapText(text, font, maxW) {
      const out = [];
      for (const para of String(text).split('\n')) {
        const words = para.split(' ');
        let line = '';
        for (const wd of words) {
          const t = line ? line + ' ' + wd : wd;
          if (this.measure(t, font) > maxW && line) { out.push(line); line = wd; } else line = t;
        }
        out.push(line);
      }
      return out;
    }

    paintSelection() {
      const ctx = this.ctx, app = this.app, sel = app.sel, z = this.zoom;
      if (!sel) return;
      const HW = this.HW, HH = this.HH;
      ctx.save();
      ctx.beginPath(); ctx.rect(HW, HH, this.W - HW, this.H - HH); ctx.clip();
      // références en cours d'édition (mode pointage)
      if (app.refHighlights) {
        app.refHighlights.forEach((h, i) => {
          const rr = this.rangeRect(h.r1, h.c1, h.r2, h.c2);
          const col = REF_COLORS[i % REF_COLORS.length];
          ctx.fillStyle = col + '22'; ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
          ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
          ctx.strokeRect(rr.x + 0.5, rr.y + 0.5, rr.w - 1, rr.h - 1);
          ctx.setLineDash([]);
        });
      }
      const rr = this.rangeRect(sel.r1, sel.c1, sel.r2, sel.c2);
      const multi = sel.r1 !== sel.r2 || sel.c1 !== sel.c2;
      if (multi) {
        ctx.fillStyle = 'rgba(255, 199, 44, 0.16)';
        ctx.fillRect(rr.x, rr.y, rr.w, rr.h);
        const a = this.cellRect(sel.r, sel.c);
        ctx.strokeStyle = 'rgba(224,164,0,0.6)'; ctx.lineWidth = 1;
        ctx.strokeRect(a.x + 1.5, a.y + 1.5, a.w - 3, a.h - 3);
      }
      ctx.strokeStyle = '#E0A400';
      ctx.lineWidth = 2;
      ctx.strokeRect(rr.x, rr.y, rr.w - 1, rr.h - 1);
      // poignée
      const hs = app.touchMode ? 10 : 7;
      ctx.fillStyle = '#E0A400';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      if (app.touchMode) { ctx.beginPath(); ctx.arc(rr.x + rr.w - 1, rr.y + rr.h - 1, hs / 2 + 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      else { ctx.fillRect(rr.x + rr.w - hs / 2 - 1, rr.y + rr.h - hs / 2 - 1, hs, hs); ctx.strokeRect(rr.x + rr.w - hs / 2 - 1, rr.y + rr.h - hs / 2 - 1, hs, hs); }
      // aperçu de recopie
      if (app.fillPreview) {
        const f = app.fillPreview;
        const fr = this.rangeRect(f.r1, f.c1, f.r2, f.c2);
        ctx.setLineDash([5, 4]); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
        ctx.strokeRect(fr.x + 0.5, fr.y + 0.5, fr.w - 2, fr.h - 2);
        ctx.setLineDash([]);
      }
      // presse-papiers (fourmis)
      if (app.clip && app.clip.si === app.si && app.clip.showAnts) {
        const c = app.clip;
        const cr = this.rangeRect(c.r1, c.c1, c.r2, c.c2);
        ctx.setLineDash([4, 4]); ctx.strokeStyle = '#1a5fd0'; ctx.lineWidth = 1.5;
        ctx.strokeRect(cr.x + 1, cr.y + 1, cr.w - 3, cr.h - 3); ctx.setLineDash([]);
      }
      // flèche de liste déroulante
      const dv = SE.dvAt(this.sh, sel.r, sel.c);
      if (dv) {
        const a = this.cellRect(sel.r, sel.c);
        const bs = Math.min(a.h - 4, 20 * z);
        const bx = a.x + a.w + 2, by = a.y + (a.h - bs) / 2;
        ctx.fillStyle = '#111'; roundRect(ctx, bx, by, bs, bs, 3); ctx.fill();
        ctx.fillStyle = '#FFC72C';
        ctx.beginPath(); ctx.moveTo(bx + bs * 0.28, by + bs * 0.4); ctx.lineTo(bx + bs * 0.72, by + bs * 0.4); ctx.lineTo(bx + bs / 2, by + bs * 0.66); ctx.fill();
        this.dvButton = { x: bx, y: by, w: bs, h: bs };
      } else this.dvButton = null;
      ctx.restore();
    }

    // Rendu hors écran d'une plage (export PNG / PDF)
    renderRangeImage(range, scale) {
      const sh = this.sh, z = 1;
      const savedZoom = this.zoom;
      this.zoom = 1;
      this.layout();
      const x0 = this.colPos[range.c1], y0 = this.rowPos[range.r1];
      const W = this.colPos[range.c2 + 1] - x0, H = this.rowPos[range.r2 + 1] - y0;
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(W * scale); cv.height = Math.ceil(H * scale);
      const saved = { ctx: this.ctx, sx: this.sx, sy: this.sy };
      const ctx = cv.getContext('2d');
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      this.ctx = ctx;
      this.sx = (c) => this.colPos[c] - x0;
      this.sy = (r) => this.rowPos[r] - y0;
      const covered = new Set();
      for (const m of sh.merges) for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) covered.add(r * 100000 + c);
      const g = sh.grid;
      if (this.app.exportGrid === false) sh.grid = false;
      this.paintRegion({ rows: [range.r1, range.r2], cols: [range.c1, range.c2], x: 0, y: 0, w: W, h: H }, covered);
      sh.grid = g;
      this.ctx = saved.ctx; delete this.sx; delete this.sy;
      this.zoom = savedZoom;
      this.layout();
      return cv;
    }
  }

  const REF_COLORS = ['#1a73e8', '#e8453c', '#7b1fa2', '#0f9d58', '#f57c00', '#00838f'];
  SE.REF_COLORS = REF_COLORS;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  SE.roundRect = roundRect;
  SE.Grid = Grid;
})();
