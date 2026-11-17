# TIMELINE DJ MIX

**Le mix DJ monté sur timeline** — par DJ LATIN JAZZ & DJ CRISLATINO, en collaboration avec Claude.ai.
Logiciel libre et gratuit, GNU GPL version 2 ou ultérieure.

Site, téléchargements et notice : https://deltapassion.github.io/Timeline-DJ-Mix/
Soutenir le projet : https://ko-fi.com/djlatinjazz

*English below.*

---

## Ce que fait le logiciel

Enchaînements calés au tempo sur une timeline, courbes de volume, graves et aigus, mix harmonique,
Auto DJ par styles, table de mixage avec effets et tempo ±8 % par voie, pré-écoute au casque
(carte 4 canaux ou deuxième carte son), contrôleurs MIDI avec les mappings Mixxx et apprentissage MIDI,
export MP3, FLAC, WAV et AIFF, interface et notice en 10 langues.

## Organisation du dépôt

| Dossier / fichier | Contenu |
|---|---|
| `src/index.template.html` | la page du logiciel (structure HTML), avec des repères `@@…@@` |
| `src/js/` | `app.js` (le logiciel), `core.js` (analyse audio, calculs, encodeurs), `potentiometres.js`, `disposition.js` |
| `src/styles/` | feuilles de style |
| `src/langues/` | textes de l'interface : `fr.txt` + une traduction par langue (une ligne = numéro, tabulation, texte) |
| `src/controleurs/` | mappings Mixxx inclus (un dossier par contrôleur, liste dans `liste.json`) |
| `src/vendor/lame.min.js` | encodeur MP3 lamejs (LGPL) |
| `scripts/assembler.js` | assemble tout en un seul fichier `app/index.html` |
| `main.js`, `build/`, `installer.nsi`, `afterPack.js` | version de bureau (Electron) et installateurs |
| `docs/` | le site GitHub Pages, avec la notice en 10 langues (HTML et PDF) |
| `outils/site/` | générateurs du site, de la notice, des captures et des vidéos (Python, facultatif) |
| `.github/workflows/fabriquer.yml` | fabrication automatique des 4 versions par GitHub |

## Fabriquer le logiciel sur son ordinateur

Il faut **Node.js 20 ou plus récent** (https://nodejs.org). Ensuite, double-clic sur :

| Système | Fichier | Résultat dans `dist/` |
|---|---|---|
| Windows | `fabriquer-windows.bat` (il faut aussi NSIS : https://nsis.sourceforge.io) | `Timeline-DJ-Mix-Windows-Setup.exe` |
| Mac (Apple M ou Intel) | `fabriquer-mac.command` | `Timeline-DJ-Mix-macOS-AppleSilicon.zip` et `Timeline-DJ-Mix-macOS-Intel.zip` |
| Linux | `fabriquer-linux.sh` | `timeline-dj-mix_amd64.deb` et `Timeline-DJ-Mix-x86_64.AppImage` |

Ou en ligne de commande :

```
npm ci
npm run assembler        # seulement le fichier HTML : app/index.html et dist-web/
npm start                # essayer la version de bureau
npm run dist:linux       # .deb + AppImage
npm run dist:win         # installateur Windows
npm run dist:mac         # Mac Apple Silicon + Intel (ou dist:mac-arm64 / dist:mac-intel)
```

`npm run assembler` produit aussi `dist-web/Timeline-DJ-Mix.html` (version sans installation, pour Chrome ou Edge)
et `dist-web/Notice-Timeline-DJ-Mix.html` (notice autonome en 10 langues, images comprises).

Depuis Linux, on peut aussi fabriquer les versions Windows (NSIS : `sudo apt install nsis`) et Mac
(signature avec [rcodesign](https://github.com/indygreg/apple-platform-rs), variable `RCODESIGN`).

## Fabriquer par GitHub (sans rien installer)

Le fichier `.github/workflows/fabriquer.yml` fabrique les versions Windows, Mac (Apple Silicon et Intel) et Linux :

- à chaque envoi sur la branche `main` : fichiers à télécharger dans l'onglet **Actions** › dernière exécution › *Artifacts* ;
- pour publier une version : créer une étiquette, par exemple `git tag v0.3.0 && git push --tags`.
  GitHub crée alors la **Release** avec tous les fichiers, sous les noms attendus par les boutons du site.

## Le site

*Settings › Pages* : *Deploy from a branch*, branche `main`, dossier `/docs`.
Après une modification du logiciel, `npm run assembler` met aussi à jour `docs/app/index.html` (version en ligne).

## Modifier les textes et les traductions

Chaque ligne de `src/langues/fr.txt` a son numéro ; la même ligne existe dans chaque langue.
Pour un nouveau texte : ajouter la ligne suivante dans `fr.txt` et dans les 9 autres fichiers.
`scripts/assembler.js` signale une ligne manquante ou un repère `{x}` oublié.

## Notes sur Mac

L'application n'est pas signée par un certificat Apple. Au premier lancement :
*Réglages Système › Confidentialité et sécurité › Ouvrir quand même*.
Si macOS dit que l'application est endommagée :
`xattr -dr com.apple.quarantine "/Applications/TIMELINE DJ MIX.app"`.

## Licences

TIMELINE DJ MIX : GNU GPL v2 ou ultérieure (`LICENSE-GPL-2.0.txt`).
Mappings et bibliothèques de contrôleurs : projet [Mixxx](https://mixxx.org) (GPL).
Encodage MP3 : [lamejs](https://github.com/zhuker/lamejs) (LGPL).
Photo de fond du site : Patrick LEVERGER.

---

# English

**The DJ mix built on a timeline** — by DJ LATIN JAZZ & DJ CRISLATINO, in collaboration with Claude.ai.
Free software, GNU GPL v2 or later.

### Build

Install **Node.js 20+**, then run `fabriquer-windows.bat` (needs NSIS), `fabriquer-mac.command` or `fabriquer-linux.sh`,
or use `npm ci` followed by `npm run dist:win`, `npm run dist:mac` (Apple Silicon + Intel) or `npm run dist:linux`.
Files are written to `dist/`. `npm run assembler` only rebuilds the single-file app (`app/index.html`, `dist-web/`).

GitHub Actions (`.github/workflows/fabriquer.yml`) builds all four versions on every push to `main`;
pushing a `v*` tag publishes a Release with all files.

### Layout

`src/` holds the app sources (HTML template, JS, CSS, UI strings in `src/langues/`, bundled Mixxx mappings in `src/controleurs/`);
`scripts/assembler.js` assembles them into one HTML file. `main.js` and `build/` are the Electron desktop shell.
`docs/` is the GitHub Pages website with the 10-language user guide.
