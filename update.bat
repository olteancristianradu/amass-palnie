@echo off
REM ============================================================
REM  AMASS Palnie - UPDATE la ultima versiune (dublu-click)
REM  Ruleaza din folderul aplicatiei. Datele NU se pierd
REM  (stau in volumul Docker amass-palnie_amass-data).
REM ============================================================
cd /d "%~dp0"
echo.
echo === [1/3] BACKUP automat al datelor (inainte de orice)...
docker run --rm -v amass-palnie_amass-data:/d -v "%cd%":/b alpine tar czf /b/backup-before-update.tgz -C /d . 2>nul
echo     Salvat: backup-before-update.tgz
echo.
echo === [2/3] Iau ultima versiune de pe GitHub...
git pull
echo.
echo === [3/3] Reconstruiesc si pornesc aplicatia (poate dura 1-2 min)...
docker compose up -d --build
echo.
echo === GATA. Aplicatia ruleaza pe http://localhost:3000
echo     Datele au ramas neatinse.
echo.
pause
