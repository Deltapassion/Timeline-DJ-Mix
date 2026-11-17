function CoreFactory() {
  'use strict';

  /* ---------- FFT (radix 2, en place) ---------- */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < h; k++) {
          const a = i + k, b = a + h;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  /* ---------- Préparation du signal ---------- */
  function decimate(channels, sr) {
    const D = Math.max(1, Math.floor(sr / 11025));
    const n = Math.floor(channels[0].length / D), x = new Float32Array(n), nc = channels.length;
    for (let c = 0; c < nc; c++) {
      const ch = channels[c];
      for (let i = 0, j = 0; i < n; i++) { let s = 0; for (let k = 0; k < D; k++) s += ch[j++]; x[i] += s; }
    }
    const g = 1 / (D * nc);
    for (let i = 0; i < n; i++) x[i] *= g;
    return { x, sr: sr / D };
  }

  function peaks(channels, sr, perSec) {
    const hop = sr / perSec, len = channels[0].length, n = Math.ceil(len / hop), p = new Float32Array(n);
    for (const ch of channels) {
      for (let i = 0; i < n; i++) {
        const a = Math.floor(i * hop), b = Math.min(len, Math.floor((i + 1) * hop));
        let m = p[i];
        for (let j = a; j < b; j += 2) { const v = ch[j] < 0 ? -ch[j] : ch[j]; if (v > m) m = v; }
        p[i] = m;
      }
    }
    return p;
  }

  /* ---------- Enveloppe d'attaques ---------- */
  function onsetEnv(x, sr) {
    const hop = Math.round(sr / 200), fr = sr / hop, n = Math.floor(x.length / hop);
    const Ef = new Float32Array(n), El = new Float32Array(n);
    const a = 1 - Math.exp(-2 * Math.PI * 150 / sr);
    let l1 = 0, l2 = 0, mf = 0, ml = 0;
    for (let i = 0, j = 0; i < n; i++) {
      let sf = 0, sl = 0;
      for (let k = 0; k < hop; k++, j++) { const v = x[j]; l1 += a * (v - l1); l2 += a * (l1 - l2); sf += v * v; sl += l2 * l2; }
      Ef[i] = sf; El[i] = sl; mf += sf; ml += sl;
    }
    const ef = mf / Math.max(1, n) * 2e-3 + 1e-12, el = ml / Math.max(1, n) * 2e-3 + 1e-12;
    const env = new Float32Array(n), low = new Float32Array(n);
    for (let i = 2; i < n; i++) {
      const df = Math.log((Ef[i] + ef) / (Ef[i - 2] + ef)), dl = Math.log((El[i] + el) / (El[i - 2] + el));
      low[i] = dl > 0 ? dl : 0;
      env[i] = (df > 0 ? df : 0) + 2 * low[i];
    }
    return { env, low, fr };
  }

  function fold(env, fr, bpm, bins) {
    const acc = new Float64Array(bins), inc = bpm / 60 / fr * bins;
    let ph = 0;
    for (let i = 0; i < env.length; i++) { acc[ph | 0] += env[i]; ph += inc; if (ph >= bins) ph -= bins; }
    let best = -1, bi = 0;
    for (let b = 0; b < bins; b++) {
      const s = acc[b] + 0.5 * (acc[(b + bins - 1) % bins] + acc[(b + 1) % bins]);
      if (s > best) { best = s; bi = b; }
    }
    const l = acc[(bi + bins - 1) % bins], c = acc[bi], r = acc[(bi + 1) % bins];
    const cen = (r - l) / Math.max(1e-9, l + c + r);
    return { score: best, phase: (((bi + 0.5 + cen) / bins) % 1 + 1) % 1 };
  }

  function tempo(env, low, fr, lo, hi) {
    lo = lo || 70; hi = hi || 180;
    const n = env.length;
    if (n < fr * 4) return { bpm: 120, grid0: 0, conf: 0 };
    let mean = 0; for (let i = 0; i < n; i++) mean += env[i]; mean /= n;
    const e = new Float32Array(n); for (let i = 0; i < n; i++) e[i] = env[i] - mean;
    const Lmin = Math.floor(fr * 60 / hi), Lmax = Math.ceil(fr * 60 / lo), top = Math.min(n - 1, 2 * Lmax + 2);
    const acf = new Float64Array(top + 1);
    for (let L = Lmin; L <= top; L++) { let s = 0; for (let i = L; i < n; i++) s += e[i] * e[i - L]; acf[L] = s / (n - L); }
    let bestL = Lmin, bestS = -Infinity;
    for (let L = Lmin; L <= Lmax; L++) {
      const bpm = 60 * fr / L, o = Math.log2(bpm / 122) / 0.7, w = Math.exp(-0.5 * o * o);
      const s = (acf[L] + 0.5 * (2 * L <= top ? acf[2 * L] : 0)) * w;
      if (s > bestS) { bestS = s; bestL = L; }
    }
    /* recherche fine par repliement de l'enveloppe sur la période */
    let b0 = 60 * fr / (bestL + 1), b1 = 60 * fr / Math.max(1, bestL - 1), best = { score: -1 }, bpm = 60 * fr / bestL;
    for (let b = b0; b <= b1; b += 0.02) { const f = fold(env, fr, b, 32); if (f.score > best.score) { best = f; bpm = b; } }
    b0 = bpm - 0.03; b1 = bpm + 0.03; best = { score: -1 };
    let fine = bpm;
    for (let b = b0; b <= b1; b += 0.002) { const f = fold(env, fr, b, 64); if (f.score > best.score) { best = f; fine = b; } }
    bpm = fine;
    const rb = Math.round(bpm);
    const fr0 = Math.abs(rb - bpm) < 0.06 ? fold(env, fr, rb, 64) : null;
    if (fr0 && fr0.score >= 0.9 * best.score) { best = fr0; bpm = rb; }
    else bpm = Math.round(bpm * 100) / 100;
    const period = 60 / bpm;
    /* phase mesurée contre un peigne d'impulsions : l'attaque tombe au début de la case */
    let phase = best.phase * period - 0.3 / fr;
    phase = ((phase % period) + period) % period;
    /* premier temps de la mesure : la classe de temps la plus chargée en graves */
    const sums = [0, 0, 0, 0];
    for (let k = 0; ; k++) {
      const idx = Math.round((phase + k * period) * fr);
      if (idx >= n - 3) break;
      let m = 0; for (let j = Math.max(0, idx - 2); j <= idx + 2; j++) if (low[j] > m) m = low[j];
      sums[k & 3] += m;
    }
    let c = 0; for (let k = 1; k < 4; k++) if (sums[k] > sums[c] * 1.02) c = k;
    return { bpm, grid0: phase + c * period, conf: best.score };
  }

  /* ---------- Tonalité (profils de Krumhansl) ---------- */
  const KMAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KMIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  function key(x, sr) {
    const N = 8192;
    if (x.length < N * 2) return { tonic: 0, minor: false, conf: 0 };
    const hop = Math.max(N >> 1, Math.floor((x.length - N) / 500));
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const kLo = Math.ceil(60 * N / sr), kHi = Math.min(N / 2 - 1, Math.floor(2000 * N / sr));
    const pcOf = new Int8Array(kHi + 1).fill(-1);
    for (let k = kLo; k <= kHi; k++) {
      const p = 69 + 12 * Math.log2(k * sr / N / 440), r = Math.round(p);
      if (Math.abs(p - r) < 0.35) pcOf[k] = ((r % 12) + 12) % 12;
    }
    const chroma = new Float64Array(12), re = new Float32Array(N), im = new Float32Array(N);
    for (let s = 0; s + N <= x.length; s += hop) {
      for (let i = 0; i < N; i++) { re[i] = x[s + i] * win[i]; im[i] = 0; }
      fft(re, im);
      for (let k = kLo; k <= kHi; k++) if (pcOf[k] >= 0) chroma[pcOf[k]] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    }
    const corr = (prof, t) => {
      let mx = 0, my = 0; for (let i = 0; i < 12; i++) { mx += chroma[(i + t) % 12]; my += prof[i]; } mx /= 12; my /= 12;
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < 12; i++) { const dx = chroma[(i + t) % 12] - mx, dy = prof[i] - my; a += dx * dy; b += dx * dx; c += dy * dy; }
      return a / Math.sqrt(b * c + 1e-12);
    };
    let best = -2, tonic = 0, minor = false;
    for (let t = 0; t < 12; t++) {
      const a = corr(KMAJ, t), b = corr(KMIN, t);
      if (a > best) { best = a; tonic = t; minor = false; }
      if (b > best) { best = b; tonic = t; minor = true; }
    }
    return { tonic, minor, conf: best };
  }

  function analyze(x, sr) {
    const o = onsetEnv(x, sr), t = tempo(o.env, o.low, o.fr), k = key(x, sr);
    return { bpm: t.bpm, grid0: t.grid0, tonic: k.tonic, minor: k.minor };
  }

  /* ---------- Roue harmonique ---------- */
  const NOTES = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
  function keyNum(tonic, minor) { const t = minor ? (tonic + 3) % 12 : tonic; return ((t * 7) % 12 + 7) % 12 + 1; }
  function keyCode(tonic, minor) { return keyNum(tonic, minor) + (minor ? 'A' : 'B'); }
  function keyName(tonic, minor) { return NOTES[tonic] + (minor ? ' m' : ''); }
  /* 2 = même tonalité, 1 = voisine sur la roue, 0 = éloignée */
  function keyCompat(a, b) {
    if (!a || !b || a.tonic == null || b.tonic == null) return 0;
    const na = keyNum(a.tonic, a.minor), nb = keyNum(b.tonic, b.minor), same = !!a.minor === !!b.minor;
    if (na === nb) return same ? 2 : 1;
    const d = Math.abs(na - nb);
    return same && (d === 1 || d === 11) ? 1 : 0;
  }

  /* ---------- Mise en page du mix et carte de tempo ---------- */
  /* items : [{sbIn, sbOut, overlap, tempo, tmode}] en temps (battements) */
  function computeLayout(items) {
    const L = [], n = items.length;
    for (let i = 0; i < n; i++) {
      const it = items[i], len = Math.max(1, it.sbOut - it.sbIn);
      let mb0 = 0;
      if (i > 0) {
        const p = L[i - 1], ov = Math.max(0, Math.min(it.overlap, len, p.mb1 - p.mb0));
        mb0 = p.mb1 - ov;
        if (i >= 2) mb0 = Math.max(mb0, L[i - 2].mb1);
      }
      L.push({ mb0, mb1: mb0 + len, off: mb0 - it.sbIn, len, lane: i % 2, inOv: 0, outOv: 0 });
    }
    for (let i = 1; i < n; i++) { const ov = L[i - 1].mb1 - L[i].mb0; L[i].inOv = ov; L[i - 1].outOv = ov; }
    const segs = [];
    let t = 0;
    const push = (b0, b1, T0, T1) => {
      if (b1 - b0 < 1e-9) return;
      const dt = T0 === T1 ? (b1 - b0) * 60 / T0 : 120 * (b1 - b0) / (T0 + T1);
      segs.push({ b0, b1, T0, T1, t0: t, t1: t + dt }); t += dt;
    };
    for (let i = 0; i < n; i++) {
      const a = i === 0 ? L[0].mb0 : L[i - 1].mb1, b = i === n - 1 ? L[i].mb1 : L[i + 1].mb0, T = items[i].tempo;
      push(a, b, T, T);
      if (i < n - 1) {
        const m = items[i + 1].tmode, Tn = items[i + 1].tempo;
        push(L[i + 1].mb0, L[i].mb1, m === 'lead' ? Tn : T, m === 'hold' ? T : Tn);
      }
    }
    const find = (v, k0, k1) => {
      let lo = 0, hi = segs.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (v > segs[m][k1]) lo = m + 1; else hi = m; }
      return segs[lo];
    };
    const lay = { items: L, segs, total: t, totalBeats: n ? L[n - 1].mb1 : 0 };
    lay.segAtTime = tt => segs.length ? find(tt, 't0', 't1') : null;
    lay.tempoInSeg = (s, tt) => s.T0 === s.T1 ? s.T0 : s.T0 + (s.T1 - s.T0) * Math.min(1, Math.max(0, (tt - s.t0) / (s.t1 - s.t0)));
    lay.tempoAt = tt => { const s = lay.segAtTime(tt); return s ? lay.tempoInSeg(s, tt) : 120; };
    lay.b2t = b => {
      if (!segs.length) return b * 0.5;
      const s = find(b, 'b0', 'b1');
      if (b <= s.b0) return s.t0 + (b - s.b0) * 60 / s.T0;
      if (b >= s.b1) return s.t1 + (b - s.b1) * 60 / s.T1;
      if (s.T0 === s.T1) return s.t0 + (b - s.b0) * 60 / s.T0;
      const a = (s.T1 - s.T0) / (2 * (s.t1 - s.t0)), c = 60 * (b - s.b0);
      return s.t0 + 2 * c / (s.T0 + Math.sqrt(s.T0 * s.T0 + 4 * a * c));
    };
    lay.t2b = tt => {
      if (!segs.length) return tt * 2;
      const s = find(tt, 't0', 't1');
      if (tt <= s.t0) return s.b0 + (tt - s.t0) * s.T0 / 60;
      if (tt >= s.t1) return s.b1 + (tt - s.t1) * s.T1 / 60;
      const u = tt - s.t0;
      if (s.T0 === s.T1) return s.b0 + u * s.T0 / 60;
      return s.b0 + (s.T0 * u + (s.T1 - s.T0) * u * u / (2 * (s.t1 - s.t0))) / 60;
    };
    return lay;
  }

  function evalEnv(pts, b) {
    const n = pts.length;
    if (!n) return 1;
    if (b <= pts[0].b) return pts[0].v;
    for (let k = 1; k < n; k++) {
      if (b <= pts[k].b) { const d = pts[k].b - pts[k - 1].b; return d < 1e-9 ? pts[k].v : pts[k - 1].v + (pts[k].v - pts[k - 1].v) * (b - pts[k - 1].b) / d; }
    }
    return pts[n - 1].v;
  }

  /* Courbes automatiques d'un morceau, en temps relatifs à son début.
     inType : transition d'entrée ; outType : transition d'entrée du morceau suivant */
  function autoCurves(L, inType, outType) {
    const len = L.len, a = L.inOv, o = L.outOv, vol = [], bass = [];
    let inEnd = 0;
    if (a > 0 && inType !== 'quick') { inEnd = inType === 'bass' ? a * 0.25 : a; vol.push({ b: 0, v: 0 }, { b: inEnd, v: 1 }); }
    else vol.push({ b: 0, v: 1 });
    if (o > 0) {
      const st = Math.max(inEnd, outType === 'bass' ? len - o * 0.25 : len - o);
      if (st > vol[vol.length - 1].b + 1e-6) vol.push({ b: st, v: 1 });
      vol.push({ b: len, v: 0 });
    } else vol.push({ b: len, v: 1 });
    if (a > 1 && inType === 'bass') bass.push({ b: 0, v: 0 }, { b: a / 2 - 0.5, v: 0 }, { b: a / 2 + 0.5, v: 1 });
    else bass.push({ b: 0, v: 1 });
    if (o > 1 && outType === 'bass') {
      const m = Math.max(bass[bass.length - 1].b, len - o / 2 - 0.5);
      bass.push({ b: m, v: 1 }, { b: Math.max(m, len - o / 2 + 0.5), v: 0 }, { b: len, v: 0 });
    } else bass.push({ b: len, v: 1 });
    return { vol, bass, treble: [{ b: 0, v: 1 }, { b: len, v: 1 }] };
  }

  /* ---------- Fichiers : WAV, CRC, ZIP sans compression ---------- */
  function wavHeader(frames, sr, ch, bits) {
    bits = bits || 16;
    const h = new DataView(new ArrayBuffer(44)), bytes = bits >> 3, data = frames * ch * bytes, s = (o, t) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); h.setUint32(4, 36 + data, true); s(8, 'WAVE'); s(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true);
    h.setUint16(22, ch, true); h.setUint32(24, sr, true); h.setUint32(28, sr * ch * bytes, true); h.setUint16(32, ch * bytes, true); h.setUint16(34, bits, true);
    s(36, 'data'); h.setUint32(40, data, true);
    return new Uint8Array(h.buffer);
  }
  let CRCT = null;
  function crc32(u8, crc) {
    if (!CRCT) { CRCT = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRCT[n] = c >>> 0; } }
    let c = ~(crc || 0) >>> 0;
    for (let i = 0; i < u8.length; i++) c = CRCT[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return ~c >>> 0;
  }
  /* files : [{name, parts:[Uint8Array|Blob], size, crc}] → liste de morceaux à passer à new Blob() */
  function zipStore(files) {
    const out = [], central = [], enc = new TextEncoder();
    let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, f.crc, true); lh.setUint32(18, f.size, true); lh.setUint32(22, f.size, true);
      lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      out.push(new Uint8Array(lh.buffer), nm, ...f.parts);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, f.crc, true); ch.setUint32(20, f.size, true); ch.setUint32(24, f.size, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + f.size;
    }
    let cs = 0; for (const c of central) cs += c.length;
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return out.concat(central, [new Uint8Array(e.buffer)]);
  }


  /* ---------- FLAC 16 bits stéréo : prédicteurs fixes + codage de Rice ---------- */
  function flacEncoder(total, sr, bits) {
    bits = bits === 24 ? 24 : 16; const BM = (1 << bits) - 1;
    const BS = 4096, c8 = new Uint8Array(256), c16 = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i, d = i << 8;
      for (let k = 0; k < 8; k++) { c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff; d = d & 0x8000 ? ((d << 1) ^ 0x8005) & 0xffff : (d << 1) & 0xffff; }
      c8[i] = c; c16[i] = d;
    }
    const h = new Uint8Array(42);
    h.set([0x66, 0x4C, 0x61, 0x43, 0x80, 0, 0, 34, BS >> 8, BS & 255, BS >> 8, BS & 255], 0);
    h[18] = sr >> 12; h[19] = (sr >> 4) & 255; h[20] = ((sr & 15) << 4) | (1 << 1) | ((bits - 1) >> 4); h[21] = (((bits - 1) & 15) << 4) | (Math.floor(total / 4294967296) & 15);
    h[22] = (total >>> 24) & 255; h[23] = (total >>> 16) & 255; h[24] = (total >>> 8) & 255; h[25] = total & 255;
    let frameNo = 0, buf, pos, acc, nb;
    const wb = (v, bits) => { acc = (acc << bits) | (v & ((1 << bits) - 1)); nb += bits; while (nb >= 8) { buf[pos++] = (acc >>> (nb - 8)) & 255; nb -= 8; } acc &= (1 << nb) - 1; };
    const res = new Int32Array(BS);
    function sub(x, o, bs) {
      let same = true; for (let i = 1; i < bs; i++) if (x[o + i] !== x[o]) { same = false; break; }
      if (same) { wb(0, 8); wb(x[o] & BM, bits); return; }
      const sums = [0, 0, 0, 0, 0];
      for (let i = 4; i < bs; i++) {
        const a = x[o + i], b = x[o + i - 1], c = x[o + i - 2], d = x[o + i - 3], e = x[o + i - 4];
        sums[0] += Math.abs(a); sums[1] += Math.abs(a - b); sums[2] += Math.abs(a - 2 * b + c); sums[3] += Math.abs(a - 3 * b + 3 * c - d); sums[4] += Math.abs(a - 4 * b + 6 * c - 4 * d + e);
      }
      let ord = 0; for (let k = 1; k < 5; k++) if (sums[k] < sums[ord]) ord = k;
      if (bs <= ord) ord = 0;
      let sumU = 0;
      for (let i = ord; i < bs; i++) {
        const a = x[o + i]; let r;
        if (ord === 0) r = a; else if (ord === 1) r = a - x[o + i - 1]; else if (ord === 2) r = a - 2 * x[o + i - 1] + x[o + i - 2];
        else if (ord === 3) r = a - 3 * x[o + i - 1] + 3 * x[o + i - 2] - x[o + i - 3]; else r = a - 4 * x[o + i - 1] + 6 * x[o + i - 2] - 4 * x[o + i - 3] + x[o + i - 4];
        const u = r >= 0 ? r * 2 : -r * 2 - 1; res[i] = u; sumU += u;
      }
      let k = 0, best = Infinity; const n = bs - ord;
      for (let j = 0; j < 15; j++) { const b = n * (j + 1) + Math.floor(sumU / (1 << j)); if (b < best) { best = b; k = j; } }
      if (best + 64 > bs * bits) { wb(2, 8); for (let i = 0; i < bs; i++) wb(x[o + i] & BM, bits); return; }
      wb((8 | ord) << 1, 8);
      for (let i = 0; i < ord; i++) wb(x[o + i] & BM, bits);
      wb(0, 2); wb(0, 4); wb(k, 4);
      const mask = (1 << k) - 1;
      for (let i = ord; i < bs; i++) { const u = res[i]; let q = u >>> k; while (q >= 16) { wb(0, 16); q -= 16; } wb(1, q + 1); if (k) wb(u & mask, k); }
    }
    return {
      header: h,
      /* à appeler par blocs multiples de 4096 échantillons, sauf le dernier */
      encode(l, r) {
        const n = l.length;
        buf = new Uint8Array(n * 8 + 4096); pos = 0; acc = 0; nb = 0;
        for (let o = 0; o < n; o += BS) {
          const bs = Math.min(BS, n - o), st = pos;
          if (pos + bs * 8 + 256 > buf.length) { const nbuf = new Uint8Array(buf.length * 2 + bs * 8); nbuf.set(buf.subarray(0, pos)); buf = nbuf; }
          buf[pos++] = 0xFF; buf[pos++] = 0xF8; buf[pos++] = ((bs === BS ? 0xC : 0x7) << 4) | 0x9; buf[pos++] = bits === 24 ? 0x1C : 0x18;
          const f = frameNo++;
          if (f < 0x80) buf[pos++] = f;
          else if (f < 0x800) { buf[pos++] = 0xC0 | (f >> 6); buf[pos++] = 0x80 | (f & 63); }
          else if (f < 0x10000) { buf[pos++] = 0xE0 | (f >> 12); buf[pos++] = 0x80 | ((f >> 6) & 63); buf[pos++] = 0x80 | (f & 63); }
          else { buf[pos++] = 0xF0 | (f >> 18); buf[pos++] = 0x80 | ((f >> 12) & 63); buf[pos++] = 0x80 | ((f >> 6) & 63); buf[pos++] = 0x80 | (f & 63); }
          if (bs !== BS) { buf[pos++] = ((bs - 1) >> 8) & 255; buf[pos++] = (bs - 1) & 255; }
          let c = 0; for (let i = st; i < pos; i++) c = c8[c ^ buf[i]];
          buf[pos++] = c;
          sub(l, o, bs); sub(r, o, bs);
          if (nb) wb(0, 8 - nb);
          let d = 0; for (let i = st; i < pos; i++) d = ((d << 8) & 0xffff) ^ c16[(d >> 8) ^ buf[i]];
          buf[pos++] = d >> 8; buf[pos++] = d & 255;
        }
        return buf.slice(0, pos);
      }
    };
  }

  return { flacEncoder, fft, decimate, peaks, onsetEnv, tempo, key, analyze, keyNum, keyCode, keyName, keyCompat, computeLayout, evalEnv, autoCurves, wavHeader, crc32, zipStore };
}

