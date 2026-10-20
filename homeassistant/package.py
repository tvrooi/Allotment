#!/usr/bin/env python3
"""Package this modified checkout as a local Home Assistant app; no bank data included."""
from pathlib import Path
import argparse
import json
import shutil
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--out', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=True)
app = out / 'flybudget_up'
app.mkdir()  # Never overwrite an existing app folder or its data.
files = subprocess.check_output(
    ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root
).decode().split('\0')
for relative in files:
    if not relative or relative == 'homeassistant/config.yaml':
        continue
    source = root / relative
    if not source.is_file():
        continue
    target = app / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)

shutil.copy2(root / 'README.md', app / 'UPSTREAM-README.md')
for filename in ['README.md', 'DOCS.md', 'config.yaml']:
    shutil.copy2(root / 'homeassistant' / filename, app / filename)
shutil.copy2(root / 'client/public/logo.png', app / 'icon.png')
version = json.loads((root / 'package.json').read_text())['version']
config = (app / 'config.yaml').read_text()
import re
config = re.sub(r"(?m)^version:.*$", f"version: '{version}'", config)
(app / 'config.yaml').write_text(config)
upstream = (root / 'Dockerfile').read_text()
(app / 'Dockerfile.upstream').write_text(upstream)
# Build on the device's own architecture, and retain the upstream hardened runtime.
dockerfile = upstream.replace('FROM --platform=$BUILDPLATFORM ', 'FROM ')
dockerfile = dockerfile.replace('ENTRYPOINT ["/usr/bin/tini", "--"]', '')
dockerfile = dockerfile.replace('CMD ["node", "server.js"]', '')
dockerfile += '''

# Home Assistant local app wrapper. Prepare Supervisor's private volume, then
# drop to the existing unprivileged node user before starting the web server.
USER root
RUN apt-get update \\
 && apt-get install -y --no-install-recommends gosu \\
 && rm -rf /var/lib/apt/lists/*
COPY homeassistant/start.sh homeassistant/ha-launch.cjs /app/
RUN chmod 755 /app/start.sh
ARG BUILD_ARCH
LABEL io.hass.name="FlyBudget Up Preview" \\
      io.hass.type="addon" \\
      io.hass.version="__RELEASE_VERSION__" \\
      io.hass.arch="${BUILD_ARCH}"
ENTRYPOINT ["/app/start.sh"]
CMD []
'''
dockerfile = dockerfile.replace('__RELEASE_VERSION__', version)
(app / 'Dockerfile').write_text(dockerfile)

archive = out / 'FlyBudget-Up-Home-Assistant.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as zipped:
    for file in sorted(app.rglob('*')):
        if file.is_file():
            zipped.write(file, arcname=file.relative_to(out))
print(archive)
print(app)
