import hashlib
import unittest

from catalog import release_entry
from catalog_contract import validate_release
from publication import (
    canonical_bytes,
    control_artifacts,
    manifest_digest,
    release_body,
    validate_manifest,
)
from refresh_catalog import build_catalog
from test_catalog import evidence
from test_publication import fixture
from test_validate_site import empty_catalog


class ChangelogTests(unittest.TestCase):
    def test_legacy_body_remains_exact(self):
        manifest = fixture()
        self.assertEqual(
            release_body(manifest),
            "OCF publication manifest SHA-256: " + manifest_digest(manifest),
        )
        self.assertNotIn(b"## Changes", control_artifacts(manifest)["release-notes.md"])

    def test_changelog_is_hash_bound_and_roundtrips_catalog(self):
        manifest = fixture()
        old = manifest_digest(manifest)
        manifest["changelog"] = [
            "Adds the approved complete audio edition.",
            "Preserves original render provenance.",
        ]
        self.assertNotEqual(old, manifest_digest(manifest))
        receipt, remote = evidence(manifest)
        remote["author"] = {"login": "meramsey"}
        entry = release_entry(manifest, receipt, remote)
        validate_release(entry)
        self.assertEqual(entry["changelog"], manifest["changelog"])
        self.assertIn(b"## Changes", control_artifacts(manifest)["release-notes.md"])
        records = {
            a["remote_filename"]: (a["size_bytes"], a["sha256"])
            for a in manifest["assets"]
        }
        records.update(
            {
                name: (len(data), hashlib.sha256(data).hexdigest())
                for name, data in control_artifacts(manifest).items()
            }
        )
        assets = [
            {
                "id": i,
                "name": name,
                "size": size,
                "digest": "sha256:" + digest,
                "state": "uploaded",
            }
            for i, (name, (size, digest)) in enumerate(records.items(), 1)
        ]
        catalog, ignored = build_catalog(
            empty_catalog(),
            [remote],
            lambda _: assets,
            lambda _: canonical_bytes(manifest),
        )
        self.assertFalse(ignored)
        self.assertEqual(catalog["releases"][0]["changelog"], manifest["changelog"])
        for body in (
            remote["body"] + "\nUnexpected text",
            "OCF publication manifest SHA-256: " + manifest_digest(manifest),
        ):
            changed = dict(remote, body=body)
            with self.assertRaises(ValueError):
                build_catalog(
                    empty_catalog(),
                    [changed],
                    lambda _: assets,
                    lambda _: canonical_bytes(manifest),
                )

    def test_invalid_changelogs_rejected(self):
        for value in (
            [],
            "text",
            [""],
            ["private\npath"],
            [1],
            ["x" * 1001],
            ["x"] * 33,
        ):
            manifest = fixture()
            manifest["changelog"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_manifest(manifest)
