#!/usr/bin/env python3
"""Build compact, browser-loadable autocomplete shards from OffeneRegister.

The source JSONL contains officers and historical metadata that the UI does not
need.  This builder keeps only the company name and the minimum register fields,
groups records by the first two normalized characters, and writes deterministic
gzip-compressed JSON.  The generated data is discovery-only; OpenRegister still
performs the one official verification request when a check starts.
"""

from __future__ import annotations

import argparse
import bz2
import collections
import gzip
import json
import os
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path


SOURCE_DATE = "2019-02-05"
REGISTER_RE = re.compile(r"^\s*(.+?)\s+(HRA|HRB|PR|GnR|VR)\s*([0-9A-Za-z./-]+)\s*$", re.I)


def normalize(value: str) -> str:
    value = value.replace("ß", "ss").replace("ẞ", "SS")
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def shard_key(name: str) -> str:
    key = normalize(name)[:2]
    return (key + "__")[:2]


def clean(value: object, limit: int) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def record_from_company(company: dict) -> list[object] | None:
    name = clean(company.get("name"), 240)
    if len(normalize(name)) < 2:
        return None

    attrs = company.get("all_attributes") if isinstance(company.get("all_attributes"), dict) else {}
    native = clean(attrs.get("native_company_number"), 180)
    court = clean(attrs.get("registrar"), 100)
    register_type = clean(attrs.get("_registerArt"), 8)
    register_number = clean(attrs.get("_registerNummer"), 40)
    if native:
        match = REGISTER_RE.match(native)
        if match:
            court = court or clean(match.group(1), 100)
            register_type = register_type or clean(match.group(2), 8)
            register_number = register_number or clean(match.group(3), 40)

    if register_type.upper() == "GNR":
        register_type = "GnR"
    else:
        register_type = register_type.upper()

    city = clean(attrs.get("registered_office"), 100)
    status = clean(company.get("current_status"), 80).lower()
    active = status in {"currently registered", "active", "registered"}
    source_id = clean(company.get("company_number"), 100)
    return [name, city, register_type, register_number, court, active, source_id]


class WriterPool:
    def __init__(self, directory: Path, limit: int = 128):
        self.directory = directory
        self.limit = limit
        self.handles: collections.OrderedDict[str, object] = collections.OrderedDict()

    def write(self, key: str, record: list[object]) -> None:
        handle = self.handles.pop(key, None)
        if handle is None:
            handle = (self.directory / f"{key}.jsonl").open("a", encoding="utf-8", newline="\n")
        self.handles[key] = handle
        handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        if len(self.handles) > self.limit:
            _, oldest = self.handles.popitem(last=False)
            oldest.close()

    def close(self) -> None:
        for handle in self.handles.values():
            handle.close()
        self.handles.clear()


def build(source: Path, output: Path) -> dict:
    output.mkdir(parents=True, exist_ok=True)
    for old in output.glob("*.json.gz"):
        old.unlink()

    total = 0
    kept = 0
    malformed = 0
    unique_total = 0
    with tempfile.TemporaryDirectory(prefix="uj-offeneregister-") as tmp_name:
        tmp = Path(tmp_name)
        writers = WriterPool(tmp)
        with bz2.open(source, "rt", encoding="utf-8", errors="replace") as stream:
            for line in stream:
                total += 1
                try:
                    company = json.loads(line)
                except json.JSONDecodeError:
                    malformed += 1
                    continue
                record = record_from_company(company)
                if record is None:
                    continue
                writers.write(shard_key(str(record[0])), record)
                kept += 1
                if total % 250_000 == 0:
                    print(f"prebranih={total:,} uporabnih={kept:,}", flush=True)
        writers.close()

        shards = []
        for source_shard in sorted(tmp.glob("*.jsonl")):
            records: dict[str, list[object]] = {}
            with source_shard.open("r", encoding="utf-8") as rows:
                for line in rows:
                    record = json.loads(line)
                    dedupe = "|".join(str(value) for value in (record[0], record[2], record[3], record[4]))
                    existing = records.get(dedupe)
                    if existing is None or (record[5] and not existing[5]):
                        records[dedupe] = record
            ordered = sorted(
                records.values(),
                key=lambda row: (not bool(row[5]), normalize(str(row[0])), str(row[4]), str(row[3])),
            )
            unique_total += len(ordered)
            target = output / f"{source_shard.stem}.json.gz"
            with target.open("wb") as raw:
                with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as zipped:
                    payload = json.dumps(ordered, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
                    zipped.write(payload)
            shards.append({"key": source_shard.stem, "records": len(ordered), "bytes": target.stat().st_size})

    manifest = {
        "version": f"{SOURCE_DATE}-v1",
        "source": "OffeneRegister.de / OpenCorporates",
        "sourceUrl": "https://offeneregister.de/daten/",
        "license": "CC BY 4.0",
        "attributionUrl": "https://opencorporates.com/",
        "snapshotDate": SOURCE_DATE,
        "records": unique_total,
        "shards": shards,
    }
    (output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(
        f"koncano: vrstic={total:,} uporabnih={kept:,} enoličnih={unique_total:,} "
        f"okvarjenih={malformed:,} shardov={len(shards):,}",
        flush=True,
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Vir ne obstaja: {args.source}")
    build(args.source.resolve(), args.output.resolve())


if __name__ == "__main__":
    main()
