@echo off
REM ============================================================
REM  AMASS Palnie - PORNESTE actualizarea automata (o singura data)
REM  Inregistreaza o sarcina Windows care ruleaza auto-update.bat
REM  la fiecare 2 ore => serverul trage SINGUR modificarile noastre.
REM  Dublu-click o data. (Daca da eroare, click dreapta - Run as administrator.)
REM ============================================================
cd /d "%~dp0"
set "TASK=AMASS-Palnie-AutoUpdate"
echo Inregistrez actualizarea automata (la fiecare 2 ore)...
schtasks /Create /TN "%TASK%" /TR "cmd /c \"%~dp0auto-update.bat\"" /SC HOURLY /MO 2 /F
if errorlevel 1 (
  echo.
  echo [EROARE] Nu am putut crea sarcina.
  echo   Solutie: click dreapta pe acest fisier - "Run as administrator".
  echo.
  pause
  exit /b 1
)
echo.
echo [OK] Gata! Serverul verifica GitHub la fiecare 2 ore si trage singur
echo      modificarile noi (reconstruieste doar cand chiar exista ceva nou).
echo.
echo   - Vezi istoricul in fisierul: auto-update.log
echo   - Verifici acum imediat: dublu-click pe auto-update.bat
echo   - Opresti auto-update: schtasks /Delete /TN "%TASK%" /F
echo.
pause
