@echo off
REM ============================================================
REM  AMASS Palnie - BACKUP date (dublu-click)
REM  Scoate o copie a bazei de date (volumul Docker) intr-un
REM  fisier .tgz in acest folder. Copiaza-l periodic undeva sigur
REM  (alt disc / stick / cloud).
REM ============================================================
cd /d "%~dp0"
REM AUTO-DETECT volumul de date (independent de numele folderului) — evită backup la volum gol/greșit.
set "VOL=amass-palnie_amass-data"
for /f "delims=" %%v in ('docker volume ls -q --filter name=_amass-data 2^>nul') do set "VOL=%%v"
echo.
echo === Fac backup la datele aplicatiei (volumul Docker: %VOL%)...
docker run --rm -v %VOL%:/d -v "%cd%":/b alpine tar czf /b/backup-amass.tgz -C /d .
if errorlevel 1 (
  echo [EROARE] Backup ESUAT. Verifica: containerul ruleaza? volumul exista? ^(docker volume ls^)
  pause
  exit /b 1
)
echo.
echo === GATA. Fisier: backup-amass.tgz (in acest folder).
echo     Copiaza-l undeva sigur. Rularea repetata il suprascrie.
echo.
pause
