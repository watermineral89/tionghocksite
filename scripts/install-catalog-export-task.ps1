#Requires -Version 5.1
<#
.SYNOPSIS
  Install a Windows Task Scheduler job that exports the public catalog every 15 minutes.

.DESCRIPTION
  Run ONCE on the Matang server (as Administrator recommended):

    powershell -ExecutionPolicy Bypass -File scripts\install-catalog-export-task.ps1

  Task name: TiongHock-PublicCatalogExport
#>

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Runner = Join-Path $Root "scripts\run-catalog-export.ps1"
$TaskName = "TiongHock-PublicCatalogExport"

if (-not (Test-Path $Runner)) {
	throw "Missing runner: $Runner"
}

$action = New-ScheduledTaskAction `
	-Execute "powershell.exe" `
	-Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" `
	-WorkingDirectory $Root

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date.AddMinutes(1) `
	-RepetitionInterval (New-TimeSpan -Minutes 15) `
	-RepetitionDuration ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet `
	-AllowStartIfOnBatteries `
	-DontStopIfGoingOnBatteries `
	-StartWhenAvailable `
	-RunOnlyIfNetworkAvailable:$false `
	-MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
	-UserId $env:USERNAME `
	-LogonType Interactive `
	-RunLevel Limited

Register-ScheduledTask `
	-TaskName $TaskName `
	-Action $action `
	-Trigger $trigger `
	-Settings $settings `
	-Principal $principal `
	-Force | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "Runs every 15 minutes via: $Runner"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Ensure .env exists at $Root\.env"
Write-Host "  2. Test once:  powershell -File `"$Runner`""
Write-Host "  3. Set CATALOG_AUTO_PUSH=1 in .env if Matang should push to GitHub/Vercel"
Write-Host "  4. Task Scheduler → confirm task exists and last run result is 0x0"
