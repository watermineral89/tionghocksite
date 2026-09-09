#!/usr/bin/env python3
"""
Export a sanitized public catalog JSON for /parts stock search.

Run on the Matang server (SQL / AutoCount host) every 15 minutes.
Public fields ONLY: name, brand, availability.
Never exports: SKU, price, cost, OHB, memos, notes.

Bucket rules:
  - in_stock : combined OHB >= 3
  - limited  : combined OHB 1–2
  - enquire  : combined OHB 0

Usage (Matang):
  1. Copy .env.example → .env and fill DB_* values
  2. pip install -r scripts/requirements-catalog.txt
  3. python scripts/export-public-catalog.py
  4. Or run: powershell -File scripts/run-catalog-export.ps1
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()

try:
    import pyodbc
except ImportError:
    print("Install deps: pip install -r scripts/requirements-catalog.txt", file=sys.stderr)
    sys.exit(1)

IN_STOCK_MIN = 3
LIMITED_MIN = 1

# Active sellable items only; OHB summed across locations for bucket (never exported).
EXPORT_SQL = """
SELECT
    RTRIM(i.Description) AS name,
    RTRIM(ISNULL(i.Brand, '')) AS brand,
    CAST(ISNULL(ohb.total_qty, 0) AS INT) AS total_ohb
FROM dbo.Item i
OUTER APPLY (
    SELECT SUM(CAST(b.BalQty AS DECIMAL(18, 4))) AS total_qty
    FROM dbo.ItemBatchBalQty b
    WHERE b.ItemCode = i.ItemCode
) ohb
WHERE i.IsActive = 1
  AND RTRIM(ISNULL(i.Description, '')) <> ''
"""

BLOCKED_OUTPUT_KEYS = {
    "sku",
    "itemcode",
    "altcode",
    "article",
    "uom",
    "price",
    "netcost",
    "cost",
    "ohb",
    "total_ohb",
    "memo",
    "note",
    "further_desc",
}


def availability_from_ohb(total: int) -> str:
    if total >= IN_STOCK_MIN:
        return "in_stock"
    if total >= LIMITED_MIN:
        return "limited"
    return "enquire"


def connect():
    server = os.environ.get("DB_SERVER") or os.environ.get("DB_SERVER_MATANG")
    database = os.environ.get("DB_DATABASE", "AED_AED")
    user = os.environ.get("DB_USERNAME")
    password = os.environ.get("DB_PASSWORD")
    driver = os.environ.get("DB_ODBC_DRIVER", "ODBC Driver 17 for SQL Server")
    trusted = (os.environ.get("DB_TRUSTED_CONNECTION") or "").strip().lower() in {
        "1",
        "true",
        "yes",
    }

    if not server:
        raise RuntimeError("Set DB_SERVER in .env")

    if trusted:
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};DATABASE={database};"
            "Trusted_Connection=yes;TrustServerCertificate=yes;"
        )
    else:
        if not user or not password:
            raise RuntimeError("Set DB_USERNAME and DB_PASSWORD in .env (or DB_TRUSTED_CONNECTION=true)")
        conn_str = (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};DATABASE={database};UID={user};PWD={password};"
            "TrustServerCertificate=yes;"
        )
    return pyodbc.connect(conn_str, timeout=30)


def fetch_rows(conn) -> list[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(EXPORT_SQL)
    columns = [c[0] for c in cur.description]
    rows = []
    for record in cur.fetchall():
        row = dict(zip(columns, record))
        total_ohb = int(row.pop("total_ohb", 0) or 0)
        item = {
            "name": str(row.get("name") or "").strip(),
            "brand": str(row.get("brand") or "").strip(),
            "availability": availability_from_ohb(total_ohb),
        }
        if not item["name"]:
            continue
        for key in item:
            if key.lower() in BLOCKED_OUTPUT_KEYS:
                raise RuntimeError(f"Blocked key in output: {key}")
        rows.append(item)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Export public catalog JSON (name + brand + availability only)")
    parser.add_argument(
        "--out",
        default=str(ROOT / "public" / "data" / "public-catalog.json"),
        help="Output JSON path",
    )
    args = parser.parse_args()

    tz = timezone(timedelta(hours=8))
    updated_at = datetime.now(tz).isoformat()

    with connect() as conn:
        items = fetch_rows(conn)

    payload = {"version": 1, "updatedAt": updated_at, "items": items}

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"Wrote {len(items)} items -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
