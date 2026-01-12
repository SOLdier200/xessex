@echo off
REM Start Claude Code in WSL with bypass permissions
REM Run this from Windows

wsl -d Ubuntu -- bash -lic "cd ~/xessex && claude --dangerously-skip-permissions"
pause
