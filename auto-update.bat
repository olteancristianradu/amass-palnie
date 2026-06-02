@echo off
REM ============================================================
REM  AMASS Palnie - actualizare AUTOMATA, SIGURA (nesupravegheat).
REM  Pas cu pas: BACKUP -> update -> HEALTH-CHECK -> ROLLBACK daca e stricat.
REM  Datele NU se pierd (volum + backup). Daca update-ul e nesanatos,
REM  aplicatia revine SINGURA la versiunea anterioara buna.
REM ============================================================
cd /d "%~dp0"
git fetch origin main >nul 2>&1
for /f %%a in ('git rev-parse HEAD') do set "PREV=%%a"
for /f %%a in ('git rev-parse origin/main') do set "REMOTE=%%a"
if "%PREV%"=="%REMOTE%" (
  echo [%date% %time%] La zi - nimic de actualizat.>> auto-update.log
  exit /b 0
)

echo [%date% %time%] Update gasit (%REMOTE%). Backup baza...>> auto-update.log
docker run --rm -v amass-palnie_amass-data:/d -v "%cd%":/b alpine tar czf /b/backup-before-update.tgz -C /d . >> auto-update.log 2>&1

echo [%date% %time%] Aplic update...>> auto-update.log
git pull origin main >> auto-update.log 2>&1
docker compose up -d --build >> auto-update.log 2>&1

echo [%date% %time%] Health-check (max 2 min)...>> auto-update.log
set "OK="
for /l %%i in (1,1,24) do (
  if not defined OK (
    timeout /t 5 /nobreak >nul
    curl -s -f http://localhost:3000/api/health >nul 2>&1 && set "OK=1"
  )
)
if defined OK (
  echo [%date% %time%] OK - update sanatos, aplicat.>> auto-update.log
  exit /b 0
)

echo [%date% %time%] NESANATOS dupa 2 min - ROLLBACK la versiunea anterioara %PREV%...>> auto-update.log
git reset --hard %PREV% >> auto-update.log 2>&1
docker compose up -d --build >> auto-update.log 2>&1
echo [%date% %time%] Rollback terminat - ruleaza versiunea anterioara (buna). Datele intacte.>> auto-update.log
exit /b 1
