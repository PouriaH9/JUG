param([switch]$Demo)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$bundledNode = 'C:\Users\pouri\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
if (Test-Path -LiteralPath $bundledNode) { $env:PATH = "$bundledNode;$env:PATH" }
$nodeExecutable = (Get-Command node.exe).Source
$npmCommand = (Get-Command npm.cmd).Source
$npmCli = Join-Path (Split-Path $npmCommand) 'node_modules/npm/bin/npm-cli.js'
if (-not $env:ADMIN_EMAIL) { $env:ADMIN_EMAIL = 'admin@jug.local' }
if (-not $env:ADMIN_PASSWORD) {
  if ($Demo) { $env:ADMIN_PASSWORD = 'JugAdmin!2026' }
  else { throw 'Set ADMIN_PASSWORD to a unique password of at least 16 characters before starting PostgreSQL mode.' }
}
if (-not $Demo -and $env:ADMIN_PASSWORD.Length -lt 16) { throw 'ADMIN_PASSWORD must contain at least 16 characters in PostgreSQL mode.' }
if ($Demo) { $env:JUG_DEMO = 'true'; $env:DATABASE_URL = '' } else {
  $env:JUG_DEMO = 'false'
  if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'postgres://jug:jug_local_only@localhost:54329/jug?sslmode=disable' }
}
Push-Location (Join-Path $projectRoot 'backend')
try { go build -o jug-api.exe .; if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' } } finally { Pop-Location }
$api = Start-Process -FilePath (Join-Path $projectRoot 'backend/jug-api.exe') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -PassThru
try {
  Push-Location (Join-Path $projectRoot 'frontend')
  if (-not (Test-Path 'node_modules')) { & $nodeExecutable $npmCli ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' } }
  $env:NEXT_DIST_DIR = '.next-dev'
  & $nodeExecutable $npmCli run dev
} finally {
  Pop-Location
  if (-not $api.HasExited) { Stop-Process -Id $api.Id }
}
