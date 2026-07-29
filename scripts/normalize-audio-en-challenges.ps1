param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$audioRoot = (Resolve-Path (Join-Path $root 'assets/audio')).Path
$targetRoot = (Resolve-Path (Join-Path $audioRoot 'garden-voice')).Path
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$files = @(Get-ChildItem -LiteralPath $targetRoot -Filter 'challenge-*.mp3' -File | Sort-Object FullName)

if ($files.Count -ne 11) {
  throw "Expected 11 English challenge audio files, found $($files.Count)."
}

foreach ($file in $files) {
  if (-not $file.FullName.StartsWith($targetRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to process a file outside assets/audio/garden-voice: $($file.FullName)"
  }
  if ($DryRun) {
    Write-Host "Would normalize $($file.Name)"
    continue
  }

  $temporary = Join-Path $file.DirectoryName ($file.BaseName + '.normalized.mp3')
  & $ffmpeg -hide_banner -loglevel error -y -i $file.FullName `
    -af 'loudnorm=I=-16:TP=-2:LRA=7' -ar 44100 -b:a 128k $temporary
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporary)) {
    throw "Normalizing failed: $($file.FullName)"
  }
  Move-Item -LiteralPath $temporary -Destination $file.FullName -Force
  Write-Host "Normalized $($file.Name)"
}

Write-Host 'English challenge audio normalization complete.'
