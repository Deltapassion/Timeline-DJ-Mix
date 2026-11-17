#!/usr/bin/env node
// TIMELINE DJ MIX — assemble le logiciel en un seul fichier HTML à partir des sources de src/
// Usage : node scripts/assembler.js
//   produit app/index.html (utilisé par Electron), app/notice/ (notice hors ligne),
//   dist-web/Timeline-DJ-Mix.html (version sans installation)
//   et dist-web/Notice-Timeline-DJ-Mix.html (notice autonome en 10 langues)
// © 2026 DJ LATIN JAZZ & DJ CRISLATINO, en collaboration avec Claude.ai — GNU GPL v2 ou ultérieure
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const lire = (...p) => fs.readFileSync(path.join(...p), 'utf8');
const ecrire = (p, txt) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, txt); };
// texte JSON sûr à l'intérieur d'une balise <script>
const jsonScript = o => JSON.stringify(o).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');

const LANGUES = ['fr', 'en', 'es', 'pt', 'it', 'de', 'el', 'ru', 'zh', 'ja'];

// --- textes de l'interface : src/langues/xx.txt, une ligne « numéro<TAB>texte » ---
function langues() {
  const lireListe = l => {
    const m = new Map();
    for (const ligne of lire(SRC, 'langues', l + '.txt').split(/\r?\n/)) {
      if (!ligne.trim()) continue;
      const t = ligne.indexOf('\t');
      if (t < 0) throw new Error(`langues/${l}.txt : tabulation manquante : ${ligne}`);
      m.set(Number(ligne.slice(0, t)), ligne.slice(t + 1));
    }
    return m;
  };
  const fr = lireListe('fr'), n = fr.size, data = {};
  for (const l of LANGUES) {
    const m = l === 'fr' ? fr : lireListe(l), arr = [];
    for (let i = 0; i < n; i++) {
      if (!m.has(i)) throw new Error(`langues/${l}.txt : la ligne ${i} manque (« ${fr.get(i)} »)`);
      const a = (fr.get(i).match(/\{\w\}/g) || []).sort().join(), b = (m.get(i).match(/\{\w\}/g) || []).sort().join();
      if (a !== b) throw new Error(`langues/${l}.txt ligne ${i} : les repères {x} ne correspondent pas au français`);
      arr.push(m.get(i));
    }
    data[l] = arr;
  }
  return data;
}

// --- mappings Mixxx : src/controleurs/liste.json + un dossier par contrôleur ---
function controleurs() {
  const dir = path.join(SRC, 'controleurs'), liste = JSON.parse(lire(dir, 'liste.json'));
  const libs = {}, presets = {};
  for (const b of liste.bibliotheques) libs[b] = lire(dir, 'bibliotheques', b);
  for (const c of liste.controleurs) {
    const files = {};
    for (const f of c.files) files[f] = lire(dir, c.id, f);
    presets[c.id] = { label: c.label, match: c.match, kind: c.kind, xml: c.xml, files };
  }
  return { libs, presets };
}

function logiciel() {
  const icone = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'build', 'icones', 'embed-96.png')).toString('base64');
  let html = lire(SRC, 'index.template.html');
  html = html.replace(/@@INCLUDE:([\w./-]+)@@/g, (_, f) => lire(SRC, f));
  html = html.split('@@ICON96@@').join(icone);
  html = html.replace('@@I18N@@', () => jsonScript(langues()));
  html = html.replace('@@MIXXX@@', () => jsonScript(controleurs()));
  const reste = html.match(/@@[A-Z0-9]+[:@]/);
  if (reste) throw new Error('repère non remplacé : ' + reste[0]);
  return html;
}

// --- notice : docs/notice/index.html (page du site) rendue utilisable hors du site ---
const SITE = 'https://deltapassion.github.io/Timeline-DJ-Mix/';
function notice(integrer) {
  const dir = path.join(ROOT, 'docs', 'notice');
  if (!fs.existsSync(path.join(dir, 'index.html'))) return null;
  const dataUri = f => {
    const ext = path.extname(f).slice(1).replace('jpg', 'jpeg');
    return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
  };
  let h = lire(dir, 'index.html');
  h = h.replace(/(href|src)="\.\.\/assets\/([\w.-]+)"/g, (_, a, f) => `${a}="${dataUri(path.join(ROOT, 'docs', 'assets', f))}"`);
  h = h.split('href="../index.html"').join(`href="${SITE}"`);
  h = h.split('"../index.html?lang=" + l').join(JSON.stringify(SITE + 'index.html?lang=') + ' + l');
  h = h.split('"notice-" + l + ".pdf"').join(JSON.stringify(SITE + 'notice/notice-') + ' + l + ".pdf"');
  h = h.replace(/href="notice-(\w+)\.pdf"/g, (_, l) => `href="${SITE}notice/notice-${l}.pdf"`);
  if (integrer) h = h.replace(/src="(img\/[\w/.-]+)"/g, (_, f) => `src="${dataUri(path.join(dir, f))}"`);
  return h;
}

function copierDossier(de, vers) {
  fs.mkdirSync(vers, { recursive: true });
  for (const e of fs.readdirSync(de, { withFileTypes: true })) {
    const a = path.join(de, e.name), b = path.join(vers, e.name);
    if (e.isDirectory()) copierDossier(a, b); else fs.copyFileSync(a, b);
  }
}

const html = logiciel();
ecrire(path.join(ROOT, 'app', 'index.html'), html);
ecrire(path.join(ROOT, 'dist-web', 'Timeline-DJ-Mix.html'), html);
ecrire(path.join(ROOT, 'docs', 'app', 'index.html'), html);
console.log('  • app/index.html', (html.length / 1048576).toFixed(1), 'Mo');

const n = notice(false);
if (n) {
  fs.rmSync(path.join(ROOT, 'app', 'notice'), { recursive: true, force: true });
  ecrire(path.join(ROOT, 'app', 'notice', 'index.html'), n);
  copierDossier(path.join(ROOT, 'docs', 'notice', 'img'), path.join(ROOT, 'app', 'notice', 'img'));
  const auto = notice(true);
  ecrire(path.join(ROOT, 'dist-web', 'Notice-Timeline-DJ-Mix.html'), auto);
  console.log('  • app/notice/ et dist-web/Notice-Timeline-DJ-Mix.html', (auto.length / 1048576).toFixed(1), 'Mo');
}
