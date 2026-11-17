
(() => {
  const LS = 'djctl-layout', st = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} };
  const $ = id => document.getElementById(id), snd = $('snd'), top = $('top');
  if (st.mini) snd.classList.add('mini');
  const syncMini = () => { const b = $('sndMini'); if (b) { b.textContent = snd.classList.contains('mini') ? 'Vue contrôleur DJ' : 'Vue simple'; b.classList.toggle('on', snd.classList.contains('mini')); } };
  document.addEventListener('click', e => {
    if (e.target.id === 'sndMini') { snd.classList.toggle('mini'); st.mini = snd.classList.contains('mini'); save(); syncMini(); }
    if (e.target.id === 'btnSnd') $('splitSnd').hidden = snd.hidden;
  });
  // valeur des faders, lumière au centre
  const tick = () => {
    syncMini();
    snd.querySelectorAll('input[type=range]').forEach(i => {
      const mn = +i.min, mx = +i.max, v = +i.value;
      i.style.setProperty('--p', ((v - mn) / (mx - mn) * 100).toFixed(1));
      const c = mn < 0 && Math.abs(v) < 1e-9; i.classList.toggle('center', c);
      const k = i.parentNode.querySelector('.dj-knob'); if (k) k.classList.toggle('center', c);
      const val = i.closest('label') && i.closest('label').querySelector('.dj-val');
      if (val && mx - mn < 1) val.textContent = (v > 0 ? '+' : '') + (v * 100).toFixed(1) + ' %';
    });
    setTimeout(tick, 120);
  };
  tick();
  // redimensionnement des zones
  const drag = (el, move) => el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const mv = ev => move(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); save(); window.dispatchEvent(new Event('resize')); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
  // entre listes et timeline
  const sh = document.createElement('div'); sh.className = 'split-h'; sh.title = 'Glisser pour régler la hauteur des listes';
  top.after(sh);
  const applyTop = () => { if (st.top) top.style.flex = '0 0 ' + st.top + 'px'; };
  drag(sh, e => { st.top = Math.max(120, Math.min(window.innerHeight - 220, e.clientY - top.getBoundingClientRect().top)); applyTop(); });
  // entre bibliothèque et playlist
  const sv = document.createElement('div'); sv.className = 'split-v'; sv.title = 'Glisser pour régler la largeur';
  $('libPanel').after(sv);
  const applyCol = () => { if (st.col) top.style.gridTemplateColumns = st.col + 'px 6px 1fr'; top.style.setProperty('grid-template-columns', st.col ? st.col + 'px 6px 1fr' : '', st.col ? 'important' : ''); };
  drag(sv, e => { const r = top.getBoundingClientRect(); st.col = Math.max(200, Math.min(r.width - 200, e.clientX - r.left)); applyCol(); });
  // hauteur du panneau Son et effets
  const applySnd = () => { if (st.snd) { snd.style.maxHeight = st.snd + 'px'; snd.style.height = st.snd + 'px'; } };
  drag($('splitSnd'), e => { st.snd = Math.max(50, e.clientY - snd.getBoundingClientRect().top); applySnd(); });
  sh.addEventListener('dblclick', () => { delete st.top; top.style.flex = ''; save(); });
  sv.addEventListener('dblclick', () => { delete st.col; top.style.removeProperty('grid-template-columns'); save(); });
  $('splitSnd').addEventListener('dblclick', () => { delete st.snd; snd.style.height = snd.style.maxHeight = ''; save(); });
  applyTop(); applyCol(); applySnd();
})();
