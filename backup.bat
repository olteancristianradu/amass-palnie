@echo off
REM ============================================================
REM  AMASS Palnie - BACKUP date (dublu-click)
REM  Scoate o copie a bazei de date (volumul Docker) intr-un
REM  fisier .tgz in acest folder. Copiaza-l periodic undeva sigur
REM  (alt disc / stick / cloud).
REM ============================================================
cd /d "%~dp0"
echo.
echo === Fac backup la datele aplicatiei (volumul Docker)...
docker run --rm -v amass-palnie_amass-data:/d -v "%cd%":/b alpine tar czf /b/backup-amass.tgz -C /d .
echo.
echo === GATA. Fisier: backup-amass.tgz (in acest folder).
echo     Copiaza-l undeva sigur. Rularea repetata il suprascrie.
echo.
pause
