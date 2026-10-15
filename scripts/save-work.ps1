param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Message,
    [switch]$Wait
)

$ErrorActionPreference = 'Stop'
if ($Message.Trim().Length -lt 8) { throw 'Use a meaningful commit message with at least 8 characters.' }
$repoPath = Split-Path -Parent $PSScriptRoot

function Get-VercelPublishData {
    param([string]$Endpoint)
    $runtimePath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    $vercelPath = Join-Path $env:APPDATA 'npm/node_modules/vercel/dist/vc.js'
    if (-not (Test-Path -LiteralPath $runtimePath) -or -not (Test-Path -LiteralPath $vercelPath)) {
        throw 'Your work is saved, but the installed Node runtime or Vercel CLI is missing. Follow the Vercel dashboard link.'
    }
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $runtimePath
    $info.WorkingDirectory = $repoPath
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    foreach ($argument in @($vercelPath, 'api', $Endpoint, '--raw', '--scope', 'pouriah9s-projects')) { $info.ArgumentList.Add($argument) }
    $info.Environment['PATH'] = "$(Split-Path -Parent $runtimePath);$env:PATH"
    $proxySettings = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
    if ($proxySettings.ProxyEnable -eq 1 -and $proxySettings.ProxyServer) {
        foreach ($scheme in @('http', 'https')) {
            $proxyKey = "${scheme}_PROXY".ToUpperInvariant()
            if ($info.Environment[$proxyKey]) { continue }
            $proxyAddress = $null
            if ($proxySettings.ProxyServer -notmatch '=') { $proxyAddress = $proxySettings.ProxyServer }
            elseif ($proxySettings.ProxyServer -match "(?:^|;)$scheme=([^;]+)") { $proxyAddress = $Matches[1] }
            if ($proxyAddress) {
                if ($proxyAddress -notmatch '^\w+://') { $proxyAddress = "http://$proxyAddress" }
                $info.Environment[$proxyKey] = $proxyAddress
            }
        }
    }
    if ($info.Environment['HTTPS_PROXY'] -or $info.Environment['HTTP_PROXY']) { $info.Environment['NODE_USE_ENV_PROXY'] = '1' }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(45000)) {
            $process.Kill($true)
            throw 'Your work is saved, but the Vercel status request timed out. Follow the dashboard link.'
        }
        $outputText = $outputTask.GetAwaiter().GetResult()
        [void]$errorTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            throw 'Your work is saved, but Vercel status could not be read. Check the existing Vercel sign-in and team access; follow the dashboard link.'
        }
        return ($outputText | ConvertFrom-Json)
    } finally { $process.Dispose() }
}

Push-Location -LiteralPath $repoPath
try {
    & git rev-parse --show-toplevel
    if ($LASTEXITCODE -ne 0) { throw 'This folder is not a Git repository.' }
    $branchName = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $branchName) { throw 'Check out a branch before saving.' }
    $remoteUrl = & git remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $remoteUrl -notmatch 'github\.com[:/]PouriaH9/JUG(?:\.git)?/?$') {
        throw 'Expected origin to point to PouriaH9/JUG on GitHub. Check your repository settings.'
    }
    & git diff --check
    if ($LASTEXITCODE -ne 0) { throw 'Fix the whitespace errors above before saving.' }
    & git add --all -- .
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage application changes.' }
    & git diff --cached --quiet
    $stagedExitCode = $LASTEXITCODE
    if ($stagedExitCode -eq 1) {
        & git commit -m $Message
        if ($LASTEXITCODE -ne 0) { throw 'Commit failed. Your changes remain on this computer.' }
    } elseif ($stagedExitCode -ne 0) {
        throw 'Could not inspect staged changes.'
    } else {
        Write-Host 'No new changes to commit; pushing any existing local commits.'
    }
    & git push --set-upstream origin $branchName
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. Your local commit is safe. Resolve sign-in or branch conflicts, then rerun.' }
    $commitSha = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Push succeeded, but the saved commit could not be read.' }
    Write-Host "Saved to GitHub on $branchName ($($commitSha.Substring(0, 8)))."
    Write-Host 'Builds: https://github.com/PouriaH9/JUG/actions'
    Write-Host 'Full application deployment: https://vercel.com/pouriah9s-projects/jug'
    if ($branchName -ne 'main') {
        Write-Host 'Open a pull request to review this branch. Production publishing runs from main.'
        if ($Wait) { Write-Warning 'Waiting for production workflows is available only on main.' }
    } elseif ($Wait) {
        if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Your work is saved. Use publish.cmd or PowerShell 7 for deployment status waiting.' }
        $workflowNames = @('Application checks', 'Publish frontend preview')
        $reportedStates = @{}
        $deadline = [DateTime]::UtcNow.AddMinutes(15)
        $vercelProject = Get-VercelPublishData '/v9/projects/jug'
        if (-not $vercelProject.id) { throw 'Your work is saved, but Vercel project jug could not be identified.' }
        $pagesReported = $false
        Write-Host 'Waiting for application checks, frontend preview, and the Vercel Git deployment for this exact commit...'
        while ($true) {
            try {
                $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/PouriaH9/JUG/actions/runs?head_sha=$commitSha&per_page=30" -Headers @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'JUG-publish' } -TimeoutSec 20
            } catch {
                throw 'Your work is saved on GitHub, but build status could not be checked. Open the Builds link above to follow progress.'
            }
            $allSucceeded = $true
            foreach ($workflowName in $workflowNames) {
                $run = $runs.workflow_runs | Where-Object { $_.name -eq $workflowName -and $_.head_sha -eq $commitSha -and $_.event -eq 'push' } | Sort-Object id -Descending | Select-Object -First 1
                $state = if (-not $run) { 'waiting to start' } elseif ($run.status -eq 'completed') { $run.conclusion } else { $run.status }
                if ($reportedStates[$workflowName] -ne $state) {
                    Write-Host "${workflowName}: $state"
                    $reportedStates[$workflowName] = $state
                    if ($run.html_url) { Write-Host $run.html_url }
                }
                if ($run.status -eq 'completed' -and $run.conclusion -ne 'success') {
                    throw "Your work is saved, but '$workflowName' finished with '$($run.conclusion)'. Open its run link above."
                }
                if ($state -ne 'success') { $allSucceeded = $false }
            }
            if ($allSucceeded -and -not $pagesReported) {
                Write-Host "Frontend preview is published: https://pouriah9.github.io/JUG/?v=$commitSha"
                $pagesReported = $true
            }
            $deploymentData = Get-VercelPublishData "/v6/deployments?projectId=$($vercelProject.id)&target=production&limit=30"
            $deployment = $deploymentData.deployments | Where-Object { $_.source -eq 'git' -and $_.meta.githubCommitSha -eq $commitSha } | Sort-Object created -Descending | Select-Object -First 1
            $vercelState = if ($deployment) { $deployment.readyState } else { 'waiting to start' }
            if (-not $vercelState -and $deployment) { $vercelState = $deployment.state }
            if ($reportedStates['Vercel'] -ne $vercelState) {
                Write-Host "Vercel production: $vercelState"
                $reportedStates['Vercel'] = $vercelState
            }
            if ($vercelState -in @('ERROR', 'CANCELED')) {
                throw "Your work is saved, but the Vercel Git deployment finished with '$vercelState'. Open the Vercel dashboard above."
            }
            if ($allSucceeded -and $vercelState -eq 'READY') {
                if (-not $deployment.url) { throw 'Vercel reported READY without a deployment address. Open the dashboard link.' }
                Write-Host "Full application is published: https://jug-liard.vercel.app"
                Write-Host "Verified deployment: https://$($deployment.url)"
                Write-Host "Frontend fallback: https://pouriah9.github.io/JUG/?v=$commitSha"
                break
            }
            if ([DateTime]::UtcNow -ge $deadline) {
                throw 'Your work is saved. Builds are still pending after 15 minutes; follow them using the links above.'
            }
            Start-Sleep -Seconds 30
        }
    } else {
        Write-Host 'Publishing runs in GitHub Actions. Add -Wait to follow this commit until the frontend preview is ready.'
    }
} finally {
    Pop-Location
}
