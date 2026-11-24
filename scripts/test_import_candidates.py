import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from import_candidates import import_candidates, validate_lyrics_receipt
from publication import canonical_bytes, manifest_digest, validate_manifest, verify_files
from catalog import _project_entry
from catalog_contract import validate_release
from datetime import datetime, timezone
from test_publication import fixture


def candidate(root, preparation=False):
    root.mkdir()
    base = fixture()
    session = {
        k: v
        for k, v in base["assets"][0]["session"].items()
        if k
        not in {
            "duration_seconds",
            "sample_rate_hz",
            "channels",
            "encoding",
            "bit_depth",
        }
    }
    if preparation:
        session.update(
            kind="preparation-learning", function_id=None, title="Preparation Learning"
        )
    title = "00 - Preparation-Learning" if preparation else "OCF-FND-001 - Example"
    audio = {
        fmt: {
            "duration_seconds": 1.0,
            "sample_rate_hz": 44100,
            "channels": 2,
            "encoding": fmt,
            "operation": "stream-copy",
            "packet_sha256": "b" * 64,
            "decoded_pcm_sha256": "c" * 64,
        }
        for fmt in ("flac", "mp3")
    }
    audio["flac"]["bit_depth"] = 16
    technical = {
        "schema_version": 1,
        "source_kind": "verified-retained-flac",
        "frames": 44100,
        "peak": 0.1,
        "audio": audio,
        "source_commit": base["source_commit"],
        "source_version": base["source_version"],
        "clipped_sample_count": 0,
    }
    artifacts = []
    for fmt in ("flac", "mp3", "png", "json"):
        data = (
            canonical_bytes(technical)
            if fmt == "json"
            else b"synthetic-container-fixture"
        )
        name = f"{title} - en-US - Example-Voice - v{session['edition']}.{fmt}"
        (root / name).write_bytes(data)
        artifacts.append(
            {
                "file": name,
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    document = {
        "schema_version": 1,
        "session": session,
        "source_commit": base["source_commit"],
        "source_version": base["source_version"],
        "source_manifest_sha256": "d" * 64,
        "master_sha256": "e" * 64,
        "technical_receipt_sha256": artifacts[-1]["sha256"],
        "audio": audio,
        "artifacts": artifacts,
        "publication_approved": False,
    }
    path = root / "export-candidate.json"
    path.write_bytes(canonical_bytes(document))
    return path, document


class ImportTests(unittest.TestCase):
    def test_timed_lyrics_extension_is_strict_and_hash_bound(self):
        lyrics = {
            "verified": True,
            "compressed_audio_unchanged": True,
            "timed_event_count": 12,
            "mp3_id3_version": "2.3",
            "flac_lrc_sha256": "a" * 64,
            "transcript_sha256": "b" * 64,
        }
        operation = {
            "operation": "embed-measured-timed-lyrics-without-changing-audio-packets",
            "implementation_sha256": "c" * 64,
        }
        receipt = {"embedded_lyrics": lyrics, "post_export_operations": operation}
        assets = [
            {"format": "lrc", "sha256": "a" * 64},
            {"format": "txt", "sha256": "b" * 64},
        ]
        validate_lyrics_receipt({}, assets)
        validate_lyrics_receipt(receipt, assets)
        for field, value in (
            ("verified", False),
            ("compressed_audio_unchanged", False),
            ("timed_event_count", True),
            ("timed_event_count", 0),
            ("mp3_id3_version", "2.4"),
            ("flac_lrc_sha256", "d" * 64),
            ("private_path", "/private/secret"),
        ):
            changed = copy.deepcopy(receipt)
            changed["embedded_lyrics"][field] = value
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                validate_lyrics_receipt(changed, assets)
        for changed in (
            {"embedded_lyrics": lyrics},
            {"post_export_operations": operation},
            {**receipt, "post_export_operations": {**operation, "path": "/private"}},
            {
                **receipt,
                "post_export_operations": {**operation, "operation": "reencode"},
            },
        ):
            with self.assertRaises(ValueError):
                validate_lyrics_receipt(changed, assets)
        with self.assertRaises(ValueError):
            validate_lyrics_receipt(receipt, assets + [assets[0]])

    def test_timed_lyrics_receipt_is_preserved_in_public_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, document = candidate(root / "source")
            record = document["artifacts"][-1]
            receipt_path = path.parent / record["file"]
            technical = json.loads(receipt_path.read_text())
            hashes = {}
            for fmt in ("txt", "lrc"):
                name = str(Path(record["file"]).with_suffix("." + fmt))
                data = b"public measured lyrics"
                (path.parent / name).write_bytes(data)
                hashes[fmt] = hashlib.sha256(data).hexdigest()
                document["artifacts"].append(
                    {"file": name, "bytes": len(data), "sha256": hashes[fmt]}
                )
            technical["embedded_lyrics"] = {
                "verified": True,
                "compressed_audio_unchanged": True,
                "timed_event_count": 1,
                "mp3_id3_version": "2.3",
                "flac_lrc_sha256": hashes["lrc"],
                "transcript_sha256": hashes["txt"],
            }
            technical["post_export_operations"] = {
                "operation": "embed-measured-timed-lyrics-without-changing-audio-packets",
                "implementation_sha256": "c" * 64,
            }
            data = canonical_bytes(technical)
            receipt_path.write_bytes(data)
            record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            document["technical_receipt_sha256"] = record["sha256"]
            path.write_bytes(canonical_bytes(document))
            result = import_candidates(
                [path],
                root / "out",
                tag="audio-v1",
                edition=document["session"]["edition"],
            )
            verify_files(result, root / "out")
            self.assertEqual((root / "out" / record["file"]).read_bytes(), data)

    def test_verified_copy_and_preparation_first(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            function, doc = candidate(root / "function")
            preparation, _ = candidate(root / "preparation", True)
            output = root / "bundle"
            result = import_candidates(
                [function, preparation],
                output,
                tag="audio-v1",
                edition=doc["session"]["edition"],
            )
            verify_files(result, output)
            self.assertEqual(len(result["assets"]), 8)
            self.assertTrue(result["assets"][0]["filename"].startswith("00 - "))
            self.assertEqual(
                next(
                    a["session"]["function_id"]
                    for a in result["assets"]
                    if "session" in a
                ),
                None,
            )
            self.assertEqual(
                json.loads((output / "publication.json").read_text()), result
            )
            self.assertNotIn("approval", result)
            self.assertTrue(function.exists())

    def test_mixed_render_commits_retain_exact_receipt_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            function, original = candidate(root / "function")
            prep, later = candidate(root / "preparation", True)
            later["source_commit"] = "c" * 40
            receipt = later["artifacts"][-1]
            technical = json.loads((prep.parent / receipt["file"]).read_text())
            technical["source_commit"] = later["source_commit"]
            data = canonical_bytes(technical)
            (prep.parent / receipt["file"]).write_bytes(data)
            receipt.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            later["technical_receipt_sha256"] = receipt["sha256"]
            prep.write_bytes(canonical_bytes(later))
            edition = later["session"]["edition"]
            with self.assertRaisesRegex(ValueError, "explicit release source"):
                import_candidates([function, prep], root / "fail", tag="audio-mixed", edition=edition)
            manifest = import_candidates(
                [function, prep], root / "ok", tag="audio-mixed", edition=edition,
                release_source_commit="d" * 40,
            )
            self.assertEqual(manifest["source_commit"], "d" * 40)
            for item in manifest["assets"]:
                self.assertEqual(item["provenance"]["render_source_commit"],
                                 later["source_commit"] if item["filename"].startswith("00 - ") else original["source_commit"])
            release = _project_entry(manifest, manifest_digest(manifest), datetime.now(timezone.utc))
            self.assertEqual(validate_release(release), manifest)
            invalid = copy.deepcopy(manifest)
            invalid["assets"][0]["provenance"]["render_source_commit"] = "not-a-commit"
            with self.assertRaisesRegex(ValueError, "invalid render_source_commit"):
                validate_manifest(invalid)

    def test_tamper_duplicate_and_overwrite_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, doc = candidate(root / "source")
            kwargs = {"tag": "audio-v1", "edition": doc["session"]["edition"]}
            with self.assertRaisesRegex(ValueError, "duplicate"):
                import_candidates([path, path], root / "duplicate", **kwargs)
            self.assertFalse((root / "duplicate").exists())
            import_candidates([path], root / "existing", **kwargs)
            with self.assertRaisesRegex(ValueError, "already exists"):
                import_candidates([path], root / "existing", **kwargs)
            (path.parent / doc["artifacts"][0]["file"]).write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "size|checksum"):
                import_candidates([path], root / "tampered", **kwargs)
            self.assertFalse((root / "tampered").exists())

    def test_hidden_technical_fields_are_not_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, document = candidate(root / "source")
            record = document["artifacts"][-1]
            receipt = path.parent / record["file"]
            technical = json.loads(receipt.read_text())
            technical["private_reference"] = "/private/DO_NOT_PUBLISH.wav"
            data = canonical_bytes(technical)
            receipt.write_bytes(data)
            record.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
            document["technical_receipt_sha256"] = record["sha256"]
            path.write_bytes(canonical_bytes(document))
            with self.assertRaisesRegex(ValueError, "unknown fields"):
                import_candidates(
                    [path],
                    root / "out",
                    tag="audio-v1",
                    edition=document["session"]["edition"],
                )
            self.assertFalse((root / "out").exists())

    def test_identity_and_receipt_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, original = candidate(root / "source", True)
            for field, value, match in (
                ("technical_receipt_sha256", "f" * 64, "receipt hash"),
                ("publication_approved", True, "approval"),
            ):
                doc = copy.deepcopy(original)
                doc[field] = value
                path.write_bytes(canonical_bytes(doc))
                with self.assertRaisesRegex(ValueError, match):
                    import_candidates(
                        [path],
                        root / "out",
                        tag="audio-v1",
                        edition=doc["session"]["edition"],
                    )
            doc = copy.deepcopy(original)
            doc["session"]["function_id"] = "OCF-FND-001"
            path.write_bytes(canonical_bytes(doc))
            with self.assertRaisesRegex(ValueError, "function"):
                import_candidates(
                    [path],
                    root / "out",
                    tag="audio-v1",
                    edition=doc["session"]["edition"],
                )


if __name__ == "__main__":
    unittest.main()
