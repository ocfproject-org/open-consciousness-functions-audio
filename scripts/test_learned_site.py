import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from learned_site import canonical, contract, install, projection


class LearnedProjectionTests(unittest.TestCase):
    def setUp(self):
        self.fn = {"function_id": "OCF-TST-001", "title": {"text": "Test"},
                   "description": {"text": "Reviewed guide", "status": "reviewed"},
                   "commands": [{"command_id": "test", "command_status": "active",
                                 "spoken_status": "reviewed", "spoken_cue": "Plus Test",
                                 "display_cue": {"status": "reviewed", "text": "PLUS-TEST"},
                                 "invocation_scope": None, "procedure_status": "documented",
                                 "procedure_steps": [{"instruction": "Test instruction"}]}],
                   "lifecycle": {}, "safety_notes": []}
        self.export = {"functions": [self.fn], "source_commit": "a" * 40, "locale": "en-US"}
        self.catalog = {"releases": []}

    def test_unicode_canonical_hash_matches_shared_browser_vector(self):
        text = (Path(__file__).parent / "fixtures/learned-unicode.json").read_text(encoding="utf-8").strip()
        self.assertEqual(canonical(json.loads(text)), text)
        self.assertEqual(hashlib.sha256(text.encode()).hexdigest(),
                         "537d98982612b4ff9291a80335e1831596a43e491c6f6f3c1df9adb17f1154bc")

    def test_examples_drafts_title_raw_hash_and_commit_do_not_change_contract(self):
        original = contract(self.fn)
        changed = copy.deepcopy(self.fn)
        changed.update(common_uses=[{"text": "new example", "status": "reviewed"}],
                       canonical_resource_sha256="f" * 64, title={"text": "New title"},
                       historical_commands=[{"text": "draft leak"}])
        changed["commands"][0]["usage"] = {"text": "draft leak", "status": "draft"}
        self.assertEqual(original, contract(changed))
        before = projection(self.export, self.catalog)["subjects"]["OCF-TST-001"]["guide"]
        self.export["source_commit"] = "b" * 40
        after = projection(self.export, self.catalog)["subjects"]["OCF-TST-001"]["guide"]
        self.assertEqual(before["fingerprint"], after["fingerprint"])
        self.assertNotEqual(before["commit"], after["commit"])

    def test_reviewed_instructions_change_fingerprint_normalized_whitespace_does_not(self):
        original = contract(self.fn)
        self.fn["description"]["text"] = " Reviewed   guide\n"
        self.assertEqual(original, contract(self.fn))
        self.fn["commands"][0]["procedure_steps"][0]["instruction"] = "Changed instruction"
        self.assertNotEqual(original, contract(self.fn))

    def test_projection_is_derived_and_preparation_is_separate(self):
        result = projection(self.export, self.catalog)
        guide = result["subjects"]["OCF-TST-001"]["guide"]
        self.assertEqual(guide["fingerprint"], hashlib.sha256(canonical(guide["snapshot"]).encode()).hexdigest())
        self.assertEqual(len([k for k in result["subjects"] if k.startswith("OCF-")]), 1)
        self.assertIsNone(result["subjects"]["preparation:ocf"]["guide"])
        self.assertIsNone(result["subjects"]["preparation:human-plus"]["guide"])

    def test_panels_inside_main_after_intro_and_content_escaped_as_json(self):
        self.fn["title"]["text"] = '</script><img src=x onerror="bad()">'
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            pages = ['functions/OCF-TST-001/index.html', 'functions/index.html', 'quick-reference/index.html', 'preparation-learning/index.html']
            original = '<head></head><header class="site-header">Site header</header><main><header class="page-intro function-intro">Intro</header><p>Canonical guidance unchanged</p></main>'
            for name in pages:
                page = root / name
                page.parent.mkdir(parents=True, exist_ok=True)
                page.write_text(original)
            install(root, self.export, self.catalog)
            for name in pages:
                output = (root / name).read_text()
                self.assertLess(output.index('<main>'), output.index('data-learned-subject'))
                self.assertLess(output.index('Intro</header>'), output.index('data-learned-subject'))
                self.assertIn('<p>Canonical guidance unchanged</p>', output)
                self.assertNotIn('onerror', output)
            self.assertIn('onerror', (root / 'assets/data/learning.json').read_text())

    def test_missing_intro_fails_instead_of_inserting_outside_main(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            page = root / 'functions/OCF-TST-001/index.html'
            page.parent.mkdir(parents=True)
            page.write_text('<header class="site-header">Header</header><main></main>')
            with self.assertRaisesRegex(ValueError, 'page introduction'):
                install(root, self.export, self.catalog)


if __name__ == '__main__':
    unittest.main()
