param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Missing local .env file with ELEVENLABS_API_KEY.'
}

$keyLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -like 'ELEVENLABS_API_KEY=*' } | Select-Object -First 1
if (-not $keyLine) { throw 'ELEVENLABS_API_KEY is not set in .env.' }
$apiKey = $keyLine.Substring($keyLine.IndexOf('=') + 1).Trim()
$headers = @{ 'xi-api-key' = $apiKey }
$jsonHeaders = @{ 'xi-api-key' = $apiKey; 'Content-Type' = 'application/json' }

$storyDir = Join-Path $root 'assets/audio/story'
$gameDir = Join-Path $root 'assets/audio/game'
$gardenVoiceDir = Join-Path $root 'assets/audio/garden-voice'
New-Item -ItemType Directory -Force -Path $storyDir, $gameDir, $gardenVoiceDir | Out-Null

function Invoke-AudioGeneration {
  param(
    [Parameter(Mandatory)] [string]$Uri,
    [Parameter(Mandatory)] [hashtable]$Body,
    [Parameter(Mandatory)] [string]$OutFile
  )
  if ((Test-Path -LiteralPath $OutFile) -and -not $Force) {
    Write-Host "Keeping existing $(Split-Path $OutFile -Leaf)"
    return
  }
  $json = $Body | ConvertTo-Json -Depth 8
  Invoke-WebRequest -Uri $Uri -Method Post -Headers $jsonHeaders -Body $json -OutFile $OutFile
  Write-Host "Created $(Split-Path $OutFile -Leaf)"
}

$voices = Invoke-RestMethod -Uri 'https://api.elevenlabs.io/v2/voices?page_size=100' -Method Get -Headers $headers
$voice = $voices.voices | Where-Object { $_.name -eq 'The Garden of Menet' } | Select-Object -First 1
if (-not $voice) { throw 'The Garden of Menet voice was not found.' }

$scenes = @(
  '[softly] At the edge of Menet, beneath the hills and wide French sky... I wait.',
  '[reflective] Quiet is not empty. Beneath my soil, roots search - and a thousand small lives wait.',
  '[concerned] But sunlight is not enough. Bare soil loses water. Lonely plants struggle. What is not shared... disappears.',
  '[with quiet hope] Then young hands arrived. Not with a perfect plan, but with questions, seeds - and courage.',
  '[warmly] Rain was caught. Mulch cooled the soil. Flowers called pollinators home. Waste became tomorrow''s growth.',
  '[with growing wonder] I became a living web: soil and water, wildlife and people, harvest and generosity.',
  '[almost a whisper] Now I need your eyes. Listen. Notice what is missing. Help every part find its place... and help me come alive.'
)

for ($i = 0; $i -lt $scenes.Count; $i++) {
  $body = @{
    text = $scenes[$i]
    model_id = 'eleven_v3'
    language_code = 'en'
    seed = 240517
  }
  $file = Join-Path $storyDir ('narration-{0:d2}.mp3' -f ($i + 1))
  $uri = "https://api.elevenlabs.io/v1/text-to-speech/$($voice.voice_id)?output_format=mp3_44100_128"
  Invoke-AudioGeneration -Uri $uri -Body $body -OutFile $file
}

# Short, deliberately rare in-game lines spoken by the same saved Voice 1 as
# the opening story. File names match gardenVoiceFiles in the canonical game.
$gardenLines = @(
  @{ Name = 'milestone-soil'; Text = '[softly] Feed me first. Everything visible begins with the life beneath.' },
  @{ Name = 'milestone-water'; Text = '[gently] Rain should not rush away. Give it somewhere useful to pause.' },
  @{ Name = 'milestone-food'; Text = '[warmly] Let one place feed roots, leaves, fruit - and the people who tend me.' },
  @{ Name = 'milestone-shelter'; Text = '[with quiet wonder] Leave a little room for lives you may never see at first.' },
  @{ Name = 'milestone-share'; Text = '[warmly] What leaves my gate is not lost. It becomes someone else''s beginning.' },
  @{ Name = 'guild-discovered'; Text = '[with growing wonder] You looked between the elements. That is where my strongest design lives.' },
  @{ Name = 'reflection-three'; Text = '[reflective] I can feel soil, water and food beginning to answer one another. Resilience grows in the conversation between them.' },
  @{ Name = 'reflection-share'; Text = '[warmly] You made room for lives you may never meet, then let one gift continue beyond my gate.' },
  @{ Name = 'season-spring'; Text = '[softly, with new hope] The frost has loosened its hold. New companions arrive carefully, and last year''s rain rises through the soil.' },
  @{ Name = 'season-summer'; Text = '[warmly] My leaves are full of light. Water, shade and many kinds of flower decide whether abundance can keep its balance.' },
  @{ Name = 'season-autumn'; Text = '[reflective] Fruit, leaves and seed are arriving together. What is shared, stored or returned now will shape the quiet months.' },
  @{ Name = 'season-winter'; Text = '[almost a whisper] I have drawn my energy inward. Beneath cover and bark, many lives wait without becoming absent.' },
  @{ Name = 'ending'; Text = '[with quiet gratitude] You did not finish me. You helped me become able to continue - through another season, another visitor and another gift.' },
  # Resident stories - earned, multi-part moments about the lives that arrive.
  @{ Name = 'resident-hedgehog-1'; Text = '[softly] Something moved through the leaf litter last night. Small, unhurried, certain of its way. I did not plant it and I cannot keep it - but the cover you left made the crossing possible.' },
  @{ Name = 'resident-hedgehog-2'; Text = '[with quiet wonder] Under the wood and the mulch, through the coldest weeks, something slept and did not die. That is not luck alone. You left the corner undisturbed when tidying it would have been easier.' },
  @{ Name = 'resident-hedgehog-3'; Text = '[warmly] There are smaller prints now beside the first. I will not promise you they all live out the year - I cannot, and neither can anyone. But a garden safe enough to sleep in has become a garden safe enough to raise young in. That is the whole of it.' },
  @{ Name = 'resident-bee-1'; Text = '[softly] Something came from somewhere else and decided this was worth the journey. I did not call it. Word travels here in a language of scent and distance.' },
  @{ Name = 'resident-bee-2'; Text = '[warmly] For weeks now, as one flower closed another was already waiting. That continuity is far harder to design than a single beautiful bed - and you built it without being asked to.' },
  @{ Name = 'resident-bee-3'; Text = '[reflective] Fruit is setting where the flowers stood. I cannot tell you which visit made which fruit - that is not how any of this works. But the visitors came, the harvest followed, and both belong to the same arrangement.' },
  @{ Name = 'resident-worm-1'; Text = '[almost a whisper] Beneath the cover something began that you will almost never see. Organic matter and a little shade were invitation enough.' },
  @{ Name = 'resident-worm-2'; Text = '[reflective] Rain sinks differently now. Burrows and castings change where water goes and how far roots may follow. Slowly - soil keeps its own time, not ours.' },
  @{ Name = 'resident-worm-3'; Text = '[with quiet wonder] Even through the cold months, under the mulch, the work did not stop entirely. You have made something that no longer needs you to be watching it.' },
  # Imbalance stories - an outbreak read as a symptom, and the relationship that answers it.
  @{ Name = 'pest-aphid-1'; Text = '[quietly concerned] The softest shoots are curling. Something small has found them, and there are many - they arrive faster than anything here can answer. I am not telling you this to alarm you. I am telling you because you asked to see what I see.' },
  @{ Name = 'pest-aphid-2'; Text = '[reflective] You could ask what will remove them. I would rather tell you what is absent. Nothing here hunts them. There is no long flowering season to hold a predator between meals, and no dry crevice for one to pass the winter in. The aphids are not the problem - they are the reading.' },
  @{ Name = 'pest-aphid-3'; Text = '[warmly] There are ladybugs on the same stems now. I cannot tell you they will clear every one, and I would not want them to - a predator that finishes its prey has nowhere left to live. What you built was not a weapon. It was a place for something to stay long enough to matter.' },
  @{ Name = 'pest-slug-1'; Text = '[quietly concerned] By morning the young leaves had holes, and the trails were still bright across the soil. The damp cover you laid is good for much of what lives here. It is good for this, too.' },
  @{ Name = 'pest-slug-2'; Text = '[reflective] Mulch holds water, feeds the soil and hides the slugs from the sun. All of that is one decision, not three. What this garden does not yet have is anything that forages here at night - no undisturbed corner, no ground cover deep enough, no reason for a night visitor to make the crossing. Shelter without a hunter is only shelter for one side.' },
  @{ Name = 'pest-slug-3'; Text = '[warmly] Something works through the litter after dark. Slugs are still here - they will be, and that is not failure. Hedgehogs, birds and ground beetles eat many things, and the balance they keep is never a clean sweep. Fewer holes in the leaves is all I can honestly report. It is enough.' },
  @{ Name = 'pest-caterpillar-1'; Text = '[quietly concerned] White butterflies came to the brassicas, and what they left behind is feeding now. It is easy to resent this. I would rather you look at it first - the same wings you welcomed among the flowers laid these eggs. They were never two different visitors.' },
  @{ Name = 'pest-caterpillar-2'; Text = '[reflective] Caterpillars are food. That is not a comfort - it is a fact this garden cannot yet use, because nothing here is hunting them. No nest box, no clean shallow water, no reason for a bird to include these rows in its morning.' },
  @{ Name = 'pest-caterpillar-3'; Text = '[warmly] Birds work the brassicas in the early hours now. Some caterpillars will still finish, become butterflies and return to the flowers, which is how it should go. You did not remove anything from this garden. You added the part that was missing, and the rest arranged itself.' }
)

foreach ($line in $gardenLines) {
  $body = @{
    text = $line.Text
    model_id = 'eleven_v3'
    language_code = 'en'
    seed = 240517
  }
  $file = Join-Path $gardenVoiceDir ($line.Name + '.mp3')
  $uri = "https://api.elevenlabs.io/v1/text-to-speech/$($voice.voice_id)?output_format=mp3_44100_128"
  Invoke-AudioGeneration -Uri $uri -Body $body -OutFile $file
}

$musicPrompt = @'
An intimate instrumental underscore for a poetic story told by a living community garden in rural France. 65 seconds, calm and quietly adventurous. Begin with spacious felt piano and a breath of warm room tone; gradually introduce soft cello harmonics, brushed acoustic textures, and a few gentle wooden notes. The emotional arc moves from stillness and fragile concern into human arrival, connection, hope, and a luminous but restrained ending. Organic, imperfect, close-miked, cinematic in the smallest possible way. Leave generous space for spoken narration throughout. No vocals, no choir, no synthesizers, no electronic pulse, no trailer boom, no fantasy sparkle, no dramatic drums, no abrupt ending. End on one warm unresolved-to-resolved acoustic breath.
'@
Invoke-AudioGeneration `
  -Uri 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128' `
  -Body @{ prompt = $musicPrompt.Trim(); music_length_ms = 65000; model_id = 'music_v2'; force_instrumental = $true } `
  -OutFile (Join-Path $storyDir 'intro-music.mp3')

$effects = @(
  @{ Folder = 'story'; Name = 'garden-ambience'; Duration = 30.0; Loop = $true; Influence = 0.35; Prompt = 'A seamless, intimate early morning ambience in a small community garden in rural central France: gentle leaves moving in a light breeze, a few distant native songbirds, very faint bees, soft open countryside air. Natural field recording, calm, sparse, no people, no road traffic, no farm machinery, no music, no tonal drone.' },
  @{ Name = 'ui-soft'; Duration = 0.7; Influence = 0.65; Prompt = 'One tiny tactile interface sound made from a dry leaf brushing a smooth piece of wood, soft and close, warm, elegant, no clicky plastic, no digital beep, no music.' },
  @{ Name = 'warning'; Duration = 0.8; Influence = 0.7; Prompt = 'A soft muted wooden tap against packed garden soil, gentle corrective feedback, low and warm, no alarm, no digital tone, no music.' },
  @{ Name = 'plant'; Duration = 1.1; Influence = 0.65; Prompt = 'Close natural foley: one small seed dropped into loose dark soil followed by a soft thumb press and a tiny leaf rustle, warm and satisfying, no voice, no music.' },
  @{ Name = 'water'; Duration = 1.3; Influence = 0.7; Prompt = 'Close natural foley: a small pour of rainwater from a metal watering can onto garden soil, a few clear droplets, gentle and refreshing, no voice, no music.' },
  @{ Name = 'compost'; Duration = 1.2; Influence = 0.6; Prompt = 'Close natural foley: a handful of dry leaves and crumbly compost settling into a wooden compost bay, soft earthy texture, no voice, no music.' },
  @{ Name = 'build'; Duration = 1.0; Influence = 0.65; Prompt = 'One small satisfying wooden garden construction sound: a smooth timber piece seats gently into place with a quiet hand-tool knock, no metal clang, no voice, no music.' },
  @{ Name = 'harvest'; Duration = 1.2; Influence = 0.65; Prompt = 'Close natural garden harvest foley: crisp leaves gathered and one apple placed softly into a wicker basket, fresh and satisfying, no voice, no music.' },
  @{ Name = 'reward'; Duration = 2.1; Influence = 0.45; Prompt = 'A short warm organic success flourish made only from two gentle kalimba-like wooden notes, a soft seed-shaker breath, and a subtle leaf rustle. Hopeful and restrained, handmade, no synthesizer, no bell, no fantasy sparkle, no voice.' },
  @{ Name = 'guild'; Duration = 2.4; Influence = 0.45; Prompt = 'A short organic connection flourish: interlocking warm wooden notes, a soft brush of leaves, and one quiet resonant cello harmonic suggesting two garden elements forming a living relationship. Intimate, restrained, no synth, no bells, no voice.' },
  @{ Name = 'give'; Duration = 2.0; Influence = 0.45; Prompt = 'A short generous handmade flourish: wicker basket movement, seeds softly pouring, two rising warm wooden notes. Human, communal, quietly joyful, no coins, no digital sounds, no voice, no music bed.' },
  @{ Name = 'bird'; Duration = 1.8; Influence = 0.75; Prompt = 'A single small European garden songbird gives a brief natural three-note call from a nearby hedgerow, clean field recording, no other animals, no voice, no music.' },
  @{ Name = 'bee'; Duration = 1.4; Influence = 0.8; Prompt = 'One bumblebee passes close to lavender flowers and gently buzzes away, natural garden field recording, delicate, no swarm, no voice, no music.' },
  @{ Name = 'butterfly'; Duration = 1.2; Influence = 0.45; Prompt = 'Extremely delicate close foley suggesting butterfly wings: two soft papery wing flutters beside leaves, airy and natural, not magical, no chime, no voice, no music.' },
  @{ Name = 'hedgehog'; Duration = 1.5; Influence = 0.7; Prompt = 'A tiny hedgehog shuffles through dry garden leaves and gives one soft curious snuffle, natural close field recording, gentle, no voice, no music.' },
  @{ Name = 'worm'; Duration = 1.1; Influence = 0.45; Prompt = 'Subtle close earthy foley: moist crumbly soil shifts with a faint soft movement underneath, delicate and natural, no squelch, no voice, no music.' },
  @{ Name = 'ladybug'; Duration = 1.0; Influence = 0.45; Prompt = 'A tiny beetle opens its wings from a leaf: one very light shell click and a brief delicate wing flutter, close natural foley, no magical tone, no voice, no music.' },
  @{ Name = 'beetle'; Duration = 1.0; Influence = 0.55; Prompt = 'A small garden beetle crawls across dry bark: two tiny natural shell taps and a faint leaf movement, close foley, no voice, no music.' },
  @{ Name = 'mushroom'; Duration = 1.3; Influence = 0.4; Prompt = 'Soft earthy organic reveal foley: damp forest mulch settles, one rounded wood tone and a faint mycelial crackle, subtle and natural, no magic sparkle, no voice, no music.' },
  @{ Name = 'season-spring'; Duration = 2.3; Influence = 0.45; Prompt = 'A gentle natural spring transition: light breeze through new leaves, two nearby birds waking, a soft wooden tone, hopeful and restrained, no voice, no synth, no music bed.' },
  @{ Name = 'season-summer'; Duration = 2.3; Influence = 0.5; Prompt = 'A gentle natural summer garden transition: warm leaves, a passing bee, faint grass movement, and one low wooden tone, sunlit and calm, no voice, no synth, no music bed.' },
  @{ Name = 'season-autumn'; Duration = 2.3; Influence = 0.5; Prompt = 'A gentle natural autumn garden transition: a small swirl of dry leaves, one apple settling into grass, and a warm hollow wooden note, no voice, no synth, no music bed.' },
  @{ Name = 'season-winter'; Duration = 2.3; Influence = 0.5; Prompt = 'A gentle natural winter garden transition: quiet cold air, a bare branch moving, one distant bird, and a soft low wooden resonance, peaceful not ominous, no voice, no synth, no music bed.' },
  # Garden kitchen - a seamless hearth loop that sits under the preserving scene.
  @{ Name = 'unlock'; Duration = 2.6; Influence = 0.45; Prompt = 'A short warm handmade flourish announcing that something has just become possible in a garden: a gate latch lifting, two rising wooden kalimba-like notes, a soft brush of leaves and one quiet resonant string. Hopeful, generous, restrained, no synthesizer, no bell chime, no fantasy sparkle, no voice, no music bed.' },
  @{ Name = 'hearth-fire'; Duration = 10; Influence = 0.75; Loop = $true; Prompt = 'A small steady wood fire burning in an open hearth beneath a cooking pot: soft continuous flame breath with irregular gentle crackles and occasional quiet pops of resin, close natural field recording, warm and homely, no roaring, no whoosh, no voice, no music.' }
)

foreach ($effect in $effects) {
  $dir = if ($effect.Folder -eq 'story') { $storyDir } else { $gameDir }
  $body = @{
    text = $effect.Prompt
    duration_seconds = $effect.Duration
    prompt_influence = $effect.Influence
    loop = [bool]$effect.Loop
    model_id = 'eleven_text_to_sound_v2'
  }
  Invoke-AudioGeneration `
    -Uri 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128' `
    -Body $body `
    -OutFile (Join-Path $dir ($effect.Name + '.mp3'))
}

Write-Host 'All requested audio assets are present.'
