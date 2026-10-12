#!/usr/bin/env python3
"""Create QR codes in bulk from a CSV file and save one SVG per row.

The CSV needs a header row with at least `external_id` and `target_url`; `name` and `folder` are optional.
Up to 100 codes are created per request. Rows are matched by external_id, so re-running the script after a
failure creates only what is missing.

Usage:  QR_TOKEN=qrs_... python3 python-bulk-from-csv.py links.csv out/
Needs:  Python 3.9+, standard library only.
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = os.environ.get("QR_API", "https://qrmaker.ai/api/v1")
TOKEN = os.environ.get("QR_TOKEN") or sys.exit("Set QR_TOKEN to an API token from Settings > API Tokens")
BATCH = 100


def post(path: str, payload: dict) -> dict:
    """POST JSON, retrying on 429 and 5xx with the delay the server asks for."""
    data = json.dumps(payload).encode()
    for attempt in range(1, 5):
        req = urllib.request.Request(
            API + path, data=data, method="POST",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                return json.load(res)
        except urllib.error.HTTPError as err:
            if err.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(int(err.headers.get("Retry-After") or attempt * 2))
                continue
            body = json.loads(err.read() or b"{}")
            sys.exit(f"Request failed: {err.code} {body.get('code')}: {body.get('error')}")
    raise RuntimeError("unreachable")


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rows = list(csv.DictReader(open(sys.argv[1], newline="", encoding="utf-8-sig")))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)

    created = existing = failed = 0
    for start in range(0, len(rows), BATCH):
        chunk = rows[start:start + BATCH]
        items = [
            {k: v for k, v in {
                "external_id": r["external_id"].strip(),
                "target_url": r["target_url"].strip(),
                "name": (r.get("name") or "").strip() or None,
                "folder": (r.get("folder") or "").strip() or None,
            }.items() if v}
            for r in chunk
        ]
        result = post("/qrcodes/batch?include=svg", {"items": items})
        # One result per input row, in the same order. The batch itself returns 200 even if some rows fail.
        for row, item in zip(chunk, result["data"]):
            if item["status"] in (200, 201):
                code = item["data"]
                (out / f"{code['external_id']}.svg").write_text(code["svg"], encoding="utf-8")
                created += item["status"] == 201
                existing += item["status"] == 200
            else:
                failed += 1
                err = item.get("error", {})
                print(f"  row {row['external_id']}: {err.get('code')} {err.get('error')}", file=sys.stderr)
        print(f"{min(start + BATCH, len(rows))}/{len(rows)} rows processed")

    print(f"Done: {created} created, {existing} already existed, {failed} failed. SVG files are in {out}/")


if __name__ == "__main__":
    main()
