/* SuperEssence Sheets — composants d'interface (modales, menus, toasts) */
(function () {
  'use strict';
  const SE = window.SE;
  const $ = (s, el) => (el || document).querySelector(s);
  SE.$ = $;
  SE.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  SE.h = function (html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  SE.toast = function (msg, kind) {
    const el = SE.h('<div class="toast ' + (kind || '') + '">' + SE.esc(msg) + '</div>');
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, kind === 'err' ? 3800 : 2200);
  };

  const stack = [];
  SE.modal = function (o) {
    const ov = $('#overlay');
    const m = SE.h('<div class="modal ' + (o.wide ? 'wide' : '') + '"><div class="modal-head">' + (o.icon ? '<div class="mi">' + SE.icon(o.icon, 18) + '</div>' : '') + '<h3>' + SE.esc(o.title || '') + '</h3><button class="icon-btn small" data-x>' + SE.icon('x', 18) + '</button></div><div class="modal-body"></div>' + (o.buttons && o.buttons.length ? '<div class="modal-foot"></div>' : '') + '</div>');
    const body = m.querySelector('.modal-body');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    const close = (val) => {
      const i = stack.indexOf(m);
      if (i >= 0) stack.splice(i, 1);
      m.remove();
      if (!stack.length) ov.classList.add('hidden');
      else stack[stack.length - 1].classList.remove('hidden');
      o.onClose && o.onClose(val);
    };
    m.close = close;
    m.querySelector('[data-x]').onclick = () => close(null);
    if (o.buttons) {
      const foot = m.querySelector('.modal-foot');
      o.buttons.forEach((b) => {
        const btn = SE.h('<button class="btn ' + (b.cls || '') + '">' + (b.icon ? SE.icon(b.icon, 16) : '') + SE.esc(b.label) + '</button>');
        btn.onclick = () => { const r = b.onClick ? b.onClick(m) : undefined; if (r !== false) close(b.value); };
        foot.appendChild(btn);
      });
    }
    stack.forEach((x) => x.classList.add('hidden'));
    stack.push(m);
    ov.appendChild(m);
    ov.classList.remove('hidden');
    // anti « clic fantôme » après un toucher
    const opened = Date.now();
    m.style.pointerEvents = 'none';
    setTimeout(() => { m.style.pointerEvents = ''; }, 380);
    ov.onclick = (e) => { if (e.target === ov && stack.length && Date.now() - opened > 400) stack[stack.length - 1].close(null); };
    o.onOpen && o.onOpen(m);
    return m;
  };
  SE.closeAllModals = () => { while (stack.length) stack[stack.length - 1].close(null); };
  SE.modalOpen = () => stack.length > 0;

  SE.confirm = (title, text, okLabel, danger) => new Promise((res) => {
    SE.modal({ title, body: '<p class="hint">' + SE.esc(text) + '</p>', buttons: [{ label: 'Annuler', value: false }, { label: okLabel || 'OK', cls: danger ? 'danger' : 'primary', value: true }], onClose: (v) => res(!!v) });
  });

  SE.prompt = (title, label, value, opts) => new Promise((res) => {
    let result = null;
    const m = SE.modal({
      title, icon: opts && opts.icon,
      body: '<div class="field"><label>' + SE.esc(label) + '</label><input type="' + ((opts && opts.type) || 'text') + '" value="' + SE.esc(value || '') + '"></div>' + (opts && opts.hint ? '<p class="hint">' + opts.hint + '</p>' : ''),
      buttons: [{ label: 'Annuler' }, { label: 'Valider', cls: 'primary', onClick: (mm) => { result = mm.querySelector('input').value; } }],
      onClose: () => res(result)
    });
    const inp = m.querySelector('input');
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
    inp.onkeydown = (e) => { if (e.key === 'Enter') { result = inp.value; m.close(true); } };
  });

  // Menu contextuel / liste d'actions
  SE.menu = function (x, y, items) {
    document.querySelectorAll('.ctx').forEach((e) => e.remove());
    const el = SE.h('<div class="ctx"></div>');
    items.forEach((it) => {
      if (it === '-') { el.appendChild(document.createElement('hr')); return; }
      if (!it) return;
      const b = SE.h('<button>' + (it.icon ? SE.icon(it.icon, 16) : '<span style="width:16px"></span>') + '<span>' + SE.esc(it.label) + '</span>' + (it.key ? '<span class="kbd" style="margin-left:auto">' + it.key + '</span>' : '') + '</button>');
      b.onclick = () => { el.remove(); cleanup(); it.run(); };
      el.appendChild(b);
    });
    document.body.appendChild(el);
    el.style.pointerEvents = 'none';
    setTimeout(() => { el.style.pointerEvents = ''; }, 380);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(6, Math.min(x, innerWidth - r.width - 6)) + 'px';
    el.style.top = Math.max(6, Math.min(y, innerHeight - r.height - 6)) + 'px';
    const off = (e) => { if (!el.contains(e.target)) { el.remove(); cleanup(); } };
    const cleanup = () => { document.removeEventListener('pointerdown', off, true); };
    setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    return el;
  };

  SE.SWATCHES = ['#000000', '#3F3F46', '#71717A', '#A1A1AA', '#D4D4D8', '#F4F4F5', '#FFFFFF', '#FFC72C', '#FFE38A', '#FFF4D1',
    '#C62828', '#E53935', '#EF9A9A', '#FDE2E1', '#EF6C00', '#FB8C00', '#FFCC80', '#FFF3E0', '#F9A825', '#FFF59D',
    '#2E7D32', '#43A047', '#A5D6A7', '#DFF5E3', '#00838F', '#00ACC1', '#80DEEA', '#E0F7FA', '#1A5FD0', '#1E88E5',
    '#90CAF9', '#E3EEFF', '#6A1B9A', '#8E24AA', '#CE93D8', '#F3E5F5', '#AD1457', '#D81B60', '#F48FB1', '#FCE4EC'];
  SE.pickColor = (title, allowNone) => new Promise((res) => {
    let val;
    const body = SE.h('<div><div class="swatches">' + (allowNone ? '<button class="none" data-c="" title="Aucune"></button>' : '') + SE.SWATCHES.map((c) => '<button style="background:' + c + '" data-c="' + c + '"></button>').join('') + '</div><div class="field" style="margin-top:14px"><label>Personnalisée</label><input type="color" value="#FFC72C" style="height:44px;padding:4px"></div></div>');
    const m = SE.modal({ title, icon: 'palette', body, buttons: [{ label: 'Utiliser la couleur personnalisée', onClick: (mm) => { val = mm.querySelector('input').value; } }], onClose: () => res(val) });
    body.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { val = b.dataset.c; m.close(true); }));
  });
})();
