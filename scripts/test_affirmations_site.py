import tempfile
import unittest
from pathlib import Path
from affirmations_site import page
from share_site import install


class AffirmationShellTests(unittest.TestCase):
    def test_empty_shell_and_distinct_routes(self):
        library, morning = page(), page(True)
        self.assertIn('data-affirmation-search', library)
        self.assertNotIn('data-affirmation-search', morning)
        self.assertIn('<ul class="affirmation-list" data-affirmation-list></ul>', morning)
        self.assertIn('href="../my-morning/"', library)
        self.assertIn('Nothing is uploaded', library)
        self.assertNotIn('localStorage', library + morning)

    def test_morning_has_no_public_sharing_control(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / 'my-morning/index.html'
            target.parent.mkdir()
            text = '<head><link rel="canonical" href="https://ocfproject.org/my-morning/"></head><footer class="site-footer"></footer>'
            target.write_text(text)
            install(root)
            self.assertEqual(target.read_text(), text)
