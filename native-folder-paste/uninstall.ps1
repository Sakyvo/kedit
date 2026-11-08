$ErrorActionPreference = 'Stop'
$homePath = Join-Path $env:LOCALAPPDATA 'KEDIT/FolderPaste'
$nativeManifest = Join-Path $homePath 'cc.cd.kedit.folder_paste.json'
$keyPath = 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\cc.cd.kedit.folder_paste'
$current = Get-Item $keyPath -ErrorAction SilentlyContinue
if ($current) {
  if ($current.GetValue('') -ne $nativeManifest) { throw 'Registration belongs to a different installation; nothing removed.' }
  Remove-Item $keyPath
}
# Delete only this product's known files, not arbitrary files in the directory.
@('KeditFolderPaste.exe', 'cc.cd.kedit.folder_paste.json', 'uninstall.ps1',
  'extension/manifest.json', 'extension/content.js', 'extension/background.js') | ForEach-Object {
  $path = Join-Path $homePath $_
  if (Test-Path $path) { Remove-Item -LiteralPath $path }
}
foreach ($dir in @((Join-Path $homePath 'extension'), $homePath)) {
  if ((Test-Path $dir) -and !(Get-ChildItem -LiteralPath $dir -Force)) { Remove-Item -LiteralPath $dir }
}
Write-Host 'Host removed. Remove KEDIT Folder Paste in vivaldi://extensions as well.'
