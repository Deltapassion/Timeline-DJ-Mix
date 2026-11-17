(() => {
  'use strict';
  const Core = CoreFactory();
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = n => String(n).padStart(2, '0');
  function fmtT(t, dec) {
    t = Math.max(0, t || 0);
    const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    const ss = dec ? (s < 10 ? '0' : '') + (Math.floor(s * 10) / 10).toFixed(1) : pad2(Math.floor(s));
    return (h ? h + ':' : '') + pad2(m) + ':' + ss;
  }
  let uidN = 0;
  const uid = () => 'x' + Date.now().toString(36) + (uidN++).toString(36);
  const SR = 44100, LSKEY = 'timeline-dj-mix-v1', LSOLD = 'fondu-enchaine-v1', LSSET = 'timeline-dj-mix-reglages';
  const TYPES = { beat: 'Fondu calé', bass: 'Échange des basses', quick: 'Entrée franche', fade: 'Fondu simple, sans calage', cut: 'Coupe' };
  const PDEF = ['Salsa', 'Bachata', 'Kizomba', 'Semba', 'Tango', 'Reggaeton'];
  const SND0 = () => ({ a: { vol: 1, lo: 0, mid: 0, hi: 0, flt: 0, tmp: 0 }, b: { vol: 1, lo: 0, mid: 0, hi: 0, flt: 0, tmp: 0 }, xf: 0, echo: 0, flg: 0, rev: 0, exp: false });

  const S = { tracks: [], playlist: [], sel: null, curve: 'vol', snap: 4, pps: 6, playhead: 0, sort: { k: 'title', dir: 1 }, q: '', libSel: null, auto: false, snd: SND0(), midi: {}, cuePos: 0, out: { master: '', mode: 'quad', cue: '' }, bg: '#12161d',
    party: { shuffle: true, mins: 60, styles: PDEF.map(name => ({ name, count: 3, en: true })) } };
  let lay = Core.computeLayout([]), autoCache = [];
  const T = id => S.tracks.find(t => t.id === id);

  /* ================= Langues ================= */
  const LANGS = [['fr', 'Français'], ['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['it', 'Italiano'], ['de', 'Deutsch'], ['el', 'Ελληνικά'], ['ru', 'Русский'], ['zh', '中文'], ['ja', '日本語']];
  const L10N = { lang: 'fr', exact: new Map(), tpl: [], data: null };
  try { L10N.data = JSON.parse($('i18n-data').textContent); } catch (e) { L10N.data = null; }
  const norm = x => x.replace(/[\s ]+/g, ' ').trim();
  function setLang(l) {
    if (!L10N.data || !L10N.data[l]) l = 'fr';
    L10N.lang = l; L10N.exact = new Map(); L10N.tpl = [];
    if (l !== 'fr') {
      const fr = L10N.data.fr, to = L10N.data[l];
      fr.forEach((k, i) => {
        if (/\{\w\}/.test(k)) {
          const names = [];
          const re = new RegExp('^' + norm(k).replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\w)\\?\}/g, (m, n) => { names.push(n); return '(.+?)'; }) + '$');
          L10N.tpl.push({ re, names, out: to[i] });
        } else L10N.exact.set(norm(k), to[i]);
      });
      L10N.tpl.sort((a, b) => b.re.source.length - a.re.source.length);
    }
    document.documentElement.lang = l;
  }
  /* Traduit un texte français affiché ; ce qui n'est pas connu reste tel quel */
  function i18n(str) {
    if (L10N.lang === 'fr' || str == null) return str;
    const m = /^([\s ]*)([\s\S]*?)([\s ]*)$/.exec(String(str)), core = norm(m[2]);
    if (!core) return str;
    let out = L10N.exact.get(core);
    if (out == null) for (const t of L10N.tpl) {
      const r = t.re.exec(core); if (!r) continue;
      const v = {}; t.names.forEach((n, j) => { v[n] = n === 'x' ? i18n(r[j + 1]) : r[j + 1]; });
      out = t.out.replace(/\{(\w)\}/g, (x, n) => (v[n] != null ? v[n] : x)); break;
    }
    return out == null ? str : m[1] + out + m[3];
  }
  const ATTRS = ['title', 'aria-label', 'placeholder', 'label'];
  function trText(n) {
    const cur = n.nodeValue;
    if (cur === n.__out) return;
    n.__fr = cur; const o = i18n(cur); n.__out = o;
    if (o !== cur) n.nodeValue = o;
  }
  function trEl(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a), st = el.__fra || (el.__fra = {});
      if (st[a] && cur === st[a].out) continue;
      const o = i18n(cur); st[a] = { fr: cur, out: o };
      if (o !== cur) el.setAttribute(a, o);
    }
  }
  const skip = n => { const p = n.nodeType === 1 ? n : n.parentElement; return !p || !!p.closest('script,style,textarea,[translate="no"]'); };
  function trTree(root) {
    if (!root || skip(root)) return;
    if (root.nodeType === 3) { if (/\S/.test(root.nodeValue)) trText(root); return; }
    if (root.nodeType !== 1) return;
    trEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, { acceptNode: n => (n.nodeType === 1 ? (n.matches('script,style,textarea,[translate="no"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) : (/\S/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP)) });
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) trText(n); else trEl(n); }
  }
  /* Retour au français (ou changement de langue) : chaque texte repart de son original */
  function retranslate() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) { if (n.__fr != null && n.nodeValue === n.__out) n.nodeValue = n.__fr; n.__out = undefined; }
      else if (n.__fra) { for (const a in n.__fra) if (n.getAttribute(a) === n.__fra[a].out) n.setAttribute(a, n.__fra[a].fr); n.__fra = null; }
    }
    trTree(document.body);
  }
  const trObs = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'childList') r.addedNodes.forEach(trTree);
      else if (r.type === 'characterData') { if (!skip(r.target)) trText(r.target); }
      else if (r.type === 'attributes') { if (!skip(r.target)) trEl(r.target); }
    }
    trObs.takeRecords();
  });
  function startI18n() {
    const want = S.lang || (navigator.languages || [navigator.language || 'fr']).map(x => String(x).slice(0, 2).toLowerCase()).find(x => LANGS.some(l => l[0] === x)) || 'fr';
    setLang(want);
    const sel = $('langSel');
    sel.innerHTML = LANGS.map(l => `<option value="${l[0]}">${l[1]}</option>`).join(''); sel.value = L10N.lang;
    sel.onchange = () => { S.lang = sel.value; setLang(S.lang); changed(true); retranslate(); saveSettings(); draw(); };
    trTree(document.body);
    trObs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  const selIndex = () => S.playlist.findIndex(it => it.id === S.sel);

  function status(m) { $('status').textContent = m; }
  let toastT = 0;
  function toast(m) { const e = $('toast'); e.textContent = m; e.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { e.style.display = 'none'; }, 4200); }

  /* ================= Morceaux de démonstration ================= */
  const DEMOS = [
    { title: 'Marché de nuit', bpm: 96, root: 9, minor: true, prog: [0, 5, 0, 7] },
    { title: 'Quai n° 3', bpm: 100, root: 0, minor: false, prog: [0, 5, 7, 0] },
    { title: 'Dernier tram', bpm: 104, root: 4, minor: true, prog: [0, 5, 0, 7] }
  ];
  function renderDemo(d) {
    const beat = 60 / d.bpm, bars = 40, t0 = 0.06, n = Math.ceil((t0 + bars * 4 * beat + 0.6) * SR), x = new Float32Array(n), TAU = 2 * Math.PI;
    let seed = 12345 + d.bpm;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    const sine = (t, f, g, len) => {
      const i0 = Math.floor(t * SR), m = Math.floor(len * SR), w = TAU * f / SR, att = 0.008 * SR, rel = m * 0.3;
      for (let i = 0; i < m && i0 + i < n; i++) x[i0 + i] += g * Math.min(1, i / att, (m - i) / rel) * Math.sin(w * i);
    };
    const noise = (t, g, len, hp) => {
      const i0 = Math.floor(t * SR), m = Math.floor(len * SR * 4), k = 1 / (len * SR); let p = 0;
      for (let i = 0; i < m && i0 + i < n; i++) { const v = rnd(); x[i0 + i] += g * Math.exp(-i * k) * (hp ? v - p : (v + p) * 0.5); p = v; }
    };
    for (let k = 0; k < bars * 4; k++) {
      const t = t0 + k * beat, bar = Math.floor(k / 4), inBar = k % 4, body = bar >= 8 && bar < 32, i0 = Math.floor(t * SR), amp = inBar === 0 ? 0.9 : 0.66;
      for (let i = 0, ph = 0; i < 0.3 * SR && i0 + i < n; i++) { const tt = i / SR; ph += TAU * (46 + 104 * Math.exp(-tt * 32)) / SR; x[i0 + i] += amp * Math.exp(-tt * 15) * Math.sin(ph); }
      noise(t + beat / 2, 0.1, 0.012, true);
      if (bar >= 4 && (inBar === 1 || inBar === 3)) noise(t, 0.22, 0.03, false);
      if (body) {
        const deg = d.prog[bar % 4], pc = (d.root + deg) % 12, f = 55 * Math.pow(2, ((pc + 3) % 12) / 12), third = d.minor && deg !== 7 ? 3 : 4;
        sine(t + beat / 2, f * 2, 0.24, beat * 0.45);
        if (inBar !== 0) sine(t, f * 2, 0.18, beat * 0.4);
        if (inBar === 0) for (const st of [0, third, 7, 12]) sine(t, f * 4 * Math.pow(2, st / 12), st === third ? 0.08 : 0.055, beat * 3.9);
      }
    }
    const buf = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: SR });
    for (let i = 0; i < n; i++) x[i] *= 0.8;
    buf.copyToChannel(x, 0); buf.copyToChannel(x, 1);
    return Promise.resolve(buf);
  }

  /* ================= Fichiers audio gardés par le navigateur, pour les retrouver à la réouverture ================= */
  const FDB = {
    db: null, warned: false, chain: Promise.resolve(),
    open() {
      if (this.db !== null) return Promise.resolve(this.db);
      return new Promise(res => {
        try { const r = indexedDB.open('timeline-dj-mix-fichiers', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(this.db = r.result); r.onerror = () => res(this.db = false); r.onblocked = () => res(this.db = false); }
        catch (e) { res(this.db = false); }
      });
    },
    async tx(mode, fn) {
      const db = await this.open(); if (!db) return undefined;
      return new Promise(res => { try { const t = db.transaction('f', mode), rq = fn(t.objectStore('f')); t.oncomplete = () => res(rq ? rq.result : true); t.onerror = t.onabort = () => res(undefined); } catch (e) { res(undefined); } });
    },
    /* les copies se font l'une après l'autre, en arrière-plan */
    put(id, file) {
      this.chain = this.chain.then(async () => {
        try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); if (e.quota && e.usage + file.size > e.quota * 0.85) throw new Error('quota'); } } catch (e) { if (e.message === 'quota') { if (!this.warned) { this.warned = true; toast('Le navigateur n\'a plus assez de place pour garder tous les fichiers : certains seront à réimporter à la prochaine ouverture.'); } return; } }
        if ((await this.tx('readwrite', st => st.put(file, id))) === undefined && !this.warned && this.db) { this.warned = true; toast('Le navigateur n\'a pas pu garder ce fichier : il sera à réimporter à la prochaine ouverture.'); }
      });
    },
    get(id) { return this.tx('readonly', st => st.get(id)); },
    del(id) { return this.tx('readwrite', st => st.delete(id)); },
    clear() { return this.tx('readwrite', st => st.clear()); }
  };
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* facultatif */ }
  async function restoreFiles() {
    let n = 0, miss = 0;
    for (const tr of S.tracks.slice()) {
      if (tr.file || tr.demo != null) continue;
      const f = await FDB.get(tr.id);
      if (f && f.size && S.tracks.includes(tr) && !tr.file) { tr.file = f; tr.status = 'wait'; queue.push({ tr, full: tr.bpm == null }); n++; } else if (!tr.file) miss++;
    }
    if (n) { renderLib(); pump(); }
    if (miss) toast(miss + (miss > 1 ? ' morceaux n\'ont' : ' morceau n\'a') + ' pas pu être retrouvé' + (miss > 1 ? 's' : '') + ' : réimportez les fichiers marqués « à réimporter » pour les écouter.');
  }

  /* ================= Décodage, cache des tampons ================= */
  let decCtx = null;
  function decodeAiff(ab) {
    const d = new DataView(ab), id = o => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
    let ch = 0, frames = 0, bits = 0, rate = 0, le = false, data = -1;
    for (let p = 12; p + 8 <= d.byteLength;) {
      const ck = id(p), sz = d.getUint32(p + 4);
      if (ck === 'COMM') {
        ch = d.getUint16(p + 8); frames = d.getUint32(p + 10); bits = d.getUint16(p + 14);
        rate = d.getUint32(p + 18) * Math.pow(2, (d.getUint16(p + 16) & 0x7fff) - 16383 - 31);
        if (sz > 18) { const c = id(p + 26); if (c === 'sowt') le = true; else if (c !== 'NONE' && c !== 'twos') throw new Error('AIFF compressé'); }
      } else if (ck === 'SSND') data = p + 16 + d.getUint32(p + 8);
      p += 8 + sz + (sz & 1);
    }
    const by = bits >> 3;
    if (!ch || data < 0 || by < 1 || by > 4 || !(rate > 3000)) throw new Error('AIFF illisible');
    frames = Math.min(frames, Math.floor((d.byteLength - data) / (by * ch)));
    const buf = new AudioBuffer({ length: Math.max(1, frames), numberOfChannels: Math.min(2, ch), sampleRate: Math.round(rate) });
    for (let c = 0; c < Math.min(2, ch); c++) {
      const out = buf.getChannelData(c);
      for (let i = 0, p = data + c * by; i < frames; i++, p += by * ch)
        out[i] = by === 1 ? d.getInt8(p) / 128 : by === 2 ? d.getInt16(p, le) / 32768 : by === 3 ? (le ? (d.getInt8(p + 2) << 16 | d.getUint16(p, true)) : (d.getInt8(p) << 16 | d.getUint16(p + 1))) / 8388608 : d.getInt32(p, le) / 2147483648;
    }
    return buf;
  }
  function decode(ab) {
    const h = new Uint8Array(ab, 0, Math.min(12, ab.byteLength));
    if (h.length === 12 && h[0] === 70 && h[1] === 79 && h[2] === 82 && h[3] === 77 && h[8] === 65 && h[9] === 73 && h[10] === 70) return Promise.resolve(decodeAiff(ab));
    if (!decCtx) decCtx = new OfflineAudioContext(2, 2, SR);
    return decCtx.decodeAudioData(ab);
  }
  const bufs = new Map(), loading = new Map();
  let exportNeed = new Set();
  async function loadBuffer(tr) {
    if (tr.demo != null) return renderDemo(DEMOS[tr.demo]);
    if (!tr.file) throw new Error('fichier manquant');
    return decode(await tr.file.arrayBuffer());
  }
  function neededSet() {
    const s = new Set(exportNeed), t = mixNow();
    S.playlist.forEach((it, i) => { const L = lay.items[i]; if (L && lay.b2t(L.mb1) > t - 2 && lay.b2t(L.mb0) < t + 100) s.add(it.tid); });
    for (const id of Q.tids) s.add(id);
    return s;
  }
  function cachePut(id, b) {
    bufs.delete(id); bufs.set(id, b);
    if (bufs.size <= 4) return;
    const n = neededSet(); n.add(id);
    for (const k of [...bufs.keys()]) { if (bufs.size <= 4) break; if (!n.has(k)) bufs.delete(k); }
  }
  function getBuffer(tr) {
    if (bufs.has(tr.id)) return Promise.resolve(bufs.get(tr.id));
    if (loading.has(tr.id)) return loading.get(tr.id);
    const p = loadBuffer(tr).then(b => { loading.delete(tr.id); cachePut(tr.id, b); return b; }, e => { loading.delete(tr.id); throw e; });
    loading.set(tr.id, p);
    return p;
  }

  /* ================= Analyse ================= */
  let worker = null, wSeq = 0;
  const wJobs = new Map();
  function analyzeAsync(x, sr) {
    return new Promise(res => {
      if (worker === null) {
        try {
          const src = 'const Core=(' + CoreFactory.toString() + ')();onmessage=e=>{postMessage({id:e.data.id,r:Core.analyze(e.data.x,e.data.sr)});};';
          worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
          worker.onmessage = e => { const j = wJobs.get(e.data.id); wJobs.delete(e.data.id); if (j) j.res(e.data.r); };
          worker.onerror = () => { worker = false; for (const j of wJobs.values()) j.res(Core.analyze(j.x, j.sr)); wJobs.clear(); };
        } catch (e) { worker = false; }
      }
      if (!worker) return res(Core.analyze(x, sr));
      const id = ++wSeq; wJobs.set(id, { x, sr, res }); worker.postMessage({ id, x, sr });
    });
  }
  const minIn = tr => Math.ceil(-tr.grid0 * tr.bpm / 60 - 1e-6);
  const maxOut = tr => Math.floor((tr.dur - tr.grid0) * tr.bpm / 60 + 1e-6);
  function gridDefaults(tr) {
    const bps = tr.bpm / 60, b = (tr.aStart - tr.grid0) * bps, r = Math.round(b / 4) * 4;
    let a = Math.abs(b - r) < 0.6 ? r : Math.floor(b / 4) * 4;
    while (a < minIn(tr)) a += 4;
    const top = Math.floor(maxOut(tr) / 4) * 4;
    let o = Math.min(top, Math.floor(((tr.aEnd - tr.grid0) * bps + 0.6) / 4) * 4);
    if (o < a + 16) o = Math.max(top, a + 4);
    return { sbIn: a, sbOut: o };
  }
  async function analyzeTrack(tr, buf, full) {
    const ch = []; for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) ch.push(buf.getChannelData(c));
    tr.dur = buf.duration;
    tr.peaks = Core.peaks(ch, buf.sampleRate, 100);
    let mx = 0; for (let i = 0; i < tr.peaks.length; i++) if (tr.peaks[i] > mx) mx = tr.peaks[i];
    let a = 0, e = tr.peaks.length - 1;
    while (a < e && tr.peaks[a] < 0.05 * mx) a++;
    while (e > a && tr.peaks[e] < 0.08 * mx) e--;
    tr.aStart = a / 100; tr.aEnd = (e + 1) / 100;
    if (full) { const d = Core.decimate(ch, buf.sampleRate); Object.assign(tr, await analyzeAsync(d.x, d.sr)); }
  }
  const queue = [];
  let busy = false;
  async function pump() {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const job = queue.shift(), tr = job.tr;
      if (!S.tracks.includes(tr)) continue;
      try {
        status('Analyse : ' + tr.title + '…'); tr.status = 'work'; renderLib();
        const buf = await loadBuffer(tr);
        await analyzeTrack(tr, buf, job.full);
        tr.status = 'ok'; cachePut(tr.id, buf);
        if (job.then) job.then(tr);
      } catch (e) { tr.status = 'err'; console.error(e); toast('Ce navigateur ne sait pas lire ce format : ' + tr.name); }
      if (tr._wait) { const w = tr._wait; tr._wait = null; w.forEach(r => r()); }
      changed(true);
    }
    busy = false; status('Prêt');
  }

  function ensureAnalyzed(tr) {
    if (tr.status === 'ok' && tr.bpm != null) return Promise.resolve();
    const k = queue.findIndex(j => j.tr === tr);
    if (k < 0) return Promise.resolve();
    queue.unshift(queue.splice(k, 1)[0]);
    return new Promise(r => { (tr._wait = tr._wait || []).push(r); pump(); });
  }

  /* ================= Étiquettes ID3v2 (titre, artiste) ================= */
  function readTags(u8) {
    const out = {};
    if (u8.length < 10 || u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) return out;
    const ver = u8[3], size = Math.min(u8.length, 10 + ((u8[6] & 127) << 21 | (u8[7] & 127) << 14 | (u8[8] & 127) << 7 | (u8[9] & 127)));
    const text = (a, b) => {
      const enc = u8[a]; let d = u8.subarray(a + 1, b), lab = 'iso-8859-1';
      if (enc === 3) lab = 'utf-8';
      else if (enc === 1 || enc === 2) { lab = 'utf-16le'; if (d[0] === 0xFE && d[1] === 0xFF) { lab = 'utf-16be'; d = d.subarray(2); } else if (d[0] === 0xFF && d[1] === 0xFE) d = d.subarray(2); else if (enc === 2) lab = 'utf-16be'; }
      return new TextDecoder(lab).decode(d).replace(/\0/g, '').trim();
    };
    let p = 10;
    while (p + (ver === 2 ? 6 : 10) < size) {
      let id, len, hs;
      if (ver === 2) { id = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2]); len = u8[p + 3] << 16 | u8[p + 4] << 8 | u8[p + 5]; hs = 6; }
      else {
        id = String.fromCharCode(u8[p], u8[p + 1], u8[p + 2], u8[p + 3]); hs = 10;
        len = ver === 4 ? (u8[p + 4] & 127) << 21 | (u8[p + 5] & 127) << 14 | (u8[p + 6] & 127) << 7 | (u8[p + 7] & 127) : (u8[p + 4] << 24 | u8[p + 5] << 16 | u8[p + 6] << 8 | u8[p + 7]) >>> 0;
      }
      if (!/^[A-Z0-9]+$/.test(id) || len <= 0) break;
      if (p + hs + len <= size) {
        if (id === 'TIT2' || id === 'TT2') out.title = text(p + hs, p + hs + len);
        if (id === 'TPE1' || id === 'TP1') out.artist = text(p + hs, p + hs + len);
      }
      p += hs + len;
    }
    return out;
  }

  async function importFiles(files, style) {
    let n = 0;
    for (const f of files) {
      if (!/^(audio|video)\//.test(f.type) && !/\.(mp3|mp2|wav|wave|flac|ogg|oga|opus|m4a|m4b|mp4|aac|aif|aiff|aifc|webm|weba|mka|wma|caf|3gp|amr|ac3|ape|alac)$/i.test(f.name)) continue;
      const miss = S.tracks.find(t => !t.file && t.demo == null && t.name === f.name && (!t.size || t.size === f.size));
      if (miss) { if (style) miss.style = style; miss.file = f; miss.size = f.size; FDB.put(miss.id, f); miss.status = 'wait'; queue.push({ tr: miss, full: false }); n++; continue; }
      const dup = S.tracks.find(t => t.name === f.name && t.size === f.size);
      if (dup) { if (style && dup.style !== style) { dup.style = style; n++; } continue; }
      const base = f.name.replace(/\.[^.]+$/, ''), m = base.match(/^(.+?)\s+-\s+(.+)$/);
      const tr = { id: uid(), name: f.name, size: f.size, file: f, title: m ? m[2] : base, artist: m ? m[1] : '', style: style || '', status: 'wait' };
      try { const tg = readTags(new Uint8Array(await f.slice(0, 262144).arrayBuffer())); if (tg.title) tr.title = tg.title; if (tg.artist) tr.artist = tg.artist; } catch (e) { /* nom de fichier */ }
      S.tracks.push(tr); queue.push({ tr, full: true }); FDB.put(tr.id, f); n++;
    }
    if (!n) toast('Aucun nouveau fichier audio reconnu.');
    renderLib(); pump(); return n;
  }

  /* ================= Modèle du mix ================= */
  function relayout() {
    lay = Core.computeLayout(S.playlist.map(it => ({ sbIn: it.sbIn, sbOut: it.sbOut, overlap: it.type === 'cut' ? 0 : it.overlap, tempo: it.tempo, tmode: it.type === 'fade' ? 'hold' : it.tmode })));
    autoCache = [];
    $('tlSpacer').style.width = Math.max(tl.clientWidth, PADL + lay.total * S.pps + 80) + 'px';
  }
  function curves(i, name) {
    const it = S.playlist[i];
    if (it.cv[name]) return it.cv[name];
    if (!autoCache[i]) autoCache[i] = Core.autoCurves(lay.items[i], it.type, S.playlist[i + 1] ? S.playlist[i + 1].type : 'beat');
    return autoCache[i][name];
  }
  function addToPlaylist(tid, at, quiet) {
    const tr = T(tid);
    if (!tr || tr.bpm == null) { if (!quiet) toast('Ce morceau est encore en cours d\'analyse.'); return null; }
    if (!quiet) pushUndo();
    if (at == null || at < 0 || at > S.playlist.length) at = S.playlist.length;
    const d = gridDefaults(tr), prev = S.playlist[at - 1], far = prev && Math.abs(Math.log2(tr.bpm / prev.tempo)) > Math.log2(1.08);
    const it = { id: uid(), tid, sbIn: d.sbIn, sbOut: d.sbOut, overlap: far ? 16 : Math.min(32, Math.floor((d.sbOut - d.sbIn) / 16) * 4), tempo: tr.bpm, tmode: 'ramp', type: far ? 'fade' : 'beat', cv: { vol: null, bass: null, treble: null } };
    S.playlist.splice(at, 0, it);
    if (!quiet) { S.sel = it.id; changed(); }
    return it;
  }
  function removeItem(id) { pushUndo(); S.playlist = S.playlist.filter(it => it.id !== id); if (S.sel === id) S.sel = null; changed(); }
  function clampItem(it) {
    const tr = T(it.tid); if (!tr || tr.dur == null) return;
    it.sbOut = Math.min(it.sbOut, maxOut(tr)); it.sbIn = Math.max(it.sbIn, minIn(tr));
    if (it.sbOut < it.sbIn + 4) it.sbOut = it.sbIn + 4;
  }
  function setTrackBpm(tr, nb) {
    nb = clamp(nb, 40, 260);
    const r = nb / tr.bpm;
    for (const it of S.playlist) if (it.tid === tr.id) {
      it.sbIn = Math.round(it.sbIn * r); it.sbOut = Math.round(it.sbOut * r);
      if (Math.abs(it.tempo - tr.bpm) < 0.005) it.tempo = nb;
      for (const k in it.cv) if (it.cv[k]) it.cv[k].forEach(p => { p.b *= r; });
    }
    tr.bpm = nb;
    for (const it of S.playlist) if (it.tid === tr.id) clampItem(it);
  }

  /* ================= Annulation, sauvegarde ================= */
  const undo = [];
  function pushUndo() { undo.push(JSON.stringify({ pl: S.playlist, g: S.tracks.map(t => [t.id, t.bpm, t.grid0]) })); if (undo.length > 60) undo.shift(); }
  function doUndo() {
    const s = undo.pop(); if (!s) return;
    const o = JSON.parse(s);
    S.playlist = o.pl.filter(it => T(it.tid));
    for (const [id, bpm, g] of o.g) { const t = T(id); if (t) { t.bpm = bpm; t.grid0 = g; } }
    if (selIndex() < 0) S.sel = null;
    changed();
  }
  function projectData() {
    return { app: 'timeline-dj-mix', v: 1, tracks: S.tracks.filter(t => t.bpm != null).map(t => ({ id: t.id, name: t.name, size: t.size, title: t.title, artist: t.artist, dur: t.dur, bpm: t.bpm, grid0: t.grid0, tonic: t.tonic, minor: t.minor, aStart: t.aStart, aEnd: t.aEnd, demo: t.demo, style: t.style || '' })), playlist: S.playlist, ui: { pps: S.pps, snap: S.snap } };
  }
  let saveT = 0;
  function saveSettings() { try { localStorage.setItem(LSSET, JSON.stringify({ snd: S.snd, midi: S.midi, party: S.party, out: S.out, outV: 2, bg: S.bg, btn: S.btn, btnp: S.btnp, lang: S.lang })); } catch (e) { /* stockage indisponible */ } }
  function saveLocal() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(LSKEY, JSON.stringify(projectData())); } catch (e) { /* stockage indisponible */ } }, 600); }
  function loadProject(d) {
    if (!d || (d.app !== 'timeline-dj-mix' && d.app !== 'fondu-enchaine') || !Array.isArray(d.tracks)) { toast('Ce fichier n\'est pas un projet TIMELINE DJ MIX.'); return false; }
    pause(); bufs.clear(); undo.length = 0;
    const old = S.tracks;
    S.tracks = d.tracks.map(t => {
      const tr = Object.assign({}, t, { status: 'missing' });
      const have = old.find(o => o.file && o.name === t.name && o.size === t.size);
      if (have) { tr.file = have.file; tr.peaks = have.peaks; tr.status = have.peaks ? 'ok' : 'wait'; }
      if (tr.demo != null || (tr.file && !tr.peaks)) { tr.status = 'wait'; queue.push({ tr, full: false }); }
      return tr;
    });
    S.playlist = (d.playlist || []).filter(it => T(it.tid)).map(it => Object.assign({ cv: { vol: null, bass: null, treble: null }, tmode: 'ramp', type: 'beat' }, it));
    if (d.ui) { S.snap = d.ui.snap === 1 ? 1 : 4; }
    S.sel = null; S.playhead = 0;
    changed(); fit(); pump(); restoreFiles();
    return true;
  }
  function initDemo() {
    S.tracks = []; S.playlist = []; S.sel = null; S.playhead = 0; bufs.clear();
    let left = DEMOS.length;
    DEMOS.forEach((d, i) => {
      const tr = { id: 'demo' + i, demo: i, name: 'demo-' + i, size: 0, title: d.title, artist: 'Démo', status: 'wait' };
      S.tracks.push(tr);
      queue.push({ tr, full: true, then: () => { if (--left === 0) { for (const t of S.tracks) if (t.demo != null) addToPlaylist(t.id); undo.length = 0; S.sel = S.playlist[1] ? S.playlist[1].id : null; changed(); fit(); } } });
    });
    changed(); pump();
  }

  /* ================= Rendu des listes ================= */
  const NOTE_L = { fr: ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'], es: ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'], de: ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'], ru: ['До', 'До♯', 'Ре', 'Ми♭', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Ля♭', 'Ля', 'Си♭', 'Си'], el: ['Ντο', 'Ντο♯', 'Ρε', 'Μι♭', 'Μι', 'Φα', 'Φα♯', 'Σολ', 'Λα♭', 'Λα', 'Σι♭', 'Σι'], abc: ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'] };
  NOTE_L.pt = NOTE_L.it = NOTE_L.es;
  const keyTxt = t => t.tonic == null ? '' : Core.keyCode(t.tonic, t.minor) + ' · ' + (NOTE_L[L10N.lang] || NOTE_L.abc)[t.tonic] + (t.minor ? ' m' : '');
  function refItem() { const i = selIndex(); return i >= 0 ? S.playlist[i] : S.playlist[S.playlist.length - 1]; }
  let libRows = [];
  function renderLib() {
    const ref = refItem(), rt = ref && T(ref.tid), q = S.q.toLowerCase();
    let rows = S.tracks.filter(t => !q || (t.title + ' ' + t.artist).toLowerCase().includes(q));
    const k = S.sort.k, val = t => k === 'key' ? (t.tonic == null ? 99 : Core.keyNum(t.tonic, t.minor) + (t.minor ? 0 : 0.5)) : k === 'bpm' || k === 'dur' ? (t[k] || 0) : String(t[k] || '').toLowerCase();
    rows = rows.slice().sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * S.sort.dir; });
    libRows = rows;
    $('libBody').innerHTML = rows.map(t => {
      const c = rt && rt !== t ? Core.keyCompat(rt, t) : 0, near = rt && rt !== t && t.bpm && Math.abs(Math.log2(t.bpm / ref.tempo)) < Math.log2(1.06);
      const tag = t.status === 'work' ? '<span class="tag">analyse…</span>' : t.status === 'wait' ? '<span class="tag">en attente</span>' : t.status === 'missing' ? '<span class="tag warn">fichier à réimporter</span>' : t.status === 'err' ? '<span class="tag warn">illisible</span>' : t.demo != null ? '<span class="tag">démo</span>' : '';
      return `<tr data-id="${t.id}" draggable="true" class="${t.id === S.libSel ? 'sel' : ''}"><td><button class="ico" data-act="prev" title="Pré-écoute" aria-label="Pré-écoute de ${esc(t.title)}">${cueId() === 't:' + t.id ? '■' : '▶'}</button></td>` +
        `<td title="${esc(t.name)}"><span translate="no">${esc(t.title)}</span>${tag}</td><td translate="no">${esc(t.artist)}</td><td translate="no">${esc(t.style || '')}</td><td class="num${near ? ' bpmok' : ''}">${t.bpm ? t.bpm.toFixed(1) : ''}</td>` +
        `<td><span class="key"><i class="c${c}"></i>${keyTxt(t)}</span></td><td class="num">${t.dur ? fmtT(t.dur) : ''}</td>` +
        `<td><button class="ico" data-act="add" title="Ajouter à la playlist" aria-label="Ajouter ${esc(t.title)} à la playlist">+</button> <button class="ico" data-act="del" title="Retirer de la bibliothèque" aria-label="Retirer ${esc(t.title)} de la bibliothèque">✕</button></td></tr>`;
    }).join('');
    $('libEmpty').hidden = S.tracks.length > 0;
    $('libCount').textContent = S.tracks.length ? S.tracks.length + (S.tracks.length > 1 ? ' morceaux' : ' morceau') : '';
  }
  function renderPl() {
    $('plBody').innerHTML = S.playlist.map((it, i) => {
      const t = T(it.tid), L = lay.items[i], p = i > 0 ? T(S.playlist[i - 1].tid) : null, c = p ? Core.keyCompat(p, t) : 0;
      const sel = i === 0 ? '<span class="muted">Ouverture</span>' : `<select data-act="type" aria-label="Transition d'entrée du morceau ${i + 1}">${Object.keys(TYPES).map(k => `<option value="${k}"${it.type === k ? ' selected' : ''}>${TYPES[k]}</option>`).join('')}</select>`;
      return `<tr data-id="${it.id}" draggable="true" class="${it.id === S.sel ? 'sel' : ''}"><td><button class="ico" data-act="cue" title="Pré-écouter ce morceau, sans arrêter le mix" aria-label="Pré-écouter ${esc(t.title)}">${cueId() === 'i:' + it.id ? '■' : '▶'}</button>${i ? ` <button class="ico" data-act="cuex" title="Pré-écouter la transition d'entrée, sans arrêter le mix" aria-label="Pré-écouter la transition vers ${esc(t.title)}">${cueId() === 'x:' + it.id ? '■' : '⇄'}</button>` : ''}</td><td class="num">${i + 1}</td><td>${sel}</td><td><span translate="no">${esc(t.title)}</span>${t.status === 'missing' ? '<span class="tag warn">fichier à réimporter</span>' : ''}</td><td translate="no">${esc(t.artist)}</td>` +
        `<td class="num">${it.tempo.toFixed(1)}</td><td><span class="key"><i class="c${c}"></i>${keyTxt(t)}</span></td><td class="num">${fmtT(lay.b2t(L.mb0))}</td>` +
        `<td><button class="ico" data-act="rm" title="Retirer du mix" aria-label="Retirer ${esc(t.title)} du mix">✕</button></td></tr>`;
    }).join('');
    $('plEmpty').hidden = S.playlist.length > 0;
    $('plCount').textContent = S.playlist.length ? S.playlist.length + (S.playlist.length > 1 ? ' morceaux, ' : ' morceau, ') + fmtT(lay.total) : '';
  }
  function renderInsp() {
    const i = selIndex(), el = $('insp');
    if (i < 0) { el.innerHTML = '<span class="muted">Sélectionnez un morceau dans la timeline pour régler sa transition, son tempo, sa grille et ses courbes.</span>'; return; }
    const it = S.playlist[i], tr = T(it.tid), L = lay.items[i];
    const opt = (o, v) => Object.keys(o).map(k => `<option value="${k}"${k === v ? ' selected' : ''}>${o[k]}</option>`).join('');
    el.innerHTML = `<b class="t" translate="no">${i + 1}. ${esc(tr.title)}</b>` +
      (i > 0 ? `<div class="grp"><label for="inType">Transition</label><select id="inType">${opt(TYPES, it.type)}</select></div>` +
        `<div class="grp"><label for="inOv">Chevauchement</label><input id="inOv" type="number" step="${S.snap}" min="0" value="${L.inOv}"><span class="muted">temps</span></div>` +
        `<div class="grp"><label for="inTm">Tempo pendant la transition</label><select id="inTm">${opt({ ramp: 'Glisse de l\'un à l\'autre', hold: 'Garde celui du sortant', lead: 'Prend celui de l\'entrant' }, it.tmode)}</select></div>` : '') +
      `<div class="grp"><label for="inTempo">Tempo dans le mix</label><input id="inTempo" type="number" step="0.1" min="40" max="260" value="${+it.tempo.toFixed(2)}"><button id="inTempoR" title="Revenir au tempo d'origine du morceau">Origine</button></div>` +
      `<div class="grp"><label for="inBpm">BPM du morceau</label><input id="inBpm" type="number" step="0.01" min="40" max="260" value="${+tr.bpm.toFixed(2)}"><button class="ico" id="bpmH">÷2</button><button class="ico" id="bpmD">×2</button></div>` +
      `<div class="grp"><span class="l">Grille</span><button class="ico" data-g="-0.01" title="Avancer la grille de 10 ms">◀</button><span class="muted">10 ms</span><button class="ico" data-g="0.01" title="Reculer la grille de 10 ms">▶</button><button data-gb="-1" title="Le premier temps de la mesure est un temps plus tôt">Mesure −1 temps</button><button data-gb="1" title="Le premier temps de la mesure est un temps plus tard">+1 temps</button></div>` +
      (i > 0 ? `<button id="cueX" title="Pré-écoute au casque, sans arrêter le mix">${cueId() === 'x:' + it.id ? '■ Arrêter' : '⇄ Écouter la transition'}</button>` : '') +
      `<button id="cvReset" title="Efface les points posés à la main sur ce morceau et remet les fondus automatiques">Rétablir les courbes automatiques</button>`;
  }
  function changed(light) {
    relayout(); renderLib(); renderPl(); renderInsp(); updateClock(); draw();
    if (!light) { saveLocal(); resync(); if (Q.on && Q.kind === 'mix') cueSeek(cueNow()); }
  }

  /* ================= Moteur audio ================= */
  let ac = null, live = null, mvol = null;
  function impulse(ctx, dur) {
    const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, n, ctx.sampleRate);
    let sd = 987654321;
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; d[i] = (sd / 2147483648 - 1) * Math.pow(1 - i / n, 3); } }
    return b;
  }
  /* Table de mixage : deux voies (EQ 3 bandes, filtre, volume), crossfader, écho, flanger, réverb, limiteur */
  function buildMix(ctx) {
    const mk = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
    const gn = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
    const dry = gn(1), sum = gn(1), lanes = [];
    for (let l = 0; l < 2; l++) {
      const o = { inp: gn(1), lo: mk('lowshelf', 120), mid: mk('peaking', 1000, 0.7), hi: mk('highshelf', 6000), lp: mk('lowpass', 20000, 0.9), hp: mk('highpass', 10, 0.9), vol: gn(1) };
      o.inp.connect(o.lo).connect(o.mid).connect(o.hi).connect(o.lp).connect(o.hp).connect(o.vol).connect(dry);
      lanes.push(o);
    }
    dry.connect(sum);
    const dl = ctx.createDelay(2.5), dlFb = gn(0.45), dlWet = gn(0); dl.delayTime.value = 0.375;
    dry.connect(dl); dl.connect(dlFb).connect(dl); dl.connect(dlWet).connect(sum);
    const fl = ctx.createDelay(0.05), flFb = gn(0.5), flWet = gn(0), lfo = ctx.createOscillator(), lfoG = gn(0.004); fl.delayTime.value = 0.006; lfo.frequency.value = 0.22;
    lfo.connect(lfoG).connect(fl.delayTime); lfo.start(); dry.connect(fl); fl.connect(flFb).connect(fl); fl.connect(flWet).connect(sum);
    const rv = ctx.createConvolver(), rvWet = gn(0); rv.buffer = impulse(ctx, 2.6); dry.connect(rv).connect(rvWet).connect(sum);
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -0.8; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
    sum.connect(lim);
    const eq = v => (v < 0 ? 26 * v : 6 * v);
    return {
      lanes, out: lim, tmp: [0, 0], srcs: [],
      apply(sn, tempo, tc) {
        this.tmp = [sn.a.tmp || 0, sn.b.tmp || 0];
        this.srcs = this.srcs.filter(x => { try { x.src.detune.value = 1200 * Math.log2(1 + this.tmp[x.lane]); return !x.dead; } catch (e) { return false; } });
        const t = ctx.currentTime, set = (p, v) => { if (tc) p.setTargetAtTime(v, t, tc); else p.value = v; };
        ['a', 'b'].forEach((k, l) => {
          const o = sn[k], n = lanes[l], xf = l === 0 ? (sn.xf > 0 ? 1 - sn.xf : 1) : (sn.xf < 0 ? 1 + sn.xf : 1);
          set(n.lo.gain, eq(o.lo)); set(n.mid.gain, eq(o.mid)); set(n.hi.gain, eq(o.hi));
          set(n.lp.frequency, o.flt < 0 ? 20000 * Math.pow(0.004, -o.flt) : 20000);
          set(n.hp.frequency, o.flt > 0 ? 20 * Math.pow(400, o.flt) : 10);
          set(n.vol.gain, o.vol * xf);
        });
        set(dlWet.gain, sn.echo * 0.8); set(flWet.gain, sn.flg * 0.9); set(rvWet.gain, sn.rev * 0.7);
        this.tempo(tempo, tc);
      },
      tempo(tp, tc) { const v = clamp(60 / (tp || 120) * 0.75, 0.05, 2.4); if (tc) dl.delayTime.setTargetAtTime(v, ctx.currentTime, 0.05); else dl.delayTime.value = v; }
    };
  }
  let cueMix = null, cueGain = null, cueDest = null, cueEl = null, outNodes = [];
  function AC() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      live = buildMix(ac); live.apply(S.snd, 120, 0);
      mvol = ac.createGain(); mvol.gain.value = $('mvol').value / 100; live.out.connect(mvol);
      cueMix = buildMix(ac); cueMix.apply(SND0(), 120, 0);
      cueGain = ac.createGain(); cueGain.gain.value = $('cvol') ? $('cvol').value / 100 : 0.85; cueMix.out.connect(cueGain);
      if (S.out.master && ac.setSinkId) ac.setSinkId(S.out.master).then(routeOut, routeOut);
      routeOut();
    }
    return ac;
  }
  /* Sortie générale et casque : stéréo (casque avec le mix ou sur une autre carte), ou carte 4 canaux (1-2 / 3-4) */
  function routeOut() {
    if (!ac) return;
    const dest = ac.destination, max = dest.maxChannelCount || 2, mode = S.out.mode || 'stereo';
    for (const n of outNodes) { try { n.disconnect(); } catch (e) { /* déjà débranché */ } } outNodes = [];
    try { mvol.disconnect(); } catch (e) { /* idem */ } try { cueGain.disconnect(); } catch (e) { /* idem */ }
    if (cueEl) { try { cueEl.pause(); } catch (e) { /* idem */ } }
    let msg = 'Canaux disponibles sur la sortie générale : ' + max + '.';
    if (mode !== 'stereo' && max >= 4) {
      dest.channelCount = 4; dest.channelInterpretation = 'discrete';
      const mg = ac.createChannelMerger(4), ms = ac.createChannelSplitter(2), cs = ac.createChannelSplitter(2), m0 = mode === 'quad' ? 0 : 2, c0 = mode === 'quad' ? 2 : 0;
      mvol.connect(ms); ms.connect(mg, 0, m0); ms.connect(mg, 1, m0 + 1); cueGain.connect(cs); cs.connect(mg, 0, c0); cs.connect(mg, 1, c0 + 1); mg.connect(dest); outNodes = [mg, ms, cs];
      msg += mode === 'quad' ? ' Général sur 1-2, casque sur 3-4.' : ' Casque sur 1-2, général sur 3-4.';
    } else {
      try { dest.channelCount = 2; dest.channelInterpretation = 'speakers'; } catch (e) { /* valeur imposée */ }
      mvol.connect(dest);
      if (mode !== 'stereo') msg += ' Il en faut 4 pour séparer le casque : réglez la carte en « Quadriphonique » dans le système.';
      if (S.out.cue && window.HTMLMediaElement && 'setSinkId' in HTMLMediaElement.prototype) {
        if (!cueDest) cueDest = ac.createMediaStreamDestination();
        if (!cueEl) cueEl = new Audio();
        cueGain.connect(cueDest); cueEl.srcObject = cueDest.stream;
        cueEl.setSinkId(S.out.cue).then(() => cueEl.play()).catch(() => { toast('La sortie casque choisie n\'est pas disponible : le casque repasse avec le mix.'); try { cueGain.connect(dest); } catch (e) { /* idem */ } });
        msg += ' Casque envoyé sur l\'autre carte son.';
      } else { cueGain.connect(dest); if (mode === 'stereo') msg += ' Casque entendu avec le mix.'; }
    }
    if ($('outInfo')) $('outInfo').textContent = msg;
  }
  const eqDb = v => -30 * (1 - v);
  /* Position d'un morceau dans le mix, figée au moment du calcul */
  function itemTiming(i) {
    const it = S.playlist[i], L = lay.items[i], tr = T(it.tid), l0 = lay;
    const fade = it.type === 'fade' && L.inOv > 0, tOv = fade ? l0.b2t(L.mb0 + L.inOv) : 0, rate0 = it.tempo / tr.bpm;
    const sOv = tr.grid0 + (it.sbIn + L.inOv) * 60 / tr.bpm, g0 = tr.grid0, off = L.off, bpm = tr.bpm;
    return { tS: l0.b2t(L.mb0), tE: l0.b2t(L.mb1), fade, tOv, rate0, sOv, bpm, lane: L.lane,
      src: t => (fade && t < tOv ? sOv - (tOv - t) * rate0 : g0 + (l0.t2b(t) - off) * 60 / bpm) };
  }
  /* (Re)programme vitesse, courbes et arrêt d'un nœud. fresh : le démarre aussi. */
  function program(n, i, tm, tA, whenA, fresh) {
    const L = lay.items[i], W = t => whenA + (t - tA);
    let ts = Math.max(tm.tS, tA);
    if (fresh && tm.fade && tm.src(ts) < 0) ts = Math.min(tm.tOv, tm.tOv - tm.sOv / tm.rate0);
    const rate = n.src.playbackRate;
    if (!fresh) for (const p of [rate, n.g.gain, n.lo.gain, n.hi.gain]) p.cancelScheduledValues(W(ts));
    for (const sg of lay.segs) {
      if (sg.t1 <= ts || sg.t0 >= tm.tE) continue;
      const a = Math.max(sg.t0, ts), b = Math.min(sg.t1, tm.tE);
      if (tm.fade && sg.t1 <= tm.tOv + 1e-6) { rate.setValueAtTime(tm.rate0, W(a)); continue; }
      rate.setValueAtTime(lay.tempoInSeg(sg, a) / tm.bpm, W(a));
      if (sg.T0 !== sg.T1) rate.linearRampToValueAtTime(lay.tempoInSeg(sg, b) / tm.bpm, W(b));
    }
    const env = (param, pts, map) => {
      const tt = pts.map(p => lay.b2t(L.mb0 + p.b));
      let v0 = pts[pts.length - 1].v;
      if (ts <= tt[0]) v0 = pts[0].v;
      else for (let k = 1; k < pts.length; k++) if (ts <= tt[k]) { v0 = pts[k - 1].v + (pts[k].v - pts[k - 1].v) * (ts - tt[k - 1]) / Math.max(1e-9, tt[k] - tt[k - 1]); break; }
      param.setValueAtTime(map(v0), W(ts));
      for (let k = 0; k < pts.length; k++) if (tt[k] > ts) param.linearRampToValueAtTime(map(pts[k].v), W(tt[k]));
    };
    env(n.g.gain, curves(i, 'vol'), v => v);
    env(n.lo.gain, curves(i, 'bass'), eqDb);
    env(n.hi.gain, curves(i, 'treble'), eqDb);
    if (fresh) n.src.start(W(ts), Math.max(0, tm.src(ts)));
    n.src.stop(W(tm.tE));
    n.tm = tm;
  }
  /* Programme un morceau du mix dans ctx. tA (temps du mix) correspond à whenA (temps du contexte). */
  function scheduleItem(ctx, mix, i, buf, tA, whenA) {
    const tm = itemTiming(i);
    if (tm.tE <= tA + 0.005) return null;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 180;
    const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 4500;
    const g = ctx.createGain();
    src.connect(lo).connect(hi).connect(g).connect(mix.lanes[tm.lane].inp);
    if (mix.tmp && src.detune) { src.detune.value = 1200 * Math.log2(1 + (mix.tmp[tm.lane] || 0)); const rec = { src, lane: tm.lane }; mix.srcs.push(rec); src.addEventListener('ended', () => { rec.dead = true; }); }
    const n = { src, lo, hi, g, ctx };
    program(n, i, tm, tA, whenA, true);
    return n;
  }
  function killNode(n) {
    const t = n.ctx.currentTime;
    try { n.g.gain.cancelScheduledValues(t); n.g.gain.setTargetAtTime(0, t, 0.008); n.src.stop(t + 0.05); } catch (e) { try { n.src.stop(); } catch (e2) { /* déjà arrêté */ } }
    setTimeout(() => { try { n.g.disconnect(); } catch (e) { /* idem */ } }, 200);
  }
  const P = { playing: false, t0: 0, when0: 0, nodes: new Map(), timer: 0 };
  function mixNow() { return P.playing ? P.t0 + (ac.currentTime - P.when0) : S.playhead; }
  function stopNodes() { for (const n of P.nodes.values()) killNode(n); P.nodes.clear(); }
  /* Après une modification pendant la lecture : ce qui joue continue sans coupure.
     Seuls les morceaux dont la position a réellement changé sont relancés. */
  function resync() {
    if (!P.playing) return;
    const now = mixNow(), tA = now + 0.04, wA = ac.currentTime + 0.04, idx = new Map(S.playlist.map((it, i) => [it.id, i]));
    for (const [id, n] of [...P.nodes]) {
      const i = idx.get(id);
      if (i != null) {
        const tm = itemTiming(i);
        if (n.tm.tS <= now && tm.tS <= tA && tm.tE > tA + 0.05 && tm.lane === n.tm.lane && Math.abs(tm.src(tA) - n.tm.src(tA)) < 0.003) {
          try { program(n, i, tm, tA, wA, false); continue; } catch (e) { /* relance complète */ }
        }
      }
      killNode(n); P.nodes.delete(id);
    }
    tick();
  }
  function tick() {
    if (!P.playing) return;
    const now = mixNow();
    if (now >= lay.total) { pause(); S.playhead = lay.total; updateClock(); draw(); return; }
    S.playlist.forEach((it, i) => {
      if (P.nodes.has(it.id)) return;
      const L = lay.items[i], ts = lay.b2t(L.mb0), te = lay.b2t(L.mb1);
      if (te <= now + 0.1 || ts > now + 90) return;
      const tr = T(it.tid), buf = bufs.get(tr.id);
      if (!buf) { if (tr.file || tr.demo != null) getBuffer(tr).then(tick, () => {}); else if (ts < now + 2 && !tr._told) { tr._told = true; toast('« ' + tr.title + ' » reste muet : son fichier est à réimporter.'); } return; }
      if (ts < now + 15) { const n = scheduleItem(ac, live, i, buf, now + 0.07, ac.currentTime + 0.07); if (n) P.nodes.set(it.id, n); }
    });
    live.tempo(lay.tempoAt(now), 1); mxState();
    if (S.auto && !adBusy && lay.total - now < 150) adAppend(1);
  }
  async function play() {
    if (!S.playlist.length && S.auto) await adAppend(2);
    if (!S.playlist.length) { toast('Ajoutez d\'abord des morceaux à la playlist.'); return; }
    try { await AC().resume(); } catch (e) { toast('Le navigateur a refusé de démarrer le son.'); return; }
    if (S.playhead >= lay.total - 0.1) S.playhead = 0;
    P.playing = true; P.t0 = S.playhead; P.when0 = ac.currentTime + 0.05; P.nodes.clear();
    $('btnPlay').textContent = '⏸'; mxState();
    tick(); P.timer = setInterval(tick, 200); requestAnimationFrame(frame);
  }
  function pause() {
    if (!P.playing) return;
    S.playhead = Math.min(mixNow(), lay.total);
    P.playing = false; clearInterval(P.timer); stopNodes();
    $('btnPlay').textContent = '▶'; mxState();
  }
  function restart(t) { stopNodes(); P.t0 = clamp(t, 0, lay.total); P.when0 = ac.currentTime + 0.03; tick(); }
  function seek(t) { t = clamp(t, 0, lay.total); if (P.playing) restart(t); else S.playhead = t; updateClock(); draw(); }
  let rafOn = false;
  function frame() {
    if (!P.playing && !Q.on) { rafOn = false; return; }
    if (P.playing) {
      const t = mixNow(), x = X(t), w = cv.clientWidth;
      if (!drag && (x > w - 30 || x < 0)) tl.scrollLeft = Math.max(0, PADL + t * S.pps - 60);
      updateClock();
    }
    if (Q.on && Q.kind === 'track' && Q.src && !cueDrag) { const pos = Q.off + (ac.currentTime - Q.w0), d = Q.src.buffer.duration; $('cueSeek').value = Math.round(1000 * pos / d); $('cueTime').textContent = fmtT(pos) + ' / ' + fmtT(d); }
    draw();
    requestAnimationFrame(frame);
  }
  let cueDrag = false;
  function updateClock() {
    const t = Math.min(mixNow(), lay.total);
    $('clock').innerHTML = fmtT(t, 1) + ' <small>/ ' + fmtT(lay.total) + '</small>';
    $('bpmNow').textContent = lay.total ? lay.tempoAt(t).toFixed(1) + ' BPM' : '— BPM';
  }
  const Q = { on: false, kind: null, id: null, t0: 0, when0: 0, end: Infinity, nodes: new Map(), timer: 0, tids: [], src: null, trk: null, off: 0, w0: 0 };
  const cueId = () => Q.id;
  const cueNow = () => (Q.on && Q.kind === 'mix' ? Q.t0 + (ac.currentTime - Q.when0) : S.cuePos);
  function cueRefresh() { renderLib(); renderPl(); renderInsp(); $('btnCue').textContent = Q.on && Q.kind === 'mix' ? '■ Pré-écoute' : '▶ Pré-écoute'; $('btnCue').classList.toggle('on', Q.on && Q.kind === 'mix'); $('cueBar').hidden = !(Q.on && Q.kind === 'track'); }
  function stopCue() {
    if (!Q.on && !Q.id) return;
    if (Q.on && Q.kind === 'mix') S.cuePos = clamp(cueNow(), 0, lay.total);
    for (const n of Q.nodes.values()) killNode(n); Q.nodes.clear();
    if (Q.src) { const x = Q.src; Q.src = null; try { x.stop(); } catch (e) { /* fini */ } }
    clearInterval(Q.timer); Q.on = false; Q.id = null; Q.kind = null; Q.tids = []; Q.trk = null;
    cueRefresh(); draw();
  }
  function cueTick() {
    if (!Q.on || Q.kind !== 'mix') return;
    const now = cueNow();
    if (now >= Math.min(Q.end, lay.total)) { stopCue(); return; }
    const tids = [];
    S.playlist.forEach((it, i) => {
      const L = lay.items[i], ts = lay.b2t(L.mb0), te = lay.b2t(L.mb1);
      if (te <= now + 0.1 || ts > now + 60) return;
      const tr = T(it.tid); tids.push(tr.id);
      if (Q.nodes.has(it.id)) return;
      const buf = bufs.get(tr.id);
      if (!buf) { if (tr.file || tr.demo != null) getBuffer(tr).then(cueTick, () => {}); return; }
      if (ts < now + 15) { const n = scheduleItem(ac, cueMix, i, buf, now + 0.07, ac.currentTime + 0.07); if (n) Q.nodes.set(it.id, n); }
    });
    Q.tids = tids; cueMix.tempo(lay.tempoAt(now), 1);
  }
  /* Pré-écoute du mix à partir de la ligne verte, sans toucher à la lecture en cours */
  async function cueStart(t, end, id) {
    stopCue();
    if (!S.playlist.length) return;
    try { await AC().resume(); } catch (e) { toast('Le navigateur a refusé de démarrer le son.'); return; }
    S.cuePos = clamp(t, 0, lay.total);
    Q.on = true; Q.kind = 'mix'; Q.id = id || 'm'; Q.t0 = S.cuePos; Q.when0 = ac.currentTime + 0.05; Q.end = end == null ? Infinity : end;
    cueTick(); Q.timer = setInterval(cueTick, 200); cueRefresh(); requestAnimationFrame(frame);
  }
  /* Place la ligne verte ; si la pré-écoute tourne, elle repart de là */
  function cueSeek(t) {
    S.cuePos = clamp(t, 0, lay.total);
    if (Q.on && Q.kind === 'mix') { for (const n of Q.nodes.values()) killNode(n); Q.nodes.clear(); Q.t0 = S.cuePos; Q.when0 = ac.currentTime + 0.03; Q.end = Infinity; cueTick(); }
    draw();
  }
  function cueTransition(i) {
    const it = S.playlist[i]; if (!it || i < 1) return;
    if (Q.id === 'x:' + it.id) { stopCue(); return; }
    const L = lay.items[i];
    return cueStart(lay.b2t(L.mb0) - 6, lay.b2t(lay.items[i - 1].mb1) + 6, 'x:' + it.id);
  }
  function cueItem(i) {
    const it = S.playlist[i]; if (!it) return;
    if (Q.id === 'i:' + it.id) { stopCue(); return; }
    const L = lay.items[i];
    return cueStart(lay.b2t(L.mb0 + L.inOv), null, 'i:' + it.id);
  }
  /* Pré-écoute d'un morceau de la bibliothèque, avec curseur de position */
  function trackSrc(buf, from) {
    if (Q.src) { const x = Q.src; Q.src = null; try { x.stop(); } catch (e) { /* fini */ } }
    const sn = ac.createBufferSource(); sn.buffer = buf; sn.connect(cueGain);
    Q.off = clamp(from, 0, Math.max(0, buf.duration - 0.5)); Q.w0 = ac.currentTime; Q.src = sn;
    sn.onended = () => { if (Q.src === sn) stopCue(); };
    sn.start(0, Q.off);
  }
  async function cueTrack(tr, from) {
    const key = 't:' + tr.id;
    if (Q.id === key) { stopCue(); return; }
    stopCue();
    if (!tr.file && tr.demo == null) { toast('Le fichier de « ' + tr.title + ' » n\'est plus accessible : réimportez-le (bouton « Importer des morceaux ») pour l\'écouter.'); return; }
    try {
      await AC().resume(); Q.on = true; Q.kind = 'track'; Q.id = key; Q.trk = tr; Q.tids = [tr.id]; cueRefresh();
      $('cueName').textContent = tr.title;
      const buf = await getBuffer(tr);
      if (Q.id !== key) return;
      trackSrc(buf, from != null ? from : tr.aStart || 0); requestAnimationFrame(frame);
    } catch (e) { stopCue(); toast('Pré-écoute impossible : ' + ((e && e.message) || 'fichier illisible') + '.'); }
  }

  /* ================= Timeline ================= */
  const tl = $('tl'), cv = $('cv'), g = cv.getContext('2d');
  const PADL = 10, RUL = 24, TMP = 44;
  const COL = ['#f0a742', '#54b9cf'], CCOL = { vol: '#ffffff', bass: '#ff9d7a', treble: '#c9b6ff' };
  const TH = {};
  const hex2 = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixc = (a, b, k) => '#' + hex2(a).map((v, i) => Math.round(v + (hex2(b)[i] - v) * k).toString(16).padStart(2, '0')).join('');
  /* Couleur des boutons : '' = couleur par défaut du thème */
  function applyBtn() {
    const st = document.documentElement.style, ink = c => { const [r, g2, b] = hex2(c); return (0.299 * r + 0.587 * g2 + 0.114 * b) > 150 ? '#14181f' : '#ffffff'; };
    const ok = c => /^#[0-9a-f]{6}$/i.test(c || '');
    if (ok(S.btn)) { st.setProperty('--btn-bg', S.btn); st.setProperty('--btn-fg', ink(S.btn)); } else { st.removeProperty('--btn-bg'); st.removeProperty('--btn-fg'); }
    if (ok(S.btnp)) { st.setProperty('--btnp-bg', S.btnp); st.setProperty('--btnp-fg', ink(S.btnp)); } else { st.removeProperty('--btnp-bg'); st.removeProperty('--btnp-fg'); }
    if ($('btnPick') && ok(S.btn)) $('btnPick').value = S.btn;
    if ($('btnpPick') && ok(S.btnp)) $('btnpPick').value = S.btnp;
    for (const [id, v] of [['btnSw', S.btn || ''], ['btnpSw', S.btnp || ''], ['bgSw', S.bg]]) if ($(id)) for (const b of $(id).children) b.setAttribute('aria-pressed', String((b.dataset.c || '').toLowerCase() === (v || '').toLowerCase()));
  }
  function applyTheme(bg) {
    if (!/^#[0-9a-f]{6}$/i.test(bg)) bg = '#12161d';
    S.bg = bg;
    const [r, gg, b] = hex2(bg), light = (0.299 * r + 0.587 * gg + 0.114 * b) > 150, fg = light ? '#101318' : '#ffffff', text = light ? '#171b22' : '#e6e9ef';
    Object.assign(TH, { bg, lane: mixc(bg, fg, 0.035), panel: mixc(bg, fg, 0.07), line: mixc(bg, fg, 0.2), muted: mixc(bg, fg, light ? 0.62 : 0.56), text, bgA: bg + 'c8',
      grid: light ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.03)', band: light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.045)', tick: light ? 'rgba(20,24,31,.6)' : 'rgba(230,233,239,.55)' });
    CCOL.vol = light ? '#14181f' : '#ffffff';
    const st = document.documentElement.style;
    st.setProperty('--bg', bg); st.setProperty('--panel', TH.panel); st.setProperty('--panel-2', mixc(bg, fg, 0.12)); st.setProperty('--line', TH.line); st.setProperty('--text', text); st.setProperty('--muted', TH.muted);
    st.setProperty('color-scheme', light ? 'light' : 'dark');
    if ($('bgPick')) $('bgPick').value = bg;
    applyBtn();
  }
  let drag = null, dpr = 1;
  const X = t => PADL + t * S.pps - tl.scrollLeft;
  const timeAt = x => (x - PADL + tl.scrollLeft) / S.pps;
  const laneH = () => Math.max(30, (cv.clientHeight - RUL - TMP - 8) / 2);
  function clipRect(i) { const L = lay.items[i], h = laneH(); return { x0: X(lay.b2t(L.mb0)), x1: X(lay.b2t(L.mb1)), y: RUL + 3 + L.lane * (h + 3), h }; }
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const w = tl.clientWidth, h = tl.clientHeight;
    cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    $('tlSpacer').style.width = Math.max(w, PADL + lay.total * S.pps + 80) + 'px';
    draw();
  }
  function draw() {
    const W = cv.clientWidth, H = cv.clientHeight, sx = tl.scrollLeft, font = getComputedStyle(document.body).fontFamily;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = TH.bg; g.fillRect(0, 0, W, H);
    const h = laneH(), yT = RUL + 3 + 2 * (h + 3);
    g.fillStyle = TH.lane; g.fillRect(0, RUL + 3, W, h); g.fillRect(0, RUL + 6 + h, W, h);
    g.fillStyle = TH.panel; g.fillRect(0, 0, W, RUL); g.fillRect(0, yT, W, H - yT);
    /* règle */
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800];
    let st = steps[steps.length - 1]; for (const s of steps) if (s * S.pps >= 64) { st = s; break; }
    g.font = '11px ' + font; g.textBaseline = 'middle'; g.textAlign = 'left';
    for (let t = Math.max(0, Math.floor((sx - PADL) / S.pps / st) * st); X(t) < W; t += st) {
      const x = Math.round(X(t)) + 0.5;
      g.strokeStyle = TH.line; g.beginPath(); g.moveTo(x, RUL - 7); g.lineTo(x, RUL); g.stroke();
      g.strokeStyle = TH.grid; g.beginPath(); g.moveTo(x, RUL); g.lineTo(x, yT); g.stroke();
      g.fillStyle = TH.muted; g.fillText(fmtT(t, st < 1), x + 4, RUL / 2);
    }
    /* zones de transition */
    for (let i = 1; i < S.playlist.length; i++) {
      const L = lay.items[i]; if (L.inOv <= 0) continue;
      const a = X(lay.b2t(L.mb0)), b = X(lay.b2t(lay.items[i - 1].mb1));
      if (b < 0 || a > W) continue;
      g.fillStyle = TH.band; g.fillRect(a, RUL, b - a, yT - RUL);
      if (b - a > 54) { g.fillStyle = TH.muted; g.textAlign = 'center'; g.fillText(i18n(L.inOv + ' temps'), (a + b) / 2, yT + 9); g.textAlign = 'left'; }
    }
    /* morceaux */
    S.playlist.forEach((it, i) => {
      const r = clipRect(i); if (r.x1 < 0 || r.x0 > W) return;
      const L = lay.items[i], tr = T(it.tid), col = COL[L.lane], sel = it.id === S.sel, mid = r.y + r.h / 2;
      g.fillStyle = L.lane ? 'rgba(84,185,207,.13)' : 'rgba(240,167,66,.13)'; g.fillRect(r.x0, r.y, r.x1 - r.x0, r.h);
      const a = Math.max(0, Math.floor(r.x0)), b = Math.min(W, Math.ceil(r.x1)), vp = curves(i, 'vol'), tm = itemTiming(i);
      if (tr.peaks) {
        const pk = tr.peaks; let prev = null;
        g.strokeStyle = col; g.globalAlpha = sel ? 0.95 : 0.7; g.lineWidth = 1; g.beginPath();
        for (let px = a; px <= b; px++) {
          const tx = (px + sx - PADL) / S.pps, mb = lay.t2b(tx), idx = Math.floor(tm.src(tx) * 100);
          if (prev !== null) {
            const i0 = Math.max(0, Math.min(prev, idx)), i1 = Math.min(pk.length - 1, Math.max(prev, idx)), stp = Math.max(1, (i1 - i0) >> 3);
            let m = 0; for (let k = i0; k <= i1; k += stp) if (pk[k] > m) m = pk[k];
            const hh = Math.max(0.5, m * Core.evalEnv(vp, mb - L.mb0) * (r.h / 2 - 4));
            g.moveTo(px - 0.5, mid - hh); g.lineTo(px - 0.5, mid + hh);
          }
          prev = idx;
        }
        g.stroke(); g.globalAlpha = 1;
      } else {
        g.strokeStyle = 'rgba(232,115,106,.5)'; g.beginPath();
        for (let x = a - r.h; x < b; x += 12) { g.moveTo(Math.max(x, r.x0), r.y + r.h - Math.max(0, r.x0 - x)); g.lineTo(Math.min(x + r.h, r.x1), r.y + Math.max(0, x + r.h - r.x1)); }
        g.stroke();
      }
      /* mesures et temps */
      const pxBeat = S.pps * 60 / lay.tempoAt(timeAt(clamp((r.x0 + r.x1) / 2, 0, W)));
      const stepB = pxBeat >= 9 ? 1 : pxBeat * 4 >= 7 ? 4 : pxBeat * 16 >= 7 ? 16 : 0;
      if (stepB) {
        g.beginPath();
        for (let sb = Math.ceil(it.sbIn / stepB) * stepB; sb <= it.sbOut; sb += stepB) {
          const x = X(lay.b2t(L.off + sb)); if (x < -2 || x > W + 2) continue;
          const big = ((sb % 4) + 4) % 4 === 0, xx = Math.round(x) + 0.5;
          g.moveTo(xx, r.y + r.h); g.lineTo(xx, r.y + r.h - (big ? (((sb % 16) + 16) % 16 === 0 ? 11 : 7) : 4));
        }
        g.strokeStyle = TH.tick; g.stroke();
      }
      /* courbe */
      const pts = curves(i, S.curve), yv = v => r.y + 4 + (1 - v) * (r.h - 8);
      g.strokeStyle = CCOL[S.curve]; g.globalAlpha = sel ? 1 : 0.55; g.lineWidth = sel ? 1.8 : 1.2; g.beginPath();
      g.moveTo(r.x0, yv(pts[0].v));
      for (const p of pts) g.lineTo(X(lay.b2t(L.mb0 + p.b)), yv(p.v));
      g.lineTo(r.x1, yv(pts[pts.length - 1].v)); g.stroke(); g.lineWidth = 1; g.globalAlpha = 1;
      if (sel) { g.fillStyle = CCOL[S.curve]; for (const p of pts) { const x = X(lay.b2t(L.mb0 + p.b)); g.fillRect(x - 3.5, yv(p.v) - 3.5, 7, 7); } }
      g.strokeStyle = col; g.lineWidth = sel ? 2 : 1; g.strokeRect(r.x0 + 0.5, r.y + 0.5, r.x1 - r.x0 - 1, r.h - 1); g.lineWidth = 1;
      /* titre */
      const lx = Math.max(r.x0, 0) + 6, room = r.x1 - lx - 6;
      if (room > 40) {
        g.save(); g.beginPath(); g.rect(lx - 2, r.y, room + 2, 20); g.clip();
        g.font = '600 12px ' + font; const txt = (i + 1) + '. ' + tr.title + '   ' + it.tempo.toFixed(1) + ' BPM' + (tr.tonic != null ? '   ' + Core.keyCode(tr.tonic, tr.minor) : '') + (tr.peaks ? '' : '   ' + i18n('(fichier à réimporter)'));
        g.fillStyle = TH.bgA; g.fillRect(lx - 3, r.y + 3, Math.min(room, g.measureText(txt).width + 8), 16);
        g.fillStyle = TH.text; g.fillText(txt, lx + 1, r.y + 11.5); g.restore();
      }
    });
    /* piste de tempo */
    if (lay.segs.length) {
      let mn = Infinity, mxx = -Infinity; for (const s of lay.segs) { mn = Math.min(mn, s.T0, s.T1); mxx = Math.max(mxx, s.T0, s.T1); }
      const yy = v => mxx - mn < 1e-6 ? yT + TMP / 2 + 6 : yT + TMP - 7 - (v - mn) / (mxx - mn) * (TMP - 24);
      g.strokeStyle = '#f0a742'; g.lineWidth = 1.5; g.beginPath();
      lay.segs.forEach((s, k) => { const a = X(s.t0), b = X(s.t1); if (k === 0) g.moveTo(a, yy(s.T0)); else g.lineTo(a, yy(s.T0)); g.lineTo(b, yy(s.T1)); });
      g.stroke(); g.lineWidth = 1;
      g.font = '11px ' + font; g.fillStyle = '#f0a742';
      for (const s of lay.segs) if (s.T0 === s.T1) { const a = Math.max(X(s.t0), 0), b = X(s.t1); if (b - a > 70 && a < W) g.fillText(s.T0.toFixed(1) + ' BPM', a + 6, yy(s.T0) - 8); }
    } else {
      g.font = '14px ' + font; g.fillStyle = TH.muted; g.fillText(i18n('La timeline se remplit quand vous ajoutez des morceaux à la playlist.'), 16, RUL + 3 + h / 2);
    }
    /* ligne verte de pré-écoute */
    if (lay.total) {
      const xc = Math.round(X(Math.min(cueNow(), lay.total))) + 0.5;
      if (xc >= 0 && xc <= W) {
        g.strokeStyle = '#3ddc84'; g.lineWidth = Q.on && Q.kind === 'mix' ? 2 : 1.2; g.beginPath(); g.moveTo(xc, RUL); g.lineTo(xc, H); g.stroke(); g.lineWidth = 1;
        g.fillStyle = '#3ddc84'; g.beginPath(); g.moveTo(xc - 6, H); g.lineTo(xc + 6, H); g.lineTo(xc, H - 9); g.fill();
      }
    }
    /* tête de lecture */
    const xp = Math.round(X(Math.min(mixNow(), lay.total))) + 0.5;
    if (xp >= 0 && xp <= W) {
      g.strokeStyle = TH.text; g.beginPath(); g.moveTo(xp, 0); g.lineTo(xp, H); g.stroke();
      g.fillStyle = TH.text; g.beginPath(); g.moveTo(xp - 5, 0); g.lineTo(xp + 5, 0); g.lineTo(xp, 7); g.fill();
    }
  }
  function hit(x, y) {
    if (y < RUL) return { kind: 'ruler' };
    if (y > RUL + 2 * laneH() + 8) return { kind: 'cue' };
    for (let i = 0; i < S.playlist.length; i++) {
      const r = clipRect(i);
      if (x < r.x0 - 4 || x > r.x1 + 4 || y < r.y || y > r.y + r.h) continue;
      const it = S.playlist[i], L = lay.items[i], sel = it.id === S.sel, pts = curves(i, S.curve), yv = v => r.y + 4 + (1 - v) * (r.h - 8);
      if (sel) for (let k = 0; k < pts.length; k++) if (Math.abs(x - X(lay.b2t(L.mb0 + pts[k].b))) <= 7 && Math.abs(y - yv(pts[k].v)) <= 7) return { kind: 'pt', i, k };
      if (Math.abs(x - r.x0) <= 5) return { kind: 'edgeL', i };
      if (Math.abs(x - r.x1) <= 5) return { kind: 'edgeR', i };
      if (sel) { const b = clamp(lay.t2b(timeAt(x)) - L.mb0, 0, L.len), v = Core.evalEnv(pts, b); if (Math.abs(y - yv(v)) <= 5) return { kind: 'line', i, b, v }; }
      return { kind: 'body', i };
    }
    return y > RUL + 2 * laneH() + 8 ? { kind: 'cue' } : null;
  }
  const mpos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function ensureCustom(i) { const it = S.playlist[i]; if (!it.cv[S.curve]) it.cv[S.curve] = curves(i, S.curve).map(p => ({ b: p.b, v: p.v })); return it.cv[S.curve]; }
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const m = mpos(e), h = e.shiftKey ? { kind: 'cue' } : hit(m.x, m.y);
    drag = null;
    if (!h) { if (S.sel) { S.sel = null; changed(true); } return; }
    try { cv.setPointerCapture(e.pointerId); } catch (er) { /* sans capture */ }
    if (h.kind === 'ruler') { drag = { kind: 'ruler' }; seek(timeAt(m.x)); return; }
    if (h.kind === 'cue') { drag = { kind: 'cue' }; cueSeek(timeAt(m.x)); return; }
    const it = S.playlist[h.i];
    if (S.sel !== it.id) { S.sel = it.id; renderLib(); renderPl(); renderInsp(); draw(); if (h.kind === 'pt' || h.kind === 'line') return; }
    drag = { kind: h.kind, i: h.i, lay0: lay, t0: timeAt(m.x), moved: false, o: { sbIn: it.sbIn, sbOut: it.sbOut, ov: lay.items[h.i].inOv, cv: JSON.stringify(it.cv) } };
    if (h.kind === 'line') {
      pushUndo(); drag.moved = true;
      const pts = ensureCustom(h.i); let k = pts.findIndex(p => p.b > h.b); if (k < 0) k = pts.length;
      pts.splice(k, 0, { b: h.b, v: h.v }); drag.kind = 'pt'; drag.k = k; draw();
    } else if (h.kind === 'pt') drag.k = h.k;
  });
  cv.addEventListener('pointermove', e => {
    const m = mpos(e);
    if (!drag) {
      const h = hit(m.x, m.y);
      cv.style.cursor = !h ? 'default' : h.kind === 'edgeL' || h.kind === 'edgeR' ? 'ew-resize' : h.kind === 'pt' ? 'move' : h.kind === 'line' ? 'copy' : h.kind === 'body' ? (h.i > 0 ? 'grab' : 'default') : h.kind === 'cue' ? 'col-resize' : 'text';
      return;
    }
    if (drag.kind === 'ruler') { seek(timeAt(m.x)); return; }
    if (drag.kind === 'cue') { cueSeek(timeAt(m.x)); return; }
    const it = S.playlist[drag.i], tr = T(it.tid), o = drag.o;
    if (drag.kind === 'pt') {
      if (!drag.moved) { pushUndo(); drag.moved = true; }
      const pts = ensureCustom(drag.i), L = lay.items[drag.i], r = clipRect(drag.i), k = drag.k;
      let b = Math.round((lay.t2b(timeAt(m.x)) - L.mb0) * 4) / 4, v = clamp(1 - (m.y - r.y - 4) / (r.h - 8), 0, 1);
      b = clamp(b, k > 0 ? pts[k - 1].b : 0, k < pts.length - 1 ? pts[k + 1].b : L.len);
      if (v > 0.96) v = 1; if (v < 0.04) v = 0;
      pts[k].b = b; pts[k].v = v; draw(); return;
    }
    const db = Math.round((drag.lay0.t2b(timeAt(m.x)) - drag.lay0.t2b(drag.t0)) / S.snap) * S.snap;
    if (!drag.moved) { if (!db) return; pushUndo(); drag.moved = true; }
    if (drag.kind === 'body') {
      if (drag.i === 0) return;
      it.overlap = Math.max(0, o.ov - db);
      if (it.type === 'cut' && it.overlap > 0) it.type = 'beat';
    } else if (drag.kind === 'edgeL') {
      const ni = clamp(o.sbIn + db, minIn(tr), o.sbOut - 4), d = ni - o.sbIn;
      it.sbIn = ni; if (drag.i > 0 && it.type !== 'cut') it.overlap = Math.max(0, o.ov - d);
      const c0 = JSON.parse(o.cv); for (const k in c0) it.cv[k] = c0[k] ? c0[k].map(p => ({ b: Math.max(0, p.b - d), v: p.v })) : null;
    } else if (drag.kind === 'edgeR') it.sbOut = clamp(o.sbOut + db, o.sbIn + 4, maxOut(tr));
    relayout(); updateClock(); draw();
  });
  const endDrag = () => { const d = drag; drag = null; if (d && d.moved) changed(); };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('contextmenu', e => { e.preventDefault(); cueSeek(timeAt(mpos(e).x)); });
  cv.addEventListener('dblclick', e => {
    const m = mpos(e), h = hit(m.x, m.y);
    if (!h || h.kind !== 'pt') return;
    pushUndo();
    const it = S.playlist[h.i], pts = ensureCustom(h.i);
    pts.splice(h.k, 1); if (pts.length < 2) it.cv[S.curve] = null;
    changed();
  });
  function setPps(p, anchorX) {
    const ax = anchorX == null ? cv.clientWidth / 2 : anchorX, t = timeAt(ax);
    S.pps = clamp(p, 0.4, 400);
    $('zoom').value = Math.round(100 * Math.log(S.pps / 0.4) / Math.log(1000));
    $('tlSpacer').style.width = Math.max(tl.clientWidth, PADL + lay.total * S.pps + 80) + 'px';
    tl.scrollLeft = Math.max(0, PADL + t * S.pps - ax);
    draw();
  }
  function fit() { if (lay.total > 0) { setPps((tl.clientWidth - 2 * PADL - 20) / lay.total, 0); tl.scrollLeft = 0; draw(); } }
  tl.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setPps(S.pps * Math.exp(-e.deltaY * 0.0025), mpos(e).x); }
    else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); tl.scrollLeft += e.deltaY; }
  }, { passive: false });
  tl.addEventListener('scroll', draw);
  new ResizeObserver(resize).observe(tl);

  /* ================= Export ================= */
  const isHosted = () => !!(window.claude && typeof window.claude.use === 'function');
  let dlMemo = null;
  const getDl = () => { if (!isHosted()) return Promise.resolve(null); if (!dlMemo) dlMemo = Promise.resolve().then(() => window.claude.use('downloads')).catch(() => null); return dlMemo; };
  async function saveBlob(name, blob) {
    const dl = await getDl();
    if (dl) {
      try { await dl.save({ filename: name, data: blob }); return true; }
      catch (e) { toast(e && e.code === 'declined' ? 'Enregistrement annulé.' : 'Enregistrement impossible (' + ((e && e.code) || 'erreur') + ').'); return false; }
    }
    if (isHosted()) { toast('L\'enregistrement de fichiers n\'est pas disponible dans cette vue.'); return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 120000);
    return true;
  }
  function tracklist() {
    const lines = ['Mix réalisé avec TIMELINE DJ MIX, durée ' + fmtT(lay.total), ''];
    S.playlist.forEach((it, i) => {
      const t = T(it.tid), L = lay.items[i];
      lines.push(pad2(i + 1) + '  ' + fmtT(i ? lay.b2t(L.mb0 + L.inOv / 2) : 0) + '  ' + (t.artist ? t.artist + ' – ' : '') + t.title + '  (' + it.tempo.toFixed(1) + ' BPM' + (t.tonic != null ? ', ' + Core.keyCode(t.tonic, t.minor) : '') + ')');
    });
    return lines.join('\r\n') + '\r\n';
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let expCancel = false, expResult = null, expBusy = false;
  function aiffHeader(frames) {
    const d = new DataView(new ArrayBuffer(54)), w = (o, t) => { for (let i = 0; i < 4; i++) d.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'FORM'); d.setUint32(4, 46 + frames * 4); w(8, 'AIFF'); w(12, 'COMM'); d.setUint32(16, 18); d.setUint16(20, 2); d.setUint32(22, frames); d.setUint16(26, 16);
    d.setUint16(28, 0x400E); d.setUint16(30, 0xAC44); w(38, 'SSND'); d.setUint32(42, frames * 4 + 8);
    return new Uint8Array(d.buffer);
  }
  function makeSink(fmt, total) {
    const parts = []; let crc = 0, size = 0;
    const add = u8 => { parts.push(u8); crc = Core.crc32(u8, crc); size += u8.length; };
    const done = ext => ({ parts, size, crc, ext });
    const q = (v, m) => { v = Math.round(v * m); return v > m ? m : v < -m - 1 ? -m - 1 : v; };
    const ints = (x, o, n) => { const a = new Int16Array(n); for (let i = 0; i < n; i++) a[i] = q(x[o + i], 32767); return a; };
    if (fmt.startsWith('mp3')) {
      const enc = new lamejs.Mp3Encoder(2, SR, +fmt.slice(3));
      return { async write(l, r, o, n, prog) {
        const li = ints(l, o, n), ri = ints(r, o, n), B = 1152 * 120;
        for (let p = 0; p < n; p += B) { const m = enc.encodeBuffer(li.subarray(p, Math.min(n, p + B)), ri.subarray(p, Math.min(n, p + B))); if (m.length) add(new Uint8Array(m)); prog(Math.min(n, p + B) / n); await sleep(0); if (expCancel) throw new Error('annulé'); }
      }, end() { const m = enc.flush(); if (m.length) add(new Uint8Array(m)); return done('mp3'); } };
    }
    if (fmt === 'flac24') {
      const enc = Core.flacEncoder(total, SR, 24); add(enc.header);
      const i24 = (x, o, n) => { const a = new Int32Array(n); for (let i = 0; i < n; i++) a[i] = q(x[o + i], 8388607); return a; };
      return { async write(l, r, o, n) { add(enc.encode(i24(l, o, n), i24(r, o, n))); }, end: () => done('flac') };
    }
    if (fmt === 'flac') {
      const enc = Core.flacEncoder(total, SR, 16); add(enc.header);
      return { async write(l, r, o, n) { add(enc.encode(ints(l, o, n), ints(r, o, n))); }, end: () => done('flac') };
    }
    if (fmt === 'wav24') {
      add(Core.wavHeader(total, SR, 2, 24));
      return { async write(l, r, o, n) { const u = new Uint8Array(n * 6); for (let i = 0, k = 0; i < n; i++) { let v = q(l[o + i], 8388607); u[k++] = v & 255; u[k++] = (v >> 8) & 255; u[k++] = (v >> 16) & 255; v = q(r[o + i], 8388607); u[k++] = v & 255; u[k++] = (v >> 8) & 255; u[k++] = (v >> 16) & 255; } add(u); }, end: () => done('wav') };
    }
    if (fmt === 'aiff') {
      add(aiffHeader(total));
      return { async write(l, r, o, n) { const u = new Uint8Array(n * 4); for (let i = 0, k = 0; i < n; i++) { let v = q(l[o + i], 32767); u[k++] = (v >> 8) & 255; u[k++] = v & 255; v = q(r[o + i], 32767); u[k++] = (v >> 8) & 255; u[k++] = v & 255; } add(u); }, end: () => done('aiff') };
    }
    add(Core.wavHeader(total, SR, 2, 16));
    return { async write(l, r, o, n) { const u = new Int16Array(n * 2); for (let i = 0; i < n; i++) { u[2 * i] = q(l[o + i], 32767); u[2 * i + 1] = q(r[o + i], 32767); } add(new Uint8Array(u.buffer)); }, end: () => done('wav') };
  }
  async function renderMix(fmt, onProg) {
    const total = Math.ceil(lay.total * SR), CH = 4096 * 323, sink = makeSink(fmt, total);
    const fxTail = S.snd.exp && (S.snd.echo > 0 || S.snd.rev > 0);
    for (let s0 = 0; s0 < total; s0 += CH) {
      if (expCancel) throw new Error('annulé');
      const n = Math.min(CH, total - s0), pre = s0 > 0 ? (fxTail ? 3 * SR : SR / 2) : 0, tA = (s0 - pre) / SR, tB = (s0 + n) / SR;
      const oc = new OfflineAudioContext(2, n + pre, SR), c = buildMix(oc); c.apply(S.snd.exp ? S.snd : SND0(), lay.tempoAt(Math.max(0, tA)), 0); c.out.connect(oc.destination);
      const idx = [];
      S.playlist.forEach((it, i) => { const L = lay.items[i]; if (lay.b2t(L.mb1) > tA && lay.b2t(L.mb0) < tB) idx.push(i); });
      exportNeed = new Set(idx.map(i => S.playlist[i].tid));
      for (const i of idx) { const tr = T(S.playlist[i].tid); if (!tr.file && tr.demo == null) continue; scheduleItem(oc, c, i, await getBuffer(tr), tA, 0); }
      const rb = await oc.startRendering();
      await sink.write(rb.getChannelData(0), rb.getChannelData(1), pre, n, v => onProg((s0 + v * n) / total));
      onProg((s0 + n) / total); await sleep(0);
    }
    exportNeed = new Set();
    return sink.end();
  }
  function openExport() {
    if (!S.playlist.length) { toast('La playlist est vide.'); return; }
    const miss = S.playlist.filter(it => { const t = T(it.tid); return !t.file && t.demo == null; }).length;
    expResult = null; expCancel = false;
    $('expProg').hidden = true; $('expGo').textContent = 'Exporter'; $('expGo').disabled = false;
    $('expMsg').textContent = miss ? miss + ' morceau(x) sans fichier seront remplacés par du silence. Réimportez-les d\'abord pour un mix complet.' : 'Durée du mix : ' + fmtT(lay.total) + '.';
    $('expNote').textContent = '';
    getDl().then(dl => { $('expNote').textContent = dl ? 'Dans cette page, le fichier audio est remis dans une archive .zip, avec la liste des titres.' : isHosted() ? 'L\'enregistrement de fichiers n\'est pas disponible dans cette vue. Utilisez la version fichier HTML du logiciel.' : ''; });
    const noMp3 = typeof lamejs === 'undefined';
    for (const r of document.querySelectorAll('input[name=fmt]')) if (r.value.startsWith('mp3')) { r.disabled = noMp3; if (noMp3 && r.checked) $('fmtWav').checked = true; }
    $('dlgExport').showModal();
  }
  async function goExport() {
    if (expResult) {
      const r = expResult, dl = await getDl(), enc = new TextEncoder().encode(tracklist());
      const blob = dl ? new Blob(Core.zipStore([{ name: 'mix.' + r.ext, parts: r.parts, size: r.size, crc: r.crc }, { name: 'titres.txt', parts: [enc], size: enc.length, crc: Core.crc32(enc) }]), { type: 'application/zip' })
        : new Blob(r.parts, { type: { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aiff: 'audio/aiff' }[r.ext] });
      if (await saveBlob(dl ? 'Timeline DJ Mix.zip' : 'Timeline DJ Mix.' + r.ext, blob)) $('expMsg').textContent = 'Fichier remis au navigateur.';
      return;
    }
    if (expBusy) return;
    pause(); stopCue(); expBusy = true; expCancel = false;
    const fmt = document.querySelector('input[name=fmt]:checked').value, pr = $('expProg');
    pr.hidden = false; pr.value = 0; $('expGo').disabled = true; $('expCancel').textContent = 'Annuler';
    $('expMsg').textContent = 'Calcul du mix…';
    try {
      expResult = await renderMix(fmt, v => { pr.value = v; $('expMsg').textContent = 'Calcul du mix… ' + Math.round(v * 100) + ' %'; });
      $('expMsg').textContent = 'Mix prêt : ' + (expResult.size / 1048576).toFixed(1) + ' Mo.';
      $('expGo').textContent = 'Enregistrer le fichier';
    } catch (e) {
      exportNeed = new Set();
      $('expMsg').textContent = expCancel ? 'Export annulé.' : 'L\'export a échoué : ' + e.message; pr.hidden = true;
      if (!expCancel) console.error(e);
    }
    expBusy = false; $('expGo').disabled = false; $('expCancel').textContent = 'Fermer';
  }

  /* ================= Auto DJ et soirée par styles ================= */
  const AD = { cur: -1, n: 0 };
  let adBusy = false, ptIdx = -1;
  const usable = t => t.status !== 'err' && t.status !== 'missing';
  const pool = i => S.tracks.filter(t => usable(t) && t.style && t.style === S.party.styles[i].name);
  const adOrder = () => S.party.styles.map((x, i) => i).filter(i => S.party.styles[i].en !== false && pool(i).length);
  function adNext() {
    const inPl = new Set(S.playlist.map(it => it.tid)), ord = adOrder(), st = S.party.styles;
    if (ord.length) {
      for (let k = 0; k <= ord.length; k++) {
        if (!ord.includes(AD.cur) || AD.n >= st[AD.cur].count) { AD.cur = ord[(ord.indexOf(AD.cur) + 1) % ord.length]; AD.n = 0; }
        const c = pool(AD.cur).filter(t => !inPl.has(t.id));
        if (!c.length) { AD.n = Infinity; continue; }
        AD.n++;
        return S.party.shuffle ? c[Math.floor(Math.random() * c.length)] : c[0];
      }
      return null;
    }
    const c = S.tracks.filter(t => usable(t) && !inPl.has(t.id));
    if (!c.length) return null;
    const last = S.playlist[S.playlist.length - 1], lt = last && T(last.tid);
    if (!last) return c[0];
    let best = c[0], bc = Infinity;
    for (const t of c) { const cost = t.bpm == null ? 40 : Math.abs(Math.log2(t.bpm / last.tempo)) * 100 + (Core.keyCompat(lt, t) ? 0 : 3); if (cost < bc) { bc = cost; best = t; } }
    return best;
  }
  /* Ajoute k titres à la suite ; pendant la lecture, ce qui joue n'est pas touché */
  async function adAppend(k, until) {
    if (adBusy) return 0;
    adBusy = true;
    let done = 0, guard = 0;
    try {
      while ((until ? lay.total < until : done < k) && guard++ < 600) {
        const t = adNext();
        if (!t) { if (S.auto && !until) { S.auto = false; toast('Auto DJ : plus aucun titre disponible, il s\'arrête.'); } break; }
        await ensureAnalyzed(t);
        if (t.status !== 'ok' || t.bpm == null) continue;
        if (addToPlaylist(t.id, null, true)) { done++; relayout(); if (until) $('adMsg').textContent = done + ' titres placés, ' + fmtT(lay.total) + '…'; }
      }
    } finally { adBusy = false; }
    if (done) changed();
    renderAutoBtn();
    return done;
  }
  function renderAutoBtn() {
    const b = $('btnAuto'); b.classList.toggle('on', S.auto); b.textContent = S.auto ? 'Auto DJ en marche' : 'Auto DJ arrêté';
    $('adLive').checked = S.auto;
    const ord = adOrder(); $('btnStyle').disabled = ord.length < 2;
    $('btnStyle').title = ord.length && S.party.styles[AD.cur] ? 'Style en cours : ' + S.party.styles[AD.cur].name + '. Passer au style suivant' : 'Passer au style suivant';
  }
  function renderAuto() {
    $('ptShuffle').checked = !!S.party.shuffle; $('adMins').value = S.party.mins;
    $('ptList').innerHTML = S.party.styles.map((x, i) => `<tr data-i="${i}"><td><button class="ico" data-a="up" aria-label="Monter ${esc(x.name)}">▲</button> <button class="ico" data-a="dn" aria-label="Descendre ${esc(x.name)}">▼</button></td>` +
      `<td><input type="checkbox" data-a="en" id="pt-en-${i}" ${x.en !== false ? 'checked' : ''} aria-label="Activer ${esc(x.name)}"></td><td><input type="text" data-a="name" id="pt-name-${i}" value="${esc(x.name)}" aria-label="Nom du style" style="width:110px"></td>` +
      `<td><button data-a="dir">Choisir le dossier</button></td><td class="num">${pool(i).length}</td><td><input type="number" data-a="count" id="pt-count-${i}" min="1" max="20" value="${x.count}" aria-label="Titres par série" style="width:56px"></td>` +
      `<td><button class="ico" data-a="rm" aria-label="Supprimer ${esc(x.name)}">✕</button></td></tr>`).join('');
    $('ptAdd').disabled = S.party.styles.length >= 8;
    renderAutoBtn();
  }
  function setAuto(v) {
    S.auto = !!v; renderAutoBtn(); mxState();
    if (S.auto && !S.tracks.some(t => usable(t) && !S.playlist.some(it => it.tid === t.id))) toast('Auto DJ : tous les titres de la bibliothèque sont déjà dans le mix. Importez-en d\'autres ou choisissez des dossiers de styles.');
  }

  /* ================= Son : voies, crossfader, effets ================= */
  const SNDCTL = [['a.vol', 'Volume', 0, 1, 1], ['a.lo', 'Graves', -1, 1, 0], ['a.mid', 'Médiums', -1, 1, 0], ['a.hi', 'Aigus', -1, 1, 0], ['a.flt', 'Filtre', -1, 1, 0], ['a.tmp', 'Tempo ±8 %', -0.08, 0.08, 0], ['xf', 'Crossfader', -1, 1, 0],
    ['b.vol', 'Volume', 0, 1, 1], ['b.lo', 'Graves', -1, 1, 0], ['b.mid', 'Médiums', -1, 1, 0], ['b.hi', 'Aigus', -1, 1, 0], ['b.flt', 'Filtre', -1, 1, 0], ['b.tmp', 'Tempo ±8 %', -0.08, 0.08, 0], ['echo', 'Écho', 0, 1, 0], ['flg', 'Flanger', 0, 1, 0], ['rev', 'Réverb', 0, 1, 0]];
  const sndGet = k => (k[1] === '.' ? S.snd[k[0]][k.slice(2)] : S.snd[k]);
  let setT = 0;
  function sndSet(k, v, fromUi, exact) {
    const c = SNDCTL.find(x => x[0] === k); if (!c) return;
    v = clamp(+v || 0, c[2], c[3]); if (!exact && c[2] < 0 && Math.abs(v) < 0.02 * (c[3] - c[2])) v = 0;
    if (k[1] === '.') S.snd[k[0]][k.slice(2)] = v; else S.snd[k] = v;
    if (!fromUi) { const el = document.querySelector('[data-snd="' + k + '"]'); if (el) el.value = v; }
    if (live) live.apply(S.snd, lay.total ? lay.tempoAt(Math.min(mixNow(), lay.total)) : 120, 0.015);
    clearTimeout(setT); setT = setTimeout(saveSettings, 500);
  }
  function buildSnd() {
    const grp = (title, cls, keys) => `<div class="strip ${cls}"><b>${title}</b>${keys.map(k => { const c = SNDCTL.find(x => x[0] === k); return `<label class="kn"><span>${c[1]}</span><input type="range" min="${c[2]}" max="${c[3]}" step="${c[3] - c[2] < 1 ? 0.001 : 0.01}" value="${sndGet(k)}" data-snd="${k}" id="snd-${k.replace('.', '-')}" title="Double-clic : remise à zéro"></label>`; }).join('')}</div>`;
    $('snd').innerHTML = grp('Voie A', 'la', ['a.vol', 'a.lo', 'a.mid', 'a.hi', 'a.flt', 'a.tmp']) + grp('A ↔ B', 'xf', ['xf']) + grp('Voie B', 'lb', ['b.vol', 'b.lo', 'b.mid', 'b.hi', 'b.flt', 'b.tmp']) + grp('Effets', 'fx', ['echo', 'flg', 'rev']) +
      `<div class="strip opt"><b>Casque</b><label class="kn"><span>Volume de pré-écoute</span><input type="range" id="cvol" min="0" max="100" value="85"></label></div>` +
      `<div class="strip opt"><b>Sorties</b><label class="kn"><span>Sortie générale</span><select id="outMaster"><option value="">Par défaut</option></select></label>` +
      `<label class="kn"><span>Répartition</span><select id="outMode"><option value="stereo">Stéréo</option><option value="quad">Carte 4 canaux : général 1-2, casque 3-4</option><option value="quadinv">Carte 4 canaux : casque 1-2, général 3-4</option></select></label>` +
      `<label class="kn"><span>Casque sur une autre carte son</span><select id="outCue"><option value="">Désactivé</option></select></label>` +
      `<button id="cueAsk" title="Le navigateur demande l'accès au micro pour donner le nom des cartes son ; rien n'est enregistré">Lister les cartes son</button><span class="muted" id="outInfo"></span></div>` +
      `<div class="strip opt"><label><input type="checkbox" id="sndExp"${S.snd.exp ? ' checked' : ''}> Appliquer ces réglages à l'export</label><button id="sndReset">Tout remettre à zéro</button><button id="sndMini" title="Basculer entre la vue contrôleur DJ et la vue simple d'origine">Vue simple</button></div>`;
    $('outMode').value = S.out.mode || 'stereo';
    listOutputs(false);
  }
  async function listOutputs(ask) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { $('outInfo').textContent = 'Ce navigateur ne permet pas de choisir les sorties.'; return; }
    try {
      if (ask) { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach(t => t.stop()); }
      const d = (await navigator.mediaDevices.enumerateDevices()).filter(x => x.kind === 'audiooutput' && x.deviceId !== 'default' && x.deviceId !== 'communications');
      const opts = d.map((x, i) => `<option value="${esc(x.deviceId)}">${esc(x.label || 'Sortie ' + (i + 1))}</option>`).join('');
      const m = $('outMaster'), c = $('outCue');
      m.innerHTML = '<option value="">Par défaut</option>' + opts; c.innerHTML = '<option value="">Désactivé</option>' + opts;
      m.value = [...m.options].some(o => o.value === S.out.master) ? S.out.master : ''; c.value = [...c.options].some(o => o.value === S.out.cue) ? S.out.cue : '';
      if (!d.length || !d.some(x => x.label)) $('outInfo').textContent = 'Cliquez « Lister les cartes son » pour voir leurs noms.';
      if (!(window.AudioContext && 'setSinkId' in AudioContext.prototype)) m.disabled = true;
    } catch (e) { if (ask) toast('Sans cette autorisation, le navigateur ne donne pas la liste des cartes son.'); }
  }

  /* ================= Mappings Mixxx (moteur repris de Platine DUO) ================= */
  let MXD = { libs: {}, presets: {} };
  try { MXD = JSON.parse($('mx-data').textContent); } catch (e) { /* pas de mappings fournis */ }
  const PUSH = new Set(['cue_default', 'cue_set', 'cue_gotoandplay', 'cue_gotoandstop', 'cue_preview', 'beatsync', 'beatsync_phase', 'beatsync_tempo', 'rate_perm_up', 'rate_perm_down', 'rate_perm_up_small', 'rate_perm_down_small',
    'rate_temp_up', 'rate_temp_down', 'rate_temp_up_small', 'rate_temp_down_small', 'beatloop_activate', 'loop_in', 'loop_out', 'reloop_toggle', 'reloop_exit', 'reloop_andstop', 'loop_halve', 'loop_double', 'beatjump_forward', 'beatjump_backward',
    'LoadSelectedTrack', 'LoadSelectedTrackAndPlay', 'eject', 'back', 'fwd', 'start', 'end', 'stop', 'start_play', 'start_stop', 'bpm_tap', 'play_stutter', 'rate_set_zero', 'pitch_adjust_set_default', 'rate_set_default']);
  const TOGGLE = new Set(['play', 'repeat', 'sync_enabled', 'pfl', 'keylock', 'quantize', 'reverse', 'slip_enabled', 'mute', 'scratch_touch', 'scratch2_enable', 'vinyl', 'sync_master', 'sync_leader', 'loop_enabled']);
  function specFor(g, k) {
    if (/^\[Channel[1-4]\]$/.test(g)) {
      if (k === 'rate') return { t: 'pot', min: -1, max: 1, def: 0, c: 1 };
      if (k === 'volume') return { t: 'pot', min: 0, max: 1, def: 1 };
      if (k === 'pregain') return { t: 'log', min: 0, max: 4, def: 1 };
      if (k === 'scratch2') return { t: 'pot', min: -3, max: 3, def: 0, c: 1 };
      if (k === 'jog' || k === 'wheel') return { t: 'rel', def: 0 };
      if (k === 'rateRange') return { t: 'raw', def: 0.08 };
      if (k === 'rate_dir' || k === 'track_loaded') return { t: 'raw', def: 1 };
      if (k === 'track_samplerate') return { t: 'raw', def: 44100 };
      if (k === 'beatloop_size' || k === 'beatjump_size') return { t: 'raw', def: 4 };
      if (k === 'orientation') return { t: 'raw', def: g === '[Channel1]' || g === '[Channel3]' ? 0 : 2 };
      if (k === 'vinyl' || k === 'quantize') return { t: 'toggle', def: 1 };
      if (TOGGLE.has(k)) return { t: 'toggle', def: 0 };
      if (PUSH.has(k) || /^hotcue_\d+_(activate|clear|set|goto|gotoandplay|gotoandstop|activate_preview)$/.test(k) || /^beatloop_[\d.]+_(toggle|activate)$/.test(k) || /^beatjump_[\d.]+_(forward|backward)$/.test(k) || /^beatlooproll_[\d.]+_activate$/.test(k)) return { t: 'push', def: 0 };
      return { t: 'raw', def: 0 };
    }
    if (/^\[EqualizerRack1_\[Channel[1-4]\]_Effect1\]$/.test(g)) {
      if (/^parameter[123]$/.test(k)) return { t: 'log', min: 0, max: 4, def: 1 };
      if (/^button_parameter[123]$/.test(k)) return { t: 'toggle', def: 0 };
      if (k === 'enabled') return { t: 'toggle', def: 1 };
    }
    if (/^\[QuickEffectRack1_\[Channel[1-4]\]\]$/.test(g)) {
      if (k === 'super1') return { t: 'pot', min: 0, max: 1, def: 0.5, c: 1 };
      if (k === 'enabled') return { t: 'toggle', def: 1 };
    }
    if (g === '[Master]') {
      if (k === 'crossfader' || k === 'balance') return { t: 'pot', min: -1, max: 1, def: 0, c: 1 };
      if (k === 'headMix') return { t: 'pot', min: -1, max: 1, def: -1, c: 1 };
      if (k === 'gain' || k === 'headGain') return { t: 'log', min: 0, max: 5, def: 1 };
      if (/^crossfader_(up|down)(_small)?$/.test(k)) return { t: 'push', def: 0 };
    }
    if (g === '[Library]' || g === '[Playlist]') {
      if (k === 'focused_widget') return { t: 'raw', def: 3 };
      if (k === 'MoveVertical' || k === 'MoveHorizontal' || k === 'SelectTrackKnob' || k === 'ScrollVertical' || k === 'SelectPlaylist' || k === 'MoveFocus') return { t: 'rel', def: 0 };
      return { t: 'push', def: 0 };
    }
    if (/^\[EffectRack1_EffectUnit[1-4]\]$/.test(g)) {
      if (k === 'mix' || k === 'super1') return { t: 'pot', min: 0, max: 1, def: 0 };
      if (k === 'enabled' || /^group_\[.+\]_enable$/.test(k)) return { t: 'toggle', def: 0 };
      if (k === 'chain_selector' || k === 'chain_preset_selector') return { t: 'rel', def: 0 };
      if (k === 'num_effectslots' || k === 'num_effects') return { t: 'raw', def: 3 };
      return { t: 'push', def: 0 };
    }
    if (/^\[EffectRack1_EffectUnit[1-4]_Effect[123]\]$/.test(g)) {
      if (k === 'enabled') return { t: 'toggle', def: 0 };
      if (k === 'meta') return { t: 'pot', min: 0, max: 1, def: 0 };
      if (k === 'effect_selector') return { t: 'rel', def: 0 };
      if (/^parameter\d+$/.test(k)) return { t: 'pot', min: 0, max: 1, def: 0.5 };
      return { t: 'raw', def: 0 };
    }
    if (/^\[Sampler\d+\]$/.test(g)) { if (k === 'play') return { t: 'toggle', def: 0 }; if (k === 'volume') return { t: 'pot', min: 0, max: 1, def: 1 }; return { t: 'raw', def: 0 }; }
    if ((g === '[App]' || g === '[Master]') && (k === 'num_decks' || k === 'num_samplers')) return { t: 'raw', def: 4 };
    if (g === '[AutoDJ]') return k === 'enabled' ? { t: 'toggle', def: 0 } : { t: 'push', def: 0 };
    return { t: 'raw', def: 0 };
  }
  function aliasOf(g, k) {
    if (g === '[Mixer]') g = '[Master]';
    if (g === '[Master]' && k === 'volume') k = 'gain';
    if (g === '[Master]' && k === 'headVolume') k = 'headGain';
    const m = g.match(/^\[Channel([1-4])\]$/);
    if (m) {
      const eq = '[EqualizerRack1_[Channel' + m[1] + ']_Effect1]', b = { filterLow: 1, filterMid: 2, filterHigh: 3 }[k];
      if (b) return [eq, 'parameter' + b];
      const kl = k.match(/^filter(Low|Mid|High)Kill$/);
      if (kl) return [eq, 'button_parameter' + { Low: 1, Mid: 2, High: 3 }[kl[1]]];
      if (k === 'play_latched') k = 'play';
      if (k === 'sync_mode') k = 'sync_enabled';
    }
    if (/^\[EffectRack1_EffectUnit[1-4]\]$/.test(g) && k === 'super1') k = 'mix';
    return [g, k];
  }
  const CO = {
    m: new Map(),
    ctl(g, k) {
      [g, k] = aliasOf(String(g), String(k));
      const id = g + '|' + k; let c = this.m.get(id);
      if (!c) { const s = specFor(g, k); c = { g, k, s, v: s.def, cbs: new Set() }; this.m.set(id, c); }
      return c;
    },
    get(g, k) { return this.ctl(g, k).v; },
    set(g, k, v, src) {
      const c = this.ctl(g, k); v = +v; if (!isFinite(v)) v = 0;
      const old = c.v; c.v = v;
      if (!Mx.dry) { try { mxAct(c, v, old, src); } catch (e) { console.error(e); } }
      if (c.v !== old || c.s.t === 'push' || c.s.t === 'rel') this.emit(c);
    },
    /* mise à jour venant du logiciel : informe les scripts et les voyants, sans déclencher d'action */
    upd(g, k, v) { const c = this.ctl(g, k); if (c.v === v) return; c.v = v; this.emit(c); },
    emit(c) { for (const f of [...c.cbs]) { try { f(c.v, c.g, c.k); } catch (e) { Mx.err(e); } } },
    on(g, k, f) { const c = this.ctl(g, k); c.cbs.add(f); return () => c.cbs.delete(f); },
    toP(s, v) { return s.t === 'log' ? (v <= 1 ? v / 2 : 0.5 + (v - 1) / (s.max - 1) / 2) : s.t === 'pot' ? (v - s.min) / (s.max - s.min) : s.t === 'toggle' || s.t === 'push' ? (v > 0 ? 1 : 0) : v; },
    fromP(s, p) { return s.t === 'log' ? (p <= 0.5 ? p * 2 : 1 + (p - 0.5) * 2 * (s.max - 1)) : s.t === 'pot' ? s.min + p * (s.max - s.min) : s.t === 'toggle' || s.t === 'push' ? (p > 0.5 ? 1 : 0) : p; },
    midiP(s, val) { return (s.t === 'log' || s.c) ? (val <= 64 ? val / 128 : 0.5 + (val - 64) / 126) : val / 127; },
    param(g, k) { const c = this.ctl(g, k); return this.toP(c.s, c.v); },
    setParam(g, k, p, src) { const c = this.ctl(g, k); this.set(c.g, c.k, this.fromP(c.s, clamp(p, 0, 1)), src); },
    def(g, k) { return this.ctl(g, k).s.def; }
  };
  /* Déplacement au jog : les ticks sont cumulés pour ne pas relancer la lecture à chaque pas */
  let jogAcc = 0, jogT = 0;
  function jogBy(ticks) { jogAcc += ticks; if (!jogT) jogT = setTimeout(() => { const d = jogAcc; jogAcc = 0; jogT = 0; if (d) seek(mixNow() + d * 0.02); }, 90); }
  function browse(dir) {
    if (!libRows.length || !dir) return;
    const k = clamp(libRows.findIndex(t => t.id === S.libSel) + Math.sign(dir), 0, libRows.length - 1);
    S.libSel = libRows[k].id; renderLib(); const r = $('libBody').children[k]; if (r) r.scrollIntoView({ block: 'nearest' });
  }
  /* Traduit une commande Mixxx en action sur la timeline : platines 1 et 3 = voie A, 2 et 4 = voie B */
  function mxAct(c, v, old, src) {
    const g = c.g, k = c.k, beat = () => 60 / (lay.total ? lay.tempoAt(Math.min(mixNow(), lay.total)) : 120);
    let m, m2;
    if ((m = g.match(/^\[Channel([1-4])\]$/))) {
      const ln = (+m[1] - 1) % 2 ? 'b' : 'a';
      if (k === 'play') { if ((v > 0) !== P.playing) (v > 0 ? play() : pause()); }
      else if (k === 'volume') sndSet(ln + '.vol', v);
      else if (k === 'rate') sndSet(ln + '.tmp', v * (CO.get(g, 'rateRange') || 0.08) * (CO.get(g, 'rate_dir') || 1));
      else if ((m2 = k.match(/^rate_(perm|temp)_(up|down)(_small)?$/))) {
        if (m2[1] === 'temp') { if (v > 0) { Mx.tmpKeep = Mx.tmpKeep || {}; Mx.tmpKeep[ln] = S.snd[ln].tmp; sndSet(ln + '.tmp', S.snd[ln].tmp + (m2[2] === 'up' ? 1 : -1) * (m2[3] ? 0.01 : 0.04), false, true); } else if (Mx.tmpKeep && Mx.tmpKeep[ln] != null) { sndSet(ln + '.tmp', Mx.tmpKeep[ln], false, true); Mx.tmpKeep[ln] = null; } }
        else if (v > 0) sndSet(ln + '.tmp', S.snd[ln].tmp + (m2[2] === 'up' ? 1 : -1) * (m2[3] ? 0.001 : 0.005), false, true);
      }
      else if (k === 'rate_set_zero' || k === 'pitch_adjust_set_default' || k === 'rate_set_default') { if (v > 0) sndSet(ln + '.tmp', 0); }
      else if (k === 'cue_default' || k === 'cue_gotoandstop' || k === 'cue_gotoandplay' || k === 'start' || k === 'start_stop' || k === 'start_play') { if (v > 0) nextTransition(-1); }
      else if (k === 'LoadSelectedTrack' || k === 'LoadSelectedTrackAndPlay') { if (v > 0 && S.libSel) addToPlaylist(S.libSel); }
      else if (k === 'pfl') { const t = T(S.libSel); if (v > 0) { if (t && cueId() !== 't:' + t.id) cueTrack(t); } else stopCue(); }
      else if (k === 'jog' || k === 'wheel') { if (v) jogBy(v); }
      else if (k === 'beatjump_forward' || k === 'fwd') { if (v > 0) seek(mixNow() + 4 * beat()); }
      else if (k === 'beatjump_backward' || k === 'back') { if (v > 0) seek(mixNow() - 4 * beat()); }
      else if ((m2 = k.match(/^beatjump_([\d.]+)_(forward|backward)$/))) { if (v > 0) seek(mixNow() + (m2[2] === 'forward' ? 1 : -1) * +m2[1] * beat()); }
      else if ((m2 = k.match(/^hotcue_(\d+)_(activate|goto|gotoandplay)$/))) { const L = lay.items[+m2[1] - 1]; if (v > 0 && L) seek(lay.b2t(L.mb0)); }
    } else if ((m = g.match(/^\[EqualizerRack1_\[Channel([1-4])\]_Effect1\]$/))) {
      const ln = (+m[1] - 1) % 2 ? 'b' : 'a', b = { parameter1: 'lo', parameter2: 'mid', parameter3: 'hi' }[k], kb = { button_parameter1: 'lo', button_parameter2: 'mid', button_parameter3: 'hi' }[k];
      if (b) sndSet(ln + '.' + b, v <= 1 ? v - 1 : (v - 1) / 3);
      else if (kb) sndSet(ln + '.' + kb, v > 0 ? -1 : 0);
    } else if ((m = g.match(/^\[QuickEffectRack1_\[Channel([1-4])\]\]$/))) { if (k === 'super1') sndSet(((+m[1] - 1) % 2 ? 'b' : 'a') + '.flt', (v - 0.5) * 2); }
    else if (g === '[Master]') {
      if (k === 'crossfader') sndSet('xf', v);
      else if (k === 'gain') { const p = CO.toP(c.s, v); $('mvol').value = Math.round(p * 100); if (mvol) mvol.gain.value = p; }
      else if (k === 'headGain') { const p = CO.toP(c.s, v); if ($('cvol')) $('cvol').value = Math.round(p * 100); if (cue) cue.g.gain.value = p; }
    } else if (g === '[Library]' || g === '[Playlist]') {
      if (c.s.t === 'rel') { if (k !== 'MoveHorizontal' && k !== 'MoveFocus' && k !== 'SelectPlaylist') browse(v); }
      else if (v > 0) {
        if (k === 'MoveDown' || k === 'SelectNextTrack' || k === 'ScrollDown') browse(1);
        else if (k === 'MoveUp' || k === 'SelectPrevTrack' || k === 'ScrollUp') browse(-1);
        else if (k === 'GoToItem' || k === 'AutoDjAddBottom' || k === 'AutoDjAddTop' || k === 'LoadSelectedIntoFirstStopped') { if (S.libSel) addToPlaylist(S.libSel); }
      }
    } else if ((m = g.match(/^\[EffectRack1_EffectUnit([1-4])(_Effect1)?\]$/))) { if (k === 'mix' || k === 'meta') sndSet(['echo', 'rev', 'flg', 'echo'][+m[1] - 1], v); }
    else if (g === '[AutoDJ]') {
      if (k === 'enabled') setAuto(v > 0);
      else if (v > 0 && k === 'skip_next') { AD.n = Infinity; renderAutoBtn(); }
      else if (v > 0 && k === 'fade_now') nextTransition(1);
    }
  }
  /* État du logiciel renvoyé aux scripts et aux voyants */
  function mxState() {
    if (!Mx.preset) return;
    const t = Math.min(mixNow(), lay.total), tp = lay.total ? lay.tempoAt(t) : 0;
    for (let d = 1; d <= 4; d++) {
      const g = '[Channel' + d + ']';
      CO.upd(g, 'play', P.playing ? 1 : 0); CO.upd(g, 'play_indicator', P.playing ? 1 : 0); CO.upd(g, 'cue_indicator', P.playing ? 0 : 1);
      CO.upd(g, 'rate', (S.snd[(d - 1) % 2 ? 'b' : 'a'].tmp || 0) / (CO.get(g, 'rateRange') || 0.08) * (CO.get(g, 'rate_dir') || 1));
      CO.upd(g, 'duration', lay.total); CO.upd(g, 'bpm', tp); CO.upd(g, 'file_bpm', tp); CO.upd(g, 'playposition', lay.total ? t / lay.total : 0);
    }
    CO.upd('[AutoDJ]', 'enabled', S.auto ? 1 : 0);
  }
  class ColorMapper {
    constructor(map) { this.m = Object.entries(map).map(([c, v]) => [+c, v]); }
    nearest(c) { let best = this.m[0], bd = Infinity; for (const e of this.m) { const a = e[0], d = (((a >> 16) & 255) - ((c >> 16) & 255)) ** 2 + (((a >> 8) & 255) - ((c >> 8) & 255)) ** 2 + ((a & 255) - (c & 255)) ** 2; if (d < bd) { bd = d; best = e; } } return best; }
    getValueForNearestColor(c) { const n = this.nearest(c); return n && n[1]; }
    getNearestColor(c) { const n = this.nearest(c), a = (n && n[0]) || 0; return { red: (a >> 16) & 255, green: (a >> 8) & 255, blue: a & 255 }; }
  }
  const Mx = {
    preset: null, controls: new Map(), outputs: [], resolver: null, cache: new Map(), conns: new Set(), timers: new Map(), tid: 1, handlers: new Map(), outSubs: [],
    scr: {}, lsb: {}, hidLast: {}, hidFeat: {}, frame: null, prefixes: [], name: '', missing: [], errCount: 0, errs: [], kind: 'midi', dry: false, hid: null,
    err(e) { this.errCount++; const s = String((e && e.message) || e); if (this.errs.length < 8 && !this.errs.includes(s)) this.errs.push(s); },
    send(s, a, b) { if (midiAcc) for (const o of midiAcc.outputs.values()) { try { o.send([s & 255, a & 127, b & 127]); } catch (e) { /* sortie fermée */ } } },
    sysex(arr) { if (midiAcc) for (const o of midiAcc.outputs.values()) { try { o.send(Array.from(arr)); } catch (e) { /* SysEx non autorisé */ } } },
    engine() {
      const M = this, toCb = cb => (typeof cb === 'string' ? M.fn(cb) : cb);
      return {
        getValue: (g, k) => CO.get(g, k),
        setValue: (g, k, v) => CO.set(g, k, v, 'script'),
        getParameter: (g, k) => CO.param(g, k),
        setParameter: (g, k, p) => CO.setParam(g, k, p, 'script'),
        getParameterForValue: (g, k, v) => CO.toP(CO.ctl(g, k).s, v),
        reset: (g, k) => CO.set(g, k, CO.def(g, k), 'script'),
        getDefaultValue: (g, k) => CO.def(g, k),
        getDefaultParameter: (g, k) => CO.toP(CO.ctl(g, k).s, CO.def(g, k)),
        makeConnection: (g, k, cb) => M.connect(g, k, toCb(cb)),
        makeUnbufferedConnection: (g, k, cb) => M.connect(g, k, toCb(cb)),
        connectControl: (g, k, cb, remove) => {
          if (remove) { for (const c of [...M.conns]) if (c.g === g && c.k === k && (c.name === cb || c.cb === cb)) c.disconnect(); return true; }
          const c = M.connect(g, k, toCb(cb)); c.name = typeof cb === 'string' ? cb : null; return c;
        },
        trigger: (g, k) => { const c = CO.ctl(g, k); for (const x of M.conns) if (x.g === c.g && x.k === c.k) x.trigger(); },
        beginTimer: (ms, f, one) => {
          const fn = typeof f === 'string' ? () => M.evalStr(f) : f, id = M.tid++;
          const run = () => { try { fn(); } catch (e) { M.err(e); } if (one) M.timers.delete(id); };
          M.timers.set(id, one ? setTimeout(run, Math.max(20, ms)) : setInterval(run, Math.max(20, ms)));
          return id;
        },
        stopTimer: id => { const t = M.timers.get(id); if (t) { clearTimeout(t); clearInterval(t); M.timers.delete(id); return true; } return false; },
        scratchEnable: d => { M.scr[d] = true; }, scratchTick: (d, i) => { if (M.scr[d] && !M.dry) jogBy(i); }, scratchDisable: d => { delete M.scr[d]; }, isScratching: d => !!M.scr[d],
        brake: () => {}, spinback: () => {}, softStart: (d, on) => { if (on && !M.dry) CO.set('[Channel' + d + ']', 'play', 1, 'script'); },
        softTakeover: () => {}, softTakeoverIgnoreNextValue: () => {}, log: () => {}, getSetting: () => undefined, getStringValue: () => '', setStringValue: () => {}
      };
    },
    connect(g, k, cb) {
      const M = this, c = CO.ctl(g, k);
      const conn = { g: c.g, k: c.k, cb, isConnected: true,
        disconnect() { if (!this.isConnected) return false; this.off(); this.isConnected = false; M.conns.delete(this); return true; },
        trigger() { if (this.isConnected && typeof this.cb === 'function') try { this.cb(CO.get(this.g, this.k), this.g, this.k); } catch (e) { M.err(e); } },
        off: null };
      conn.off = CO.on(c.g, c.k, (v, gg, kk) => { if (typeof cb === 'function') cb(v, gg, kk); });
      this.conns.add(conn); return conn;
    },
    midiApi() {
      const M = this;
      return { sendShortMsg: (s, a, b) => M.send(s, a, b), sendSysexMsg: arr => M.sysex(arr),
        makeInputHandler: (s, n, cb) => { const key = (s << 8) | n; let set = M.handlers.get(key); if (!set) M.handlers.set(key, set = new Set()); const h = { cb, disconnect() { set.delete(h); return true; }, isConnected: true }; set.add(h); return h; } };
    },
    controllerApi() {
      const M = this, out = (rid, data) => { if (M.hid && M.hid.opened) M.hid.sendReport(rid || 0, Uint8Array.from(data)).catch(() => {}); };
      return { send: (b, l, r) => out(r, b), sendOutputReport: (r, d) => out(r, d), sendFeatureReport: (r, d) => { if (M.hid && M.hid.opened) M.hid.sendFeatureReport(r, Uint8Array.from(d)).catch(() => {}); },
        getInputReport: r => M.hidLast[r] || new Uint8Array(40), getFeatureReport: r => M.hidFeat[r] || new Uint8Array(32), sendShortMsg: (s, a, b) => M.send(s, a, b), sendSysexMsg: a => M.sysex(a) };
    },
    fn(name) {
      if (this.cache.has(name)) return this.cache.get(name);
      let f = null, parent;
      try { f = this.resolver(name); const i = name.lastIndexOf('.'); if (i > 0) parent = this.resolver(name.slice(0, i)); } catch (e) { this.err('Fonction introuvable : ' + name); }
      const bound = typeof f === 'function' ? f.bind(parent) : null;
      this.cache.set(name, bound); return bound;
    },
    evalStr(code) { try { return this.resolver(code); } catch (e) { this.err(e); } },
    unload() {
      for (const p of this.prefixes) { const f = this.resolver ? this.fn(p + '.shutdown') : null; if (f) try { f(); } catch (e) { /* arrêt */ } }
      for (const c of [...this.conns]) c.disconnect();
      for (const t of this.timers.values()) { clearTimeout(t); clearInterval(t); } this.timers.clear();
      for (const u of this.outSubs) u(); this.outSubs = [];
      this.handlers.clear(); this.controls.clear(); this.outputs = []; this.cache.clear(); this.resolver = null; this.preset = null; this.prefixes = []; this.missing = []; this.name = ''; this.scr = {}; this.errCount = 0; this.errs = [];
      if (this.frame) { this.frame.remove(); this.frame = null; }
    },
    /* saved : { builtin: id } ou { xml: nom, files: { nom: contenu } } */
    activate(saved) {
      this.unload();
      let src = saved;
      if (saved && saved.builtin) { const p = MXD.presets[saved.builtin]; if (!p) return false; src = { xml: p.xml, files: p.files }; }
      if (!src || !src.xml || !src.files || !src.files[src.xml]) return false;
      this.kind = /\.hid\.xml$/i.test(src.xml) ? 'hid' : 'midi';
      const doc = new DOMParser().parseFromString(src.files[src.xml], 'application/xml');
      if (doc.querySelector('parsererror')) { toast('Le fichier XML du mapping est illisible.'); return false; }
      const txt = (el, sel) => { const x = el.querySelector(sel); return ((x && x.textContent) || '').trim(); };
      const num = s => { s = (s || '').trim(); return s ? (/^0x/i.test(s) ? parseInt(s, 16) : parseInt(s, 10)) : NaN; };
      this.name = txt(doc, 'info > name') || src.xml.replace(/\.(midi|hid)\.xml$|\.xml$/i, '');
      for (const c of doc.querySelectorAll('controls > control')) {
        const st = num(txt(c, 'status')), no = num(txt(c, 'midino')); if (isNaN(st) || isNaN(no)) continue;
        const oe = c.querySelector('options'), opts = [...((oe && oe.children) || [])].map(o => o.tagName.toLowerCase());
        const e = { g: txt(c, 'group'), k: txt(c, 'key'), opts, script: opts.includes('script-binding') };
        const key = (st << 8) | no; if (!this.controls.has(key)) this.controls.set(key, []); this.controls.get(key).push(e);
      }
      for (const o of doc.querySelectorAll('outputs > output')) {
        const st = num(txt(o, 'status')), no = num(txt(o, 'midino') || txt(o, 'number')); if (isNaN(st) || isNaN(no)) continue;
        const on = num(txt(o, 'on')), off = num(txt(o, 'off')), mn = parseFloat(txt(o, 'minimum')), mx = parseFloat(txt(o, 'maximum'));
        this.outputs.push({ g: txt(o, 'group'), k: txt(o, 'key'), st, no, on: isNaN(on) ? 0x7f : on, off: isNaN(off) ? 0 : off, min: isNaN(mn) ? 0.5 : mn, max: isNaN(mx) ? 1e9 : mx });
      }
      const list = [...doc.querySelectorAll('scriptfiles > file')].map(f => ({ name: f.getAttribute('filename') || '', prefix: f.getAttribute('functionprefix') || '' }));
      const lower = {}; for (const n of Object.keys(src.files)) lower[n.toLowerCase()] = n;
      const get = n => { const base = n.split('/').pop(), real = lower[n.toLowerCase()] || lower[base.toLowerCase()]; return real ? src.files[real] : (MXD.libs[base] != null ? MXD.libs[base] : null); };
      /* Les scripts Mixxx attendent un espace global à eux : chaque mapping tourne dans son propre cadre caché */
      const fr = document.createElement('iframe'); fr.hidden = true; fr.setAttribute('aria-hidden', 'true'); fr.title = 'Scripts du mapping'; document.body.appendChild(fr);
      this.frame = fr;
      const w = fr.contentWindow, run = (name, code) => { try { w.eval(code); } catch (e) { this.err(name + ' : ' + e.message); } };
      try {
        Object.assign(w, { engine: this.engine(), midi: this.midiApi(), controller: this.controllerApi(), ColorMapper, print() {} });
        w.console = { log() {}, warn() {}, error() {}, debug() {}, info() {}, trace() {}, assert() {} };
        const common = get('common-controller-scripts.js'); if (common) run('common-controller-scripts.js', common);
        for (const f of list) {
          if (/common-controller-scripts\.js$/i.test(f.name)) continue;
          const sc = get(f.name);
          if (sc == null) this.missing.push(f.name); else run(f.name, sc);
          if (f.prefix) this.prefixes.push(f.prefix);
        }
        this.resolver = n => w.eval(n);
      } catch (e) { this.err(e); this.resolver = () => undefined; }
      this.preset = saved;
      const dry0 = this.dry; this.dry = true;   /* l'initialisation ne doit rien déclencher dans le mix */
      for (const p of this.prefixes) { const f = this.fn(p + '.init'); if (f) try { f(this.name, false); } catch (e) { this.err(e); } }
      this.dry = dry0;
      for (const o of this.outputs) this.outSubs.push(CO.on(o.g, o.k, v => this.send(o.st, o.no, v >= o.min && v <= o.max ? o.on : o.off)));
      mxState();
      return true;
    },
    input(st, d1, d2) {
      let hit = false;
      const hs = this.handlers.get((st << 8) | d1);
      if (hs) for (const h of [...hs]) { hit = true; try { h.cb(st & 15, d1, d2, st, ''); } catch (e) { this.err(e); } }
      let list = this.controls.get((st << 8) | d1);
      if (!list && (st & 0xf0) === 0x80) { list = this.controls.get(((0x90 | (st & 15)) << 8) | d1); d2 = 0; }
      if (!list) return hit;
      for (const e of list) {
        hit = true;
        if (e.script) { const f = this.fn(e.k); if (f) try { f(st & 15, d1, d2, st, e.g); } catch (er) { this.err(er); } continue; }
        this.applyValue(e, st, d1, d2);
      }
      return hit;
    },
    applyValue(e, st, d1, v) {
      const c = CO.ctl(e.g, e.k), s = c.s, o = e.opts, type = st & 0xf0;
      if (o.includes('invert')) v = 127 - v;
      let rel = null;
      if (o.includes('rot64')) rel = v - 64; else if (o.includes('rot64inv')) rel = 64 - v; else if (o.includes('rot64fast')) rel = (v - 64) * 1.5;
      else if (o.includes('selectknob') || o.includes('herc-jog') || o.includes('hercjog') || o.includes('diff')) rel = v > 64 ? v - 128 : v;
      if (o.includes('fourteen-bit-lsb')) { this.lsb[c.g + c.k] = v; return; }
      if (o.includes('fourteen-bit-msb')) { CO.setParam(c.g, c.k, ((v << 7) | (this.lsb[c.g + c.k] || 0)) / 16383, 'midi'); return; }
      if (type === 0xe0) { CO.setParam(c.g, c.k, ((v << 7) | d1) / 16383, 'midi'); return; }
      if (s.t === 'rel') { CO.set(c.g, c.k, rel != null ? rel : (v > 64 ? v - 128 : v), 'midi'); return; }
      if (s.t === 'toggle') {
        if (o.includes('switch')) { CO.set(c.g, c.k, v > 0 ? 1 : 0, 'midi'); return; }
        if (type === 0x80 || v === 0) return;
        CO.set(c.g, c.k, c.v > 0 ? 0 : 1, 'midi'); return;
      }
      if (s.t === 'push') { CO.set(c.g, c.k, type === 0x80 ? 0 : (v > 0 ? 1 : 0), 'midi'); return; }
      if (rel != null) { CO.setParam(c.g, c.k, CO.param(c.g, c.k) + rel / 128, 'midi'); return; }
      if (o.includes('spread64')) { CO.setParam(c.g, c.k, CO.param(c.g, c.k) + (v - 64) / 128, 'midi'); return; }
      if (s.t === 'pot' || s.t === 'log') { CO.setParam(c.g, c.k, CO.midiP(s, v), 'midi'); return; }
      CO.set(c.g, c.k, v, 'midi');
    },
    hidInput(data) { for (const p of this.prefixes) { const f = this.fn(p + '.incomingData'); if (f) try { f(data, data.length); } catch (e) { this.err(e); } } },
    async hidConnect() {
      if (!navigator.hid) { toast('Ce navigateur ne gère pas l\'USB HID : utilisez Chrome ou Edge, avec la version fichier HTML.'); return; }
      try {
        const ds = await navigator.hid.requestDevice({ filters: [] }); if (!ds.length) return;
        const d = ds[0]; if (!d.opened) await d.open();
        d.oninputreport = e => { const u = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength); this.hidLast[e.reportId || 0] = u; this.hidInput(e.reportId ? Uint8Array.of(e.reportId, ...u) : u); };
        this.hid = d; this.hidFeat = {};
        const ids = new Set(), walk = cs => { for (const c of cs || []) { for (const r of c.featureReports || []) ids.add(r.reportId || 0); walk(c.children); } }; walk(d.collections);
        for (const id of ids) { try { const v = await d.receiveFeatureReport(id); this.hidFeat[id] = new Uint8Array(v.buffer, v.byteOffset, v.byteLength); } catch (e) { /* rapport non lisible */ } }
        if (this.preset) this.activate(this.preset);
        toast((d.productName || 'Appareil HID') + ' connecté.');
      } catch (e) { toast('Connexion HID impossible : ' + e.message); }
      renderMidi();
    },
    load(saved, quiet) {
      const ok = this.activate(saved);
      if (ok) { S.mx = saved; try { localStorage.setItem(LSSET + '-mx', JSON.stringify(saved)); } catch (e) { if (!quiet) toast('Mapping trop volumineux pour être mémorisé : il faudra le réimporter.'); } }
      if (!quiet) toast(ok ? 'Mapping « ' + this.name + ' » chargé' + (this.missing.length ? ' (fichiers manquants : ' + this.missing.join(', ') + ')' : '') + '.' : 'Ce mapping n\'a pas pu être chargé.');
      if ($('dlgMidi').open) renderMidi();
      return ok;
    },
    remove() { this.unload(); S.mx = null; try { localStorage.removeItem(LSSET + '-mx'); } catch (e) { /* rien */ } renderMidi(); },
    /* un contrôleur connu vient d'être branché : son mapping se charge tout seul */
    detect() {
      if (this.preset || !midiAcc) return;
      for (const inp of midiAcc.inputs.values()) for (const id in MXD.presets) if (MXD.presets[id].kind && new RegExp(MXD.presets[id].match, 'i').test(inp.name || '') && !/hid/i.test(MXD.presets[id].xml)) { this.load({ builtin: id }); return; }
    }
  };

  /* ================= Contrôleurs MIDI (apprentissage) ================= */
  const MACTS = [['play', 'Lecture / pause', 'btn'], ['home', 'Retour au début', 'btn'], ['prevT', 'Transition précédente', 'btn'], ['nextT', 'Transition suivante', 'btn'], ['jog', 'Déplacement dans le mix (jog, encodeur)', 'rel'],
    ['browse', 'Parcourir la bibliothèque (encodeur)', 'rel'], ['load', 'Charger le titre choisi dans le mix (bouton voie A)', 'btn'], ['loadB', 'Charger le titre choisi dans le mix (bouton voie B)', 'btn'], ['playB', 'Lecture / pause (bouton voie B)', 'btn'],
    ['cue', 'Pré-écouter le titre choisi (casque voie A)', 'btn'], ['cueB', 'Pré-écouter le titre choisi (casque voie B)', 'btn'], ['cueM', 'Pré-écoute du mix depuis la ligne verte', 'btn'], ['cueJog', 'Déplacer la ligne verte (encodeur)', 'rel'], ['cueX', 'Pré-écouter la prochaine transition', 'btn'],
    ['auto', 'Auto DJ marche / arrêt', 'btn'], ['style', 'Style suivant', 'btn'], ['mvol', 'Volume d\'écoute', 'abs'], ['cvol', 'Volume de pré-écoute', 'abs']]
    .concat(SNDCTL.map(c => ['snd:' + c[0], (c[0][1] === '.' ? 'Voie ' + c[0][0].toUpperCase() + ' : ' : c[0] === 'xf' ? '' : 'Effet : ') + c[1], 'abs']));
  let midiAcc = null, midiLearn = null, midiState = 'off';
  const bindTxt = k => { if (!k) return '—'; const ch = parseInt(k[1], 16) + 1, n = k.slice(3); return (k[0] === '9' ? 'Note ' + n : k[0] === 'b' ? 'CC ' + n : 'Pitch bend') + ', canal ' + ch; };
  function nextTransition(dir) {
    const now = mixNow(), ts = lay.items.map(L => lay.b2t(L.mb0));
    if (dir > 0) { const t = ts.find(x => x > now + 0.2); if (t != null) seek(t); }
    else { const p = ts.filter(x => x < now - 1.5); seek(p.length ? p[p.length - 1] : 0); }
  }
  function midiDo(act, kind, st, d1, d2) {
    const press = st === 0x90 || (st === 0xb0 && d2 >= 64), val = st === 0xe0 ? ((d2 << 7) | d1) / 16383 : d2 / 127, delta = st === 0xb0 ? (d2 < 64 ? d2 : d2 - 128) : 0;
    if (kind === 'btn') {
      if (!press) return;
      if (act === 'play' || act === 'playB') (P.playing ? pause() : play());
      else if (act === 'home') seek(0);
      else if (act === 'prevT') nextTransition(-1);
      else if (act === 'nextT') nextTransition(1);
      else if (act === 'load' || act === 'loadB') { if (S.libSel) addToPlaylist(S.libSel); else toast('Choisissez d\'abord un titre dans la bibliothèque.'); }
      else if (act === 'cue' || act === 'cueB') { const t = T(S.libSel); if (t) cueTrack(t); }
      else if (act === 'cueM') { if (Q.on && Q.kind === 'mix') stopCue(); else cueStart(S.cuePos); }
      else if (act === 'cueX') { const now = mixNow(), i = lay.items.findIndex((L, k) => k > 0 && lay.b2t(L.mb0) > now); if (i > 0) cueTransition(i); }
      else if (act === 'auto') setAuto(!S.auto);
      else if (act === 'style') { AD.n = Infinity; renderAutoBtn(); }
    } else if (kind === 'rel') {
      if (!delta) return;
      if (act === 'jog') seek(mixNow() + delta * 15 / (lay.total ? lay.tempoAt(mixNow()) : 120));
      else if (act === 'browse') browse(delta);
      else if (act === 'cueJog') cueSeek(cueNow() + delta * 15 / (lay.total ? lay.tempoAt(Math.min(cueNow(), lay.total)) : 120));
    } else if (act === 'mvol') { $('mvol').value = Math.round(val * 100); if (mvol) mvol.gain.value = val; }
    else if (act === 'cvol') { if ($('cvol')) $('cvol').value = Math.round(val * 100); if (cueGain) cueGain.gain.value = val; }
    else if (act.startsWith('snd:')) { const c = SNDCTL.find(x => x[0] === act.slice(4)); sndSet(c[0], c[2] + (c[3] - c[2]) * val); }
  }
  function onMidi(e) {
    const d = e.data; if (!d || d.length < 2) return;
    const st = d[0] & 0xf0, d2 = d.length > 2 ? d[2] : 0;
    if ((st === 0x90 && d2 > 0) || st === 0xb0 || st === 0xe0) {
      const key = (st === 0x90 ? '9' : st === 0xb0 ? 'b' : 'e') + (d[0] & 15).toString(16) + ':' + (st === 0xe0 ? 0 : d[1]);
      if (midiLearn) {
        for (const a in S.midi) if (S.midi[a] === key) delete S.midi[a];
        S.midi[midiLearn] = key; midiLearn = null; saveSettings(); renderMidi(); return;
      }
      /* les affectations apprises passent avant le mapping Mixxx */
      for (const m of MACTS) if (S.midi[m[0]] === key) { midiDo(m[0], m[2], st, d[1], d2); return; }
    }
    if (Mx.preset && Mx.kind === 'midi' && st >= 0x80 && st < 0xf0) Mx.input(d[0], d[1], d2);
  }
  async function midiInit() {
    if (!navigator.requestMIDIAccess) { midiState = 'none'; return; }
    try {
      try { midiAcc = await navigator.requestMIDIAccess({ sysex: true }); } catch (e) { midiAcc = await navigator.requestMIDIAccess(); }
      const hook = () => { for (const inp of midiAcc.inputs.values()) inp.onmidimessage = onMidi; Mx.detect(); if ($('dlgMidi').open) renderMidi(); };
      midiAcc.onstatechange = hook; midiState = 'on'; hook();
    } catch (e) { midiState = 'refus'; }
  }
  function renderMidi() {
    const names = midiAcc ? [...midiAcc.inputs.values()].map(i => i.name) : [];
    $('midiStatus').textContent = midiState === 'none' ? 'Ce navigateur ne propose pas le MIDI. Utilisez Chrome ou Edge.' : midiState === 'refus' ? 'L\'accès MIDI a été refusé ou n\'est pas possible dans cette vue. Ouvrez la version fichier HTML dans Chrome ou Edge.' : names.length ? 'Contrôleurs détectés : ' + names.join(', ') + '.' : 'Aucun contrôleur détecté. Branchez-le, mettez-le en mode MIDI, puis rouvrez cette fenêtre.';
    const sel = $('mxSel'), cur = S.mx && S.mx.builtin;
    if (!sel.options.length) {
      const og = (lab, kind) => '<optgroup label="' + lab + '">' + Object.keys(MXD.presets).filter(id => MXD.presets[id].kind === kind).map(id => '<option value="' + id + '">' + esc(MXD.presets[id].label) + '</option>').join('') + '</optgroup>';
      sel.innerHTML = og('Tables de mixage et surfaces à faders', 'mixer') + og('Contrôleurs', 'ctrl');
    }
    if (cur) sel.value = cur;
    $('mxHid').hidden = !(Mx.preset && Mx.kind === 'hid');
    $('mxRemove').disabled = !Mx.preset;
    $('mxStatus').textContent = Mx.preset ? 'Mapping actif : ' + Mx.name + (Mx.kind === 'hid' ? ' (USB HID' + (Mx.hid ? ', appareil connecté' : ', cliquez « Connecter en USB HID »') + ')' : ', ' + Mx.controls.size + ' commandes') +
      (Mx.missing.length ? '. Fichiers manquants : ' + Mx.missing.join(', ') : '') + (Mx.errCount ? '. ' + Mx.errCount + ' erreur(s) de script : ' + Mx.errs.slice(0, 2).join(' ; ') : '') + '.'
      : 'Aucun mapping chargé. Choisissez votre appareil, ou importez un mapping Mixxx : le fichier .xml avec ses fichiers .js.';
    $('midiList').innerHTML = MACTS.map(m => `<tr data-a="${m[0]}"><td>${esc(m[1])}</td><td class="muted">${m[2] === 'btn' ? 'bouton' : m[2] === 'rel' ? 'encodeur' : 'potentiomètre, fader'}</td><td>${midiLearn === m[0] ? '<b>Bougez la commande…</b>' : bindTxt(S.midi[m[0]])}</td>` +
      `<td><button data-m="learn">${midiLearn === m[0] ? 'Annuler' : 'Apprendre'}</button> <button class="ico" data-m="clr" aria-label="Effacer"${S.midi[m[0]] ? '' : ' disabled'}>✕</button></td></tr>`).join('');
  }

  /* ================= Événements ================= */
  $('btnImport').onclick = () => $('fileIn').click();
  $('fileIn').onchange = e => { importFiles([...e.target.files]); e.target.value = ''; };
  $('btnOpen').onclick = () => $('projIn').click();
  $('projIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { if (loadProject(JSON.parse(await f.text()))) toast('Projet ouvert. Réimportez les fichiers audio marqués « à réimporter ».'); } catch (er) { toast('Projet illisible.'); } };
  $('btnSave').onclick = () => saveBlob('Timeline DJ Mix.json', new Blob([JSON.stringify(projectData(), null, 1)], { type: 'application/json' }));
  let newArm = 0;
  $('btnNew').onclick = () => {
    if (Date.now() - newArm > 4000) { newArm = Date.now(); toast('Cliquez encore une fois sur « Nouveau mix » pour tout vider.'); return; }
    newArm = 0; pause(); stopCue(); FDB.clear(); S.tracks = []; S.playlist = []; S.sel = null; S.playhead = 0; bufs.clear(); undo.length = 0; changed();
  };
  $('btnExport').onclick = openExport;
  $('expGo').onclick = goExport;
  $('expCancel').onclick = () => { if (expBusy) expCancel = true; else $('dlgExport').close(); };
  $('expFmt').onchange = () => { if (!expBusy && expResult) { expResult = null; $('expGo').textContent = 'Exporter'; $('expMsg').textContent = ''; $('expProg').hidden = true; } };
  $('expList').onclick = () => saveBlob('Titres du mix.txt', new Blob([tracklist()], { type: 'text/plain' }));
  $('btnHelp').onclick = () => $('dlgHelp').showModal();
  $('helpClose').onclick = () => $('dlgHelp').close();
  // notice complète, dans la langue choisie : celle installée avec le logiciel, sinon celle du site
  const openNotice = () => {
    const l = L10N.lang || 'fr', inApp = /Electron/i.test(navigator.userAgent);
    const url = inApp ? new URL('notice/index.html?lang=' + l, location.href).href
      : location.protocol.startsWith('http') && /\/app\/(index\.html)?$/.test(location.pathname) ? new URL('../notice/index.html?lang=' + l, location.href).href
      : 'https://deltapassion.github.io/Timeline-DJ-Mix/notice/index.html?lang=' + l;
    window.open(url, '_blank', 'noopener');
  };
  $('helpNotice').onclick = openNotice;
  $('btnPlay').onclick = () => (P.playing ? pause() : play());
  $('btnHome').onclick = () => { seek(0); tl.scrollLeft = 0; };
  $('btnUndo').onclick = doUndo;
  $('btnFit').onclick = fit;
  $('zoom').oninput = e => setPps(0.4 * Math.pow(1000, e.target.value / 100));
  $('mvol').oninput = e => { if (mvol) mvol.gain.value = e.target.value / 100; };
  $('segCurve').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.curve = b.dataset.c; for (const x of $('segCurve').children) x.classList.toggle('on', x === b); draw(); };
  $('segSnap').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.snap = +b.dataset.s; for (const x of $('segSnap').children) x.classList.toggle('on', x === b); renderInsp(); saveLocal(); };
  $('libSearch').oninput = e => { S.q = e.target.value; renderLib(); };
  document.querySelector('#libPanel thead').onclick = e => { const th = e.target.closest('th.sortable'); if (!th) return; const k = th.dataset.k; S.sort = { k, dir: S.sort.k === k ? -S.sort.dir : 1 }; renderLib(); };

  $('libBody').addEventListener('click', e => {
    const b = e.target.closest('button'), tr = e.target.closest('tr'); if (!tr) return;
    if (!b) { S.libSel = tr.dataset.id; for (const r of $('libBody').children) r.classList.toggle('sel', r === tr); return; }
    const t = T(tr.dataset.id); if (!t) return;
    if (b.dataset.act === 'add') addToPlaylist(t.id);
    else if (b.dataset.act === 'prev') cueTrack(t);
    else if (b.dataset.act === 'del') { pushUndo(); if (cueId() === 't:' + t.id) stopCue(); S.tracks = S.tracks.filter(x => x !== t); S.playlist = S.playlist.filter(it => it.tid !== t.id); bufs.delete(t.id); FDB.del(t.id); if (selIndex() < 0) S.sel = null; undo.length = 0; changed(); }
  });
  $('libBody').addEventListener('dblclick', e => { if (e.target.closest('button')) return; const tr = e.target.closest('tr'); if (tr) addToPlaylist(tr.dataset.id); });
  $('libBody').addEventListener('dragstart', e => { const tr = e.target.closest('tr'); if (tr) { e.dataTransfer.setData('text/plain', 'lib:' + tr.dataset.id); e.dataTransfer.effectAllowed = 'copyMove'; } });
  const libP = $('libPanel');
  libP.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); libP.classList.add('drop'); } });
  libP.addEventListener('dragleave', () => libP.classList.remove('drop'));
  libP.addEventListener('drop', e => { libP.classList.remove('drop'); if (e.dataTransfer.files.length) { e.preventDefault(); importFiles([...e.dataTransfer.files]); } });

  const plB = $('plBody'), plS = $('plScroll');
  plB.addEventListener('click', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    if (e.target.closest('[data-act=rm]')) { removeItem(tr.dataset.id); return; }
    const cb = e.target.closest('[data-act=cue],[data-act=cuex]');
    if (cb) { const k = S.playlist.findIndex(x => x.id === tr.dataset.id), t0 = T(S.playlist[k].tid); if (cb.dataset.act === 'cuex') cueTransition(k); else cueItem(k); return; }
    if (e.target.closest('select')) return;
    S.sel = tr.dataset.id; changed(true);
    const i = selIndex(), r = clipRect(i); if (r.x0 < 0 || r.x0 > cv.clientWidth - 60) tl.scrollLeft = Math.max(0, PADL + lay.b2t(lay.items[i].mb0) * S.pps - 80);
  });
  function setType(it, v) { pushUndo(); if (v !== 'cut' && (it.type === 'cut' || it.overlap <= 0)) it.overlap = 32; it.type = v; changed(); }
  plB.addEventListener('change', e => { const tr = e.target.closest('tr'), it = tr && S.playlist.find(x => x.id === tr.dataset.id); if (it && e.target.dataset.act === 'type') setType(it, e.target.value); });
  plB.addEventListener('dragstart', e => { const tr = e.target.closest('tr'); if (tr) { e.dataTransfer.setData('text/plain', 'pl:' + tr.dataset.id); e.dataTransfer.effectAllowed = 'move'; } });
  const clearOver = () => { for (const r of plB.querySelectorAll('.over')) r.classList.remove('over'); };
  plS.addEventListener('dragover', e => { e.preventDefault(); clearOver(); const tr = e.target.closest('tbody tr'); if (tr) tr.classList.add('over'); });
  plS.addEventListener('dragleave', clearOver);
  plS.addEventListener('drop', e => {
    e.preventDefault(); clearOver();
    const d = e.dataTransfer.getData('text/plain') || '', tr = e.target.closest('tbody tr');
    let at = tr ? S.playlist.findIndex(x => x.id === tr.dataset.id) : S.playlist.length;
    if (d.startsWith('lib:')) addToPlaylist(d.slice(4), at);
    else if (d.startsWith('pl:')) {
      const from = S.playlist.findIndex(x => x.id === d.slice(3)); if (from < 0 || from === at) return;
      pushUndo(); const [it] = S.playlist.splice(from, 1); if (from < at) at--; S.playlist.splice(at, 0, it); changed();
    }
  });
  $('btnOrder').onclick = () => {
    if (S.playlist.length < 3) { toast('Il faut au moins trois morceaux pour réordonner.'); return; }
    pushUndo();
    const rest = S.playlist.slice(1), out = [S.playlist[0]];
    while (rest.length) {
      const a = out[out.length - 1], ta = T(a.tid); let bi = 0, bc = Infinity;
      rest.forEach((b, k) => { const c = Math.abs(Math.log2(b.tempo / a.tempo)) * 100 + (Core.keyCompat(ta, T(b.tid)) ? 0 : 3); if (c < bc) { bc = c; bi = k; } });
      out.push(rest.splice(bi, 1)[0]);
    }
    S.playlist = out; changed();
  };

  $('insp').addEventListener('change', e => {
    const i = selIndex(); if (i < 0) return;
    const it = S.playlist[i], tr = T(it.tid), v = e.target.value, id = e.target.id;
    if (id === 'inType') return setType(it, v);
    pushUndo();
    if (id === 'inOv') { it.overlap = Math.max(0, Math.round(+v || 0)); if (it.type === 'cut' && it.overlap > 0) it.type = 'beat'; }
    else if (id === 'inTm') it.tmode = v;
    else if (id === 'inTempo') it.tempo = clamp(+v || tr.bpm, 40, 260);
    else if (id === 'inBpm') setTrackBpm(tr, +v || tr.bpm);
    changed();
  });
  $('insp').addEventListener('click', e => {
    const b = e.target.closest('button'), i = selIndex(); if (!b || i < 0) return;
    const it = S.playlist[i], tr = T(it.tid);
    if (b.id === 'cueX') { cueTransition(i); return; }
    pushUndo();
    if (b.id === 'inTempoR') it.tempo = tr.bpm;
    else if (b.id === 'bpmH') setTrackBpm(tr, tr.bpm / 2);
    else if (b.id === 'bpmD') setTrackBpm(tr, tr.bpm * 2);
    else if (b.id === 'cvReset') { const had = it.cv.vol || it.cv.bass || it.cv.treble; it.cv = { vol: null, bass: null, treble: null }; toast(had ? 'Courbes automatiques rétablies pour ce morceau.' : 'Ce morceau a déjà ses courbes automatiques : rien à rétablir.'); }
    else if (b.dataset.g) tr.grid0 += +b.dataset.g;
    else if (b.dataset.gb) tr.grid0 += +b.dataset.gb * 60 / tr.bpm;
    else { undo.pop(); return; }
    for (const x of S.playlist) if (x.tid === tr.id) clampItem(x);
    changed();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'F1') { e.preventDefault(); openNotice(); return; }
    if (e.target.closest('input, select, textarea, dialog')) return;
    if (e.code === 'Space') { e.preventDefault(); P.playing ? pause() : play(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); removeItem(S.sel); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    else if (e.key === 'Home') seek(0);
    else if (e.key === 'ArrowLeft') seek(mixNow() - 5);
    else if (e.key === 'ArrowRight') seek(mixNow() + 5);
  });

  $('btnCue').onclick = () => { if (Q.on && Q.kind === 'mix') stopCue(); else cueStart(S.cuePos); };
  $('cueSeek').addEventListener('pointerdown', () => { cueDrag = true; });
  $('cueSeek').addEventListener('change', e => { cueDrag = false; if (Q.kind === 'track' && Q.src) trackSrc(Q.src.buffer, e.target.value / 1000 * Q.src.buffer.duration); });
  $('cueStop').onclick = stopCue;
  $('btnLook').onclick = () => $('dlgLook').showModal();
  $('lookClose').onclick = () => $('dlgLook').close();
  $('bgPick').oninput = e => { applyTheme(e.target.value); draw(); saveSettings(); };
  $('btnSw').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.btn = b.dataset.c; applyBtn(); saveSettings(); } });
  $('btnpSw').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { S.btnp = b.dataset.c; applyBtn(); saveSettings(); } });
  $('btnPick').oninput = e => { S.btn = e.target.value; applyBtn(); saveSettings(); };
  $('btnpPick').oninput = e => { S.btnp = e.target.value; applyBtn(); saveSettings(); };
  $('bgSw').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { applyTheme(b.dataset.c); draw(); saveSettings(); } });
  $('btnAuto').onclick = () => setAuto(!S.auto);
  $('btnStyle').onclick = () => { AD.n = Infinity; renderAutoBtn(); toast('Le prochain titre ajouté par l\'Auto DJ changera de style.'); };
  $('btnParty').onclick = () => { $('adMsg').textContent = ''; renderAuto(); $('dlgAuto').showModal(); };
  $('adClose').onclick = () => $('dlgAuto').close();
  $('adLive').onchange = e => setAuto(e.target.checked);
  $('ptShuffle').onchange = e => { S.party.shuffle = e.target.checked; saveSettings(); };
  $('adMins').onchange = e => { S.party.mins = clamp(+e.target.value || 60, 5, 600); saveSettings(); };
  $('ptAdd').onclick = () => { if (S.party.styles.length < 8) { S.party.styles.push({ name: 'Style ' + (S.party.styles.length + 1), count: 3, en: true }); saveSettings(); renderAuto(); } };
  $('ptList').addEventListener('click', e => {
    const b = e.target.closest('button'), tr = e.target.closest('tr'); if (!b || !tr) return;
    const i = +tr.dataset.i, st = S.party.styles, a = b.dataset.a;
    if (a === 'dir') { ptIdx = i; $('ptDir').click(); return; }
    if (a === 'up' && i > 0) [st[i - 1], st[i]] = [st[i], st[i - 1]];
    else if (a === 'dn' && i < st.length - 1) [st[i + 1], st[i]] = [st[i], st[i + 1]];
    else if (a === 'rm') st.splice(i, 1);
    AD.cur = -1; AD.n = 0; saveSettings(); renderAuto();
  });
  $('ptList').addEventListener('change', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const x = S.party.styles[+tr.dataset.i], a = e.target.dataset.a;
    if (a === 'en') x.en = e.target.checked;
    else if (a === 'count') x.count = clamp(Math.round(+e.target.value) || 3, 1, 20);
    else if (a === 'name') { const nn = e.target.value.trim() || x.name; for (const t of S.tracks) if (t.style === x.name) t.style = nn; x.name = nn; renderLib(); saveLocal(); }
    saveSettings(); renderAuto();
  });
  $('ptDir').onchange = async e => {
    const files = [...e.target.files], x = S.party.styles[ptIdx]; e.target.value = '';
    if (!x || !files.length) return;
    await importFiles(files, x.name); renderAuto();
    $('adMsg').textContent = x.name + ' : ' + pool(ptIdx).length + ' titres. L\'analyse du tempo se fait en arrière-plan, au fur et à mesure.';
  };
  $('adBuild').onclick = async () => {
    if (adBusy) return;
    if (!S.tracks.length) { $('adMsg').textContent = 'Importez d\'abord des morceaux ou choisissez un dossier par style.'; return; }
    pushUndo(); $('adBuild').disabled = true;
    const n = await adAppend(0, lay.total + S.party.mins * 60);
    $('adBuild').disabled = false;
    $('adMsg').textContent = n ? n + ' titres ajoutés. Durée du mix : ' + fmtT(lay.total) + '.' : 'Aucun titre disponible : tous sont déjà dans le mix, ou aucun dossier n\'est chargé.';
    if (n && !P.playing) fit();
  };
  $('btnSnd').onclick = () => { const p = $('snd'); p.hidden = !p.hidden; $('btnSnd').classList.toggle('on', !p.hidden); resize(); };
  $('snd').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.snd) sndSet(t.dataset.snd, t.value, true);
    else if (t.id === 'cvol') { if (cueGain) cueGain.gain.value = t.value / 100; }
  });
  $('snd').addEventListener('dblclick', e => { const k = e.target.dataset && e.target.dataset.snd; if (k) sndSet(k, SNDCTL.find(x => x[0] === k)[4]); });
  $('snd').addEventListener('change', e => {
    if (e.target.id === 'sndExp') { S.snd.exp = e.target.checked; saveSettings(); }
    else if (e.target.id === 'outMaster') { S.out.master = e.target.value; saveSettings(); if (ac && ac.setSinkId) ac.setSinkId(S.out.master).then(routeOut).catch(() => toast('Cette sortie n\'est pas disponible.')); }
    else if (e.target.id === 'outMode') { S.out.mode = e.target.value; saveSettings(); AC(); routeOut(); }
    else if (e.target.id === 'outCue') { S.out.cue = e.target.value; saveSettings(); AC(); routeOut(); }
  });
  $('snd').addEventListener('click', e => {
    if (e.target.id === 'sndReset') { const ex = S.snd.exp; S.snd = SND0(); S.snd.exp = ex; for (const c of SNDCTL) sndSet(c[0], c[4]); }
    else if (e.target.id === 'cueAsk') listOutputs(true);
  });
  $('btnMidi').onclick = async () => { if (!midiAcc) await midiInit(); midiLearn = null; renderMidi(); $('dlgMidi').showModal(); };
  $('midiClose').onclick = () => { midiLearn = null; $('dlgMidi').close(); };
  $('mxLoad').onclick = () => { Mx.load({ builtin: $('mxSel').value }); };
  $('mxRemove').onclick = () => Mx.remove();
  $('mxHid').onclick = () => Mx.hidConnect();
  $('mxImport').onclick = () => $('mxFiles').click();
  $('mxFiles').onchange = async e => {
    const files = {}; for (const f of e.target.files) files[f.name] = await f.text();
    e.target.value = '';
    const xml = Object.keys(files).find(n => /\.xml$/i.test(n));
    if (!xml) { toast('Sélectionnez le fichier .xml du mapping, avec ses fichiers .js.'); return; }
    Mx.load({ xml, files });
  };
  $('midiList').addEventListener('click', e => {
    const b = e.target.closest('button'), tr = e.target.closest('tr'); if (!b || !tr) return;
    const a = tr.dataset.a;
    if (b.dataset.m === 'learn') midiLearn = midiLearn === a ? null : a; else { delete S.midi[a]; saveSettings(); }
    renderMidi();
  });

  /* ================= Démarrage ================= */
  try {
    const st = JSON.parse(localStorage.getItem(LSSET) || 'null');
    if (st) {
      if (st.snd && st.snd.a && st.snd.b) S.snd = Object.assign(SND0(), st.snd);
      if (st.midi) S.midi = st.midi;
      if (st.party && Array.isArray(st.party.styles)) S.party = Object.assign(S.party, st.party);
      if (st.out) S.out = Object.assign(S.out, st.out);
      if (!st.outV) S.out.mode = 'quad';
      if (st.bg) S.bg = st.bg;
      if (st.btn) S.btn = st.btn;
      if (st.btnp) S.btnp = st.btnp;
      if (st.lang) S.lang = st.lang;
    }
  } catch (e) { /* réglages par défaut */ }
  applyTheme(S.bg); buildSnd(); renderAutoBtn(); startI18n(); draw();
  try { const sm = JSON.parse(localStorage.getItem(LSSET + '-mx') || 'null'); if (sm && Mx.activate(sm)) S.mx = sm; } catch (e) { /* pas de mapping mémorisé */ }
  if (Object.keys(S.midi).length || S.mx) midiInit();
  applyTheme(S.bg); resize(); changed(true);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LSKEY) || localStorage.getItem(LSOLD) || 'null'); } catch (e) { saved = null; }
  if (!(saved && saved.tracks && saved.tracks.length && loadProject(saved))) initDemo();
  window.__fe = { S, P, T, lay: () => lay, renderMix, play, pause, seek, Core, getBuffer, importFiles, adAppend, cueTransition, cueTrack, Q, cueStart, cueSeek, onMidi, sndSet, changed, Mx, CO, MXD, i18n, setLang, L10N };
})();
