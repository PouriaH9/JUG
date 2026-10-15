param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Message
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
    Write-Host "Saved to GitHub on $branchName. Vercel will deploy connected branches automatically."
} finally {
    Pop-Location
}
