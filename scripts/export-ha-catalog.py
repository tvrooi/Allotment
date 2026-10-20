#!/usr/bin/env python3
"""Export only public installation metadata, after the HA image is published."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def export(out, commit, digest):
    if not re.fullmatch(r'[0-9a-f]{40}', commit):
        raise ValueError('Expected a full source commit')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
        raise ValueError('Expected the published image digest')
    version = json.loads((ROOT / 'package.json').read_text())['version']
    image = 'ghcr.io/tvrooi/flybudget-ha'
    config = (ROOT / 'homeassistant/config.yaml').read_text()
    if f"version: '{version}'" not in config:
        raise ValueError('Release versions disagree')
    config += f"image: {image}\nurl: https://github.com/tvrooi/FlyBudget/tree/{commit}\n"
    files = {
        'config.yaml': config.encode(),
        'README.md': (ROOT / 'homeassistant/README.md').read_bytes(),
        'DOCS.md': (ROOT / 'homeassistant/DOCS.md').read_bytes(),
        'CHANGELOG.md': (ROOT / 'CHANGELOG.md').read_bytes(),
        'LICENSE': (ROOT / 'LICENSE').read_bytes(),
        'icon.png': (ROOT / 'client/public/logo.png').read_bytes(),
    }
    receipt = dict(version=version, source_repository='tvrooi/FlyBudget',
                   source_commit=commit, image=image, image_digest=digest,
                   files={name: hashlib.sha256(data).hexdigest() for name, data in files.items()})
    files['release.json'] = (json.dumps(receipt, indent=2) + '\n').encode()
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in files.items():
            archive.writestr('flybudget_up/' + name, data)
    return receipt

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--digest', required=True)
    args = parser.parse_args()
    print(json.dumps(export(args.out, args.commit, args.digest), indent=2))
