#!/bin/sh
rm -f /etc/udev/rules.d/69-timeline-dj-mix-usb.rules /usr/bin/timeline-dj-mix
command -v udevadm >/dev/null 2>&1 && udevadm control --reload-rules || true
exit 0
