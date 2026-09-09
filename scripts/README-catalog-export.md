# Public catalog export (Matang → website)

Option A pipeline: keep AutoCount / SQL / Tailscale **private**.  
Export a sanitized JSON every 15 minutes. The website `/parts` search reads only that file.

## What visitors can see

| Field | Public? |
|---|---|
| name | yes |
| brand | yes |
| availability (`in_stock` / `limited` / `enquire`) | yes |
| SKU, price, cost, OHB, memos | **never** |

## One-time setup on Matang server

### 1. Prerequisites

- Python 3.10+
- [ODBC Driver 17 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
- This git repo cloned on Matang (same folder you use for the site)
- SQL login with **read-only** access to `AED_AED` (recommended), or Windows trusted auth

### 2. Install Python packages

```powershell
cd C:\path\to\TiongHockSite
pip install -r scripts\requirements-catalog.txt
```

### 3. Create `.env`

```powershell
copy .env.example .env
notepad .env
```

Fill in:

```env
DB_SERVER=localhost
DB_DATABASE=AED_AED
DB_USERNAME=catalog_readonly
DB_PASSWORD=********

# Set to 1 so Matang auto-pushes catalog to GitHub → Vercel redeploys
CATALOG_AUTO_PUSH=1
```

For Windows SQL auth instead:

```env
DB_TRUSTED_CONNECTION=true
```

### 4. Test once

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-catalog-export.ps1
```

You should see: `Wrote N items -> ...\public\data\public-catalog.json`

Then open local site `/parts` and search a brand (e.g. KYB).

### 5. Schedule every 15 minutes

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-catalog-export-task.ps1
```

This creates Task Scheduler job: **TiongHock-PublicCatalogExport**

## How Vercel stays updated

If `CATALOG_AUTO_PUSH=1`:

1. Export writes `public/data/public-catalog.json`
2. Script commits that file only
3. `git push` → GitHub → Vercel rebuilds
4. Live `/parts` search uses the new JSON

If `CATALOG_AUTO_PUSH=0`:

- JSON updates on Matang only
- You commit/push manually when ready

## Logs

Exports write to `scripts/logs/catalog-export-*.log`

## Security checklist

- [ ] `.env` is **not** committed (gitignored)
- [ ] SQL user is **read-only**
- [ ] Tailscale / AutoCount API stay private — website never calls them
- [ ] Public JSON has no SKU / price / OHB

## Troubleshooting

| Problem | Fix |
|---|---|
| `pyodbc` import error | `pip install -r scripts/requirements-catalog.txt` |
| ODBC driver not found | Install ODBC Driver 17; or set `DB_ODBC_DRIVER` |
| Login failed | Check `DB_SERVER` / credentials; try `DB_TRUSTED_CONNECTION=true` |
| Empty catalog | Confirm `dbo.Item` + `dbo.ItemBatchBalQty` exist in `AED_AED` |
| git push fails | On Matang, log in to GitHub (`gh auth login` or credential manager) |
