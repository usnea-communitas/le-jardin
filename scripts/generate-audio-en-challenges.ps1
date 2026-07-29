param(
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $root 'assets/i18n/audio.en-challenges.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ($manifest.locale -ne 'en' -or $manifest.languageCode -ne 'en') {
  throw 'The challenge manifest must declare English.'
}
$cues = @($manifest.cues)
if ($cues.Count -ne 11) {
  throw "Expected exactly 11 English challenge cues, found $($cues.Count)."
}

$ids = @{}
$targets = @{}
$allowedRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'assets/audio/garden-voice')).TrimEnd('\') + '\'
$resolvedCues = foreach ($cue in $cues) {
  if (-not $cue.id -or -not $cue.targetPath -or -not $cue.input -or -not $cue.caption) {
    throw 'Every English challenge cue must include id, targetPath, input and caption.'
  }
  if ($ids.ContainsKey([string]$cue.id)) { throw "Duplicate cue id: $($cue.id)" }
  $ids[[string]$cue.id] = $true

  $relative = ([string]$cue.targetPath).Replace('\', '/')
  if ($relative -notmatch '^assets/audio/garden-voice/challenge-[a-z0-9-]+\.mp3$') {
    throw "Unsafe English challenge target: $relative"
  }
  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  if (-not $fullPath.StartsWith($allowedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to generate outside assets/audio/garden-voice: $fullPath"
  }
  if ($targets.ContainsKey($fullPath)) { throw "Duplicate cue target: $relative" }
  $targets[$fullPath] = $true

  $withoutDirection = ([string]$cue.input) -replace '^\[[^\]]+\]\s*', ''
  if ($withoutDirection -cne [string]$cue.caption) {
    throw "Caption must match the spoken text for $($cue.id)"
  }
  [PSCustomObject]@{
    Id = [string]$cue.id
    Input = [string]$cue.input
    RelativePath = $relative
    FullPath = $fullPath
  }
}

if ($DryRun) {
  Write-Host "English challenge audio dry run passed: $($resolvedCues.Count) cues."
  return
}

$apiKey = [Environment]::GetEnvironmentVariable('ELEVENLABS_API_KEY', 'Process')
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  throw 'ELEVENLABS_API_KEY is not available in the current process.'
}

$headers = @{
  'xi-api-key' = $apiKey
  'Content-Type' = 'application/json; charset=utf-8'
}
$voiceId = [System.Uri]::EscapeDataString([string]$manifest.voice.id)
$outputFormat = [System.Uri]::EscapeDataString([string]$manifest.voice.outputFormat)
$uri = "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}"

foreach ($cue in $resolvedCues) {
  if ((Test-Path -LiteralPath $cue.FullPath) -and -not $Force) {
    Write-Host "Keeping existing English challenge audio: $($cue.RelativePath)"
    continue
  }

  $temporary = Join-Path (Split-Path -Parent $cue.FullPath) (([System.IO.Path]::GetFileNameWithoutExtension($cue.FullPath)) + '.generating.mp3')
  $body = @{
    text = $cue.Input
    model_id = [string]$manifest.voice.model
    language_code = 'en'
    seed = [int]$manifest.voice.seed
  } | ConvertTo-Json -Depth 5
  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

  try {
    Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $bodyBytes -OutFile $temporary
    if (-not (Test-Path -LiteralPath $temporary) -or (Get-Item -LiteralPath $temporary).Length -lt 1024) {
      throw "ElevenLabs returned an empty file for $($cue.id)."
    }
    Move-Item -LiteralPath $temporary -Destination $cue.FullPath -Force
    Write-Host "Created English challenge audio: $($cue.RelativePath)"
  }
  catch {
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    throw
  }
}

Write-Host "All $($resolvedCues.Count) English challenge cues are present."
