param([string]$ExtensionSource, [string]$ExtensionTarget)
$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$homePath = Join-Path $env:LOCALAPPDATA 'KEDIT/FolderPaste'
# The extension is generated to the repository root, outside the delivery app.
# Fall back to a sibling `extension/` so the archive stays self-contained.
$repoExtension = Join-Path (Join-Path $source '../../../..') 'KEDIT-FolderPaste-extension'
if (!$ExtensionSource) {
  if (Test-Path (Join-Path $source 'extension/manifest.json')) { $ExtensionSource = Join-Path $source 'extension' }
  elseif (Test-Path (Join-Path $repoExtension 'manifest.json')) { $ExtensionSource = $repoExtension }
  else { throw 'Extension files not found; pass -ExtensionSource.' }
}
if (!(Test-Path (Join-Path $ExtensionSource 'manifest.json'))) { throw "No extension manifest under $ExtensionSource" }
if (!$ExtensionTarget -and (Test-Path (Join-Path $repoExtension 'manifest.json'))) { $ExtensionTarget = $repoExtension }
$manifest = Get-Content (Join-Path $ExtensionSource 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$keyBytes = [Convert]::FromBase64String($manifest.key)
$sha = [Security.Cryptography.SHA256]::Create()
$hash = $sha.ComputeHash($keyBytes)
$sha.Dispose()
$extensionId = -join ($hash[0..15] | ForEach-Object {
  [char](97 + ($_ -shr 4)); [char](97 + ($_ -band 15))
})
$exe = Join-Path $source 'KeditFolderPaste.exe'
if (!(Test-Path $exe)) { throw 'Run install.ps1 from the Release delivery folder.' }
$nativeManifest = Join-Path $homePath 'cc.cd.kedit.folder_paste.json'
# Chromium forks read different vendor roots. Vivaldi on Windows reads its own
# root; Chrome/Chromium/Edge/Brave cover the rest. Register every root we can.
$hostName = 'cc.cd.kedit.folder_paste'
$vendorRoots = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\Chromium\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\Vivaldi\NativeMessagingHosts'
)
$keyPaths = $vendorRoots | ForEach-Object { "HKCU:\$_\$hostName" }
foreach ($keyPath in $keyPaths) {
  $current = Get-Item $keyPath -ErrorAction SilentlyContinue
  if ($current -and $current.GetValue('') -ne $nativeManifest) {
    throw "A different host registration already exists at $keyPath; refusing to overwrite it."
  }
}
New-Item -ItemType Directory -Force $homePath | Out-Null
Copy-Item $exe, (Join-Path $source 'uninstall.ps1') -Destination $homePath -Force
New-Item -ItemType Directory -Force (Join-Path $homePath 'extension') | Out-Null
Copy-Item (Join-Path $ExtensionSource '*') -Destination (Join-Path $homePath 'extension') -Force
if ($ExtensionTarget -and $ExtensionTarget -ne $ExtensionSource) {
  New-Item -ItemType Directory -Force $ExtensionTarget | Out-Null
  Copy-Item (Join-Path $ExtensionSource '*') -Destination $ExtensionTarget -Force
}
$registration = @{
  name = $hostName
  description = 'KEDIT read-only folder path paste'
  path = Join-Path $homePath 'KeditFolderPaste.exe'
  type = 'stdio'
  allowed_origins = @("chrome-extension://$extensionId/")
} | ConvertTo-Json
[IO.File]::WriteAllText($nativeManifest, $registration, [Text.UTF8Encoding]::new($false))
foreach ($keyPath in $keyPaths) {
  New-Item -Path $keyPath -Force | Out-Null
  Set-Item -Path $keyPath -Value $nativeManifest
}
Write-Host "Installed for the current user (no admin required)."
Write-Host "Registered under $($keyPaths.Count) browser roots (Chrome/Chromium/Edge/Brave/Vivaldi)."
Write-Host "Extension source: $ExtensionSource"
if ($ExtensionTarget -and $ExtensionTarget -ne $ExtensionSource) { Write-Host "Extension copy: $ExtensionTarget" }
Write-Host 'Open vivaldi://extensions, enable Developer mode, Load unpacked:'
Write-Host $(if ($ExtensionTarget) { $ExtensionTarget } else { $ExtensionSource })
Write-Host "Expected extension ID: $extensionId"
Write-Host 'Reload https://kedit.cc.cd/ after loading the extension.'
