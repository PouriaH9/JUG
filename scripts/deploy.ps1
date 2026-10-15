#requires -Version 7.0
param(
    [string]$NodePath = "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)

$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$cliPaths = @{
    neon = Join-Path $env:APPDATA 'npm/node_modules/neon/dist/cli.js'
    vercel = Join-Path $env:APPDATA 'npm/node_modules/vercel/dist/vc.js'
}
foreach ($requiredPath in @($NodePath, $cliPaths.neon, $cliPaths.vercel)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required runtime or CLI is missing: $requiredPath" }
}
$nodeMajor = [int]((& $NodePath --version).TrimStart('v').Split('.')[0])
if ($LASTEXITCODE -ne 0 -or $nodeMajor -lt 24) { throw 'Use Node 24 or newer for the installed deployment CLIs.' }

# Apply proxy choices to child processes only; do not change Windows settings.
$childEnv = @{ PATH = "$(Split-Path -Parent $NodePath);$env:PATH" }
foreach ($proxyKey in @('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY')) {
    $proxyValue = [Environment]::GetEnvironmentVariable($proxyKey)
    if ($proxyValue) { $childEnv[$proxyKey] = $proxyValue }
}
if ($IsWindows) {
    $proxySettings = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
    if ($proxySettings.ProxyEnable -eq 1 -and $proxySettings.ProxyServer) {
        foreach ($scheme in @('http', 'https')) {
            $proxyKey = "${scheme}_PROXY".ToUpperInvariant()
            if ($childEnv.ContainsKey($proxyKey)) { continue }
            $proxyAddress = $null
            if ($proxySettings.ProxyServer -notmatch '=') { $proxyAddress = $proxySettings.ProxyServer }
            elseif ($proxySettings.ProxyServer -match "(?:^|;)$scheme=([^;]+)") { $proxyAddress = $Matches[1] }
            if ($proxyAddress) {
                if ($proxyAddress -notmatch '^\w+://') { $proxyAddress = "http://$proxyAddress" }
                $childEnv[$proxyKey] = $proxyAddress
            }
        }
    }
}
if ($childEnv.ContainsKey('HTTPS_PROXY') -or $childEnv.ContainsKey('HTTP_PROXY')) {
    $childEnv['NODE_USE_ENV_PROXY'] = '1'
}

function Invoke-DeploymentCli {
    param([string]$Cli, [string[]]$CliArguments, [string]$InputText, [switch]$ShowOutput, [switch]$AllowNotFound)
    $processInfo = [Diagnostics.ProcessStartInfo]::new()
    $processInfo.FileName = $NodePath
    $processInfo.WorkingDirectory = $repoPath
    $processInfo.UseShellExecute = $false
    $processInfo.CreateNoWindow = $true
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.RedirectStandardInput = $true
    $processInfo.ArgumentList.Add($cliPaths[$Cli])
    foreach ($argument in $CliArguments) { $processInfo.ArgumentList.Add($argument) }
    foreach ($key in $childEnv.Keys) { $processInfo.Environment[$key] = $childEnv[$key] }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $processInfo
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        if ($InputText) { $process.StandardInput.Write($InputText) }
        $process.StandardInput.Close()
        $process.WaitForExit()
        $commandOutput = $outputTask.GetAwaiter().GetResult()
        $commandErrors = $errorTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            # Only the project's explicit API HTTP 404 permits first-time creation.
            if ($AllowNotFound -and ($commandOutput -match '(?m)^HTTP 404(?:\s|$)' -or $commandErrors -match '(?m)^Error: Project not found\. \(404\)\s*$')) { return $null }
            # CLI diagnostics can contain credential values, so never echo them here.
            throw "$Cli command failed (exit $($process.ExitCode)). Finish '$Cli login' in your browser, verify project access, then rerun. Secret-bearing command output was hidden."
        }
        if ($ShowOutput) {
            Write-Host $commandOutput.Trim()
            Write-Host $commandErrors.Trim()
        }
        return $commandOutput.Trim()
    } finally { $process.Dispose() }
}

function Read-DeploymentEnv {
    param([string]$FilePath)
    $values = @{}
    foreach ($line in [IO.File]::ReadAllLines($FilePath)) {
        if ($line -notmatch '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') { continue }
        $key, $value = $Matches[1], $Matches[2]
        if ($value.StartsWith('"')) {
            # JSON parsing handles escaped double quotes without executing anything.
            try { $value = (ConvertFrom-Json ('{"value":' + $value + '}')).value }
            catch { throw "Invalid double-quoted value for $key in local environment file." }
        } elseif ($value.StartsWith("'")) {
            if (-not $value.EndsWith("'")) { throw "Invalid single-quoted value for $key." }
            $value = $value.Substring(1, $value.Length - 2)
        } else { $value = $value -replace '\s+#.*$', '' }
        $values[$key] = $value
    }
    return $values
}

Push-Location -LiteralPath $repoPath
try {
    & git check-ignore -q .env.local
    if ($LASTEXITCODE -ne 0) { throw '.env.local must be ignored by Git before deployment.' }
    Write-Host 'Provisioning Neon production database and private assets bucket...'
    Invoke-DeploymentCli neon @('deploy', '--project-id', 'winter-rice-30336144', '--branch', 'production', '--yes', '--no-env-pull') | Out-Null
    Invoke-DeploymentCli neon @('env', 'pull', '--project-id', 'winter-rice-30336144', '--branch', 'production', '--file', '.env.local', '--service', 'postgres', '--service', 'object-storage') | Out-Null
    $envPath = Join-Path $repoPath '.env.local'
    $serviceEnv = Read-DeploymentEnv $envPath
    if (-not $serviceEnv['ADMIN_EMAIL']) {
        [IO.File]::AppendAllText($envPath, "`nADMIN_EMAIL=pouriah9@gmail.com`n")
        $serviceEnv['ADMIN_EMAIL'] = 'pouriah9@gmail.com'
    }
    if (-not $serviceEnv['ADMIN_PASSWORD']) {
        $randomBytes = [byte[]]::new(36)
        [Security.Cryptography.RandomNumberGenerator]::Fill($randomBytes)
        $serviceEnv['ADMIN_PASSWORD'] = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        [IO.File]::AppendAllText($envPath, "ADMIN_PASSWORD=$($serviceEnv['ADMIN_PASSWORD'])`n")
    }
    if ($serviceEnv['ADMIN_PASSWORD'].Length -lt 16) { throw 'Existing ADMIN_PASSWORD must contain at least 16 characters.' }
    $requiredKeys = @('DATABASE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_ENDPOINT_URL_S3', 'AWS_REGION', 'ADMIN_EMAIL', 'ADMIN_PASSWORD')
    foreach ($key in $requiredKeys) {
        if (-not $serviceEnv[$key]) { throw "Missing required service variable: $key" }
    }

    Write-Host 'Linking Vercel project and configuring Services...'
    $existingProject = Invoke-DeploymentCli vercel @('api', '/v9/projects/jug', '--raw', '--scope', 'pouriah9s-projects') -AllowNotFound
    if (-not $existingProject) {
        $createBody = @{ name = 'jug'; framework = 'services' } | ConvertTo-Json -Compress
        Invoke-DeploymentCli vercel @('api', '/v10/projects', '--method', 'POST', '--input', '-', '--silent', '--scope', 'pouriah9s-projects') $createBody | Out-Null
        Write-Host 'Created the jug project in pouriah9s-projects.'
    }
    Invoke-DeploymentCli vercel @('link', '--yes', '--project', 'jug', '--team', 'pouriah9s-projects', '--scope', 'pouriah9s-projects') | Out-Null
    $projectLink = Get-Content -LiteralPath '.vercel/project.json' -Raw | ConvertFrom-Json
    if (-not $projectLink.projectId -or $projectLink.projectName -ne 'jug') { throw 'Unexpected Vercel project link. Check .vercel/project.json.' }
    $projectBody = @{ framework = 'services'; rootDirectory = $null } | ConvertTo-Json -Compress
    Invoke-DeploymentCli vercel @('api', "/v9/projects/$($projectLink.projectId)", '--method', 'PATCH', '--input', '-', '--silent', '--scope', 'pouriah9s-projects') $projectBody | Out-Null
    $projectDetails = Invoke-DeploymentCli vercel @('api', "/v9/projects/$($projectLink.projectId)", '--raw', '--scope', 'pouriah9s-projects') | ConvertFrom-Json
    if ($projectDetails.framework -ne 'services') { throw 'Vercel did not select the Services framework.' }
    if ($projectDetails.link) {
        if ($projectDetails.link.type -ne 'github' -or $projectDetails.link.org -ne 'PouriaH9' -or $projectDetails.link.repo -ne 'JUG') {
            throw 'Vercel is connected to an unexpected repository. Resolve the project connection before retrying.'
        }
        Write-Host 'GitHub repository is already connected.'
    } else {
        Invoke-DeploymentCli vercel @('git', 'connect', 'https://github.com/PouriaH9/JUG', '--yes', '--scope', 'pouriah9s-projects') | Out-Null
    }

    Write-Host 'Uploading service credentials to Production only...'
    foreach ($key in $requiredKeys) {
        Invoke-DeploymentCli vercel @('env', 'add', $key, 'production', '--force', '--sensitive', '--yes', '--scope', 'pouriah9s-projects') $serviceEnv[$key] | Out-Null
        Write-Host "Configured $key."
    }
    Write-Host 'Deploying production. The final deployment address will appear below.'
    Invoke-DeploymentCli vercel @('--prod', '--yes', '--scope', 'pouriah9s-projects') -ShowOutput | Out-Null
    Write-Host 'Admin credentials are saved only in ignored .env.local and Vercel Production settings.'
} finally {
    Pop-Location
}
