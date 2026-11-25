"""Tests for the pinned, fail-closed documentation site build."""

import copy
import hashlib
import io
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_public_site import (
    _asset_specification,
    _preparation_minutes,
    _apply_edition_presentation,
    _source_histories,
    _catalog_sessions,
    _discovery_section,
    _downloads_page,
    _function_audio_actions,
    _function_page,
    _function_toc_items,
    _render_toc,
    _function_audio_availability,
    _functions_index,
    _home_page,
    _historical_names_page,
    _inline,
    _historical_lookup_rows,
    _public_description,
    _public_historical_name,
    _renamed_title_rows,
    _quick_reference,
    _relationships_page,
    _function_chains_page,
    _chain_spoken_cues,
    _chains_redirect_page,
    _recommended_settings,
    _shell,
    _request_public_asset,
    _public_smart_play_listening,
    _smart_play_edition,
    _smart_play_help,
    _suggested_download_filename,
    _validate_suggested_download_filenames,
    _spoken_cue_references,
    digest,
    fetch_transcript,
    render_markdown,
    validate_guide_export,
)


class PublicSiteBuildTests(unittest.TestCase):
    def test_public_smart_play_help_preserves_faq_and_points_to_real_controls(self):
        copy = (Path(__file__).resolve().parents[1] / "docs/website/smart-play.md").read_text()
        original = (
            "## Players and playback settings\n\nOriginal player instructions.\n\n"
            "## Editions and versions\n\nEdition details.\n\n"
            "## Common questions\n\n### Existing question\n\nExisting answer.\n"
        )
        rendered = render_markdown(_public_smart_play_listening(original, copy))
        self.assertIn('<h2 id="smart-play">Smart Play</h2>', rendered)
        self.assertEqual(rendered.count('<h2 id="common-questions">'), 1)
        self.assertIn('<h3 id="existing-question">Existing question</h3>', rendered)
        self.assertIn("Original recording", rendered)
        self.assertIn("Remember for this session", rendered)
        self.assertIn("Use site default for this session", rendered)
        self.assertIn("Preparation Learning and older editions", rendered)
        self.assertIn('href="../../listening/#smart-play"', _smart_play_help("../../"))

    def test_smart_play_help_eligibility_matches_the_supported_edition(self):
        setup = {
            "is_preparation": False,
            "session": {"edition": "0.3.0", "locale": "en-US", "voice_id": "mike-original"},
            "audio_assets": [{"format": "mp3"}, {"format": "flac"}],
        }
        self.assertTrue(_smart_play_edition(setup))
        self.assertFalse(_smart_play_edition({**setup, "is_preparation": True}))
        self.assertFalse(_smart_play_edition({**setup, "audio_assets": [{"format": "mp3"}]}))
        for k, v in [("edition", "0.2.0"), ("locale", "fr-FR"), ("voice_id", "other-voice")]:
            self.assertFalse(_smart_play_edition({**setup, "session": {**setup["session"], k: v}}))

    def test_function_chains_legacy_page_has_canonical_accessible_fallback(self):
        page = _chains_redirect_page("a" * 40)
        self.assertIn('<h1>Function Chains</h1>', page)
        self.assertIn('<link rel="canonical" href="https://ocfproject.org/function-chains/">', page)
        self.assertIn('<meta name="robots" content="noindex,follow">', page)
        self.assertIn('id="chains-new-link" href="../function-chains/">Continue to Function Chains</a>', page)
        self.assertIn('<script src="../assets/js/chains-redirect.js" defer>', page)
        self.assertNotIn('http-equiv="refresh"', page)

    def test_preparation_time_uses_latest_verified_recording_duration(self):
        catalog = {"releases": []}
        for version, seconds in [("0.1.0", 1200), ("0.2.0", 1657.55771)]:
            catalog["releases"].append({"version": version, "preparations": [
                {"sessions": [{"assets": [{"duration_seconds": seconds}]}]}]})
        self.assertEqual(_preparation_minutes(catalog), 28)
        self.assertIsNone(_preparation_minutes({"releases": []}))

    def test_shared_editions_static_default_preserves_historical_files_and_history(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            page = root / "index.html"
            asset = root / "assets/js/app.js"
            asset.parent.mkdir(parents=True)
            asset.write_text("/* current edition logic */")
            original = ('<head><script src="../../assets/js/app.js" defer></script></head><main id="main" class="docs-main">'
                        '<article data-edition-content="0.1.0"><a href="https://example.com/old.mp3">old</a></article>'
                        '<article data-edition-content="0.2.0"><a href="https://example.com/new.mp3">new</a></article>'
                        '<a data-format-content="mp3" href="https://example.com/audio.mp3">MP3</a>'
                        '<a data-format-content="flac" href="https://example.com/audio.flac">FLAC</a>'
                        '<details id="function-history">pinned history</details></main></body>')
            page.write_text(original)
            catalog = {"releases": [{"version": version, "functions": [{"sessions": [{}, {}]}]}
                                    for version in ("0.1.0", "0.2.0", "0.1.5-rc1")]}
            _apply_edition_presentation(root, catalog)
            rendered = page.read_text()
            self.assertIn('data-edition-content="0.1.0" hidden', rendered)
            self.assertIn('data-edition-content="0.2.0"><', rendered)
            self.assertIn('"version": "0.2.0", "sessions": 2', rendered)
            self.assertIn('id="edition-filter"', rendered)
            self.assertIn('id="format-filter"', rendered)
            self.assertIn('data-format-content="flac" href="https://example.com/audio.flac" hidden', rendered)
            self.assertIn('data-format-content="mp3" href="https://example.com/audio.mp3">', rendered)
            self.assertIn('assets/js/app.js?v=' + hashlib.sha256(asset.read_bytes()).hexdigest()[:16], rendered)
            self.assertIn('<details id="function-history">pinned history</details>', rendered)
            self.assertIn('href="https://example.com/old.mp3"', rendered)
            self.assertIn('Earlier editions remain available', rendered)


    def test_downloads_render_verified_changelog_without_interpreting_html(self):
        release = {"functions": [], "tag": "audio-0.2.0", "version": "0.2.0",
                   "release_url": "https://github.com/example/repo/releases/tag/audio-0.2.0",
                   "changelog": ["Preserves historical downloads.",
                                 "Paired [source](https://github.com/example/source/releases/tag/audio-0.2.0).",
                                 "<script>alert(1)</script> [unsafe](javascript:alert)"]}
        rendered = _downloads_page({"releases": [release]}, [])
        self.assertIn("What changed in edition 0.2.0", rendered)
        self.assertIn("Preserves historical downloads.", rendered)
        self.assertIn('href="https://github.com/example/source/releases/tag/audio-0.2.0"', rendered)
        self.assertIn("&lt;script&gt;", rendered)
        self.assertNotIn("<script>", rendered)
        self.assertNotIn('href="javascript:', rendered)
        self.assertIn('href="' + release["release_url"] + '"', rendered)
        self.assertNotIn("What changed", _downloads_page({"releases": [{"functions": []}]}, []))


    def test_source_history_is_bounded_pinned_and_preserves_revision_order(self):
        from types import SimpleNamespace
        records = 'b' * 40 + '\x002026-11-17\x00Later <subject> & title\n' + 'c' * 40 + '\x002026-11-18\x00Ancestor'
        with patch('build_public_site.subprocess.run', side_effect=[
            SimpleNamespace(stdout='false\n'), SimpleNamespace(stdout='a' * 40),
            SimpleNamespace(stdout=records), SimpleNamespace(stdout=''),
        ]) as run:
            histories = _source_histories(Path('/source'), 'a' * 40, [
                {'function_id': 'ONE', 'canonical_resource': 'locales/en-US/OCF-ONE.yaml'},
                {'function_id': 'EMPTY', 'canonical_resource': 'locales/en-US/OCF-EMPTY.yaml'},
            ])
        self.assertEqual([r['subject'] for r in histories['ONE']], ['Later <subject> & title', 'Ancestor'])
        self.assertEqual(histories['EMPTY'], [])
        command = run.call_args_list[2].args[0]
        self.assertEqual(command[-7:], ['log', '--topo-order', '--max-count=5', '--format=%H%x00%cs%x00%s', 'a' * 40, '--', 'locales/en-US/OCF-ONE.yaml'])

    def test_source_history_rejects_shallow_or_wrong_revision(self):
        from types import SimpleNamespace
        with patch('build_public_site.subprocess.run', return_value=SimpleNamespace(stdout='true')):
            with self.assertRaisesRegex(ValueError, 'full checkout'):
                _source_histories(Path('/source'), 'a' * 40, [])
        with patch('build_public_site.subprocess.run', side_effect=[SimpleNamespace(stdout='false'), SimpleNamespace(stdout='b' * 40)]):
            with self.assertRaisesRegex(ValueError, 'match the pinned'):
                _source_histories(Path('/source'), 'a' * 40, [])

    def test_header_and_favicon_reuse_pinned_public_brand_assets(self):
        import json
        root = Path(__file__).resolve().parents[1] / "site/assets/branding"
        provenance = json.loads((root / "source.json").read_text())
        self.assertEqual(provenance["source_commit"], "6b4a9861ab89bea849ef6a97575af9cac6065d9b")
        for asset in provenance["assets"]:
            self.assertEqual(hashlib.sha256((root / asset["path"]).read_bytes()).hexdigest(), asset["sha256"])
        html = _shell("Example", "<h1>Example</h1>", "start", "a" * 40)
        self.assertIn('href="../assets/branding/ocf-app-icon-32.png" type="image/png"', html)
        self.assertIn('src="../assets/branding/ocf-app-icon-128.png"', html)
        self.assertIn('<span class="brand-short" aria-hidden="true">OCF</span>', html)
        self.assertIn('<span class="brand-name">Open Consciousness Functions', html)


    def test_optional_chains_are_exactly_the_seventeen_owner_approved_orders(self):
        source = (Path(__file__).resolve().parents[1] / "docs/website/function-chains.md").read_text()
        expected = {
            "Learning": ["OCF-FND-004", "OCF-FND-002", "OCF-COG-007", "OCF-COG-004", "OCF-COG-006"],
            "Performance": ["OCF-FND-004", "OCF-COG-007", "OCF-PRF-003", "OCF-FND-002"],
            "Communication": ["OCF-FND-004", "OCF-FND-002", "OCF-COM-001", "OCF-PRF-002", "OCF-COG-007"],
            "Emotional reset": ["OCF-FND-004", "OCF-EMO-001", "OCF-FND-005"],
            'Decision': ['OCF-FND-004', 'OCF-EMO-001', 'OCF-COG-005', 'OCF-EXP-001'],
            'Morning': ['OCF-FND-004', 'OCF-PRF-002', 'OCF-COG-007', 'OCF-FND-002', 'OCF-COG-005', 'OCF-EXP-001'],
            'Work': ['OCF-COG-007', 'OCF-FND-002', 'OCF-PRF-003', 'OCF-PRF-001'],
            'Recovery': ['OCF-FND-004', 'OCF-BOD-013', 'OCF-SLP-001'],
            'Sleep preparation': ['OCF-FND-004', 'OCF-SLP-002', 'OCF-SLP-001'],
            'Dreams': ['OCF-FND-004', 'OCF-SLP-003', 'OCF-SLP-002'],
            'Problem-solving': ['OCF-FND-004', 'OCF-COG-005', 'OCF-COG-003', 'OCF-SLP-004'],
            'Habits': ['OCF-FND-004', 'OCF-LIF-001', 'OCF-EMO-001', 'OCF-EMO-002'],
            'Action': ['OCF-FND-004', 'OCF-PRF-001', 'OCF-COG-007', 'OCF-PRF-003'],
            'Physical maintenance': ['OCF-FND-004', 'OCF-BOD-013', 'OCF-BOD-002', 'OCF-SLP-001'],
            'Daily learning': ['OCF-FND-004', 'OCF-FND-002', 'OCF-COG-007', 'OCF-COG-004', 'OCF-COG-006', 'OCF-COG-001'],
            'Evening problem-solving': ['OCF-FND-004', 'OCF-COG-005', 'OCF-SLP-004'],
            'Weight management': ['OCF-BOD-010', 'OCF-BOD-005', 'OCF-LIF-001', 'OCF-BOD-004'],

        }
        import re
        self.assertEqual(len(re.findall(r"^\d+\. ", source, re.M)), 69)
        for title, identities in expected.items():
            section = source.split("## " + title + "\n", 1)[1].split("\n## ", 1)[0]
            self.assertEqual(re.findall(r"functions/(OCF-[A-Z]{3}-[0-9]{3})/", section.split("Optional variation:")[0]), identities)
        self.assertIn("Optional variation: add [Contemplation](../functions/OCF-COG-003/) before Manifest", source)
        self.assertEqual(source.count("Optional variation:"), 1)
        self.assertIn("Mental pictures and particular", source)
        self.assertNotIn("Explore a felt sense", source)
        self.assertIn("optional sequences", source)
        self.assertIn("official Human Plus", source)
        self.assertIn("Each step links to its function", source)
        self.assertIn("function-chains/", (Path(__file__).resolve().parents[1] / "docs/website/start-here.md").read_text())


    def test_chain_directory_keeps_all_original_sections_verbatim(self):
        source = (Path(__file__).parents[1] / "docs/website/function-chains.md").read_text()
        ids = set(re.findall(r"OCF-[A-Z]{3}-[0-9]{3}", source))
        functions = [{"function_id": fid, "commands": [{"command_status": "active",
                      "designation": "primary", "spoken_cue": "Fixture cue",
                      "command_id": "OCF-CMD-BOD-010-FOOD-LESS" if fid == "OCF-BOD-010" else fid}]}
                     for fid in ids]
        enhanced = _function_chains_page(source, functions)
        originals = re.findall(r'<div class="chain-original">(.*?)</div>', enhanced, re.S)
        expected = [match.group(0) for match in re.finditer(
            r'<h2 id="[^"]+">[^<]+</h2>(.*?)(?=<h2|$)', render_markdown(source), re.S)
                    if '<ol>' in match.group(1)]
        self.assertEqual(len(originals), 17)
        self.assertEqual([re.sub(r' <span class="chain-spoken-cue">.*?</span>', '', block)
                          for block in originals], expected)
        self.assertEqual(enhanced.count('data-chain-card '), 17)
        self.assertIn('aria-label="Use guide: Sleep"', enhanced)
        self.assertIn('href="../functions/OCF-SLP-002/#cues"', enhanced)
        self.assertIn('href="../functions/OCF-SLP-002/#listening"', enhanced)

    def test_chain_cues_use_active_pinned_spoken_text_and_explicit_food_less(self):
        functions = [{"function_id": "OCF-BOD-010", "commands": [
            {"command_id": "OCF-CMD-BOD-010-PRIMARY", "designation": "primary", "command_status": "active", "spoken_cue": "Plus Food More"},
            {"command_id": "OCF-CMD-BOD-010-FOOD-LESS", "designation": "secondary", "command_status": "active", "spoken_cue": "Plus Food Less"},
        ]}]
        source = "1. [Nutricia](../functions/OCF-BOD-010/) — A selected mode."
        html = _chain_spoken_cues(source, functions)
        self.assertEqual(html.count("Plus Food Less"), 1)
        self.assertNotIn("Plus Food More", html)
        self.assertNotIn("button", html)
        primary = [{"function_id": "OCF-FND-004", "commands": [
            {"designation": "primary", "command_status": "active", "spoken_cue": "Plus Relax"},
        ]}]
        link = "[Relax](../functions/OCF-FND-004/)"
        self.assertIn("(Plus Relax)", _chain_spoken_cues(link, primary))
        primary[0]["commands"][0]["spoken_cue"] = ""
        with self.assertRaises(ValueError):
            _chain_spoken_cues(link, primary)
        primary[0]["commands"][0]["spoken_cue"] = "Plus Relax"
        primary[0]["commands"].append(dict(primary[0]["commands"][0]))
        with self.assertRaises(ValueError):
            _chain_spoken_cues(link, primary)
        functions[0]["commands"][1]["command_status"] = "inactive"
        with self.assertRaises(ValueError):
            _chain_spoken_cues(source, functions)
        with self.assertRaises(ValueError):
            _chain_spoken_cues("[Unknown](../functions/OCF-XXX-001/)", functions)

    def test_function_title_actions_link_to_edition_player_and_direct_formats(self):
        rows = []
        for title, asset_suffix, edition in (
            ("Relax", "a" * 64, "0.1.0"),
            ("Relax", "b" * 64, "0.2.0"),
        ):
            rows.append({
                "session": {
                    "asset_id": f"asset-{asset_suffix}",
                    "title": title,
                    "locale": "en-US",
                    "voice_name": "Example Voice",
                    "edition": edition,
                },
                "group": {"title": title},
                "release": {"version": edition},
                "audio_assets": [
                    {"format": "mp3", "download_url": f"https://github.com/example/{edition}/relax.mp3"},
                    {"format": "flac", "download_url": f"https://github.com/example/{edition}/relax.flac"},
                ],
            })

        html = _function_audio_actions(rows)

        self.assertEqual(html.count('class="function-audio-action-group"'), 2)
        for asset_suffix, edition in (("a" * 64, "0.1.0"), ("b" * 64, "0.2.0")):
            self.assertIn(f'href="#session-asset-{asset_suffix}"', html)
            self.assertIn(f'aria-label="Listen to Relax, en-US, edition {edition}"', html)
            for fmt in ("mp3", "flac"):
                self.assertIn(f'href="https://github.com/example/{edition}/relax.{fmt}"', html)
                self.assertIn(f'aria-label="Download {fmt.upper()} for Relax, en-US, edition {edition}"', html)
        self.assertEqual(_function_audio_actions([]), "")

    def test_download_directory_cards_are_responsive_and_contextual(self):
        groups = []
        for function_id, title in (("OCF-FND-004", "Relax"), ("OCF-BOD-001", "Brain Flow")):
            assets = [
                {
                    "asset_id": f"{function_id}-{fmt}",
                    "format": fmt,
                    "filename": f"{function_id}.{fmt}",
                    "encoding": encoding,
                    "download_url": f"https://github.com/example/{function_id}.{fmt}",
                    "sha256": "a" * 64 if fmt == "mp3" else "b" * 64,
                    "size_bytes": 1_000_000,
                    "duration_seconds": 120,
                }
                for fmt, encoding in (("mp3", "MP3 320 kbps"), ("flac", "FLAC lossless"))
            ]
            groups.append({
                "function_id": function_id,
                "title": title,
                "sessions": [{
                    "title": title,
                    "locale": "en-US",
                    "voice_name": "Example Voice",
                    "edition": "0.1.0",
                    "assets": assets,
                }],
            })
        page = _downloads_page({"releases": [{
            "version": "0.1.0",
            "tag": "audio-test-release",
            "release_url": "https://github.com/example/release",
            "functions": groups,
            "preparations": [],
        }]}, [])

        self.assertEqual(page.count('class="download-card"'), 2)
        self.assertNotIn("reference-table", page)
        for title, function_id in (("Relax", "OCF-FND-004"), ("Brain Flow", "OCF-BOD-001")):
            for fmt in ("MP3", "FLAC"):
                self.assertIn(
                    f'aria-label="Download {fmt} for {title}, en-US, Example Voice, edition 0.1.0"',
                    page,
                )
                self.assertIn(f'href="https://github.com/example/{function_id}.{fmt.lower()}"', page)
            self.assertIn(f"{function_id}.mp3", page)
            self.assertIn(f"{function_id}.flac", page)
        self.assertIn("audio-test-release", page)
        self.assertIn("320 kbps", page)
        self.assertNotIn("MP3 · MP3", page)
        self.assertNotIn("FLAC · flac", page)

    def test_download_search_uses_separate_escaped_title_and_current_cues(self):
        from html import unescape
        title = 'Manifest & "Explore"'
        function = {
            "function_id": "OCF-EXP-001", "description": {"text": "Choose an intention."},
            "commands": [
                {"spoken_cue": 'Plus Manifest & "Explore"', "command_status": "active", "spoken_status": "reviewed"},
                {"spoken_cue": "Old cue", "command_status": "retired", "spoken_status": "reviewed"},
                {"spoken_cue": "Draft cue", "command_status": "active", "spoken_status": "draft"},
            ], "categories": [{"id": "experimental", "label": "experimental"}],
        }
        page = _downloads_page({"releases": [{"version": "0.2.0", "release_url": "https://example.test/release",
            "functions": [{"function_id": "OCF-EXP-001", "title": title,
                           "sessions": [{"title": title, "assets": []}]}]}]}, [], [function])
        self.assertIn('data-download-title="Manifest &amp; &quot;Explore&quot;"', page)
        self.assertIn('Spoken cue: Plus Manifest &amp; &quot;Explore&quot;', page)
        cues = re.search(r'data-download-cues="([^"]*)"', page).group(1)
        self.assertEqual(json.loads(unescape(cues)), ['Plus Manifest & "Explore"'])
        self.assertNotIn("Old cue", page)
        self.assertNotIn("Draft cue", page)
        self.assertIn("Choose an intention.", page)
        self.assertLess(page.index('id="download-count"'), page.index('data-download-intro'))
        self.assertLess(page.index('data-download-intro'), page.index('id="download-results"'))

    def test_shell_navigation_keeps_routes_and_marks_current_location(self):
        page = _shell("Function list", "<p>Directory</p>", "functions", "a" * 40)
        for href in (
            "../start/", "../functions/", "../quick-reference/", "../listening/",
            "../historical-names/", "../relationships/", "../functions/#library", "../downloads/", "../about/",
        ):
            self.assertIn(f'href="{href}"', page)
        self.assertIn('<a href="../functions/" aria-current="page">Browse &amp; Listen</a>', page)
        detail = _shell("Function", "<p>Detail</p>", "functions/OCF-BOD-001", "a" * 40)
        self.assertIn('<a href="../../functions/" aria-current="location">Browse &amp; Listen</a>', detail)
        self.assertIn('<details class="more-menu">', page)

    def test_download_directory_cards_preserve_each_format_with_contextual_names(self):
        sessions = []
        for function_id, title in (
            ("OCF-FND-004", "Relax"),
            ("OCF-BOD-001", "Brain Flow"),
        ):
            assets = [
                {
                    "asset_id": f"{function_id}-{fmt}",
                    "format": fmt,
                    "filename": f"{function_id}.{fmt}",
                    "encoding": encoding,
                    "download_url": f"https://github.com/example/{function_id}.{fmt}",
                    "sha256": "a" * 64 if fmt == "mp3" else "b" * 64,
                    "size_bytes": 1_000_000,
                    "duration_seconds": 120,
                }
                for fmt, encoding in (("mp3", "MP3 320 kbps"), ("flac", "FLAC lossless"))
            ]
            sessions.append({
                "function_id": function_id,
                "title": title,
                "sessions": [{
                    "title": title,
                    "locale": "en-US",
                    "voice_name": "Example Voice",
                    "edition": "0.1.0",
                    "assets": assets,
                }],
            })
        page = _downloads_page({"releases": [{
            "version": "0.1.0",
            "tag": "audio-test-release",
            "release_url": "https://github.com/example/release",
            "functions": sessions,
            "preparations": [],
        }]}, [])

        self.assertEqual(page.count('class="download-card"'), 2)
        self.assertNotIn("reference-table", page)
        for title, function_id in (("Relax", "OCF-FND-004"), ("Brain Flow", "OCF-BOD-001")):
            for fmt in ("MP3", "FLAC"):
                self.assertIn(f'Download {fmt} for {title}, en-US, Example Voice, edition 0.1.0', page)
                self.assertIn(f'href="https://github.com/example/{function_id}.{fmt.lower()}"', page)
            self.assertIn(f"{function_id}.mp3", page)
            self.assertIn(f"{function_id}.flac", page)
        self.assertIn("audio-test-release", page)

    def test_render_markdown_keeps_wrapped_ordered_steps_semantic(self):
        rendered = render_markdown(
            "## Suggested way to explore\n\n"
            "1. [Relax](../functions/OCF-FND-004/) — gentle introduction to\n"
            "   guided relaxation and listening.\n"
            "2. [Focus](../functions/OCF-FND-002/) — attention-oriented\n"
            "   practice.\n"
            "3. [Think Fast](../functions/OCF-COG-007/) — thinking-oriented\n"
            "   practice."
        )
        self.assertEqual(rendered.count("<ol>"), 1)
        self.assertEqual(rendered.count("<li>"), 3)
        self.assertIn("guided relaxation and listening.", rendered)
        self.assertIn("</li><li>", rendered)
        self.assertNotIn("<p>1. ", rendered)

    def test_render_markdown_keeps_wrapped_unordered_checklists_semantic(self):
        rendered = render_markdown(
            "## Baseline\n\n"
            "- Stereo headphones with separate left/right playback are\n"
            "  required for the intended channel-separated audio.\n"
            "- Keep any accessibility settings you rely on."
        )
        self.assertEqual(rendered.count("<ul>"), 1)
        self.assertEqual(rendered.count("<li>"), 2)
        self.assertIn(
            "Stereo headphones with separate left/right playback are required "
            "for the intended channel-separated audio.", rendered,
        )
        self.assertIn("Keep any accessibility settings you rely on.", rendered)
        self.assertNotIn("<p>- ", rendered)

    def test_historical_lookup_projection_uses_only_exact_source_names(self):
        import yaml

        function = {
            "function_id": "OCF-SEN-003",
            "title": {"text": "Smell"},
            "commands": [{"display_cue": {"text": "PLUS-SMELL MORE"}}],
            "canonical_resource": "locales/en-US/OCF-SEN-003-Smell.yaml",
        }
        record = {
            "locale": "en-US",
            "function_id": "OCF-SEN-003",
            "record_metadata": {
                "historical_lookup": [
                    {"text": "Sensory: Smell", "kind": "former-title", "decision": "test"},
                    {"text": "PLUS-SMELL MORE", "kind": "former-primary", "decision": "test"},
                ]
            },
        }
        raw_resource = yaml.safe_dump(record, sort_keys=True).encode()
        function["canonical_resource_sha256"] = hashlib.sha256(raw_resource).hexdigest()
        reference = (
            "# Historical lookup\n\n## Migrated vocabulary\n\n"
            "- OCF-SEN-003 → Smell / `PLUS-SMELL MORE`; "
            "historical matches: Sensory: Smell; PLUS-SMELL MORE.\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resource = root / function["canonical_resource"]
            resource.parent.mkdir(parents=True)
            resource.write_bytes(raw_resource)
            rows = _historical_lookup_rows(reference, [function], root)
            self.assertEqual(
                rows,
                [{
                    "function_id": "OCF-SEN-003",
                    "title": "Smell",
                    "names": [
                        {
                            "text": "Sensory: Smell",
                            "kind": "former-title",
                            "label": "Former title",
                            "also_current": False,
                        },
                        {
                            "text": "PLUS-SMELL MORE",
                            "kind": "former-primary",
                            "label": "Former primary cue · Also current",
                            "also_current": True,
                        },
                    ],
                }],
            )
            page = _historical_names_page(
                rows,
                [function],
                "a" * 40,
                historical_reference_sha256="b" * 64,
            )
            self.assertIn('data-historical-kind="former-title"', page)
            self.assertIn("Earlier title:", page)
            self.assertNotIn("PLUS-SMELL MORE", page)
            self.assertNotIn("Also current", page)
            self.assertNotIn("historical strings", page)
            self.assertNotIn("SHA-256", page)
        wrong_title = reference.replace("→ Smell /", "→ Taste /")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resource = root / function["canonical_resource"]
            resource.parent.mkdir(parents=True)
            resource.write_bytes(raw_resource)
            with self.assertRaisesRegex(ValueError, "title does not match"):
                _historical_lookup_rows(wrong_title, [function], root)
        unknown_target = reference.replace("OCF-SEN-003", "OCF-SEN-004")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resource = root / function["canonical_resource"]
            resource.parent.mkdir(parents=True)
            resource.write_bytes(raw_resource)
            with self.assertRaisesRegex(ValueError, "unknown function"):
                _historical_lookup_rows(unknown_target, [function], root)

    def test_title_map_hides_unchanged_titles_and_cue_only_history_without_mutation(self):
        rows = [
            {"function_id": "OCF-SLP-005", "title": "Sleep Easy", "names": [
                {"kind": "former-title", "text": "sleep-easy"},
                {"kind": "former-primary", "text": "PLUS-SLEEP EASY"}]},
            {"function_id": "OCF-BOD-002", "title": "Circulation", "names": [
                {"kind": "former-primary", "text": "PLUS-FLOW SMOOTH"}]},
            {"function_id": "OCF-PRF-002", "title": "Inner Power", "names": [
                {"kind": "former-title", "text": "Eight-Great"},
                {"kind": "former-title", "text": "Eight-Great"},
                {"kind": "former-teaching", "text": "Plus Eight Great"}]},
        ]
        original = copy.deepcopy(rows)
        visible = _renamed_title_rows(rows)
        self.assertEqual(rows, original)
        self.assertEqual([row["function_id"] for row in visible], ["OCF-PRF-002"])
        self.assertEqual(visible[0]["names"], [{"kind": "former-title", "text": "Eight-Great"}])

    def test_home_optional_starter_links_use_verified_current_ids_in_order(self):
        ids = ("OCF-FND-004", "OCF-FND-002", "OCF-COG-004", "OCF-COG-006", "OCF-COG-007")
        titles = ("Relax", "Focus", "Imprint", "Recall", "Think Fast")
        functions = [{"function_id": fid, "title": {"text": title}, "categories": []}
                     for fid, title in zip(ids, titles)]
        page = _home_page(functions, {"releases": []}, "a" * 40)
        locations = [page.index(f'href="functions/{fid}/"') for fid in ids]
        self.assertEqual(locations, sorted(locations))
        for title in titles:
            self.assertIn(f'>{title}</a></li>', page)
        self.assertIn("optional starting choices—not additional prerequisites", page)
        self.assertLess(page.index("Complete Preparation Learning"), locations[0])
        self.assertIn("official Human Plus preparation track", page)

    def test_historical_overlap_is_exact_normalized_and_same_function_only(self):
        import yaml

        function = {
            "function_id": "OCF-PRF-002",
            "title": {"text": "Inner Power"},
            "commands": [{
                "display_cue": {"text": "PLUS-INNER POWER"},
                "spoken_cue": "Plus Inner Power",
            }],
            "canonical_resource": "locales/en-US/OCF-PRF-002-Inner-Power.yaml",
        }
        record = {
            "function_id": function["function_id"],
            "record_metadata": {
                "historical_lookup": [
                    {"text": "PLUS-STRONG", "kind": "former-primary", "decision": "test"},
                    {"text": "pLuS   inner power", "kind": "former-teaching", "decision": "test"},
                ]
            },
        }
        raw_resource = yaml.safe_dump(record, sort_keys=True).encode()
        function["canonical_resource_sha256"] = hashlib.sha256(raw_resource).hexdigest()
        reference = (
            "# Historical lookup\n\n## Migrated vocabulary\n\n"
            "- OCF-PRF-002 → Inner Power / `PLUS-INNER POWER`; "
            "historical matches: PLUS-STRONG; pLuS   inner power.\n"
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            resource = root / function["canonical_resource"]
            resource.parent.mkdir(parents=True)
            resource.write_bytes(raw_resource)
            rows = _historical_lookup_rows(reference, [function], root)
        self.assertEqual(
            [(name["text"], name["also_current"]) for name in rows[0]["names"]],
            [("pLuS   inner power", True)],
        )

    def test_public_history_exclusion_is_exact_and_function_scoped(self):
        self.assertFalse(_public_historical_name(
            "OCF-PRF-002", {"kind": "former-primary", "text": "PLUS-STRONG"}
        ))
        for function_id, kind, text in (
            ("OCF-PRF-006", "former-primary", "PLUS-STRONG"),
            ("OCF-PRF-002", "former-teaching", "PLUS-STRONG"),
            ("OCF-PRF-002", "former-primary", "PLUS-STRONG QUICK"),
            ("OCF-PRF-002", "former-primary", "PLUS-STRONG-QUICK"),
            ("OCF-PRF-002", "former-primary", "PLUS-INNER POWER"),
        ):
            with self.subTest(function_id=function_id, kind=kind, text=text):
                self.assertTrue(_public_historical_name(
                    function_id, {"kind": kind, "text": text}
                ))

    def test_published_recording_answer_is_catalog_scoped_and_never_infers_availability(self):
        functions = [{"function_id": "OCF-FND-001"}, {"function_id": "OCF-FND-002"}]
        scoped = _function_audio_availability(
            functions,
            {"releases": [{"tag": "audio-test", "version": "0.2.0", "preparations": [{"sessions": [{}]}]}]},
            {"OCF-FND-001": [{}], "OCF-FND-002": []},
        )
        self.assertIn("1 of 2 canonical function guides", scoped)
        self.assertIn("audio-test (edition 0.2.0)", scoped)
        self.assertIn("The 1 Preparation Learning session is listed separately", scoped)
        absent = _function_audio_availability(functions, {"releases": []}, {})
        self.assertIn("0 of 2 canonical function guides", absent)
        self.assertIn("no published release in the verified catalog", absent)

    def test_relationship_directory_preserves_direction_and_reason_without_graph_claims(self):
        functions = [
            {
                "function_id": "OCF-FND-004", "title": {"text": "Relax"},
                "primary_category": "foundation", "related_functions": [{
                    "function_id": "OCF-FND-002", "title": "Focus",
                    "relationship_type": "complementary", "description": "An approved reason.",
                }],
            },
            {
                "function_id": "OCF-FND-002", "title": {"text": "Focus"},
                "primary_category": "foundation", "related_functions": [],
            },
        ]
        page = _relationships_page(functions)
        self.assertEqual(page.count('class="relationship-card"'), 1)
        self.assertIn('Relax</a> <span aria-hidden="true">→</span> <a href="../functions/OCF-FND-002/">Focus', page)
        self.assertIn("An approved reason.", page)
        self.assertIn("one-way", page)
        self.assertNotIn("OCF-FND-002</a> <span aria-hidden", page)
        self.assertNotIn("complementary", page)

    def test_home_is_a_short_entry_page_and_browse_has_only_real_filters(self):
        categories = [{"id": "focus", "label": "focus"}]
        functions = [{
            "function_id": "OCF-FND-002", "slug": "focus", "title": {"text": "Focus"},
            "description": {"text": "A short approved description."}, "categories": categories,
            "primary_category": "focus", "commands": [], "tags": [], "common_uses": [],
        }]
        self.assertIn("official Human Plus preparation track", _home_page(
            functions, {"releases": [{"functions": [], "preparations": []}]}, "a" * 40
        ))
        self.assertIn('id="library"', _home_page(
            functions, {"releases": [{"functions": [], "preparations": []}]}, "a" * 40
        ))
        page = _functions_index(functions, {"OCF-FND-002": []}, [])
        self.assertIn("Browse &amp; Listen", page)
        self.assertIn('id="category-filter"', page)
        self.assertNotIn('id="language-filter"', page)
        self.assertNotIn('id="voice-filter"', page)

    def test_draft_discovery_and_pending_procedure_are_hidden_without_mutating_metadata(self):
        function = {
            "function_id": "OCF-EXP-006",
            "title": {"text": "Intuition", "status": "reviewed"},
            "description": {"text": "A documented purpose.", "status": "reviewed"},
            "categories": [],
            "tags": [
                {"text": "draft-tag", "status": "draft"},
                {"text": "machine-tag", "status": "machine"},
                {"text": "canonical-tag", "status": "canonical"},
            ],
            "common_uses": [
                {"text": "draft-use", "status": "draft"},
                {"text": "machine-use", "status": "machine"},
                {"text": "reviewed-use", "status": "reviewed"},
            ],
            "commands": [{
                "command_id": "OCF-CMD-EXP-006-PRIMARY",
                "designation": "primary",
                "spoken_cue": "Plus Intuition",
                "procedure_status": "review-pending",
                "procedure_steps": [
                    {"operation": "draft-only", "instruction": "Unapproved steps stay hidden."}
                ],
                "usage": None,
                "explanation": None,
                "effect_scope": None,
            }],
            "lifecycle": {
                "scopes": [],
                "activation": "manual",
                "persistence": "temporary",
                "trigger_conditions": [],
                "release_command": None,
            },
            "safety_notes": [],
            "related_functions": [],
            "canonical_resource": "locales/en-US/OCF-EXP-006-Intuition.yaml",
        }
        original = copy.deepcopy(function)
        html = _function_page(function, [], {}, "a" * 40)
        tags_html = _discovery_section("Tags", function["tags"])
        self.assertIn("canonical-tag", tags_html)
        self.assertNotIn("draft-tag", tags_html)
        self.assertNotIn("machine-tag", tags_html)
        self.assertNotIn("Draft metadata", html)
        self.assertNotIn("draft-tag", html)
        self.assertNotIn("machine-tag", html)
        self.assertNotIn("draft-use", html)
        self.assertNotIn("machine-use", html)
        self.assertIn("canonical-tag", html)
        self.assertIn("reviewed-use", html)
        self.assertNotIn("Unapproved steps stay hidden.", html)
        self.assertIn("No activation steps are published for this command.", html)
        self.assertNotIn("review-pending", html)
        self.assertNotIn("Title: reviewed", html)
        self.assertNotIn("Description: reviewed", html)
        self.assertEqual(html.count("A documented purpose."), 1)
        self.assertNotIn("Intended purpose", html)
        self.assertIn('<details class="source-details">', html)
        self.assertIn('<details class="function-history" id="function-history">', html)
        self.assertIn('<summary>Function change history</summary>', html)
        self.assertIn('/commits/' + 'a' * 40 + '/' + function["canonical_resource"], html)
        self.assertIn('No source revision records are available', html)
        self.assertIn('This bounded file history is incomplete', html)
        self.assertNotIn('id="function-history" open', html)
        self.assertIn('They do not establish that a new recording was made.', html)
        escaped_function = copy.deepcopy(function)
        escaped_function["title"]["text"] = '<script>alert("history")</script>'
        escaped = _function_page(escaped_function, [], {}, "a" * 40)
        self.assertNotIn('<script>alert', escaped)
        self.assertIn('View source changes for &lt;script&gt;', escaped)
        revisions = [{'commit': 'b' * 40, 'date': '2026-11-17', 'subject': '<script>bad</script> & change'},
                     {'commit': 'c' * 40, 'date': '2026-11-18', 'subject': 'Ancestor revision'}]
        history_page = _function_page(function, [], {}, 'a' * 40, revisions)
        self.assertIn('&lt;script&gt;bad&lt;/script&gt; &amp; change', history_page)
        self.assertNotIn('<script>bad', history_page)
        self.assertLess(history_page.index('bad&lt;'), history_page.index('Ancestor revision'))
        self.assertNotIn('No source revision records are available', history_page)

        self.assertNotIn("Documented practice intent:", html)
        self.assertNotIn("not a guaranteed result or medical treatment", html)
        self.assertNotIn("not evidence of lasting biological change", html)
        self.assertIn("Persistence described by the practice: temporary", html)
        permanent = copy.deepcopy(function)
        permanent["lifecycle"]["persistence"] = "permanent"
        permanent["lifecycle"]["scopes"] = [{"label": "Reinforcement", "persistence": "permanent", "description": "Documented intent"}]
        permanent["commands"][0]["effect_scope"] = "permanent"
        permanent["safety_notes"] = ["Existing function-specific precaution."]
        snapshot = copy.deepcopy(permanent)
        permanent_page = _function_page(permanent, [], {}, "a" * 40)
        self.assertIn("Command scope: permanent", permanent_page)
        self.assertIn('class="technical-popover"', permanent_page)
        self.assertEqual(permanent_page.count('class="technical-info"'), 2)
        self.assertIn("Persistence described by the practice: permanent", permanent_page)
        self.assertNotIn("Existing function-specific precaution.", permanent_page)
        self.assertNotIn('id="safety"', permanent_page)
        self.assertNotIn("Function-specific notes:", permanent_page)
        self.assertNotIn("#safety", _render_toc(_function_toc_items()))
        emergency = copy.deepcopy(permanent)
        emergency["function_id"] = "OCF-EMG-001"
        action = "If you believe you have an emergency or poisoning, call your local emergency number first."
        emergency["safety_notes"].append(action)
        emergency_page = _function_page(emergency, [], {}, "a" * 40)
        self.assertIn(action, emergency_page)
        self.assertNotIn("Existing function-specific precaution.", emergency_page)
        self.assertNotIn('id="safety"', emergency_page)
        self.assertIn("<strong>Reinforcement</strong>", permanent_page)
        self.assertNotIn("not evidence of lasting biological change", permanent_page)
        self.assertEqual(permanent, snapshot)
        self.assertEqual(function, original)
        function["commands"][0]["explanation"] = {"text": "  A   documented purpose. "}
        secondary = copy.deepcopy(function["commands"][0])
        secondary.update(designation="secondary", spoken_cue="Plus Cancel", explanation={"text": "A distinct secondary meaning."})
        function["commands"].append(secondary)
        snapshot = copy.deepcopy(function)
        rendered = _function_page(function, [], {}, "a" * 40)
        self.assertEqual(rendered.count("A documented purpose."), 1)
        self.assertNotIn("A   documented purpose", rendered)
        self.assertIn("A distinct secondary meaning.", rendered)
        self.assertIn("Plus Cancel", rendered)
        self.assertEqual(function, snapshot)

    def test_spoken_cue_reference_replaces_only_the_approved_whole_cue(self):
        commands = [
            {
                "display_cue": {"text": "PLUS-CANCEL"},
                "spoken_cue": "Plus Cancel",
            }
        ]
        usage = "Places Insulate on hold; PLUS-CANCEL ends this adjustment."
        self.assertEqual(
            _spoken_cue_references(usage, commands),
            "Places Insulate on hold; Plus Cancel ends this adjustment.",
        )
        self.assertEqual(
            _spoken_cue_references("PLUS-CANCELLED is not PLUS-CANCEL", commands),
            "PLUS-CANCELLED is not Plus Cancel",
        )
        self.assertEqual(usage, "Places Insulate on hold; PLUS-CANCEL ends this adjustment.")

    def test_suggested_download_filename_is_descriptive_safe_and_hash_free(self):
        suggested = _suggested_download_filename(
            {"function_id": "OCF-FND-004"},
            {
                "title": "Relax / Recover",
                "locale": "en-US",
                "voice_name": "Mike: Original Voice",
                "edition": "0.1.0",
            },
            {"tag": "audio-0.1.0-release"},
            {"format": "MP3", "filename": "release-abcdef123456.mp3"},
        )
        self.assertEqual(
            suggested,
            "OCF-FND-004 - Relax - Recover - en-US - Mike- Original Voice - v0.1.0 - audio-0.1.0-release.mp3",
        )
        self.assertNotIn("abcdef123456", suggested)
        self.assertNotRegex(suggested, r'[<>:"/\\|?*\x00-\x1f]')
        with self.assertRaisesRegex(ValueError, "unsupported suggested-download extension"):
            _suggested_download_filename(
                {"function_id": "OCF-FND-004"},
                {"title": "Relax", "locale": "en-US", "voice_name": "Voice", "edition": "0.1"},
                {"tag": "release"},
                {"format": "../../mp3"},
            )

    def test_suggested_audio_filename_collision_fails_closed(self):
        row = {
            "group": {"function_id": "OCF-FND-004", "title": "Relax"},
            "session": {
                "title": "Relax",
                "locale": "en-US",
                "voice_name": "Mike",
                "edition": "0.1.0",
            },
            "release": {"tag": "audio-0.1.0"},
            "audio_assets": [
                {"asset_id": "asset-one", "format": "mp3"},
                {"asset_id": "asset-two", "format": "MP3"},
            ],
        }
        with self.assertRaisesRegex(ValueError, "share a suggested local filename"):
            _validate_suggested_download_filenames([row])

    def test_public_description_removes_only_matching_display_cue_suffix(self):
        function = {
            "description": {
                "text": "Sleep deliberately; activation cue PLUS-SLEEP.",
            },
            "commands": [
                {"display_cue": {"text": "PLUS-SLEEP"}},
            ],
        }
        original = copy.deepcopy(function)
        self.assertEqual(_public_description(function), "Sleep deliberately")
        function["description"]["text"] = "Use PLUS-SLEEP safely."
        self.assertEqual(_public_description(function), "Use PLUS-SLEEP safely.")
        self.assertEqual(original["description"]["text"], "Sleep deliberately; activation cue PLUS-SLEEP.")

    @staticmethod
    def valid_pin():
        return {
            "schema_version": 1,
            "source_repository": "https://github.com/ocfproject-org/open-consciousness-functions",
            "source_commit": "a" * 40,
            "source_version": "0.1.0",
            "locale": "en-US",
            "exporter": "ocf.public-site-guides/1",
        }

    @staticmethod
    def valid_export(pin):
        functions = [
            {
                "function_id": f"OCF-FND-{index:03}",
                "documentation_status": "canonical-function-resource",
                "canonical_resource_sha256": "b" * 64,
                "commands": [],
                "historical_commands": [],
                "related_functions": [],
            }
            for index in range(1, 59)
        ]
        guide = {"markdown": "# Listening guide\n", "source_sha256": ""}
        guide["source_sha256"] = hashlib.sha256(guide["markdown"].encode()).hexdigest()
        document = {
            "schema_version": 1,
            "exporter": "ocf.public-site-guides/1",
            "source_repository": pin["source_repository"],
            "source_commit": pin["source_commit"],
            "locale": "en-US",
            "functions": functions,
            "listening_guide": guide,
        }
        document["build_receipt"] = {
            "function_count": 58,
            "narration_text_included": False,
            "source_evidence_paths_included": False,
            "draft_procedures_included": False,
            "relationship_proposals_included": False,
            "functions_sha256": digest(functions),
            "export_content_sha256": digest(document),
        }
        return document

    def test_markdown_escaping_blocks_html_and_unsafe_links(self):
        rendered = _inline(
            "<script>alert(1)</script> [bad](javascript:alert(1)) [good](https://example.org/a)"
        )
        self.assertNotIn("<script>", rendered)
        self.assertIn("&lt;script&gt;", rendered)
        self.assertNotIn('href="javascript:', rendered)
        self.assertNotIn('href="..\\..\\outside', rendered)
        self.assertIn('href="https://example.org/a"', rendered)

    def test_transcript_requires_manifest_size_digest_and_utf8(self):
        text = b"edition-matched transcript\n"
        asset = {
            "format": "txt",
            "asset_id": "asset-" + "a" * 64,
            "size_bytes": len(text),
            "sha256": hashlib.sha256(text).hexdigest(),
        }
        self.assertEqual(fetch_transcript(asset, fetcher=lambda _: text), text)
        with self.assertRaisesRegex(ValueError, "size verification"):
            fetch_transcript(asset, fetcher=lambda _: text + b"bad")
        invalid = b"\xff"
        asset.update(size_bytes=1, sha256=hashlib.sha256(invalid).hexdigest())
        with self.assertRaisesRegex(ValueError, "valid UTF-8"):
            fetch_transcript(asset, fetcher=lambda _: invalid)

    def test_transcript_rejects_unmanifested_format(self):
        with self.assertRaisesRegex(ValueError, "only published TXT/VTT"):
            fetch_transcript({"format": "wav"}, fetcher=lambda _: b"")

    def test_public_asset_fetch_retries_transient_502_with_a_fixed_bound(self):
        url = "https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/tag/transcript.txt"
        payload = b"approved public release companion"

        class Response(io.BytesIO):
            def geturl(self):
                return "https://release-assets.githubusercontent.com/transcript.txt"

        transient = HTTPError(url, 502, "proxy unavailable", {}, io.BytesIO())
        with (
            patch(
                "build_public_site.urllib.request.urlopen",
                side_effect=[transient, Response(payload)],
            ) as opener,
            patch("build_public_site.time.sleep") as pause,
        ):
            self.assertEqual(_request_public_asset({"download_url": url}), payload)
        self.assertEqual(opener.call_count, 2)
        pause.assert_called_once_with(0.25)

    def test_public_asset_fetch_does_not_retry_permanent_http_errors(self):
        url = "https://github.com/ocfproject-org/open-consciousness-functions-audio/releases/download/tag/transcript.txt"
        permanent = HTTPError(url, 404, "missing", {}, io.BytesIO())
        with (
            patch(
                "build_public_site.urllib.request.urlopen", side_effect=permanent
            ) as opener,
            self.assertRaises(HTTPError),
        ):
            _request_public_asset({"download_url": url})
        self.assertEqual(opener.call_count, 1)

    def test_quick_reference_marks_audio_unavailable_separately(self):
        function = {
            "function_id": "OCF-FND-001",
            "title": {"text": "Example"},
            "description": {"text": "Documented purpose."},
            "categories": [{"id": "foundation", "label": "Foundation"}],
            "primary_category": "foundation",
            "tags": [],
            "common_uses": [],
            "commands": [],
            "historical_commands": [],
        }
        unavailable = _quick_reference([function], {})
        available = _quick_reference([function], {"OCF-FND-001": [object()]})
        self.assertIn("Audio unavailable", unavailable)
        self.assertNotIn("Published audio available", available)
        self.assertIn('href="../functions/OCF-FND-001/#listening">Listen</a>', available)
        self.assertNotIn(">Listen</a>", unavailable)

    def test_quick_reference_filter_includes_secondary_canonical_domains(self):
        function = {
            "function_id": "OCF-EXP-001",
            "title": {"text": "Imagination"},
            "description": {"text": "A documented purpose."},
            "categories": [
                {"id": "experimental", "label": "Experimental"},
                {"id": "foundation", "label": "Foundation"},
            ],
            "primary_category": "experimental",
            "tags": [],
            "common_uses": [],
            "commands": [],
            "historical_commands": [],
        }
        page = _quick_reference([function], {})
        assert 'data-category="experimental foundation"' in page

    def test_recommended_settings_link_to_required_stereo_and_keep_optional_controls_distinct(self):
        content = _recommended_settings("a" * 40)
        self.assertIn("automatic loudness normalization", content)
        self.assertIn("normal playback speed (1.0x)", content)
        self.assertIn('href="#headphones-and-stereo"', content)
        self.assertNotIn("Speakers, mono mixing, or a single earpiece", content)
        self.assertIn("Optional processing choices are separate from the required stereo delivery.", content)
        self.assertNotIn("when the selected edition is designed", content)

    def test_platform_guides_all_state_required_stereo_delivery_and_accessible_alternatives(self):
        required = (
            "Stereo headphones or stereo earbuds with separate left/right playback are\n"
            "  required for the intended binaural/channel-separated audio."
        )
        for platform in ("android", "ios", "linux", "macos", "windows"):
            with self.subTest(platform=platform):
                content = Path(f"docs/website/listening/{platform}.md").read_text(
                    encoding="utf-8"
                )
                self.assertIn(required, content)
                self.assertIn(
                    "Speakers, mono\n  mixing, or a single earpiece are not equivalent delivery of that audio.",
                    content,
                )
                self.assertIn("or skip the audio", content)
                self.assertNotIn("stereo baseline is optional", content)
                self.assertNotIn("You may listen to the spoken guidance through speakers", content)
                self.assertNotIn("You may still listen to the spoken guidance", content)

    def test_audio_asset_specs_include_format_rate_channels_size_and_duration(self):
        specification = _asset_specification(
            {
                "format": "mp3",
                "encoding": "MP3 320 kbps",
                "sample_rate_hz": 44100,
                "channels": 2,
                "size_bytes": 1048576,
                "duration_seconds": 125,
            }
        )
        self.assertEqual(
            specification,
            "MP3 · 320 kbps · 44,100 Hz · 2 channels · 1.0 MiB · 2m 5s",
        )

    def test_guide_export_fails_closed_on_source_pin_or_receipt_drift(self):
        pin = self.valid_pin()
        document = self.valid_export(pin)
        self.assertIs(validate_guide_export(document, pin), document)
        wrong_pin = {**pin, "source_commit": "c" * 40}
        with self.assertRaisesRegex(ValueError, "source commit differs"):
            validate_guide_export(document, wrong_pin)
        tampered = copy.deepcopy(document)
        tampered["build_receipt"]["narration_text_included"] = True
        with self.assertRaisesRegex(ValueError, "narration text is forbidden"):
            validate_guide_export(tampered, pin)
        tampered = copy.deepcopy(document)
        tampered["functions"][0]["title"] = "unauthenticated text"
        with self.assertRaisesRegex(ValueError, "functions hash mismatch"):
            validate_guide_export(tampered, pin)
        for field, message in (
            ("draft_procedures_included", "draft procedure text is forbidden"),
            ("relationship_proposals_included", "draft relationship proposals are forbidden"),
        ):
            tampered = copy.deepcopy(document)
            tampered["build_receipt"][field] = True
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, message):
                validate_guide_export(tampered, pin)

    def test_release_catalog_companion_join_uses_manifest_master_hash(self):
        release = {
            "tag": "example-release",
            "functions": [
                {
                    "function_id": "OCF-FND-001",
                    "sessions": [
                        {
                            "title": "Example",
                            "assets": [
                                {
                                    "format": "mp3",
                                    "provenance": {"master_sha256": "a" * 64},
                                }
                            ],
                        }
                    ],
                }
            ],
            "preparations": [],
            "companions": [
                {
                    "asset_id": "asset-" + "b" * 64,
                    "format": "txt",
                    "provenance": {"master_sha256": "a" * 64},
                }
            ],
        }
        by_function, preparation = _catalog_sessions({"releases": [release]})
        self.assertEqual(preparation, [])
        self.assertEqual(
            by_function["OCF-FND-001"][0]["companions"]["txt"]["asset_id"],
            "asset-" + "b" * 64,
        )

    def test_unmatched_or_ambiguous_companion_fails_closed(self):
        release = {
            "tag": "example-release",
            "functions": [],
            "preparations": [],
            "companions": [
                {
                    "asset_id": "asset-" + "b" * 64,
                    "format": "txt",
                    "provenance": {"master_sha256": "c" * 64},
                }
            ],
        }
        with self.assertRaisesRegex(ValueError, "lacks a unique manifest-bound"):
            _catalog_sessions({"releases": [release]})



class DynamicFunctionCountTests(unittest.TestCase):
    def test_export_cardinality_follows_verified_receipt_not_fixed_snapshot(self):
        pin = PublicSiteBuildTests.valid_pin()
        for size in (1, 57, 59):
            doc = PublicSiteBuildTests.valid_export(pin)
            doc["functions"] = [dict(doc["functions"][0], function_id=f"OCF-FND-{i:03}") for i in range(1, size + 1)]
            receipt = doc["build_receipt"]
            receipt["function_count"] = size
            receipt["functions_sha256"] = digest(doc["functions"])
            receipt["export_content_sha256"] = digest({k: v for k, v in doc.items() if k != "build_receipt"})
            self.assertIs(validate_guide_export(doc, pin), doc)
            receipt["function_count"] = size + 1
            with self.assertRaisesRegex(ValueError, "count receipt mismatch"):
                validate_guide_export(doc, pin)
        for rows, message in (([], "nonempty"), ([{"function_id": "OCF-FND-001"}] * 2, "duplicate/missing"), ([{"function_id": "OCF-PREP-LEARN"}], "invalid function ID")):
            doc = PublicSiteBuildTests.valid_export(pin)
            doc["functions"] = rows
            with self.assertRaisesRegex(ValueError, message):
                validate_guide_export(doc, pin)

    def test_public_counts_follow_unique_guides_not_sessions_or_preparation(self):
        from build_public_site import _about_page, _preparation_page
        for size in (2, 3):
            functions = [{"function_id": f"OCF-FND-{i:03}", "title": {"text": "Example"}, "description": {"text": "Purpose"}, "categories": [{"id": "foundation", "label": "Foundation"}], "primary_category": "foundation", "tags": [], "common_uses": [], "commands": [], "historical_commands": []} for i in range(1, size + 1)]
            guide = {"functions": functions, "source_commit": "a" * 40, "build_receipt": {"approved_relationship_count": 0}}
            # Audio editions, including repeated IDs and separate preparation, do not inflate guide count.
            catalog = {"releases": [{"release_url": "https://example.test/release", "tag": "v1", "version": "1", "source_ocf_commit": "a" * 40, "functions": [{"function_id": "OCF-FND-001", "sessions": [{}, {}]}], "preparations": [{"sessions": [{}, {}]}]}]}
            about = _about_page(guide, catalog, "https://example.test/docs", {})
            self.assertIn(f"currently includes {size} functions and a separate Preparation Learning session", about)
            self.assertIn("<h2>Our Vision</h2>", about)
            self.assertIn("<strong>freely accessible, clearly documented, and open to improvement</strong>", about)
            self.assertIn(f">{size} functions</output>", _quick_reference(functions, {}))
            self.assertIn(f"Browse the {size} function guides", _preparation_page([], {}, size))
            self.assertIn(f"{size} FUNCTION GUIDES", _home_page(functions, {"releases": []}, "a" * 40))
        start = (Path(__file__).resolve().parents[1] / "docs/website/start-here.md").read_text()
        self.assertEqual(start.count("{{function_count}}"), 1)
        self.assertIn("one of the 3 function records", render_markdown(start.replace("{{function_count}}", "3")))


class AuditPresentationTests(unittest.TestCase):
    def test_exact_paragraph_normalization_and_format_tokens(self):
        from build_public_site import _normalized_public_paragraph
        self.assertEqual(_normalized_public_paragraph(" A  PURPOSE. "), _normalized_public_paragraph("a purpose."))
        self.assertNotEqual(_normalized_public_paragraph("A purpose."), _normalized_public_paragraph("A different purpose."))
        self.assertEqual(_asset_specification({"format": "flac", "encoding": "flac"}), "FLAC")
        self.assertEqual(_asset_specification({"format": "mp3", "encoding": "MP3 320 kbps"}), "MP3 · 320 kbps")
        self.assertEqual(_asset_specification({"format": "flac", "encoding": "PCM 24-bit"}), "FLAC · PCM 24-bit")


if __name__ == "__main__":
    unittest.main()
