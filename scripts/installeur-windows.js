#!/usr/bin/env node
// Fabrique dist/Timeline-DJ-Mix-Windows-Setup.exe à partir de dist/win-unpacked avec NSIS (makensis).
// Cherche makensis : variable MAKENSIS, dossier NSIS de Windows, PATH, puis la copie téléchargée par electron-builder.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const pkg = require('../package.json');

function trouverMakensis() {
  if (process.env.MAKENSIS) return { exe: process.env.MAKENSIS };
  if (process.platform === 'win32') {
    for (const d of [process.env['ProgramFiles(x86)'], process.env.ProgramFiles]) {
      if (d && fs.existsSync(path.join(d, 'NSIS', 'makensis.exe'))) return { exe: path.join(d, 'NSIS', 'makensis.exe') };
    }
  }
  try { execFileSync(process.platform === 'win32' ? 'where' : 'which', ['makensis'], { stdio: 'ignore' }); return { exe: 'makensis' }; } catch (e) { /* pas dans le PATH */ }
  // copie de NSIS téléchargée par electron-builder (Linux et Mac)
  const caches = [process.env.ELECTRON_BUILDER_CACHE, path.join(os.homedir(), '.cache', 'electron-builder'), path.join(os.homedir(), 'Library', 'Caches', 'electron-builder')].filter(Boolean);
  for (const c of caches) {
    if (!fs.existsSync(c)) continue;
    for (const d of fs.readdirSync(c).filter(n => n.startsWith('nsis-') && !n.startsWith('nsis-resources'))) {
      const base = path.join(c, d);
      for (const sub of [base, ...fs.readdirSync(base).map(n => path.join(base, n))]) {
        const exe = path.join(sub, process.platform === 'darwin' ? 'mac' : 'linux', 'makensis');
        if (fs.existsSync(exe)) return { exe, nsisdir: sub };
      }
    }
  }
  return null;
}

if (!fs.existsSync(path.join(ROOT, 'dist', 'win-unpacked'))) {
  console.error('dist/win-unpacked est absent : lancez d\'abord « npx electron-builder --win dir --x64 ».'); process.exit(1);
}
const m = trouverMakensis();
if (!m) {
  console.error('NSIS (makensis) est introuvable. Windows : installez NSIS depuis https://nsis.sourceforge.io ; Linux : sudo apt install nsis ; Mac : brew install makensis.');
  process.exit(1);
}
const env = Object.assign({}, process.env, m.nsisdir ? { NSISDIR: m.nsisdir } : {});
execFileSync(m.exe, ['-V2', '-DVERSION=' + pkg.version, 'installer.nsi'], { cwd: ROOT, env, stdio: 'inherit' });
console.log('  • dist/Timeline-DJ-Mix-Windows-Setup.exe');
