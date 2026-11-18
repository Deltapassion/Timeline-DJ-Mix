
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
  // taille de l'affichage (réduire pour les petits écrans)
  const Z = () => parseFloat(document.documentElement.style.zoom) || 1;
  const setZoom = z => {
    z = Math.round(Math.max(0.5, Math.min(1.5, z)) * 20) / 20;
    document.documentElement.style.zoom = z === 1 ? '' : String(z);
    if (z === 1) delete st.zoom; else st.zoom = z;
    const v = $('uiZoomVal'); if (v) { v.textContent = Math.round(z * 100) + ' %'; v.hidden = z === 1; }
    save(); window.dispatchEvent(new Event('resize'));
  };
  setZoom(st.zoom || 1);
  document.addEventListener('click', e => {
    if (e.target.id === 'uiZoomOut') setZoom(Z() - 0.05);
    if (e.target.id === 'uiZoomIn') setZoom(Z() + 0.05);
    if (e.target.id === 'uiZoomVal') setZoom(1);
  });
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') { e.preventDefault(); setZoom(Z() - 0.05); }
    else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') { e.preventDefault(); setZoom(Z() + 0.05); }
    else if (e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0') { e.preventDefault(); setZoom(1); }
  }, true);
  // Ctrl + molette : taille de l'affichage (dans la timeline, Ctrl + molette reste le zoom de la timeline)
  // taille de chaque zone : listes, ligne de lecture, panneau Son et effets
  st.zz = st.zz || {};
  const ZONES = { lists: '#top', tools: '#bottom > .tools', snd: '#snd' };
  const applyZZ = () => {
    for (const z in ZONES) {
      const v = st.zz[z] || 1;
      document.documentElement.style.setProperty('--zz-' + z, String(v));
      document.querySelectorAll('.zz[data-z="' + z + '"] [data-zz="0"]').forEach(el => { el.textContent = Math.round(v * 100) + ' %'; el.hidden = v === 1; });
    }
  };
  const setZZ = (z, v) => {
    v = Math.round(Math.max(0.5, Math.min(1.5, v)) * 20) / 20;
    if (v === 1) delete st.zz[z]; else st.zz[z] = v;
    applyZZ(); save(); window.dispatchEvent(new Event('resize'));
  };
  applyZZ(); new MutationObserver(() => applyZZ()).observe(snd, { childList: true });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-zz]'); if (!b) return;
    const z = b.closest('.zz').dataset.z, v = st.zz[z] || 1, a = b.dataset.zz;
    setZZ(z, a === '0' ? 1 : v + (a === '+' ? 0.05 : -0.05));
  });
  // Ctrl + molette : agrandit la zone sous la souris (dans la timeline : zoom de la timeline ; ailleurs : tout l'affichage)
  document.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest('#tl')) return;
    e.preventDefault();
    const d = -Math.sign(e.deltaY) * 0.05;
    for (const z in ZONES) if (e.target.closest(ZONES[z])) { setZZ(z, (st.zz[z] || 1) + d); return; }
    setZoom(Z() + d);
  }, { passive: false });
  // listes en haut ou en bas de la timeline (comme Platine DUO)
  const applyLists = () => {
    document.body.classList.toggle('lists-down', !!st.listsDown);
    const b = $('btnLists'); if (b) { b.textContent = st.listsDown ? 'Listes en haut' : 'Listes en bas'; b.classList.toggle('on', !!st.listsDown); }
  };
  document.addEventListener('click', e => { if (e.target.id === 'btnLists') { st.listsDown = !st.listsDown; if (!st.listsDown) delete st.listsDown; save(); applyLists(); window.dispatchEvent(new Event('resize')); } });
  applyLists();
  // la barre de réglages du morceau garde la même hauteur d'un morceau à l'autre (la timeline ne saute plus)
  const insp = $('insp');
  if (insp && window.ResizeObserver) {
    let w = 0, hMax = 0;
    new ResizeObserver(() => {
      const cw = insp.parentNode.clientWidth;
      if (Math.abs(cw - w) > 2) { w = cw; hMax = 0; insp.style.minHeight = ''; }
      const h = insp.scrollHeight;
      if (insp.childElementCount && h > hMax) { hMax = h; insp.style.minHeight = h + 'px'; }
    }).observe(insp);
  }
  // petit écran : la liste des morceaux cède de la place pour que la timeline reste visible
  const bottom = $('bottom'), tlw = $('tlWrap');
  let fitting = false;
  const fit = () => {
    if (fitting || !bottom || !tlw || !top) return; fitting = true;
    top.style.maxHeight = ''; if (snd.dataset.auto) { snd.style.maxHeight = st.snd ? st.snd + 'px' : ''; delete snd.dataset.auto; }
    const over = () => (tlw.getBoundingClientRect().bottom - bottom.getBoundingClientRect().bottom) / Z();
    let d = over();
    if (d > 1) { top.style.maxHeight = Math.max(120, top.offsetHeight - d) + 'px'; d = over(); }
    // encore trop juste : le panneau Son et effets défile
    if (d > 1 && !snd.hidden) { snd.style.maxHeight = Math.max(90, snd.offsetHeight - d) + 'px'; snd.dataset.auto = '1'; }
    fitting = false;
  };
  window.addEventListener('resize', () => requestAnimationFrame(fit));
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => requestAnimationFrame(fit)); ro.observe(snd); const tb = document.querySelector('#bottom > .tools'); if (tb) ro.observe(tb); }
  // redimensionnement des zones
  const drag = (el, move) => el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const mv = ev => move(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); save(); window.dispatchEvent(new Event('resize')); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
  // entre listes et timeline
  const sh = document.createElement('div'); sh.className = 'split-h'; sh.id = 'splitTop'; sh.title = 'Glisser pour régler la hauteur des listes';
  top.after(sh);
  const applyTop = () => { if (st.top) top.style.flex = '0 1 ' + st.top + 'px'; };
  drag(sh, e => { st.top = Math.max(120, Math.min(window.innerHeight / Z() - 220, (st.listsDown ? top.getBoundingClientRect().bottom - e.clientY : e.clientY - top.getBoundingClientRect().top) / Z())); applyTop(); });
  // entre bibliothèque et playlist
  const sv = document.createElement('div'); sv.className = 'split-v'; sv.title = 'Glisser pour régler la largeur';
  $('libPanel').after(sv);
  const applyCol = () => { if (st.col) top.style.gridTemplateColumns = st.col + 'px 6px 1fr'; top.style.setProperty('grid-template-columns', st.col ? st.col + 'px 6px 1fr' : '', st.col ? 'important' : ''); };
  drag(sv, e => { const r = top.getBoundingClientRect(), z = Z(); st.col = Math.max(200, Math.min(r.width / z - 200, (e.clientX - r.left) / z)); applyCol(); });
  // hauteur du panneau Son et effets
  const applySnd = () => { if (st.snd) { snd.style.maxHeight = st.snd + 'px'; snd.style.height = st.snd + 'px'; } };
  drag($('splitSnd'), e => { st.snd = Math.max(50, (e.clientY - snd.getBoundingClientRect().top) / Z()); applySnd(); });
  sh.addEventListener('dblclick', () => { delete st.top; top.style.flex = ''; save(); });
  sv.addEventListener('dblclick', () => { delete st.col; top.style.removeProperty('grid-template-columns'); save(); });
  $('splitSnd').addEventListener('dblclick', () => { delete st.snd; snd.style.height = snd.style.maxHeight = ''; save(); });
  applyTop(); applyCol(); applySnd();
})();
