#!/bin/sh
# Fabrique les deux versions Mac (Apple Silicon et Intel) dans le dossier dist/
# Double-cliquez sur ce fichier depuis le Finder. Il faut Node.js 20 ou plus récent : https://nodejs.org
set -e
cd "$(dirname "$0")"
npm ci
npm run dist:mac
echo
echo "Terminé : les fichiers sont dans le dossier dist/"
read -r -p "Appuyez sur Entrée pour fermer." _
