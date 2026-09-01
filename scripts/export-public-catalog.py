#!/usr/bin/env python3
"""
Export a sanitized public catalog JSON for tionghock.com stock search.

Run on the Matang server (or any host with read-only AED_AED access) every 15 minutes.
This script MUST NOT write price, cost, OHB, memos, or sales fields to the output file.

Bucket rules (coarse availability):
  - in_stock : combined OHB >= 3
  - limited  : combined OHB 1–2
  - enquire  : combined OHB 0 or inactive item

Usage:
  pip install pyodbc python-dotenv
  set DB_SERVER=...
  set DB_DATABASE=AED_AED
  python scripts/export-public-catalog.py --out public/data/public-catalog.json

Deploy the generated JSON to Cloudflare Pages / R2 (replace /data/public-catalog.json).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Any

try:
    import pyodbc
except ImportError:
    print("Install pyodbc: pip install pyodbc", file=sys.stderr)
    sys.exit(1)

IN_STOCK_MIN = 3
LIMITED_MIN = 1

# Active sellable items only; OHB summed across locations for bucket (never exported).
EXPORT_SQL = """
SELECT
    RTRIM(i.ItemCode) AS sku,
    RTRIM(i.Description) AS name,
    RTRIM(ISNULL(i.Brand, '')) AS brand,
    RTRIM(ISNULL(i.AlternateCode, '')) AS altCode,
    RTRIM(ISNULL(i.Article, '')) AS article,
    RTRIM(ISNULL(u.UOM, 'PC')) AS uom,
    CAST(ISNULL(ohb.total_qty, 0) AS INT) AS total_ohb
FROM dbo.Item i
OUTER APPLY (
    SELECT TOP 1 RTRIM(uom.UOM) AS UOM
    FROM dbo.ItemUOM uom
    WHERE uom.ItemCode = i.ItemCode AND uom.UOM = i.BaseUOM
) u
OUTER APPLY (
    SELECT SUM(CAST(b.BalQty AS DECIMAL(18, 4))) AS total_qty
    FROM dbo.ItemBatchBalQty b
    WHERE b.ItemCode = i.ItemCode
) ohb
WHERE i.IsActive = 1
  AND RTRIM(i.ItemCode) <> ''
"""

BLOCKED_OUTPUT_KEYS = {
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
    if not all([server, user, password]):
        raise RuntimeError("Set DB_SERVER, DB_USERNAME, DB_PASSWORD")
    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
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
            "sku": str(row.get("sku") or "").strip(),
            "name": str(row.get("name") or "").strip(),
            "brand": str(row.get("brand") or "").strip(),
            "altCode": str(row.get("altCode") or "").strip(),
            "article": str(row.get("article") or "").strip(),
            "uom": str(row.get("uom") or "PC").strip() or "PC",
            "availability": availability_from_ohb(total_ohb),
        }
        if not item["sku"]:
            continue
        for key in item:
            if key.lower() in BLOCKED_OUTPUT_KEYS:
                raise RuntimeError(f"Blocked key in output: {key}")
        rows.append(item)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Export public catalog JSON (no sensitive fields)")
    parser.add_argument("--out", default="public/data/public-catalog.json", help="Output JSON path")
    args = parser.parse_args()

    tz = timezone(timedelta(hours=8))
    updated_at = datetime.now(tz).isoformat()

    with connect() as conn:
        items = fetch_rows(conn)

    payload = {"version": 1, "updatedAt": updated_at, "items": items}

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {len(items)} items -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
