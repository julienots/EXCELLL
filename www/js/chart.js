/* SuperEssence Sheets — graphiques canvas (ligne, barres, aire, secteurs) */
(function () {
  'use strict';
  const SE = window.SE;
  const PALETTE = ['#F5B400', '#111114', '#1A5FD0', '#E53935', '#43A047', '#8E24AA', '#00ACC1', '#FB8C00'];
  SE.CHART_PALETTE = PALETTE;

  function rangeValues(app, si, rg) {
    const out = [];
    if (!rg) return out;
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) out.push(app.calc.value(si, r, c));
    return out;
  }

  SE.chartData = function (app, si, spec) {
    const labels = rangeValues(app, si, spec.labels).map((v, i) => {
      if (v === null || v === undefined || v === '') return String(i + 1);
      if (typeof v === 'number' && v > 30000 && v < 80000) return SE.formatValue(v, 'dated').slice(5);
      return SE.formatValue(v, '');
    });
    const series = (spec.series || []).map((s, i) => ({
      name: s.name || 'Série ' + (i + 1),
      color: s.color || PALETTE[i % PALETTE.length],
      values: rangeValues(app, si, s).map((v) => (typeof v === 'number' ? v : v === null || v === '' ? null : SE.parseNumberLiteral(String(v))))
    }));
    const n = Math.max(labels.length, ...series.map((s) => s.values.length), 0);
    while (labels.length < n) labels.push(String(labels.length + 1));
    return { labels, series };
  };

  function niceStep(range, ticks) {
    const raw = range / ticks;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m >= 5 ? 10 : m >= 2 ? 5 : m >= 1 ? 2 : 1) * p;
  }
  const fmtTick = (v) => (Math.abs(v) >= 10000 ? SE.fixed(v / 1000, 0) + 'k' : SE.fmtGeneral(Math.round(v * 100) / 100));

  SE.drawChart = function (canvas, spec, data, W, H) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const font = (w, s) => w + ' ' + s + 'px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    // titre
    ctx.fillStyle = '#111'; ctx.font = font(800, 14); ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText(spec.title || '', 14, 12);
    ctx.fillStyle = '#FFC72C'; ctx.fillRect(14, 31, 28, 3);
    const top = 46;
    if (!data.series.length || !data.labels.length) {
      ctx.fillStyle = '#999'; ctx.font = font(500, 13); ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée', W / 2, H / 2);
      return;
    }
    if (spec.type === 'pie') return drawPie(ctx, spec, data, W, H, top, font);
    // légende
    let lx = 14;
    const ly = H - 20;
    ctx.font = font(600, 11); ctx.textBaseline = 'middle';
    if (data.series.length > 1 || spec.legend) {
      data.series.forEach((s) => {
        ctx.fillStyle = s.color; ctx.fillRect(lx, ly - 5, 10, 10);
        ctx.fillStyle = '#444'; ctx.textAlign = 'left'; ctx.fillText(s.name, lx + 14, ly);
        lx += 24 + ctx.measureText(s.name).width;
      });
    }
    const bottom = H - (data.series.length > 1 || spec.legend ? 50 : 32);
    const all = data.series.flatMap((s) => s.values).filter((v) => v !== null && isFinite(v));
    let mn = Math.min(0, ...all), mx = Math.max(...all, 0);
    if (spec.type === 'line' && all.length) { const lo = Math.min(...all), hi = Math.max(...all); if (lo > 0 && (hi - lo) / hi < 0.5) { mn = lo - (hi - lo) * 0.15; mx = hi + (hi - lo) * 0.15; } }
    if (mx === mn) mx = mn + 1;
    const step = niceStep(mx - mn, 4);
    mn = Math.floor(mn / step) * step; mx = Math.ceil(mx / step) * step;
    ctx.font = font(500, 11);
    let axisW = 0;
    for (let v = mn; v <= mx + step / 2; v += step) axisW = Math.max(axisW, ctx.measureText(fmtTick(v)).width);
    const left = 18 + axisW, right = W - 16;
    const y = (v) => bottom - ((v - mn) / (mx - mn)) * (bottom - top);
    // grille
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let v = mn; v <= mx + step / 2; v += step) {
      const yy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = v === 0 ? '#bbb' : '#eee'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, yy); ctx.lineTo(right, yy); ctx.stroke();
      ctx.fillStyle = '#777'; ctx.fillText(fmtTick(v), left - 6, yy);
    }
    const n = data.labels.length;
    const bw = (right - left) / n;
    // étiquettes X
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#666';
    const every = Math.ceil(n / Math.max(1, Math.floor((right - left) / 54)));
    data.labels.forEach((l, i) => { if (i % every === 0) ctx.fillText(String(l).slice(0, 10), left + bw * (i + 0.5), bottom + 6); });
    if (spec.type === 'bar') {
      const k = data.series.length, gw = bw * 0.72, sw = gw / k;
      data.series.forEach((s, si) => {
        ctx.fillStyle = s.color;
        s.values.forEach((v, i) => {
          if (v === null || !isFinite(v)) return;
          const x = left + bw * i + (bw - gw) / 2 + sw * si;
          const y0 = y(Math.max(0, mn)), y1 = y(v);
          SE.roundRect(ctx, x + 1, Math.min(y0, y1), Math.max(1, sw - 2), Math.max(1, Math.abs(y1 - y0)), Math.min(4, sw / 3));
          ctx.fill();
        });
      });
    } else {
      data.series.forEach((s) => {
        const pts = s.values.map((v, i) => (v === null || !isFinite(v) ? null : [left + bw * (i + 0.5), y(v)])).filter(Boolean);
        if (!pts.length) return;
        if (spec.type === 'area') {
          const g = ctx.createLinearGradient(0, top, 0, bottom);
          g.addColorStop(0, s.color + '66'); g.addColorStop(1, s.color + '05');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(pts[0][0], bottom);
          pts.forEach((p) => ctx.lineTo(p[0], p[1]));
          ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = s.color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
        pts.forEach((p) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
      });
    }
  };

  function drawPie(ctx, spec, data, W, H, top, font) {
    const s = data.series[0];
    const vals = s.values.map((v) => (v && v > 0 ? v : 0));
    const total = vals.reduce((a, b) => a + b, 0);
    if (!total) { ctx.fillStyle = '#999'; ctx.textAlign = 'center'; ctx.fillText('Aucune donnée', W / 2, H / 2); return; }
    const legendW = Math.min(170, W * 0.42);
    const R = Math.min((W - legendW - 30) / 2, (H - top - 16) / 2);
    const cx = 16 + R, cy = top + (H - top) / 2 - 4;
    let a = -Math.PI / 2;
    vals.forEach((v, i) => {
      const da = (v / total) * Math.PI * 2;
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a, a + da); ctx.closePath(); ctx.fill();
      a += da;
    });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = font(800, 15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(SE.fmtGeneral(Math.round(total * 10) / 10), cx, cy);
    ctx.font = font(500, 12); ctx.textAlign = 'left';
    const lx = cx + R + 18;
    let ly = top + 6;
    data.labels.forEach((l, i) => {
      if (!vals[i] || ly > H - 10) return;
      ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.fillRect(lx, ly, 10, 10);
      ctx.fillStyle = '#333'; ctx.textBaseline = 'top';
      ctx.fillText(String(l).slice(0, 16) + ' · ' + Math.round((vals[i] / total) * 100) + '%', lx + 15, ly - 1);
      ly += 19;
    });
  }
})();
