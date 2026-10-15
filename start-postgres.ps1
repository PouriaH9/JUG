param([string]$PostgresBin = (Join-Path $PSScriptRoot '../../work/postgresql/pgsql/bin'), [string]$DataDirectory = (Join-Path $PSScriptRoot '../../work/pgdata'))
$ErrorActionPreference = 'Stop'
$PostgresBin = [IO.Path]::GetFullPath($PostgresBin)
$DataDirectory = [IO.Path]::GetFullPath($DataDirectory)
if (-not (Test-Path -LiteralPath (Join-Path $PostgresBin 'pg_ctl.exe'))) { throw 'Supply -PostgresBin with the bin folder of your PostgreSQL installation, or use docker compose up -d.' }
if (-not (Test-Path -LiteralPath (Join-Path $DataDirectory 'PG_VERSION'))) { throw 'Database has not been initialized. See README.' }
& (Join-Path $PostgresBin 'pg_ctl.exe') -D $DataDirectory -l (Join-Path $DataDirectory 'server.log') -o '-p 54329 -h 127.0.0.1' start
