#requires -Version 7.0
param([switch]$Deploy)
$ErrorActionPreference = 'Stop'
$taskNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskNeon = Join-Path $env:APPDATA 'npm/node_modules/neon/dist/cli.js'
$taskVercel = Join-Path $env:APPDATA 'npm/node_modules/vercel/dist/vc.js'
foreach ($taskPath in @($taskNode, $taskNeon, $taskVercel)) {
    if (-not (Test-Path -LiteralPath $taskPath)) { throw "Missing installed runtime or CLI: $taskPath" }
}
$taskOldEnv = @{}
foreach ($taskKey in @('PATH', 'HTTP_PROXY', 'HTTPS_PROXY', 'NODE_USE_ENV_PROXY')) {
    $taskOldEnv[$taskKey] = [Environment]::GetEnvironmentVariable($taskKey, 'Process')
}
Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
try {
    $env:PATH = "$(Split-Path -Parent $taskNode);$env:PATH"
    if ($IsWindows) {
        $taskProxy = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
        if ($taskProxy.ProxyEnable -eq 1 -and $taskProxy.ProxyServer -and $taskProxy.ProxyServer -notmatch '=') {
            if (-not $env:HTTP_PROXY) { $env:HTTP_PROXY = 'http://' + $taskProxy.ProxyServer }
            if (-not $env:HTTPS_PROXY) { $env:HTTPS_PROXY = $env:HTTP_PROXY }
        }
    }
    if ($env:HTTPS_PROXY -or $env:HTTP_PROXY) { $env:NODE_USE_ENV_PROXY = '1' }
    Write-Host 'Complete Vercel authorization in the browser when it opens.'
    & $taskNode $taskVercel login
    if ($LASTEXITCODE -ne 0) { throw 'Vercel sign-in was not completed. Rerun this script when ready.' }
    Write-Host 'Complete Neon authorization in the browser within 60 seconds.'
    & $taskNode $taskNeon login
    if ($LASTEXITCODE -ne 0) { throw 'Neon sign-in was not completed. Rerun this script when ready.' }
    if ($Deploy) { & (Join-Path $PSScriptRoot 'deploy.ps1') -NodePath $taskNode }
} finally {
    Pop-Location
    foreach ($taskKey in $taskOldEnv.Keys) { [Environment]::SetEnvironmentVariable($taskKey, $taskOldEnv[$taskKey], 'Process') }
}
