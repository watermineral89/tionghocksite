#Requires -Version 5.1
<#
.SYNOPSIS
  Export sanitized public-catalog.json from Matang SQL, optionally push to GitHub/Vercel.

.DESCRIPTION
  1. Loads .env from repo root
  2. Runs scripts/export-public-catalog.py
  3. If CATALOG_AUTO_PUSH=1, commits and pushes public/data/public-catalog.json

  Schedule this with Task Scheduler every 15 minutes (see install-catalog-export-task.ps1).
#>

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Import-DotEnv {
	param([string]$Path)
	if (-not (Test-Path $Path)) { return }
	Get-Content $Path | ForEach-Object {
		$line = $_.Trim()
		if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
		$parts = $line.Split("=", 2)
		$key = $parts[0].Trim()
		$val = $parts[1].Trim().Trim('"').Trim("'")
		if ($key) {
			[Environment]::SetEnvironmentVariable($key, $val, "Process")
		}
	}
}

Import-DotEnv (Join-Path $Root ".env")

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
	$python = Get-Command py -ErrorAction SilentlyContinue
}
if (-not $python) {
	throw "Python not found. Install Python 3 and ensure it is on PATH."
}

$logDir = Join-Path $Root "scripts\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logDir "catalog-export-$stamp.log"

function Write-Log([string]$Message) {
	$line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
	Write-Host $line
	Add-Content -Path $logFile -Value $line
}

Write-Log "Starting catalog export..."

$pyExe = $python.Source
& $pyExe (Join-Path $Root "scripts\export-public-catalog.py") "--out" (Join-Path $Root "public\data\public-catalog.json")
if ($LASTEXITCODE -ne 0) {
	Write-Log "Export FAILED (exit $LASTEXITCODE)"
	exit $LASTEXITCODE
}
Write-Log "Export OK"

$autoPush = ($env:CATALOG_AUTO_PUSH -as [string])
if ($autoPush -in @("1", "true", "yes", "TRUE", "YES")) {
	Write-Log "CATALOG_AUTO_PUSH enabled — syncing to git..."

	git add -- "public/data/public-catalog.json"
	$status = git status --porcelain -- "public/data/public-catalog.json"
	if (-not $status) {
		Write-Log "No catalog changes to push."
		exit 0
	}

	$msg = "chore: refresh public catalog export $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
	git commit -m $msg
	git push origin HEAD
	if ($LASTEXITCODE -ne 0) {
		Write-Log "git push FAILED (exit $LASTEXITCODE)"
		exit $LASTEXITCODE
	}
	Write-Log "Pushed catalog — Vercel will redeploy."
} else {
	Write-Log "CATALOG_AUTO_PUSH=0 — JSON updated locally only. Commit/push when ready."
}

Write-Log "Done."
exit 0
