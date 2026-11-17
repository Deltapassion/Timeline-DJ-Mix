const Core = new Function(require('fs').readFileSync(__dirname + '/../../src/js/core.js', 'utf8') + '\nreturn CoreFactory;')()(); const fs = require('fs'); const cp = require('child_process');
const SR = 44100;
function synth(bpm, root, minor, prog, dur, swing) {
  const n = Math.floor(dur * SR), L = new Float32Array(n), R = new Float32Array(n), beat = 60 / bpm, t0 = 0.08;
  let seed = bpm * 7919; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const add = (i0, len, fn, pan) => { for (let i = 0; i < len && i0 + i < n; i++) { const v = fn(i / SR, i); L[i0 + i] += v * (1 - pan); R[i0 + i] += v * (1 + pan); } };
  const bars = Math.floor((dur - 1) / (4 * beat));
  for (let k = 0; k < bars * 4; k++) {
    const t = t0 + k * beat, i0 = Math.floor(t * SR), bar = Math.floor(k / 4), ib = k % 4, body = bar >= 4 && bar < bars - 4;
    add(i0, 0.3 * SR, tt => (ib === 0 ? 0.85 : 0.6) * Math.exp(-tt * 14) * Math.sin(2 * Math.PI * (46 + 100 * Math.exp(-tt * 30)) * tt), 0);
    add(Math.floor((t + beat / 2) * SR), 0.04 * SR, (tt) => 0.08 * rnd() * Math.exp(-tt * 120), 0.3);
    if (bar >= 2 && (ib === 1 || ib === 3)) add(i0, 0.12 * SR, tt => 0.18 * rnd() * Math.exp(-tt * 30), -0.2);
    if (swing) add(Math.floor((t + beat * 0.75) * SR), 0.05 * SR, tt => 0.25 * Math.exp(-tt * 60) * Math.sin(2 * Math.PI * 900 * tt), 0.4);
    if (body) {
      const deg = prog[bar % 4], pc = (root + deg) % 12, f = 55 * Math.pow(2, ((pc + 3) % 12) / 12), third = minor && deg !== 7 ? 3 : 4;
      add(Math.floor((t + beat / 2) * SR), beat * 0.45 * SR, (tt, i) => 0.22 * Math.min(1, i / 300) * Math.exp(-tt * 3) * Math.sin(2 * Math.PI * f * 2 * tt), 0);
      if (ib === 0) for (const st of [0, third, 7, 12]) add(i0, beat * 3.9 * SR, (tt, i) => (st === third ? 0.07 : 0.05) * Math.min(1, i / 400, (beat * 3.9 * SR - i) / 2000) * Math.sin(2 * Math.PI * f * 4 * Math.pow(2, st / 12) * tt), st % 2 ? 0.3 : -0.3);
      if (ib === 2) add(i0, beat * 0.9 * SR, (tt, i) => 0.06 * Math.min(1, i / 200) * Math.exp(-tt * 4) * Math.sin(2 * Math.PI * f * 8 * Math.pow(2, [0, 7, 12, third][bar % 4] / 12) * tt), 0.5);
    }
  }
  return [L, R];
}
const list = [
  ['Noche de Dax', 'Salsa', 96, 9, true, [0, 5, 0, 7], true],
  ['Río Caliente', 'Salsa', 98, 2, true, [0, 5, 7, 0], true],
  ['Brisa de Mayo', 'Bachata', 128, 4, true, [0, 5, 0, 7], false],
  ['Luna Azul', 'Bachata', 126, 11, true, [0, 7, 5, 0], false],
  ['Kizomba Lenta', 'Kizomba', 88, 7, false, [0, 5, 7, 0], false],
  ['Areia Doce', 'Kizomba', 90, 0, false, [0, 7, 5, 7], false],
  ['Semba Sol', 'Semba', 110, 5, false, [0, 5, 7, 0], true],
  ['Tango Gris', 'Tango', 120, 2, true, [0, 7, 0, 5], false],
];
fs.mkdirSync('tracks', { recursive: true });
for (const [title, style, bpm, root, minor, prog, sw] of list) {
  const [L, R] = synth(bpm, root, minor, prog, 110, sw);
  const pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-1, Math.min(1, L[i] * 0.8)) * 32767; pcm[2 * i + 1] = Math.max(-1, Math.min(1, R[i] * 0.8)) * 32767; }
  fs.writeFileSync('/tmp/x.wav', Buffer.concat([Buffer.from(Core.wavHeader(L.length, SR, 2)), Buffer.from(pcm.buffer)]));
  const out = `tracks/${style}/${title}.mp3`; fs.mkdirSync(`tracks/${style}`, { recursive: true });
  cp.execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', '/tmp/x.wav', '-metadata', `title=${title}`, '-metadata', 'artist=TIMELINE DJ MIX (démo)', '-id3v2_version', '3', '-b:a', '160k', out]);
  console.log(out);
}
