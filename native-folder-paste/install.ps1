param()
$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$homePath = Join-Path $env:LOCALAPPDATA 'KEDIT/FolderPaste'
$manifest = Get-Content (Join-Path $source 'extension/manifest.json') -Raw | ConvertFrom-Json
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
$keyPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\cc.cd.kedit.folder_paste'
$current = Get-Item $keyPath -ErrorAction SilentlyContinue
if ($current -and $current.GetValue('') -ne $nativeManifest) { throw 'A different host registration exists; refusing to overwrite it.' }
New-Item -ItemType Directory -Force $homePath | Out-Null
Copy-Item $exe, (Join-Path $source 'uninstall.ps1') -Destination $homePath -Force
New-Item -ItemType Directory -Force (Join-Path $homePath 'extension') | Out-Null
Copy-Item (Join-Path $source 'extension/*') -Destination (Join-Path $homePath 'extension') -Force
$registration = @{
  name = 'cc.cd.kedit.folder_paste'
  description = 'KEDIT read-only folder path paste'
  path = Join-Path $homePath 'KeditFolderPaste.exe'
  type = 'stdio'
  allowed_origins = @("chrome-extension://$extensionId/")
} | ConvertTo-Json
[IO.File]::WriteAllText($nativeManifest, $registration, [Text.UTF8Encoding]::new($false))
New-Item -Path $keyPath -Force | Out-Null
Set-Item -Path $keyPath -Value $nativeManifest
Write-Host "Installed for the current user (no admin required)."
Write-Host "Open vivaldi://extensions, enable Developer mode, Load unpacked:"
Write-Host (Join-Path $homePath 'extension')
Write-Host "Expected extension ID: $extensionId"
Write-Host 'Reload https://kedit.cc.cd/ after loading the extension.'
