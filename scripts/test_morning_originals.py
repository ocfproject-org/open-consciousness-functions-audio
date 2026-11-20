"""Source receipt and boundary tests for the reviewed My Morning catalog."""

import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from morning_originals import load_catalog, validate_catalog, verify_build


class MorningOriginalsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        # macOS temporary roots use /var -> /private/var. Fixtures name the
        # physical root; the separate resource-symlink rejection stays intact.
        self.root = Path(self.temp.name).resolve()
        self.doc = load_catalog()
        self.functions = []
        records = {}
        for row in self.doc["rows"]:
            resource = "locales/en-US/" + row["repo_file"]
            fid = "-".join(
                row["legacy_command_id"].split("-")[0:1]
                + row["legacy_command_id"].split("-")[2:4]
            )
            record = records.setdefault(
                resource,
                {
                    "function_id": fid,
                    "record_metadata": {
                        "legacy": {
                            "source_system": "Monroe H-PLUS",
                            "name": row["title"],
                            "commands": [],
                            "command_ids": [],
                        }
                    },
                },
            )
            record["record_metadata"]["legacy"]["commands"].append(row["notation"])
            record["record_metadata"]["legacy"]["command_ids"].append(
                row["legacy_command_id"]
            )
        for resource, record in records.items():
            path = self.root / resource
            path.parent.mkdir(parents=True, exist_ok=True)
            raw = json.dumps(record).encode()
            path.write_bytes(raw)
            self.functions.append(
                {
                    "function_id": record["function_id"],
                    "canonical_resource": resource,
                    "canonical_resource_sha256": hashlib.sha256(raw).hexdigest(),
                }
            )

    def validate(self, doc=None):
        return validate_catalog(
            doc or self.doc, self.functions, self.root, self.doc["source_commit"]
        )

    def test_reviewed_coverage_and_embedded_model_match(self):
        self.validate()
        verify_build(
            self.functions,
            self.root,
            self.doc["source_commit"],
            Path(__file__).parent.parent / "site",
        )
        self.assertEqual(len(self.doc["excluded"]), 15)
        self.assertEqual(
            sum(r["role"] != "historical-function-or-mode" for r in self.doc["rows"]), 5
        )

    def test_source_pin_hash_and_resource_membership_fail_closed(self):
        with self.assertRaises(ValueError):
            validate_catalog(self.doc, self.functions, self.root, "a" * 40)
        with self.assertRaises(ValueError):
            validate_catalog(
                self.doc, self.functions[1:], self.root, self.doc["source_commit"]
            )
        path = self.root / self.functions[0]["canonical_resource"]
        path.write_bytes(path.read_bytes() + b" ")
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            self.validate()

    def test_lookups_and_current_commands_cannot_substitute_for_legacy(self):
        function = self.functions[0]
        path = self.root / function["canonical_resource"]
        record = json.loads(path.read_text())
        record["record_metadata"]["historical_lookup"] = record["record_metadata"].pop(
            "legacy"
        )
        raw = json.dumps(record).encode()
        path.write_bytes(raw)
        function["canonical_resource_sha256"] = hashlib.sha256(raw).hexdigest()
        with self.assertRaisesRegex(ValueError, "legacy source"):
            self.validate()

    def test_role_source_identity_and_coverage_changes_are_rejected(self):
        for key, value in [
            ("notation", "PLUS-CLEAR"),
            ("id", self.doc["rows"][1]["id"]),
            ("role", "close"),
            ("repo_file", "../../private.yaml"),
            ("text", ""),
        ]:
            with self.subTest(key=key):
                changed = copy.deepcopy(self.doc)
                changed["rows"][0][key] = value
                with self.assertRaises(ValueError):
                    self.validate(changed)
        changed = copy.deepcopy(self.doc)
        changed["sources"][0] = "https://example.com/unreviewed"
        with self.assertRaises(ValueError):
            self.validate(changed)
        changed = copy.deepcopy(self.doc)
        changed["rows"].pop()
        with self.assertRaises(ValueError):
            self.validate(changed)

    def test_symlink_resource_rejected_even_with_matching_bytes(self):
        path = self.root / self.functions[0]["canonical_resource"]
        target = self.root / "copy.yaml"
        target.write_bytes(path.read_bytes())
        path.unlink()
        path.symlink_to(target)
        with self.assertRaisesRegex(ValueError, "symlink"):
            self.validate()
