# Publier le site de TIMELINE DJ MIX

1. Créer le dépôt GitHub **Deltapassion/Timeline-DJ-Mix** (public) et y envoyer le code source.
2. Le dossier `docs/` est déjà à la racine du dépôt.
3. Dans le dépôt : *Settings › Pages › Build and deployment* : *Deploy from a branch*, branche `main`, dossier `/docs`.
   Le site sera à l'adresse https://deltapassion.github.io/Timeline-DJ-Mix/
4. Publier une version : créer l'étiquette `v0.3.0` (`git tag v0.3.0 && git push --tags`).
   GitHub fabrique les versions Windows, Mac et Linux et crée la *Release* avec les bons noms de fichiers
   (Timeline-DJ-Mix-Windows-Setup.exe, Timeline-DJ-Mix-macOS-AppleSilicon.zip, Timeline-DJ-Mix-macOS-Intel.zip,
   timeline-dj-mix_amd64.deb, Timeline-DJ-Mix-x86_64.AppImage, Timeline-DJ-Mix.html, Notice-Timeline-DJ-Mix.html).
   Les boutons « Télécharger » du site pointent toujours vers la dernière version.

5. Vidéos de présentation : elles sont dans `docs/video/`. Une fois publiées sur YouTube, ouvrir
   `docs/index.html`, chercher `var PRES = {fr: "", en: ""};` et mettre les identifiants YouTube
   (la partie après `watch?v=`). Le site utilisera alors YouTube ; on peut ensuite supprimer
   les fichiers .mp4 du dossier `video/` pour alléger le dépôt.
6. Le compteur de visites utilise le compte GoatCounter « deltapassion », comme les autres sites.
