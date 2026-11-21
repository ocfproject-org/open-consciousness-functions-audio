import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import hashlib

spec = importlib.util.spec_from_file_location('stage_media', Path(__file__).with_name('smart_playback_media.py'))
stage_media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage_media)


class StageTests(unittest.TestCase):
    def test_rejects_without_replacing_existing(self):
        with tempfile.TemporaryDirectory() as root:
            target = Path(root) / stage_media.NAME
            target.write_bytes(b'previous')
            with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                stage_media.stage(io.BytesIO(b'wrong'), root)
            self.assertEqual(target.read_bytes(), b'previous')
            self.assertEqual(list(Path(root).iterdir()), [target])

    def test_bounds_and_cleans_partial(self):
        with tempfile.TemporaryDirectory() as root, patch.object(stage_media, 'SIZE', 2):
            with self.assertRaisesRegex(ValueError, 'exceeds'):
                stage_media.stage(io.BytesIO(b'123'), root)
            self.assertEqual(list(Path(root).iterdir()), [])

    def test_redirects_reject_unrelated_hosts_and_credentials(self):
        import urllib.request
        handler = stage_media.PublicRedirect()
        request = urllib.request.Request(stage_media.URL)
        for url in ['http://github.com/file', 'https://example.com/file', 'https://user:secret@github.com/file']:
            with self.assertRaisesRegex(ValueError, 'Unexpected public media redirect'):
                handler.redirect_request(request, None, 302, 'Found', {}, url)

    def test_exact_fixture_atomic(self):
        data = b'exact synthetic public fixture'
        with tempfile.TemporaryDirectory() as root, patch.object(stage_media, 'SIZE', len(data)), patch.object(stage_media, 'SHA256', hashlib.sha256(data).hexdigest()):
            target = stage_media.stage(io.BytesIO(data), root)
            self.assertEqual(target.read_bytes(), data)
            self.assertEqual(list(Path(root).iterdir()), [target])


if __name__ == '__main__':
    unittest.main()
