#!/usr/bin/env python3
"""Set the single release version before opening a release PR."""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
VERSION = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?")

def prepare(version, root=ROOT):
    if not VERSION.fullmatch(version):
        raise ValueError('Use a semantic version, for example 0.2.0-up.5')
    changes = {}
    for name in ('package.json', 'package-lock.json'):
        path = root / name
        data = json.loads(path.read_text())
        data['version'] = version
        if name == 'package-lock.json':
            data['packages']['']['version'] = version
        changes[path] = json.dumps(data, indent=2) + '\n'
    path = root / 'homeassistant/config.yaml'
    text, count = re.subn(r'(?m)^version:.*$', f"version: '{version}'", path.read_text())
    if count != 1:
        raise ValueError('Expected one Home Assistant version')
    changes[path] = text
    for path, text in changes.items():
        path.write_text(text)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: npm run release:prepare -- 0.2.0-up.5')
    prepare(sys.argv[1])
    print('Version updated. Add release notes to CHANGELOG.md, then open a PR.')
