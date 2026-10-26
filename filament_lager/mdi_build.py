"""Beim Bauen der App: Material Design Icons (wie in Home Assistant) als kleine JSON-Datei ablegen.

Schlägt der Download fehl, wird die App trotzdem gebaut, nur ohne MDI-Icons.
"""

import io
import json
import re
import sys
import tarfile
import urllib.request

URL = "https://registry.npmjs.org/@mdi/svg/-/svg-7.4.47.tgz"
OUT = sys.argv[1] if len(sys.argv) > 1 else "/app/mdi.json"

icons = {}
try:
    with urllib.request.urlopen(URL, timeout=120) as resp:
        data = resp.read()
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
        for member in tar.getmembers():
            m = re.match(r"package/svg/([a-z0-9-]+)\.svg$", member.name)
            if not m:
                continue
            svg = tar.extractfile(member).read().decode()
            path = re.search(r'\sd="([^"]+)"', svg)
            if path:
                icons[m.group(1)] = path.group(1)
except Exception as e:  # noqa: BLE001 - Bau soll nicht scheitern
    print("MDI-Icons nicht geladen:", e)
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(icons, f, separators=(",", ":"))
print("MDI-Icons:", len(icons))
