#!/usr/bin/env python3
"""Publish a prepared release from tested main, without a PAT or production access."""
import json
import os
from pathlib import Path
import re
import subprocess

REPOSITORY = 'tvrooi/Allotment'
ROOT = Path(__file__).resolve().parent.parent
SHA = re.compile(r'[0-9a-f]{40}')
VERSION = re.compile(r'(\d+)\.(\d+)\.(\d+)(?:-up\.(\d+))?')


def version_key(version):
    match = VERSION.fullmatch(version)
    if not match:
        raise ValueError('Expected a stable version or an Up preview version')
    major, minor, patch, preview = match.groups()
    return (int(major), int(minor), int(patch), preview is None, int(preview or 0))


def prepared_version(root):
    version = json.loads((root / 'package.json').read_text())['version']
    version_key(version)
    if '-up.' not in version:
        raise ValueError('Automatic publishing is limited to Up preview releases')
    lock = json.loads((root / 'package-lock.json').read_text())
    if lock['version'] != version or lock['packages']['']['version'] != version:
        raise ValueError('Package release versions disagree')
    config = (root / 'homeassistant/config.yaml').read_text()
    if re.findall(r"(?m)^version: '([^']+)'$", config) != [version]:
        raise ValueError('Home Assistant release version disagrees')
    if f'\n## {version}\n' not in (root / 'CHANGELOG.md').read_text():
        raise ValueError('The prepared version needs CHANGELOG.md notes')
    return version


class GitHub:
    def api(self, path, data=None, optional=False):
        args = ['gh', 'api', f'repos/{REPOSITORY}/{path}']
        if data is not None:
            args += ['--method', 'POST', '--input', '-']
        result = subprocess.run(args, input=json.dumps(data) if data is not None else None,
                                text=True, capture_output=True)
        if result.returncode:
            if optional and '(HTTP 404)' in result.stderr:
                return None
            raise RuntimeError(f'GitHub API failed for {path}: {result.stderr.strip()}')
        return json.loads(result.stdout) if result.stdout.strip() else None


def trusted_event(event_name, event):
    if event.get('repository', {}).get('full_name') != REPOSITORY:
        return False
    if event_name == 'workflow_dispatch':
        return event.get('ref') == 'refs/heads/main'
    run = event.get('workflow_run', {})
    return (event_name == 'workflow_run' and run.get('conclusion') == 'success'
            and run.get('event') == 'push' and run.get('head_branch') == 'main'
            and run.get('head_repository', {}).get('full_name') == REPOSITORY)


def tag_commit(github, ref):
    target = ref['object']
    for _ in range(5):
        if target['type'] == 'commit' and SHA.fullmatch(target['sha']):
            return target['sha']
        if target['type'] != 'tag' or not SHA.fullmatch(target['sha']):
            break
        target = github.api(f"git/tags/{target['sha']}")['object']
    raise ValueError('Release tag does not resolve to a commit')


def publish(github, root, sha):
    if not SHA.fullmatch(sha):
        raise ValueError('Expected a full source commit')
    main = github.api('git/ref/heads/main')['object']['sha']
    if sha != main:
        return 'Skipped: a newer main commit must finish CI first.'
    # Query the actual CI workflow and commit. A same-named PR check cannot authorise release.
    runs = github.api(f'actions/workflows/ci.yml/runs?head_sha={sha}&event=push&per_page=100')
    if not any(run['head_sha'] == sha and run['head_branch'] == 'main'
               and run['event'] == 'push' and run['conclusion'] == 'success'
               for run in runs['workflow_runs']):
        raise ValueError('This main commit has no successful push CI run')
    version = prepared_version(root)
    tag = f'v{version}'
    existing = github.api(f'git/ref/tags/{tag}', optional=True)
    release = github.api(f'releases/tags/{tag}', optional=True)
    if release is not None:
        return f'Skipped: {tag} already has a release; existing releases are never overwritten.'
    if existing is not None and tag_commit(github, existing) != sha:
        return f'Skipped: {tag} belongs to an earlier commit. Prepare a new version for app changes.'
    published = github.api('releases?per_page=100')
    for previous in published:
        previous_version = previous['tag_name'].removeprefix('v')
        if not previous['draft'] and VERSION.fullmatch(previous_version):
            if version_key(version) <= version_key(previous_version):
                raise ValueError('A new release must be newer than the published releases')
    builds = github.api(f'actions/workflows/release.yml/runs?head_sha={sha}&per_page=100')
    if any(run['head_sha'] == sha and run['head_branch'] == tag
           and run['status'] != 'completed' for run in builds['workflow_runs']):
        return f'Skipped: the release build for {tag} is already running.'
    if existing is None:
        github.api('git/refs', {'ref': f'refs/tags/{tag}', 'sha': sha})
    # GITHUB_TOKEN-created tag pushes do not start another workflow. Dispatch explicitly.
    github.api('actions/workflows/release.yml/dispatches', {'ref': tag})
    return f'Dispatched Release for {tag} at tested main commit {sha}.'


def main():
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    if not trusted_event(os.environ['GITHUB_EVENT_NAME'], event):
        raise SystemExit('Refusing publication outside trusted main CI or a main retry')
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    expected = event.get('workflow_run', {}).get('head_sha', os.environ['GITHUB_SHA'])
    if sha != expected:
        raise SystemExit('Checked-out commit differs from the triggering commit')
    message = publish(GitHub(), ROOT, sha)
    print(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as summary:
            summary.write(message + '\n')


if __name__ == '__main__':
    main()
