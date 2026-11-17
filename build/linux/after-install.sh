#!/bin/sh
# TIMELINE DJ MIX : réglages après installation
set -e
APP="/opt/TIMELINE DJ MIX"
# bac à sable de Chromium (nécessaire au démarrage sur Ubuntu 24.04 et suivants)
if [ -f "$APP/chrome-sandbox" ]; then chown root:root "$APP/chrome-sandbox" || true; chmod 4755 "$APP/chrome-sandbox" || true; fi
# accès des contrôleurs DJ USB HID pour l'utilisateur connecté (règles reprises du projet Mixxx)
if [ -f "$APP/resources/69-timeline-dj-mix-usb.rules" ]; then
  install -m 644 "$APP/resources/69-timeline-dj-mix-usb.rules" /etc/udev/rules.d/69-timeline-dj-mix-usb.rules
  if command -v udevadm >/dev/null 2>&1; then udevadm control --reload-rules || true; udevadm trigger --subsystem-match=hidraw || true; fi
fi
ln -sf "$APP/timeline-dj-mix" /usr/bin/timeline-dj-mix || true
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q /usr/share/applications || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
exit 0
