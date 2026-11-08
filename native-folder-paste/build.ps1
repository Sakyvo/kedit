param([switch]$Package)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = $PSScriptRoot
$contractPath = Join-Path $root '.docs/spec/build-output.md'
$contract = Get-Content $contractPath -Raw
$match = [regex]::Match($contract, '(?s)```target-layout\s*(.*?)\s*```')
if (!$match.Success) { throw 'Missing output contract' }
$layout = ($match.Groups[1].Value | ConvertFrom-Json).builds[0]
if ($layout.product -ne 'KEDIT Folder Paste' -or $layout.buildRoot -ne '../..' -or
  $layout.targetRoot -ne '.target' -or $layout.deliveryRoot -ne '.target/.distribution') { throw 'Output contract mismatch' }
$target = Join-Path $root $layout.targetRoot
$baseline = if (Test-Path $target) { (Get-ChildItem $target -Recurse -File | Measure-Object Length -Sum).Sum } else { 0 }
Write-Host "Output baseline: $baseline bytes"
$release = Join-Path $target 'release'
New-Item -ItemType Directory -Force $release | Out-Null
$framework = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319'
$compiler = Join-Path $framework 'csc.exe'
$exe = Join-Path $release 'KeditFolderPaste.exe'
& $compiler /nologo /target:exe /optimize+ /debug- /platform:anycpu "/reference:$framework/System.Web.Extensions.dll" "/out:$exe" (Join-Path $root 'host/Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'Release compilation failed' }
$check = Start-Process -FilePath $exe -ArgumentList '--self-test' -Wait -PassThru -NoNewWindow
if ($check.ExitCode -ne 0) { throw 'Host self-test failed' }
Write-Host 'Release host self-test PASS'
if (!$Package) { return }
$distribution = Join-Path $root $layout.deliveryRoot
$app = Join-Path $distribution 'app'
$previous = Join-Path $distribution 'app-prev'
$receiptPath = Join-Path $target 'delivery.json'
$oldReceipt = if (Test-Path $receiptPath) { Get-Content $receiptPath -Raw } else { $null }
$old = if ($oldReceipt) { $oldReceipt | ConvertFrom-Json } else { $null }
$active = Get-Process -Name KeditFolderPaste -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq (Join-Path $app 'KeditFolderPaste.exe') }
if ($active) { throw "Close the running host before packaging; Release remains at $release" }
# Build the complete payload outside delivery, then swap with rollback.
$payload = Join-Path $release 'package'
if (Test-Path $payload) { Remove-Item $payload -Recurse -Force }
New-Item -ItemType Directory -Force $payload | Out-Null
Copy-Item $exe -Destination $payload
Copy-Item (Join-Path $root 'extension') -Destination $payload -Recurse
Copy-Item (Join-Path $root 'install.ps1'), (Join-Path $root 'uninstall.ps1'), (Join-Path $root 'README.md') -Destination $payload
$zipPayload = Join-Path $release 'kedit-folder-paste.zip'
Compress-Archive -Path (Join-Path $payload '*') -DestinationPath $zipPayload -Force
$inputs = @('build.ps1', 'install.ps1', 'uninstall.ps1', 'README.md') + @(
  Get-ChildItem (Join-Path $root 'host'), (Join-Path $root 'extension') -File | ForEach-Object { [IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/') }
)
$inputList = @($inputs | Sort-Object | ForEach-Object { @{ path = $_; sha256 = (Get-FileHash (Join-Path $root $_) -Algorithm SHA256).Hash } })
$sha = [Security.Cryptography.SHA256]::Create()
$fingerprint = [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($inputList | ForEach-Object { "$($_.path):$($_.sha256)" }) -join "`n")))
$sha.Dispose()
$rollback = Join-Path $release 'rollback'
if (Test-Path $rollback) { throw 'Unresolved prior packaging rollback exists' }
New-Item -ItemType Directory -Force $distribution | Out-Null
$backup = if ($old -and $old.app.status -eq 'accepted' -and !(Test-Path $previous)) { $previous } else { $rollback }
$zipDir = Join-Path $distribution 'zip'
$zip = Join-Path $zipDir 'kedit-folder-paste.zip'
$zipBackup = Join-Path $release 'rollback.zip'
if (Test-Path $zip) { Copy-Item $zip $zipBackup -Force }
$hadApp = Test-Path $app
if ($hadApp) { Move-Item $app $backup }
try {
  Move-Item $payload $app
  New-Item -ItemType Directory -Force $zipDir | Out-Null
  Copy-Item $zipPayload $zip -Force
  $files = @(Get-ChildItem $app -File -Recurse | ForEach-Object {
    @{ path = [IO.Path]::GetRelativePath($app, $_.FullName).Replace('\', '/'); bytes = $_.Length; sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash }
  })
  $receipt = @{
    product = $layout.product; generatedAt = [DateTime]::UtcNow.ToString('o')
    sourceCommit = (git -C $root rev-parse HEAD); inputFingerprint = $fingerprint; inputs = $inputList
    configuration = 'Release: csc /target:exe /optimize+ /debug- /platform:anycpu'
    command = 'pwsh -File build.ps1 -Package'
    verification = @{ command = 'KeditFolderPaste.exe --self-test'; passed = $true; timestamp = [DateTime]::UtcNow.ToString('o') }
    app = @{ status = 'pending-manual-acceptance'; entry = 'app/KeditFolderPaste.exe'; files = $files; pending = @('Vivaldi extension/native registration', 'Explorer Ctrl+C -> KEDIT Ctrl+V; undo/redo and clipboard regression') }
    zip = @{ status = 'pending-manual-acceptance'; path = 'zip/kedit-folder-paste.zip'; bytes = (Get-Item $zip).Length; sha256 = (Get-FileHash $zip -Algorithm SHA256).Hash }
  }
  $receipt | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $receiptPath
} catch {
  if (Test-Path $app) { Remove-Item $app -Recurse -Force }
  if ($hadApp) { Move-Item $backup $app }
  if (Test-Path $zipBackup) { Copy-Item $zipBackup $zip -Force } elseif (Test-Path $zip) { Remove-Item $zip }
  if ($oldReceipt) { Set-Content -Encoding utf8 $receiptPath $oldReceipt } elseif (Test-Path $receiptPath) { Remove-Item $receiptPath }
  throw
} finally {
  if (Test-Path $zipBackup) { Remove-Item $zipBackup }
}
if (Test-Path $rollback) { Remove-Item $rollback -Recurse -Force }
Write-Host "Delivery: $app"
Write-Host "Archive: $zip"
