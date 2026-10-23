#!/usr/bin/env python3
"""Repair HA startup permissions and watchdog; app source only, no stored budget access."""
from pathlib import Path
import hashlib
import shutil
import sys

NEW_START = "#!/bin/sh\nset -eu\n\n# Supervisor may make /data and options.json root-only. Give the application\n# group traversal (not listing/write access), and keep its writable files private.\nchown 0:1000 /data\nchmod 710 /data\nmkdir -p /data/flybudget\nchown -R 1000:1000 /data/flybudget\nchmod 700 /data/flybudget\n# The root shell opens the Supervisor file before gosu drops privileges. Pass an\n# inherited read-only descriptor instead of changing the file's owner or mode.\nexec /usr/bin/tini -- gosu node:node node /app/ha-launch.cjs < /data/options.json\n"
OLD_START_SHA256 = 'e4f1aefe518e9e8a039210b91d7a5cf79a8709c16be03bdbf10fd80a9a9259d7'
OLD_READ = "fs.readFileSync('/data/options.json', 'utf8')"
NEW_READ = "fs.readFileSync(0, 'utf8')"
OLD_VERSIONS = ('0.2.0-up-ha.1', '0.2.0-up-ha.2')
NEW_VERSION = '0.2.0-up-ha.3'
OLD_WATCHDOG = "watchdog: 'http://[HOST]:[PORT:3001]/api/health'"
NEW_WATCHDOG = "watchdog: 'tcp://[HOST]:[PORT:3001]'"


def main():
    if len(sys.argv) > 2:
        raise SystemExit('Usage: python3 repair-permissions.py [path-to-flybudget_up]')
    candidates = [Path(sys.argv[1])] if len(sys.argv) == 2 else [
        Path('/addons/flybudget_up'), Path('/local_apps/flybudget_up')]
    found = {p.resolve() for p in candidates if (p / 'config.yaml').is_file()}
    if len(found) != 1:
        raise SystemExit('Could not identify one FlyBudget source folder. Supply its path as the last argument.')
    root = found.pop()
    config = (root / 'config.yaml').read_text()
    if 'slug: flybudget_up' not in config:
        raise SystemExit('This folder is not the FlyBudget Up Preview app. Nothing was changed.')
    changes = {}
    for relative in ['homeassistant/start.sh', 'homeassistant/ha-launch.cjs', 'config.yaml', 'Dockerfile']:
        target = root / relative
        if target.is_symlink() or not target.resolve().is_relative_to(root):
            raise SystemExit('Unexpected source symlink. Nothing was changed.')
        text = target.read_text()
        if relative.endswith('start.sh'):
            if text != NEW_START and hashlib.sha256(target.read_bytes()).hexdigest() != OLD_START_SHA256:
                raise SystemExit('The startup script has unexpected changes. Nothing was changed.')
            replacement = NEW_START
        elif relative.endswith('ha-launch.cjs'):
            if text.count(OLD_READ) == 1:
                replacement = text.replace(OLD_READ, NEW_READ)
            elif text.count(NEW_READ) == 1:
                replacement = text
            else:
                raise SystemExit('The launcher has unexpected changes. Nothing was changed.')
        else:
            if not any(version in text for version in (*OLD_VERSIONS, NEW_VERSION)):
                raise SystemExit('The app version is not supported by this repair. Nothing was changed.')
            replacement = text
            for old_version in OLD_VERSIONS:
                replacement = replacement.replace(old_version, NEW_VERSION)
            if relative == 'config.yaml':
                if OLD_WATCHDOG in replacement:
                    replacement = replacement.replace(OLD_WATCHDOG, NEW_WATCHDOG)
                elif NEW_WATCHDOG not in replacement:
                    raise SystemExit('The watchdog has unexpected changes. Nothing was changed.')
        if replacement != text:
            changes[target] = replacement
    # Validate every file before making any changes. Keep the first backup on retries.
    for target, replacement in changes.items():
        backup = target.with_name(target.name + '.before-permissions-fix')
        if not backup.exists():
            shutil.copy2(target, backup)
        target.write_text(replacement)
        print('Updated:', target.relative_to(root))
    print('Repair applied.' if changes else 'Repair already applied.')
    print('Reload the Home Assistant app store, then Update or Rebuild FlyBudget and Start it.')
    print('Keep Watchdog off until the update is installed. A restart prints a new setup code: use the last one in the log.')
    print('This repair only changes app source. It does not open or change your budget or encryption key.')


if __name__ == '__main__':
    main()
