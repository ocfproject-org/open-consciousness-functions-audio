import tempfile
import unittest
from pathlib import Path
from share_site import install

class ShareTests(unittest.TestCase):
    def test_only_canonical_nonredirect_pages_and_idempotence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            head = '<head><link rel="canonical" href="https://ocfproject.org/functions/X/"></head>'
            target = root / 'functions/X/index.html'
            target.parent.mkdir(parents=True)
            target.write_text(head + '<footer class="site-footer"></footer>')
            (root / '404.html').write_text('<head></head><footer class="site-footer"></footer>')
            (root / 'redirect.html').write_text(head + '<meta http-equiv="refresh" content="0"><footer class="site-footer"></footer>')
            install(root)
            first = target.read_text()
            self.assertIn('../../assets/js/share.js', first)
            self.assertIn('data-page-share hidden', first)
            self.assertNotIn('data-page-share', (root/'404.html').read_text())
            self.assertNotIn('data-page-share', (root/'redirect.html').read_text())
            install(root)
            self.assertEqual(first, target.read_text())
