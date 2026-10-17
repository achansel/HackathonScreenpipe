@echo off
rem friction-assist : double-clic ou "teamstore\start.cmd moi" (Windows). Voir teamstore\README.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
