@echo off
REM ============================================================
REM  AMASS Palnie - UPDATE la ultima versiune (dublu-click)
REM  Ruleaza din folderul aplicatiei. Datele NU se pierd
REM  (stau in volumul Docker amass-palnie_amass-data).
REM ============================================================
cd /d "%~dp0"
echo.
echo === [1/2] Iau ultima versiune de pe GitHub...
git pull
echo.
echo === [2/2] Reconstruiesc si pornesc aplicatia (poate dura 1-2 min)...
docker compose up -d --build
echo.
echo === GATA. Aplicatia ruleaza pe http://localhost:3000
echo     Datele au ramas neatinse.
echo.
pause
