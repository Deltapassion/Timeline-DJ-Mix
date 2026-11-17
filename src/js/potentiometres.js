
(() => {
  const A0 = -135, A1 = 135;
  const arc = (a0, a1, r = 22) => {
    const p = a => [25 + r * Math.sin(a * Math.PI / 180), 25 - r * Math.cos(a * Math.PI / 180)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0} ${y0} A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
  };
  const knobs = [];
  function makeKnob(inp, opts = {}) {
    if (inp.dataset.djKnob) return;
    inp.dataset.djKnob = '1';
    const wrap = document.createElement('span'); wrap.className = 'dj-knobwrap';
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    const k = document.createElement('div'); k.className = 'dj-knob' + (opts.green ? ' green' : '');
    k.title = inp.title || 'Glisser vers le haut / le bas, molette. Double-clic : remise à zéro';
    k.tabIndex = 0;
    k.innerHTML = `<svg viewBox="0 0 50 50"><path class="ring-bg" d="${arc(A0, A1)}"/><path class="ring" d=""/>
      <g class="cap"><circle cx="25" cy="25" r="16" fill="url(#djKnobGrad)" stroke="#000" stroke-width="1"/>
      <circle cx="25" cy="25" r="12.5" fill="#1a1a1a" stroke="#3a3a3a" stroke-width=".8"/>
      <line x1="25" y1="14" x2="25" y2="21" stroke="#f2f2f2" stroke-width="2.4" stroke-linecap="round"/></g></svg>`;
    wrap.appendChild(k);
    const lab = inp.closest('label'); if (lab) { lab.classList.add('dj-kn'); }
    let val = null; if (lab && !opts.small) { val = document.createElement('span'); val.className = 'dj-val'; lab.appendChild(val); }
    const min = () => +inp.min || 0, max = () => (inp.max === '' ? 100 : +inp.max);
    const bipolar = min() < 0;
    const set = v => {
      const st = +inp.step || 1;
      v = Math.min(max(), Math.max(min(), v));
      v = Math.round(v / st) * st;
      if (+inp.value === v) return;
      inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const ring = k.querySelector('.ring'), cap = k.querySelector('.cap');
    let last = null;
    const draw = () => {
      const v = +inp.value; if (v === last) return; last = v;
      const t = (v - min()) / (max() - min()), a = A0 + t * (A1 - A0);
      cap.style.transform = `rotate(${a}deg)`;
      const from = bipolar ? 0 : A0;
      ring.setAttribute('d', Math.abs(a - from) < 0.5 ? '' : arc(Math.min(from, a), Math.max(from, a)));
      if (val) val.textContent = bipolar ? (v > 0 ? '+' : '') + Math.round(v * 100) : Math.round(t * 100);
    };
    let drag = null;
    k.addEventListener('pointerdown', e => { e.preventDefault(); k.setPointerCapture(e.pointerId); drag = { y: e.clientY, v: +inp.value }; k.focus(); });
    k.addEventListener('pointermove', e => {
      if (!drag) return;
      const range = max() - min(), fine = e.shiftKey ? 0.2 : 1;
      set(drag.v + (drag.y - e.clientY) / 150 * range * fine);
    });
    const end = () => { drag = null; };
    k.addEventListener('pointerup', end); k.addEventListener('pointercancel', end);
    k.addEventListener('wheel', e => { e.preventDefault(); set(+inp.value - Math.sign(e.deltaY) * (max() - min()) / 40); }, { passive: false });
    k.addEventListener('keydown', e => {
      const s = (max() - min()) / 40;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { set(+inp.value + s); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { set(+inp.value - s); e.preventDefault(); }
    });
    k.addEventListener('dblclick', e => {
      e.preventDefault(); e.stopPropagation();
      if (inp.dataset.snd) inp.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      else set(+inp.defaultValue);
    });
    knobs.push({ inp, draw }); draw();
  }
  function enhance() {
    const snd = document.getElementById('snd'); if (!snd) return;
    snd.querySelectorAll('input[type=range]').forEach(inp => {
      const k = inp.dataset.snd || '';
      if (/\.vol$/.test(k)) inp.closest('label').classList.add('dj-fader');
      else if (k === 'xf') { /* crossfader horizontal, géré en CSS */ }
      else makeKnob(inp);
    });
    const mv = document.getElementById('mvol'); if (mv) makeKnob(mv, { small: true });
  }
  // dégradé partagé des capuchons
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', 0); defs.setAttribute('height', 0); defs.style.position = 'absolute';
  defs.innerHTML = '<defs><radialGradient id="djKnobGrad" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#6b6b6b"/><stop offset=".6" stop-color="#2a2a2a"/><stop offset="1" stop-color="#0d0d0d"/></radialGradient></defs>';
  const start = () => {
    document.body.appendChild(defs);
    enhance();
    const snd = document.getElementById('snd');
    if (snd) new MutationObserver(enhance).observe(snd, { childList: true, subtree: true });
    // suit les changements faits par le programme ou le contrôleur MIDI
    const loop = () => { for (let i = knobs.length - 1; i >= 0; i--) { if (!knobs[i].inp.isConnected) knobs.splice(i, 1); else knobs[i].draw(); } requestAnimationFrame(loop); };
    loop();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
