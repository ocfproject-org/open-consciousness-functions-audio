import hashlib
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_public_site import _discovery_section
from site_references import REFERENCES, chain_references, function_background, use_references


class ReferenceTests(unittest.TestCase):
    def test_exact_approved_text_and_function_are_required(self):
        text = ('Explore Nutricia and Eat/No Eat together for a weight-management intention, '
                'as Barbara Bullard explicitly described in the 1993 Odyssey Part II account.')
        self.assertIn('#page=1', use_references('OCF-BOD-010', [{'text': text}]))
        self.assertEqual('', use_references('OCF-BOD-005', [{'text': text}]))
        self.assertEqual('', use_references('OCF-BOD-010', [{'text': text + ' Changed.'}]))

    def test_draft_filter_precedes_reference_matching(self):
        text = ('Explore Nutricia and Eat/No Eat together for a weight-management intention, '
                'as Barbara Bullard explicitly described in the 1993 Odyssey Part II account.')
        result = _discovery_section('Common-use examples', [
            {'text': text, 'status': 'draft'},
            {'text': 'An independent OCF example.', 'status': 'reviewed'}], 'OCF-BOD-010')
        self.assertNotIn('References', result)
        self.assertNotIn('Bullard', result)

    def test_chain_context_is_outside_original_and_detects_content_changes(self):
        source = (Path(__file__).resolve().parents[1] / 'docs/website/function-chains.md').read_text(encoding='utf-8')
        result = chain_references('Weight management', source)
        self.assertIn('Habit Freedom and optional Detox are OCF additions', result)
        self.assertIn('not evidence of effectiveness or safety', result)
        self.assertNotIn(' open', result)
        self.assertEqual('', chain_references('Weight management', source + '\n'))
        self.assertEqual('', chain_references('Dreams', source))

    def test_public_reference_labels_preserve_unicode(self):
        self.assertEqual('Barbara Bullard, Hemi-Sync Odyssey—Part II (Fall 1993)',
                         REFERENCES['sources']['A-ODYS2']['title'])
        self.assertEqual('High Performance-Ten (HP-10), © 1987',
                         REFERENCES['sources']['A-HP10']['title'])

    def test_rebal_background_is_separate_and_scoped_to_energy_ball(self):
        result = function_background('OCF-EXP-007')
        self.assertIn('REBAL', result)
        self.assertIn('are OCF’s cues, not Monroe Institute instructions', result)
        self.assertIn('not claims of physical protection or health benefits', result)
        self.assertIn('https://archive.org/details/ram-typed-transcripts', result)
        self.assertIn('https://archive.org/details/explorer-coll-86', result)
        self.assertIn('https://www.monroeinstitute.org/pages/resources', result)
        self.assertEqual('', function_background('OCF-FND-002'))

    def test_curated_subset_has_no_unverified_or_private_links(self):
        self.assertEqual(20, len(REFERENCES['uses']))
        self.assertEqual(6, len(REFERENCES['chains']))
        for source in REFERENCES['sources'].values():
            self.assertTrue(source['url'].startswith('https://archive.org/download/monroe-institute-reports-human-plus/'))
            self.assertTrue(source['url'].endswith('.pdf'))
            self.assertEqual(64, len(source['sha256']))
        keys = [(r['function_id'], r['text_sha256']) for r in REFERENCES['uses']]
        self.assertEqual(len(keys), len(set(keys)))


if __name__ == '__main__':
    unittest.main()
