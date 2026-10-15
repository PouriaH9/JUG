param(
    [string]$Message = "Save work $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'save-work.ps1') -Message $Message -Wait
