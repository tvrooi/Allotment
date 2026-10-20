import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

def module(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

class ReleaseTests(unittest.TestCase):
    def test_invalid_version_does_not_write(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                module('prepare-release').prepare('../unsafe', Path(directory))
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_catalog_is_metadata_only_with_matching_hashes(self):
        import hashlib
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'catalog.zip'
            receipt = module('export-ha-catalog').export(out, 'a' * 40, 'sha256:' + 'b' * 64)
            with zipfile.ZipFile(out) as archive:
                self.assertEqual(len(archive.namelist()), 7)
                self.assertFalse(any(name.endswith(('.db', '.key', '.env')) for name in archive.namelist()))
                for name, expected in receipt['files'].items():
                    self.assertEqual(hashlib.sha256(archive.read('flybudget_up/' + name)).hexdigest(), expected)
                config = archive.read('flybudget_up/config.yaml').decode()
                self.assertIn('image: ghcr.io/tvrooi/flybudget-ha', config)
                self.assertIn("watchdog: 'tcp://", config)

if __name__ == '__main__':
    unittest.main()
