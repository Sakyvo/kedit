param([string]$ExtensionTarget)
$ErrorActionPreference = 'Stop'
$homePath = Join-Path $env:LOCALAPPDATA 'KEDIT/FolderPaste'
if (!$ExtensionTarget) { $ExtensionTarget = Join-Path ([Environment]::GetFolderPath('Desktop')) 'KEDIT-FolderPaste-extension' }
$nativeManifest = Join-Path $homePath 'cc.cd.kedit.folder_paste.json'
$hostName = 'cc.cd.kedit.folder_paste'
$vendorRoots = @(
  'Software\Google\Chrome\NativeMessagingHosts',
  'Software\Chromium\NativeMessagingHosts',
  'Software\Microsoft\Edge\NativeMessagingHosts',
  'Software\BraveSoftware\Brave-Browser\NativeMessagingHosts',
  'Software\Vivaldi\NativeMessagingHosts'
)
$removed = 0
foreach ($root in $vendorRoots) {
  $keyPath = "HKCU:\$root\$hostName"
  $current = Get-Item $keyPath -ErrorAction SilentlyContinue
  if (!$current) { continue }
  # Only delete registrations that point at this installation.
  if ($current.GetValue('') -ne $nativeManifest) {
    Write-Warning "Skipped $keyPath (owned by another installation)."
    continue
  }
  Remove-Item $keyPath
  $removed++
}
# Delete only this product's known files, not arbitrary files in the directory.
@('KeditFolderPaste.exe', 'cc.cd.kedit.folder_paste.json', 'uninstall.ps1',
  'extension/manifest.json', 'extension/content.js', 'extension/background.js') | ForEach-Object {
  $path = Join-Path $homePath $_
  if (Test-Path $path) { Remove-Item -LiteralPath $path }
}
# The Desktop copy is only ever written by install.ps1 from this product.
@('manifest.json', 'content.js', 'background.js') | ForEach-Object {
  $path = Join-Path $ExtensionTarget $_
  if (Test-Path $path) { Remove-Item -LiteralPath $path }
}
foreach ($dir in @((Join-Path $homePath 'extension'), $homePath, $ExtensionTarget)) {
  if ((Test-Path $dir) -and !(Get-ChildItem -LiteralPath $dir -Force)) { Remove-Item -LiteralPath $dir }
}
Write-Host "Host removed from $removed registration(s). Remove KEDIT Folder Paste in vivaldi://extensions as well."
