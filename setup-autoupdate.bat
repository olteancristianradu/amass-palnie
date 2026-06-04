@echo off
REM ============================================================
REM  AMASS Palnie - PORNESTE actualizarea automata (o singura data)
REM  Inregistreaza o sarcina Windows care ruleaza auto-update.bat la 2h.
REM  RULEAZA ACEST FISIER CA ADMINISTRATOR (click dreapta -> Run as administrator).
REM ============================================================
cd /d "%~dp0"
set "TASK=AMASS-Palnie-AutoUpdate"

REM Verifica drepturi de admin (schtasks /RL HIGHEST le cere).
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ATENTIE] Nu rulezi ca administrator. schtasks poate esua.
  echo           Inchide, apoi click DREAPTA pe acest fisier -^> "Run as administrator".
  echo.
  pause
)

echo Inregistrez actualizarea automata (la fiecare 2 ore, cu privilegii ridicate)...
REM /RL HIGHEST = privilegii ridicate; /SC HOURLY /MO 2 = la fiecare 2 ore.
REM NOTA: implicit task-ul ruleaza DOAR cand utilizatorul e LOGAT. E corect aici, fiindca
REM Docker Desktop ruleaza in sesiunea utilizatorului - daca nimeni nu e logat, Docker oricum
REM nu e pornit. DECI: serverul trebuie sa ramana LOGAT cu Docker Desktop pornit.
schtasks /Create /TN "%TASK%" /TR "cmd /c \"%~dp0auto-update.bat\"" /SC HOURLY /MO 2 /RL HIGHEST /F
if errorlevel 1 (
  echo.
  echo [EROARE] Nu am putut crea sarcina. Ruleaza ca administrator.
  echo.
  pause
  exit /b 1
)

echo.
echo [OK] Sarcina creata. Rulez ACUM o verificare ca sa confirm ca merge...
schtasks /Run /TN "%TASK%" >nul 2>&1
echo     ^(Asteapta ~1-2 min, apoi deschide auto-update.log sa vezi rezultatul.^)
echo.
echo VERIFICARI utile:
echo   - Vezi cand a rulat ultima data:   schtasks /Query /TN "%TASK%" /V /FO LIST
echo   - Istoric + erori:                 deschide auto-update.log
echo   - Rulezi manual oricand:           dublu-click pe auto-update.bat
echo   - Opresti auto-update:             schtasks /Delete /TN "%TASK%" /F
echo.
echo IMPORTANT pentru ca update-ul automat sa MEARGA:
echo   1) Docker Desktop trebuie sa porneasca automat + serverul sa ramana LOGAT.
echo   2) git, docker si curl trebuie sa fie in PATH-ul de SISTEM (nu doar user).
echo      Verifica:  where git  ^&  where docker  ^&  where curl
echo.
pause
