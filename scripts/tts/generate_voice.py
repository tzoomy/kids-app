#!/usr/bin/env python3
"""Render the app's voice lines with Gemini TTS (gemini-3.8-flash-tts, voice Leda).

Usage (from the repo root, with GEMINI_API_KEY in the environment):
    python scripts/tts/generate_voice.py [--dry-run] [--max-requests N] [--resplit-only]

- Line list comes from src/content/games/animal-restaurant.json (food prompts and
  thanks lines, en + fr) and src/content/voice-lines-he.json (Hebrew guidance).
- Lines are batched (one API request per batch, free tier is ~3 RPM / ~10 RPD),
  separated by pause tags, then split locally on the n-1 longest silences.
- Each clip is trimmed, loudness-normalized and encoded as mono 24 kHz 48 kbps MP3
  into public/audio/{lang}/. src/content/audio-manifest.json is rewritten to list only
  clips that exist, so missing lines fall back to device TTS.
- Raw API takes are cached outside the repo (VOICE_RAW_DIR, default
  ../voice-p1/raw) so a re-split never needs another request.
- Never prints the API key.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "src/content/games/animal-restaurant.json"
HE_LINES = ROOT / "src/content/voice-lines-he.json"
MANIFEST = ROOT / "src/content/audio-manifest.json"
AUDIO_DIR = ROOT / "public/audio"
RAW_DIR = Path(os.environ.get("VOICE_RAW_DIR", ROOT.parent / "voice-p1" / "raw"))
REPORT = RAW_DIR.parent / "report.json"

MODEL_ID = "gemini-3.8-flash-tts"
VOICE = "Leda"
STYLE = "warm, cheerful, slow and clear, speaking to a 2 to 5 year old"
LANG_CODES = {"en": "en-US", "fr": "fr-FR", "he": "he-IL"}
PAUSE_TAG = "<long pause>"
BATCH_MAX = {"en": 16, "fr": 16, "he": 15}
SLEEP_BETWEEN_S = 25
SAMPLE_RATE = 24000


def log(msg: str) -> None:
    print(msg, flush=True)


def redact(text: str) -> str:
    key = os.environ.get("GEMINI_API_KEY") or ""
    text = re.sub(r"AIza[0-9A-Za-z_-]{20,}", "[REDACTED]", text or "")
    return text.replace(key, "[REDACTED]") if key else text


# ---------------------------------------------------------------- line list

def food_slug(item_id: str, count: str) -> str:
    return f"{item_id}-{count}"


def collect_lines() -> list[dict]:
    content = json.loads(CONTENT.read_text(encoding="utf-8"))
    lines: list[dict] = []
    for lang in ("en", "fr"):
        for item in content["items"]:
            for count, text in item["prompts"].get(lang, {}).items():
                lines.append({
                    "id": f"food.{item['id']}.{count}.{lang}",
                    "lang": lang,
                    "text": text,
                    "path": f"audio/{lang}/{food_slug(item['id'], count)}.mp3",
                })
        for i, text in enumerate(content["thanks"][lang]):
            lines.append({"id": f"thanks.{lang}.{i}", "lang": lang, "text": text, "path": f"audio/{lang}/thanks-{i}.mp3"})
    he = json.loads(HE_LINES.read_text(encoding="utf-8"))
    for key, text in he.items():
        if key.startswith("_"):
            continue
        lines.append({"id": f"he.{key}", "lang": "he", "text": text, "path": f"audio/he/{re.sub(r'([a-z])([A-Z])', r'\1-\2', key).replace('.', '-').lower()}.mp3"})
    return lines


def make_batches(lines: list[dict]) -> list[list[dict]]:
    batches = []
    for lang in ("en", "fr", "he"):
        group = [l for l in lines if l["lang"] == lang]
        size = BATCH_MAX[lang]
        n = -(-len(group) // size)
        per = -(-len(group) // n) if n else 0
        for i in range(n):
            batches.append(group[i * per:(i + 1) * per])
    return [b for b in batches if b]


def batch_key(batch: list[dict]) -> str:
    h = hashlib.sha1(json.dumps([MODEL_ID, VOICE, STYLE, [l["text"] for l in batch]], ensure_ascii=False).encode()).hexdigest()[:10]
    return f"{batch[0]['lang']}-{h}"


# ---------------------------------------------------------------- API

def request_audio(batch: list[dict]) -> bytes:
    from google import genai
    from google.genai import types

    client = genai.Client(http_options=types.HttpOptions(api_version="v1beta"))
    content = []
    for i, line in enumerate(batch):
        text = line["text"] if i == len(batch) - 1 else f"{line['text']} {PAUSE_TAG}"
        content.append({"type": "text", "text": text, "annotations": [{"type": "speech_metadata", "style": STYLE}]})
    interaction = client.interactions.create(
        model=MODEL_ID,
        api_version="v1beta",
        input=[{"type": "user_input", "content": content}],
        response_format={"type": "audio", "mime_type": "audio/wav", "sample_rate": SAMPLE_RATE},
        generation_config={"speech_config": [{"voice": VOICE, "language": LANG_CODES[batch[0]["lang"]]}]},
    )
    return extract_audio(interaction)


def extract_audio(obj) -> bytes:
    import base64

    def walk(o, depth=0):
        if depth > 8 or o is None:
            return None
        if isinstance(o, (bytes, bytearray)) and len(o) > 1000:
            return bytes(o)
        if isinstance(o, str) and len(o) > 1000:
            try:
                return base64.b64decode(o)
            except Exception:
                return None
        if isinstance(o, dict):
            for k in ("data", "audio", "inline_data", "outputs", "output", "content", "parts"):
                if k in o:
                    r = walk(o[k], depth + 1)
                    if r:
                        return r
            for v in o.values():
                r = walk(v, depth + 1)
                if r:
                    return r
        if isinstance(o, (list, tuple)):
            for v in o:
                r = walk(v, depth + 1)
                if r:
                    return r
        if hasattr(o, "model_dump"):
            return walk(o.model_dump(), depth + 1)
        return None

    data = walk(obj)
    if not data:
        raise RuntimeError("no audio found in response")
    return data


def save_wav(data: bytes, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if data[:4] == b"RIFF":
        path.write_bytes(data)
        return
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(data)


# ---------------------------------------------------------------- splitting

def ffmpeg(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr)


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as wf:
        return wf.getnframes() / float(wf.getframerate())


def silences(path: Path, noise_db: str = "-38dB", min_dur: float = 0.18) -> list[tuple[float, float]]:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", f"silencedetect=noise={noise_db}:d={min_dur}", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = p.stderr
    starts = [float(x) for x in re.findall(r"silence_start:\s*(-?[0-9.]+)", txt)]
    ends = [float(x) for x in re.findall(r"silence_end:\s*([0-9.]+)", txt)]
    dur = wav_duration(path)
    out = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else dur
        out.append((max(0.0, s), e))
    return out


def split_points(path: Path, n: int, weights: list[float] | None = None) -> tuple[list[tuple[float, float]], float]:
    """Return n speech intervals and a confidence score.

    Chooses n-1 internal silences with dynamic programming: prefer long silences
    (the model's inter-line pauses) while keeping each segment's duration close to
    what its text length predicts. Short intra-line pauses ("Yummy! Thank you!")
    therefore do not get picked just because they happen to be long.
    """
    import math

    dur = wav_duration(path)
    sil = silences(path)
    lead = sil[0][1] if sil and sil[0][0] <= 0.05 else 0.0
    tail = sil[-1][0] if sil and sil[-1][1] >= dur - 0.05 else dur
    cands = [s for s in sil if s[0] > lead + 0.05 and s[1] < tail - 0.05]
    m = len(cands)
    if m < n - 1:
        return [], 0.0
    weights = weights or [1.0] * n
    top = sorted((e - s for s, e in cands), reverse=True)[: n - 1]
    rate = ((tail - lead) - sum(top)) / sum(weights)
    A, B = 6.0, 1.0

    def seg_cost(i: int, start: float, end: float) -> float:
        d = max(end - start, 0.05)
        return A * math.log(d / (weights[i] * rate)) ** 2

    INF = float("inf")
    # best[k][j]: cost with segments 0..k ending at candidate j (segment k ends at cands[j] start)
    best = [[INF] * m for _ in range(n - 1)]
    back = [[-1] * m for _ in range(n - 1)]
    for j in range(m):
        best[0][j] = seg_cost(0, lead, cands[j][0]) - B * math.log(cands[j][1] - cands[j][0])
    for k in range(1, n - 1):
        for j in range(k, m):
            for i in range(k - 1, j):
                if best[k - 1][i] == INF:
                    continue
                c = best[k - 1][i] + seg_cost(k, cands[i][1], cands[j][0]) - B * math.log(cands[j][1] - cands[j][0])
                if c < best[k][j]:
                    best[k][j], back[k][j] = c, i
    if n == 1:
        return [(lead, tail)], 99.0
    final = [(best[n - 2][j] + seg_cost(n - 1, cands[j][1], tail), j) for j in range(m) if best[n - 2][j] < INF]
    if not final:
        return [], 0.0
    final.sort()
    _, j = final[0]
    chosen = []
    for k in range(n - 2, -1, -1):
        chosen.append(cands[j])
        j = back[k][j]
    chosen.reverse()
    bounds = [lead] + [x for s in chosen for x in s] + [tail]
    intervals = [(bounds[2 * i], bounds[2 * i + 1]) for i in range(n)]
    margin = (final[1][0] - final[0][0]) if len(final) > 1 else 99.0
    return intervals, margin

def text_weight(text: str) -> float:
    return len(re.sub(r"[^\w]", "", text)) + 2


def encode_clip(src: Path, start: float, end: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    s = max(0.0, start - 0.06)
    e = end + 0.10
    ffmpeg(["-i", str(src), "-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-af",
            "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "48k", str(dest)])


# ---------------------------------------------------------------- main

def write_manifest(lines: list[dict]) -> int:
    manifest = {"_comment": "lineId -> path under public/ (generated by scripts/tts/generate_voice.py; Gemini TTS gemini-3.8-flash-tts, voice Leda). Only clips that exist are listed; anything missing falls back to device TTS. lineId formats: food.{id}.{count}.{lang}, thanks.{lang}.{index}, he.{key}."}
    n = 0
    for l in lines:
        if (ROOT / "public" / l["path"]).exists():
            manifest[l["id"]] = l["path"]
            n += 1
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--resplit-only", action="store_true")
    ap.add_argument("--max-requests", type=int, default=8)
    ap.add_argument("--min-conf", type=float, default=0.0)
    args = ap.parse_args()

    lines = collect_lines()
    batches = make_batches(lines)
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {"requests": []}
    log(f"{len(lines)} lines in {len(batches)} batches")
    if args.dry_run:
        for b in batches:
            log(f"  {batch_key(b)}: {len(b)} lines, first={b[0]['id']}")
        return 0

    used = 0
    for b in batches:
        key = batch_key(b)
        raw = RAW_DIR / f"{key}.wav"
        if all((ROOT / "public" / l["path"]).exists() for l in b) and not args.resplit_only:
            log(f"skip {key}: all clips exist")
            continue
        if not raw.exists():
            if args.resplit_only:
                log(f"missing raw {key}, skipping (resplit-only)")
                continue
            if used >= args.max_requests:
                log(f"request budget reached, leaving {key} for later")
                continue
            if used:
                time.sleep(SLEEP_BETWEEN_S)
            log(f"request {used + 1}: {key} ({len(b)} lines)")
            used += 1
            entry = {"batch": key, "lines": len(b), "at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
            try:
                save_wav(request_audio(b), raw)
                entry["ok"] = True
            except Exception as exc:  # noqa: BLE001
                msg = redact(str(exc))
                entry.update(ok=False, error=msg[:500])
                report["requests"].append(entry)
                REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))
                log(f"ERROR {key}: {msg[:400]}")
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                    log("quota reached, stopping requests")
                    break
                continue
            report["requests"].append(entry)
            REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False))

        intervals, conf = split_points(raw, len(b), [text_weight(l['text']) for l in b])
        if not intervals:
            log(f"SPLIT FAILED {key}: not enough pauses")
            continue
        durs = [e - s for s, e in intervals]
        weights = [text_weight(l["text"]) for l in b]
        rate = sum(durs) / sum(weights)
        ratios = [d / (w * rate) for d, w in zip(durs, weights)]
        bad = [i for i, r in enumerate(ratios) if r < 0.6 - 2 / weights[i] or r > 1.65 + 6 / weights[i]]  # short lines vary more
        log(f"{key}: conf={conf:.2f} ratios={[round(r, 2) for r in ratios]}")
        if conf < args.min_conf or bad:
            log(f"SPLIT UNSURE {key}: conf={conf:.2f} bad={[b[i]['id'] for i in bad]} — not publishing this batch")
            continue
        for l, (s, e) in zip(b, intervals):
            encode_clip(raw, s, e, ROOT / "public" / l["path"])
    n = write_manifest(lines)
    log(f"requests used this run: {used}; clips in manifest: {n}/{len(lines)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
