$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$delivery = Join-Path $root '.target/.distribution/app'
$sandbox = Join-Path $root '.target/test/install'
if (Test-Path $sandbox) { throw 'Test sandbox already exists' }
$originalLocalAppData = $env:LOCALAPPDATA
$env:LOCALAPPDATA = $sandbox
$registry = @{ Value = $null; Created = $false }
# Only intercept this product's registry key. Filesystem operations stay real.
function Get-Item {
  param([string]$Path, [string]$ErrorAction)
  if ($Path -eq 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\cc.cd.kedit.folder_paste') {
    if ($registry.Value) {
      $item = [pscustomobject]@{ Value = $registry.Value }
      $item | Add-Member ScriptMethod GetValue { param($name) $this.Value }
      return $item
    }
    return
  }
  Microsoft.PowerShell.Management\Get-Item -Path $Path -ErrorAction $ErrorAction
}
function New-Item {
  param([string]$Path, [string]$ItemType, [switch]$Force)
  if ($Path.StartsWith('HKCU:')) { $registry.Created = $true; return }
  Microsoft.PowerShell.Management\New-Item -Path $Path -ItemType $ItemType -Force:$Force
}
function Set-Item {
  param([string]$Path, [string]$Value)
  if (!$Path.StartsWith('HKCU:') -or !$registry.Created) { throw 'Unexpected registry write' }
  $registry.Value = $Value
}
function Remove-Item {
  param([string]$Path, [string]$LiteralPath, [switch]$Recurse, [switch]$Force)
  if ($Path -and $Path.StartsWith('HKCU:')) { $registry.Value = $null; return }
  if ($LiteralPath) { Microsoft.PowerShell.Management\Remove-Item -LiteralPath $LiteralPath -Recurse:$Recurse -Force:$Force }
  else { Microsoft.PowerShell.Management\Remove-Item -Path $Path -Recurse:$Recurse -Force:$Force }
}
try {
  & (Join-Path $delivery 'install.ps1')
  $homePath = Join-Path $sandbox 'KEDIT/FolderPaste'
  $manifestPath = Join-Path $homePath 'cc.cd.kedit.folder_paste.json'
  if ($registry.Value -ne $manifestPath) { throw 'Wrong host registration' }
  $bytes = [IO.File]::ReadAllBytes($manifestPath)
  if ($bytes[0] -ne 123) { throw 'Native manifest must be BOM-free JSON' }
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.allowed_origins.Count -ne 1 -or $manifest.allowed_origins[0] -notmatch '^chrome-extension://[a-p]{32}/$') { throw 'Invalid extension allowlist' }
  if (!(Test-Path $manifest.path)) { throw 'Missing installed executable' }
  & (Join-Path $delivery 'install.ps1') # Reinstall is idempotent.
  $registry.Value = 'C:\other\manifest.json'
  $rejected = $false
  try { & (Join-Path $delivery 'install.ps1') } catch { $rejected = $true }
  if (!$rejected -or $registry.Value -ne 'C:\other\manifest.json') { throw 'Foreign registration overwritten' }
  $registry.Value = $manifestPath
  & (Join-Path $homePath 'uninstall.ps1')
  if ($registry.Value -or (Test-Path $homePath)) { throw 'Uninstall left owned files or registration' }
  Write-Host 'PASS: install, reinstall, foreign registration guard, uninstall (registry mocked; clipboard untouched)'
} finally {
  $env:LOCALAPPDATA = $originalLocalAppData
  if (Test-Path $sandbox) { Microsoft.PowerShell.Management\Remove-Item $sandbox -Recurse -Force }
}
