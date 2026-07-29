param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$audioRoot = (Resolve-Path (Join-Path $root 'assets/audio')).Path
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$targets = @(
  (Join-Path $audioRoot 'story/cs'),
  (Join-Path $audioRoot 'garden-voice/cs')
)

function Normalize-CzechAudio {
  param([Parameter(Mandatory)] [System.IO.FileInfo]$File)

  $resolved = $File.FullName
  if (-not $resolved.StartsWith($audioRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to process a file outside assets/audio: $resolved"
  }

  if ($DryRun) {
    Write-Host "Would normalize $($File.FullName.Substring($root.Length + 1))"
    return
  }

  $temp = Join-Path $File.DirectoryName ($File.BaseName + '.normalized.mp3')
  & $ffmpeg -hide_banner -loglevel error -y -i $resolved `
    -af 'loudnorm=I=-16:TP=-2:LRA=7' -ar 44100 -b:a 128k $temp
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temp)) {
    throw "Normalizing failed: $resolved"
  }

  Move-Item -LiteralPath $temp -Destination $resolved -Force
  Write-Host "Normalized $($File.FullName.Substring($root.Length + 1))"
}

$files = @(
  foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
      Get-ChildItem -LiteralPath $target -Filter '*.mp3' -File
    }
  }
)

if ($files.Count -eq 0) {
  throw 'No Czech audio files were found.'
}

$files | Sort-Object FullName | ForEach-Object { Normalize-CzechAudio -File $_ }
Write-Host "Czech audio normalization complete: $($files.Count) files."
