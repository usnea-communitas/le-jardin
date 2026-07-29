param(
  [switch]$DryRun,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $root 'assets/i18n/audio.cs.json'

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "Missing Czech audio manifest: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.locale -ne 'cs' -or $manifest.languageCode -ne 'cs') {
  throw 'The audio manifest must declare locale and languageCode as cs.'
}
if (-not $manifest.voice.id -or -not $manifest.voice.model -or -not $manifest.voice.outputFormat) {
  throw 'The audio manifest is missing required voice settings.'
}

$cues = @($manifest.cues)
if ($cues.Count -ne 49) {
  throw "Expected exactly 49 Czech voice cues, found $($cues.Count)."
}

$ids = @{}
$targets = @{}
$resolvedCues = foreach ($cue in $cues) {
  if (-not $cue.id -or -not $cue.targetPath -or -not $cue.input -or -not $cue.caption) {
    throw 'Every Czech audio cue must include id, targetPath, input and caption.'
  }
  if ($ids.ContainsKey([string]$cue.id)) {
    throw "Duplicate Czech audio cue id: $($cue.id)"
  }
  $ids[[string]$cue.id] = $true

  $relative = ([string]$cue.targetPath).Replace('\', '/')
  if ($relative -notmatch '^assets/audio/(story|garden-voice)/cs/[a-z0-9-]+\.mp3$') {
    throw "Unsafe or unsupported Czech audio target: $relative"
  }

  $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
  $storyRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'assets/audio/story/cs'))
  $gardenVoiceRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'assets/audio/garden-voice/cs'))
  $storyPrefix = $storyRoot.TrimEnd('\') + '\'
  $gardenVoicePrefix = $gardenVoiceRoot.TrimEnd('\') + '\'
  $insideAllowedRoot =
    $fullPath.StartsWith($storyPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
    $fullPath.StartsWith($gardenVoicePrefix, [System.StringComparison]::OrdinalIgnoreCase)
  if (-not $insideAllowedRoot) {
    throw "Refusing to generate outside Czech audio directories: $fullPath"
  }
  if ($targets.ContainsKey($fullPath)) {
    throw "Duplicate Czech audio target: $relative"
  }
  $targets[$fullPath] = $true

  $withoutDirection = ([string]$cue.input) -replace '^\[[^\]]+\]\s*', ''
  if ($withoutDirection -cne [string]$cue.caption) {
    throw "Caption must exactly match the ElevenLabs input without its stage direction: $($cue.id)"
  }

  [PSCustomObject]@{
    Id = [string]$cue.id
    Input = [string]$cue.input
    Caption = [string]$cue.caption
    RelativePath = $relative
    FullPath = $fullPath
  }
}

if ($DryRun) {
  Write-Host "Czech audio dry run passed: $($resolvedCues.Count) validated cues."
  Write-Host "Voice: $($manifest.voice.name) · $($manifest.voice.id)"
  Write-Host "Model: $($manifest.voice.model) · language cs · $($manifest.voice.outputFormat)"
  foreach ($cue in $resolvedCues) {
    Write-Host ("[DRY RUN] {0} -> {1}" -f $cue.Id, $cue.RelativePath)
  }
  return
}

$apiKey = [Environment]::GetEnvironmentVariable('ELEVENLABS_API_KEY', 'Process')
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  $envFile = Join-Path $root '.env.local'
  if (Test-Path -LiteralPath $envFile) {
    $keyLine = Get-Content -LiteralPath $envFile -Encoding UTF8 |
      Where-Object { $_ -match '^\s*ELEVENLABS_API_KEY\s*=' } |
      Select-Object -First 1
    if ($keyLine) {
      $apiKey = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
    }
  }
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  throw 'ELEVENLABS_API_KEY is not available in the current process or .env.local.'
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
    Write-Host "Keeping existing Czech audio: $($cue.RelativePath)"
    continue
  }

  $directory = Split-Path -Parent $cue.FullPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $temporary = Join-Path $directory (([System.IO.Path]::GetFileNameWithoutExtension($cue.FullPath)) + '.generating.mp3')
  if (Test-Path -LiteralPath $temporary) {
    Remove-Item -LiteralPath $temporary -Force
  }

  $body = @{
    text = $cue.Input
    model_id = [string]$manifest.voice.model
    language_code = 'cs'
    seed = [int]$manifest.voice.seed
  } | ConvertTo-Json -Depth 5
  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

  try {
    Invoke-WebRequest -Uri $uri -Method Post -Headers $headers -Body $bodyBytes -OutFile $temporary
    if (-not (Test-Path -LiteralPath $temporary) -or (Get-Item -LiteralPath $temporary).Length -lt 1024) {
      throw "ElevenLabs returned an empty or implausibly small file for $($cue.id)."
    }
    Move-Item -LiteralPath $temporary -Destination $cue.FullPath -Force
    Write-Host "Created Czech audio: $($cue.RelativePath)"
  }
  catch {
    if (Test-Path -LiteralPath $temporary) {
      Remove-Item -LiteralPath $temporary -Force
    }
    throw
  }
}

Write-Host "All $($resolvedCues.Count) Czech voice cues are present."
