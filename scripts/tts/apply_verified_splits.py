#!/usr/bin/env python3
"""Re-cut clips from cached raw TTS takes using hand-verified split points.

Usage (from the repo root): python scripts/tts/apply_verified_splits.py [--dry-run]

Reads scripts/tts/verified-splits.json ({batch: {lineId: {start, end, heard}}}),
re-encodes each listed clip from VOICE_RAW_DIR/{batch}.wav with the same
encoder as generate_voice.py, and records the line's text hash. It makes no API
calls and needs no key. Use it when the automatic splitter put a sentence
boundary in the wrong place: listen to the raw take, fix the intervals in the
JSON, and re-run.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_voice as g  # noqa: E402

SPLITS = Path(__file__).resolve().parent / "verified-splits.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    splits = json.loads(SPLITS.read_text(encoding="utf-8"))
    lines = {l["id"]: l for l in g.collect_lines()}
    hashes = g.load_hashes()
    failed = []
    for batch, entries in splits.items():
        if batch.startswith("_"):
            continue
        raw = g.RAW_DIR / f"{batch}.wav"
        if not raw.exists():
            g.log(f"missing raw take {raw}, skipping {batch}")
            failed.append(batch)
            continue
        for line_id, cut in entries.items():
            line = lines.get(line_id)
            if line is None:
                g.log(f"unknown line {line_id}")
                failed.append(line_id)
                continue
            dest = g.ROOT / "public" / line["path"]
            g.log(f"{line_id}: {cut['start']:.2f}-{cut['end']:.2f}s -> {line['path']}")
            if args.dry_run:
                continue
            g.encode_clip(raw, cut["start"], cut["end"], dest)
            stats = g.clip_stats(dest)
            if not g.clip_is_plausible(stats):
                g.log(f"  REJECT {line_id}: dur={stats['duration']:.2f}s rms={stats['rms']:.0f}")
                failed.append(line_id)
                continue
            hashes[line_id] = g.text_hash(line["text"])
    if not args.dry_run:
        g.propagate_shared(list(lines.values()), hashes)
        g.HASHES.write_text(json.dumps(dict(sorted(hashes.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        g.write_manifest(list(lines.values()))
    g.log(f"failed: {failed or 'none'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
