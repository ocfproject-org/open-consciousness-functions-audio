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
            target.write_text(head + '<footer class="site-footer" id="site-footer"></footer>')
            (root / '404.html').write_text('<head></head><footer class="site-footer"></footer>')
            (root / 'redirect.html').write_text(head + '<meta http-equiv="refresh" content="0"><footer class="site-footer"></footer>')
            install(root)
            first = target.read_text()
            self.assertIn('../../assets/js/share.js', first)
            self.assertIn('data-page-share hidden', first)
            self.assertIn('<button type="button" data-share-copy>Share this page</button>', first)
            self.assertNotIn('<details', first)
            self.assertNotIn('data-share-native', first)
            self.assertNotIn('data-page-share', (root/'404.html').read_text())
            self.assertNotIn('data-page-share', (root/'redirect.html').read_text())
            install(root)
            self.assertEqual(first, target.read_text())

    def test_function_share_is_near_heading_not_duplicated_in_footer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            target = root / 'index.html'
            target.write_text('<head><link rel="canonical" href="https://ocfproject.org/functions/X/"></head><header class="page-intro function-intro"><h1>X</h1><p class="audio-preferences-context">Audio preferences</p><p id="overview">Purpose</p></header><footer class="site-footer"></footer>')
            install(root)
            text = target.read_text()
            self.assertEqual(text.count('data-page-share hidden'), 1)
            self.assertLess(text.index('data-page-share'), text.index('id="overview"'))
            self.assertGreater(text.index('data-page-share'), text.index('Audio preferences'))
            self.assertIn('<footer class="site-footer"></footer>', text)
