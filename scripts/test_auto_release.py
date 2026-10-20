import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('auto_release', Path(__file__).with_name('auto-release.py'))
auto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auto)
SHA = 'a' * 40


class FakeGitHub:
    def __init__(self):
        self.responses = {
            'git/ref/heads/main': {'object': {'sha': SHA}},
            f'actions/workflows/ci.yml/runs?head_sha={SHA}&event=push&per_page=100': {
                'workflow_runs': [{'head_sha': SHA, 'head_branch': 'main', 'event': 'push', 'conclusion': 'success'}]},
            'git/ref/tags/v0.2.0-up.5': None,
            'releases/tags/v0.2.0-up.5': None,
            'releases?per_page=100': [{'tag_name': 'v0.2.0-up.4', 'draft': False}],
            f'actions/workflows/release.yml/runs?head_sha={SHA}&per_page=100': {'workflow_runs': []},
        }
        self.writes = []

    def api(self, path, data=None, optional=False):
        if data is not None:
            self.writes.append((path, data))
            return None
        return copy.deepcopy(self.responses[path])


class AutoReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'homeassistant').mkdir()
        (self.root / 'package.json').write_text(json.dumps({'version': '0.2.0-up.5'}))
        (self.root / 'package-lock.json').write_text(json.dumps({
            'version': '0.2.0-up.5', 'packages': {'': {'version': '0.2.0-up.5'}}}))
        (self.root / 'homeassistant/config.yaml').write_text("version: '0.2.0-up.5'\n")
        (self.root / 'CHANGELOG.md').write_text('# Changes\n\n## 0.2.0-up.5\n\n- Synthetic release.\n')
        self.github = FakeGitHub()

    def test_tags_exact_tested_commit_and_dispatches_without_a_pat(self):
        self.assertIn('Dispatched Release', auto.publish(self.github, self.root, SHA))
        self.assertEqual(self.github.writes, [
            ('git/refs', {'ref': 'refs/tags/v0.2.0-up.5', 'sha': SHA}),
            ('actions/workflows/release.yml/dispatches', {'ref': 'v0.2.0-up.5'}),
        ])

    def test_stale_main_does_not_publish(self):
        self.github.responses['git/ref/heads/main']['object']['sha'] = 'b' * 40
        self.assertIn('newer main', auto.publish(self.github, self.root, SHA))
        self.assertEqual(self.github.writes, [])

    def test_failed_pr_or_other_commit_ci_cannot_publish(self):
        key = f'actions/workflows/ci.yml/runs?head_sha={SHA}&event=push&per_page=100'
        for field, value in [('conclusion', 'failure'), ('event', 'pull_request'),
                             ('head_branch', 'feature'), ('head_sha', 'b' * 40)]:
            github = FakeGitHub()
            github.responses[key]['workflow_runs'][0][field] = value
            with self.assertRaisesRegex(ValueError, 'successful push CI'):
                auto.publish(github, self.root, SHA)
            self.assertEqual(github.writes, [])

    def test_never_moves_an_existing_tag_for_later_documentation_merges(self):
        self.github.responses['git/ref/tags/v0.2.0-up.5'] = {'object': {'type': 'commit', 'sha': 'b' * 40}}
        self.assertIn('earlier commit', auto.publish(self.github, self.root, SHA))
        self.assertEqual(self.github.writes, [])

    def test_retries_dispatch_after_failure_without_recreating_the_tag(self):
        self.github.responses['git/ref/tags/v0.2.0-up.5'] = {'object': {'type': 'commit', 'sha': SHA}}
        auto.publish(self.github, self.root, SHA)
        self.assertEqual(self.github.writes, [('actions/workflows/release.yml/dispatches', {'ref': 'v0.2.0-up.5'})])

    def test_already_running_or_published_releases_are_not_repeated(self):
        key = f'actions/workflows/release.yml/runs?head_sha={SHA}&per_page=100'
        self.github.responses[key]['workflow_runs'] = [{'head_sha': SHA, 'head_branch': 'v0.2.0-up.5', 'status': 'in_progress'}]
        self.assertIn('already running', auto.publish(self.github, self.root, SHA))
        self.assertEqual(self.github.writes, [])
        self.github.responses['releases/tags/v0.2.0-up.5'] = {'draft': False}
        self.assertIn('never overwritten', auto.publish(self.github, self.root, SHA))
        self.assertEqual(self.github.writes, [])

    def test_inconsistent_versions_or_missing_notes_do_not_publish(self):
        for filename, content in [('homeassistant/config.yaml', "version: '0.2.0-up.4'\n"), ('CHANGELOG.md', '# Changes\n')]:
            path = self.root / filename
            original = path.read_text()
            path.write_text(content)
            with self.assertRaises(ValueError):
                auto.publish(self.github, self.root, SHA)
            self.assertEqual(self.github.writes, [])
            path.write_text(original)

    def test_newer_published_version_prevents_a_downgrade(self):
        self.github.responses['releases?per_page=100'] = [{'tag_name': 'v0.2.0-up.6', 'draft': False}]
        with self.assertRaisesRegex(ValueError, 'newer than'):
            auto.publish(self.github, self.root, SHA)
        self.assertEqual(self.github.writes, [])

    def test_annotated_existing_tag_can_retry_without_moving_it(self):
        self.github.responses['git/ref/tags/v0.2.0-up.5'] = {'object': {'type': 'tag', 'sha': 'c' * 40}}
        self.github.responses['git/tags/' + 'c' * 40] = {'object': {'type': 'commit', 'sha': SHA}}
        auto.publish(self.github, self.root, SHA)
        self.assertEqual(self.github.writes, [('actions/workflows/release.yml/dispatches', {'ref': 'v0.2.0-up.5'})])

    def test_lockfile_mismatch_cannot_create_a_tag(self):
        path = self.root / 'package-lock.json'
        lock = json.loads(path.read_text())
        lock['packages']['']['version'] = '0.2.0-up.4'
        path.write_text(json.dumps(lock))
        with self.assertRaisesRegex(ValueError, 'versions disagree'):
            auto.publish(self.github, self.root, SHA)
        self.assertEqual(self.github.writes, [])

    def test_api_permission_errors_are_not_treated_as_missing_tags(self):
        from unittest.mock import patch
        result = auto.subprocess.CompletedProcess([], 1, '', 'gh: Resource not accessible (HTTP 403)')
        with patch.object(auto.subprocess, 'run', return_value=result):
            with self.assertRaisesRegex(RuntimeError, 'HTTP 403'):
                auto.GitHub().api('git/ref/tags/v0.2.0-up.5', optional=True)

    def test_only_trusted_main_events_are_accepted(self):
        event = {'repository': {'full_name': auto.REPOSITORY}, 'workflow_run': {
            'conclusion': 'success', 'event': 'push', 'head_branch': 'main',
            'head_repository': {'full_name': auto.REPOSITORY}}}
        self.assertTrue(auto.trusted_event('workflow_run', event))
        for field, value in [('event', 'pull_request'), ('conclusion', 'failure'), ('head_branch', 'feature'),
                             ('head_repository', {'full_name': 'other/fork'})]:
            altered = copy.deepcopy(event)
            altered['workflow_run'][field] = value
            self.assertFalse(auto.trusted_event('workflow_run', altered))
        event['ref'] = 'refs/heads/main'
        self.assertTrue(auto.trusted_event('workflow_dispatch', event))
        event['ref'] = 'refs/heads/feature'
        self.assertFalse(auto.trusted_event('workflow_dispatch', event))


if __name__ == '__main__':
    unittest.main()
