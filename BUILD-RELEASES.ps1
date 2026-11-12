$ErrorActionPreference = 'Stop'

foreach ($file in @('.env.sandbox', '.env.live')) {
  if (!(Test-Path $file)) { throw "Missing $file. Copy the matching .example file and add the correct public Supabase URL and anon key." }
  $content = Get-Content $file -Raw
  if ($content -match 'YOUR_SANDBOX|YOUR_LIVE|YOUR_.*KEY|YOUR_.*REF') { throw "$file still contains placeholder values." }
  if ($content -notmatch '(?m)^VITE_SUPABASE_URL=https://[^\s]+') { throw "$file is missing VITE_SUPABASE_URL." }
  if ($content -notmatch '(?m)^VITE_SUPABASE_ANON_KEY=\S+') { throw "$file is missing VITE_SUPABASE_ANON_KEY." }
}

npm.cmd ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
npm.cmd run verify:milestone2
if ($LASTEXITCODE -ne 0) { throw 'Milestone verification failed.' }
npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed.' }
npm.cmd run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed.' }

foreach ($mode in @('sandbox', 'live')) {
  $out = "dist-$mode"
  if (Test-Path $out) { Remove-Item $out -Recurse -Force }
  npm.cmd run build -- --mode $mode --outDir $out
  if ($LASTEXITCODE -ne 0) { throw "$mode production build failed." }
  Copy-Item vercel.json "$out/vercel.json" -Force
  $zip = "Songa-AI-2.0-$($mode.Substring(0,1).ToUpper())$($mode.Substring(1))-Dist.zip"
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Compress-Archive -Path "$out/*" -DestinationPath $zip -CompressionLevel Optimal
  Write-Host "READY: $zip" -ForegroundColor Green
}
Write-Host 'Both deployable static bundles built. Configure the matching Supabase Edge Function secrets separately.' -ForegroundColor Cyan
