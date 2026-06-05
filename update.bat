@echo off
REM ============================================================
REM  AMASS Palnie - UPDATE la ultima versiune (dublu-click)
REM  Ruleaza din folderul aplicatiei. Datele NU se pierd
REM  (stau in volumul Docker amass-palnie_amass-data).
REM ============================================================
cd /d "%~dp0"
echo.
echo === [1/3] BACKUP automat al datelor (inainte de orice)...
set "VOL=amass-palnie_amass-data"
for /f "delims=" %%v in ('docker volume ls -q --filter name=_amass-data 2^>nul') do set "VOL=%%v"
docker run --rm -v %VOL%:/d -v "%cd%":/b alpine tar czf /b/backup-before-update.tgz -C /d .
if errorlevel 1 (
  echo [EROARE] Backup ESUAT (volum %VOL%). NU continui update-ul fara backup. Verifica: docker volume ls
  pause
  exit /b 1
)
echo     Salvat: backup-before-update.tgz (volum %VOL%)
echo.
echo === [2/3] Iau ultima versiune de pe GitHub...
git pull --ff-only
if errorlevel 1 (
  echo [EROARE] git pull a esuat (modificari locale / istoric divergent). Rezolva si reincearca.
  pause
  exit /b 1
)
echo.
echo === [3/3] Reconstruiesc si pornesc aplicatia (poate dura 1-2 min)...
docker compose up -d --build
if errorlevel 1 (
  echo [EROARE] Build/pornire a esuat. Datele sunt INTACTE in volum + ai backup-before-update.tgz.
  pause
  exit /b 1
)
echo.
echo === GATA. Aplicatia ruleaza pe http://localhost:3000
echo     Datele au ramas neatinse (volum %VOL%).
echo.
pause
