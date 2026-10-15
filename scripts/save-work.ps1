param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Message,
    [switch]$Wait
)

$ErrorActionPreference = 'Stop'
if ($Message.Trim().Length -lt 8) { throw 'Use a meaningful commit message with at least 8 characters.' }
$repoPath = Split-Path -Parent $PSScriptRoot
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
        $workflowNames = @('Application checks', 'Publish frontend preview')
        $reportedStates = @{}
        $deadline = [DateTime]::UtcNow.AddMinutes(15)
        Write-Host 'Waiting for checks and the frontend preview for this exact commit...'
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
            if ($allSucceeded) {
                Write-Host "Frontend preview is published: https://pouriah9.github.io/JUG/?v=$commitSha"
                Write-Host 'The full Vercel application has its own deployment status at the dashboard link above.'
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
