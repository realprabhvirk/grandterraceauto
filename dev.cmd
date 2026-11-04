@echo off
rem Runs a command with the project-local portable Node on PATH (this session only).
rem Usage: dev node -v | dev npm install | dev npm run dev
setlocal
set "PATH=%~dp0.tools\node;%PATH%"
set "npm_config_cache=%~dp0.tools\npm-cache"
set "npm_config_update_notifier=false"
if "%~1"=="" (
  echo Usage: dev ^<command^> [args...]
  exit /b 1
)
call %*
exit /b %ERRORLEVEL%
