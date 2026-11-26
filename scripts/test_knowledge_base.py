import copy
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest

from knowledge_base import GUIDE_ANSWERS, REJECTED, directory, local_link, validate, visitor_data


DATA = Path(__file__).resolve().parents[1] / "docs/website/knowledge-base.json"


class Entries(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.ids = set()
        self.rows = set()
        self.links = set()
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if ident := attrs.get("id"):
            if ident in self.ids:
                raise ValueError(f"duplicate HTML ID {ident}")
            self.ids.add(ident)
            if tag == "section" and "learn-row" in attrs.get("class", ""):
                self.rows.add(ident)
        if tag == "a":
            self.links.add(attrs["href"])


class KnowledgeBaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(DATA.read_text(encoding="utf-8"))
        cls.visitor = visitor_data(DATA)
        cls.html = directory(DATA, smart_play=True)
        cls.pages = {route: Entries(doc) for route, doc in cls.html.items()}

    def test_every_entry_is_accounted_for_and_holds_do_not_leak(self):
        expected = {
            "learn/glossary": self.visitor["concepts"],
            "learn/faq": self.visitor["faq"] + self.visitor["practical_tips"],
            "learn/sources": self.visitor["sources"],
            "learn/history/miranon": self.visitor["miranon_levels"],
        }
        for route, records in expected.items():
            hidden = {"loosh", "locale-3", "m-band", "expand-app", "kepple-focus",
                      "real-time-zone", "monroe-institute"} if route == "learn/glossary" else set()
            self.assertEqual(self.pages[route].rows, {r["id"] for r in records} - hidden)
            self.assertFalse(hidden & self.pages[route].ids)
            for ident in hidden:
                self.assertNotIn(f"/#{ident}\"", self.html[route])

    def test_source_aliases_and_archive_status(self):
        page = self.pages["learn/sources"]
        self.assertTrue(self.visitor["source_aliases"].keys() <= page.ids)
        self.assertEqual(self.html["learn/sources"].count("Capture available; content not checked"),
                         sum(r.get("archive_status") == "capture_available" for r in self.visitor["sources"]))
        self.assertIn("Browse captures", self.html["learn/sources"])

    def test_feedback_keeps_internal_notes_and_private_or_paid_sources_out(self):
        rendered = " ".join(self.html.values())
        for unwanted in ("Selecting Signals and Background Sounds", "EASY TO READ Gateway Intermediate Workbook",
                         "Cite its PDF pages locally", "www.monroeinstitute.org/products/",
                         "hemi-sync.com/product/", "Color mapping and starting PDF page checked",
                         "Name the author when using a Focus number", "Use official institutional sources"):
            self.assertNotIn(unwanted, rendered)
        self.assertNotIn("/#kepple-focus", rendered)
        self.assertIn("monroeinstitute.org/blogs/blog/how-resonant-tuning", self.html["learn/sources"])
        self.assertEqual(self.visitor["source_aliases"]["RT"], "RT24")
        self.assertIn("monroe-rebal", self.pages["learn/glossary"].rows)
        self.assertIn("W77", self.pages["learn/sources"].rows)
        self.assertIn("https://archive.org/details/cia-readingroom-document-cia-rdp96-00788r001700210023-7",
                      self.pages["learn/sources"].links)
        for section in ("concepts", "faq", "practical_tips", "miranon_levels"):
            self.assertTrue(all("editorial_note" not in record and "evidence_note" not in record
                                for record in self.visitor[section]))

    def test_repository_contains_public_data_not_the_review_package(self):
        self.assertEqual(set(self.data), {
            "schema_version", "source_aliases", "start_here", "concepts", "faq",
            "practical_tips", "miranon_levels", "sources",
        })
        for records in (self.data[key] for key in ("concepts", "faq", "practical_tips", "miranon_levels", "sources")):
            for record in records:
                self.assertFalse({"editorial_note", "evidence_note", "publication_status"} & record.keys())
                self.assertNotEqual(record.get("source_type"), "uploaded")
                self.assertNotEqual(record.get("retrieval"), "uploaded_text")
        for required_public_only in ("knowledge-base-public.json", "editor-review.html"):
            self.assertFalse(DATA.with_name(required_public_only).exists())
        self.assertNotIn("Uploaded M p. 2", self.html["learn/sources"])

    def test_faq_does_not_surface_source_collection_workflow(self):
        faq = self.html["learn/faq"]
        for ident in ("blocked-not-paywall", "reddit-weight", "wayback-status"):
            self.assertNotIn(ident, self.pages["learn/faq"].ids)
        for phrase in ("failed automated request", "direct HTTP request", "search reader"):
            self.assertNotIn(phrase, faq)
        self.assertIn("free-sources", self.pages["learn/faq"].rows)

    def test_reference_audit_preserves_source_coverage_and_reader_copy(self):
        indexes = {r["id"]: r for r in self.visitor["sources"]}
        for category in ("concepts", "faq", "practical_tips", "miranon_levels"):
            for record in self.visitor[category]:
                with self.subTest(category=category, record=record["id"]):
                    self.assertTrue(record["sources"])
        self.assertIn("64 participants", indexes["SCI25"]["summary"])
        self.assertNotIn("Eighty undergraduates", self.html["learn/sources"])
        self.assertNotIn("Browser and HTTP check", self.html["learn/sources"])
        self.assertNotIn("in an earlier pass", self.html["learn/sources"])
        self.assertNotIn("CIA-RDP96-00788R001700210023-7.pdf", self.pages["learn/sources"].links)
        self.assertNotIn("https://www.cia.gov/readingroom/docs/CIA-RDP96-00788R001700210023-7.pdf",
                         self.pages["learn/sources"].links)
        self.assertIn("https://archive.org/details/cia-readingroom-document-cia-rdp96-00788r001700210039-0",
                      self.pages["learn/sources"].links)

    def test_numbered_focus_terms_are_sorted_without_changing_ids(self):
        rows = self.visitor["concepts"]
        numbered = [r["id"] for r in rows if re.match(r"focus-\d+", r["id"])]
        levels = [int(ident.split("-")[1]) for ident in numbered]
        self.assertEqual(levels, sorted(levels))
        self.assertEqual(numbered[:4], ["focus-1", "focus-3", "focus-10", "focus-11"])
        self.assertIn("focus-20-sleep", numbered)
        self.assertIn("focus-34-35", numbered)

    def test_controls_are_hidden_until_active_and_content_is_not(self):
        s = self.html["learn/glossary"]
        self.assertIn("data-learn-controls hidden", s)
        self.assertIn('role="status"', s)
        self.assertIn('id="transmutation-box"', s)
        self.assertNotIn('id="transmutation-box" hidden', s)

    def test_playback_answers_link_to_canonical_instructions(self):
        for ident, frag in GUIDE_ANSWERS.items():
            self.assertIn(ident, self.pages["learn/faq"].ids)
            self.assertIn("../../listening/#" + frag, self.pages["learn/faq"].links)
        self.assertIn("../../functions/OCF-EXP-007/", self.pages["learn/glossary"].links)
        self.assertNotIn("../../listening/#smart-play", directory(DATA, smart_play=False)["learn/faq"])

    def test_rejects_bad_source_relationship_and_prior_excluded_paper(self):
        for field, value in (("related", ["not-a-concept"]), ("sources", [{"source_id": "no-such-source"}]), ("definition", "PMID 32066611")):
            data = copy.deepcopy(self.data)
            data["concepts"][0][field] = value
            with self.assertRaises(ValueError):
                validate(data)
        self.assertTrue(all(not REJECTED.search(x) for x in self.html.values()))

    def test_local_canonical_links_and_unsafe_uri_rejection(self):
        self.assertEqual(local_link("https://ocfproject.org/listening/#stereo-test", "../../"), "../../listening/#stereo-test")
        for url in ("javascript:alert(1)", "//example.org", "file:///secret", "https://me:pass@example.org/"):
            self.assertIsNone(local_link(url, "../../"))


if __name__ == "__main__":
    unittest.main()
