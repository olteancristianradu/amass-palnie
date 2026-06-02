@echo off
REM ============================================================
REM  AMASS Palnie - actualizare AUTOMATA (rulata de Task Scheduler)
REM  Verifica GitHub; daca exista versiune noua, o trage si reconstruieste.
REM  Daca nu e nimic nou, NU face nimic (fara downtime).
REM  Datele raman (volumul Docker amass-palnie_amass-data).
REM ============================================================
cd /d "%~dp0"
git fetch origin main >nul 2>&1
for /f %%a in ('git rev-parse HEAD') do set "LOCAL=%%a"
for /f %%a in ('git rev-parse origin/main') do set "REMOTE=%%a"
if "%LOCAL%"=="%REMOTE%" (
  echo [%date% %time%] La zi - nimic de actualizat.>> auto-update.log
  exit /b 0
)
echo [%date% %time%] Versiune noua gasita - actualizez...>> auto-update.log
git pull origin main >> auto-update.log 2>&1
docker compose up -d --build >> auto-update.log 2>&1
echo [%date% %time%] GATA - aplicatie actualizata.>> auto-update.log
exit /b 0
