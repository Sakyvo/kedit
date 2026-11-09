$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$delivery = Join-Path $root '.target/.distribution/app'
$sandbox = Join-Path $root ('.target/test/install ' + [char]0x8d44 + [char]0x6599)
if (Test-Path $sandbox) { throw 'Test sandbox already exists' }
$originalLocalAppData = $env:LOCALAPPDATA
$env:LOCALAPPDATA = $sandbox
# Registry is simulated per key path; filesystem operations stay real.
$registry = @{ Keys = @{}; Created = @{} }
$hostName = 'cc.cd.kedit.folder_paste'
$vendorRoots = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\Chromium\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\Vivaldi\NativeMessagingHosts'
)
function Get-Item {
  param([string]$Path, [string]$ErrorAction)
  if ($Path.StartsWith('HKCU:')) {
    if ($registry.Keys.ContainsKey($Path)) {
      $item = [pscustomobject]@{ Value = $registry.Keys[$Path] }
      $item | Add-Member ScriptMethod GetValue { param($name) $this.Value }
      return $item
    }
    return
  }
  Microsoft.PowerShell.Management\Get-Item -Path $Path -ErrorAction $ErrorAction
}
function New-Item {
  param([string]$Path, [string]$ItemType, [switch]$Force)
  if ($Path.StartsWith('HKCU:')) { $registry.Created[$Path] = $true; return }
  Microsoft.PowerShell.Management\New-Item -Path $Path -ItemType $ItemType -Force:$Force
}
function Set-Item {
  param([string]$Path, [string]$Value)
  if (!$Path.StartsWith('HKCU:') -or !$registry.Created[$Path]) { throw "Unexpected registry write: $Path" }
  $registry.Keys[$Path] = $Value
}
function Remove-Item {
  param([string]$Path, [string]$LiteralPath, [switch]$Recurse, [switch]$Force)
  if ($Path -and $Path.StartsWith('HKCU:')) { $registry.Keys.Remove($Path); return }
  if ($LiteralPath) { Microsoft.PowerShell.Management\Remove-Item -LiteralPath $LiteralPath -Recurse:$Recurse -Force:$Force }
  else { Microsoft.PowerShell.Management\Remove-Item -Path $Path -Recurse:$Recurse -Force:$Force }
}
try {
  & (Join-Path $delivery 'install.ps1')
  $homePath = Join-Path $sandbox 'KEDIT/FolderPaste'
  $manifestPath = Join-Path $homePath 'cc.cd.kedit.folder_paste.json'
  $keyPaths = $vendorRoots | ForEach-Object { "HKCU:\$_\$hostName" }
  foreach ($keyPath in $keyPaths) {
    if ($registry.Keys[$keyPath] -ne $manifestPath) { throw "Missing or wrong registration: $keyPath" }
  }
  if ($registry.Keys.Count -ne $keyPaths.Count) { throw 'Unexpected extra registrations' }
  $bytes = [IO.File]::ReadAllBytes($manifestPath)
  if ($bytes[0] -ne 123) { throw 'Native manifest must be BOM-free JSON' }
  $manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $extensionPath = Join-Path $homePath 'extension/manifest.json'
  $extension = Get-Content $extensionPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (!$extension.name.Contains([string][char]0x6587)) { throw 'Extension name lost its UTF-8 Chinese text' }
  if ((Get-FileHash $extensionPath).Hash -ne (Get-FileHash (Join-Path $delivery 'extension/manifest.json')).Hash) { throw 'Extension manifest was changed during installation' }
  if ($manifest.path -ne (Join-Path $homePath 'KeditFolderPaste.exe')) { throw 'Installed path lost its Unicode characters' }
  if ($manifest.allowed_origins.Count -ne 1 -or $manifest.allowed_origins[0] -notmatch '^chrome-extension://[a-p]{32}/$') { throw 'Invalid extension allowlist' }
  if (!(Test-Path $manifest.path)) { throw 'Missing installed executable' }
  & (Join-Path $delivery 'install.ps1') # Reinstall is idempotent.
  $registry.Keys[$keyPaths[0]] = 'C:\other\manifest.json'
  $rejected = $false
  try { & (Join-Path $delivery 'install.ps1') } catch { $rejected = $true }
  if (!$rejected) { throw 'Foreign registration was not rejected' }
  if ($registry.Keys[$keyPaths[0]] -ne 'C:\other\manifest.json') { throw 'Foreign registration overwritten' }
  $registry.Keys[$keyPaths[0]] = $manifestPath
  & (Join-Path $homePath 'uninstall.ps1')
  if ($registry.Keys.Count -ne 0) { throw 'Uninstall left registrations behind' }
  if (Test-Path $homePath) { throw 'Uninstall left owned files behind' }
  Write-Host 'PASS: all vendor roots install, reinstall, foreign guard, full uninstall (registry mocked; clipboard untouched)'
} finally {
  $env:LOCALAPPDATA = $originalLocalAppData
  if (Test-Path $sandbox) { Microsoft.PowerShell.Management\Remove-Item $sandbox -Recurse -Force }
}
