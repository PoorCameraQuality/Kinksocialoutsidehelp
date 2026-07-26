@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0.."
echo Ensure ONE dev server is running on port 5173 before this audit.
echo The audit aborts immediately if the server becomes unavailable.
set VISUAL_AUDIT_BASE_URL=http://127.0.0.1:5173
set VISUAL_AUDIT_EMAIL=RopeDreamer
set VISUAL_AUDIT_PASSWORD=demo
set VISUAL_AUDIT_ORG_OWNER_EMAIL=Brax
set "VISUAL_AUDIT_ORG_OWNER_PASSWORD=Airship!2"
set VISUAL_AUDIT_ADMIN_EMAIL=Brax
set "VISUAL_AUDIT_ADMIN_PASSWORD=Airship!2"
call npm run visual:audit
