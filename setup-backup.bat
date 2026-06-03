@echo off
REM ============================================================
REM  AMASS Palnie - PORNESTE backup-ul automat zilnic (o data)
REM  ------------------------------------------------------------
REM  Inregistreaza o sarcina Windows care ruleaza  backup-daily.bat
REM  in FIECARE ZI la ora 02:00 (noaptea). Asa baza de date se
REM  salveaza singura, fara sa-ti amintesti tu.
REM
REM  Folosire: dublu-click O SINGURA DATA.
REM  (Daca da eroare de permisiuni: click dreapta - "Run as administrator".)
REM ============================================================
cd /d "%~dp0"
set "TASK=AMASS-Palnie-BackupZilnic"

echo Inregistrez backup-ul automat zilnic (la ora 02:00)...
schtasks /Create /TN "%TASK%" /TR "cmd /c \"%~dp0backup-daily.bat\"" /SC DAILY /ST 02:00 /F
if errorlevel 1 (
  echo.
  echo [EROARE] Nu am putut crea sarcina.
  echo   Solutie: click dreapta pe acest fisier - "Run as administrator".
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Gata! In fiecare noapte la 02:00 baza de date  prisma\dev.db
echo      se copiaza in folderul  backups\  (se pastreaza ultimele 30).
echo.
echo   - Faci un backup ACUM imediat: dublu-click pe  backup-daily.bat
echo   - Vezi copiile salvate in folderul:  backups\
echo   - Opresti backup-ul automat:  schtasks /Delete /TN "%TASK%" /F
echo.
pause
