@echo off
setlocal
set "JUG_PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not exist "%JUG_PWSH%" set "JUG_PWSH=pwsh.exe"
"%JUG_PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish.ps1" %*
set "JUG_PUBLISH_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %JUG_PUBLISH_RESULT%
