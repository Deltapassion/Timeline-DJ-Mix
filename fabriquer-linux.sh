#!/bin/sh
# Fabrique les versions Linux (.deb et AppImage) dans le dossier dist/
# Il faut Node.js 20 ou plus récent : https://nodejs.org
set -e
cd "$(dirname "$0")"
npm ci
npm run dist:linux
echo
echo "Terminé : les fichiers sont dans le dossier dist/"
