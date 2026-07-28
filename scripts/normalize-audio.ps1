param(
  [switch]$GardenVoiceOnly
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$audioRoot = (Resolve-Path (Join-Path $root 'assets/audio')).Path
$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source

function Normalize-Audio {
  param(
    [Parameter(Mandatory)] [string]$Path,
    [Parameter(Mandatory)] [double]$TargetLufs
  )
  $resolved = (Resolve-Path -LiteralPath $Path).Path
  if (-not $resolved.StartsWith($audioRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to process a file outside assets/audio: $resolved"
  }
  $temp = Join-Path ([System.IO.Path]::GetDirectoryName($resolved)) (([System.IO.Path]::GetFileNameWithoutExtension($resolved)) + '.normalized.mp3')
  & $ffmpeg -hide_banner -loglevel error -y -i $resolved -af "loudnorm=I=$TargetLufs`:TP=-2:LRA=7" -ar 44100 -b:a 128k $temp
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temp)) { throw "Normalizing failed: $resolved" }
  Move-Item -LiteralPath $temp -Destination $resolved -Force
  Write-Host "Normalized $(Split-Path $resolved -Leaf) to $TargetLufs LUFS"
}

if (-not $GardenVoiceOnly) {
  Get-ChildItem -LiteralPath (Join-Path $audioRoot 'story') -Filter 'narration-*.mp3' -File |
    ForEach-Object { Normalize-Audio -Path $_.FullName -TargetLufs -16 }
}

$gardenVoiceDir = Join-Path $audioRoot 'garden-voice'
if (Test-Path -LiteralPath $gardenVoiceDir) {
  Get-ChildItem -LiteralPath $gardenVoiceDir -Filter '*.mp3' -File |
    ForEach-Object { Normalize-Audio -Path $_.FullName -TargetLufs -16 }
}

if ($GardenVoiceOnly) {
  Write-Host 'Garden voice loudness normalization complete.'
  return
}

Normalize-Audio -Path (Join-Path $audioRoot 'story/intro-music.mp3') -TargetLufs -23
Normalize-Audio -Path (Join-Path $audioRoot 'story/garden-ambience.mp3') -TargetLufs -32

Get-ChildItem -LiteralPath (Join-Path $audioRoot 'game') -Filter '*.mp3' -File |
  ForEach-Object { Normalize-Audio -Path $_.FullName -TargetLufs -20 }

Write-Host 'Audio loudness normalization complete.'
