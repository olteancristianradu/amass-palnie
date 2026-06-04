@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  AMASS Palnie - actualizare AUTOMATA, SIGURA + AUTO-DIAGNOZA.
REM  VERIFICA UNELTE -> backup -> pull(verificat) -> rebuild(verificat)
REM  -> health-check -> rollback daca e stricat.
REM  ORICE esec e LOGAT clar in auto-update.log (nu mai trece tacut).
REM ============================================================
cd /d "%~dp0"
set "LOG=%~dp0auto-update.log"
echo.>> "%LOG%"
echo ============================================================>> "%LOG%"
echo [%date% %time%] PORNIRE auto-update>> "%LOG%"

REM --- 0) UNELTE: cea mai frecventa cauza de esec = git/docker NU sunt in PATH-ul Task Scheduler ---
where git   >nul 2>&1 || (echo [EROARE] 'git' nu e gasit ^(adauga Git in PATH-ul de SISTEM, nu doar user^).>> "%LOG%" & exit /b 2)
where docker>nul 2>&1 || (echo [EROARE] 'docker' nu e gasit ^(Docker Desktop instalat + in PATH SISTEM^).>> "%LOG%" & exit /b 2)
where curl  >nul 2>&1 || (echo [EROARE] 'curl' nu e gasit.>> "%LOG%" & exit /b 2)
docker info >nul 2>&1 || (echo [EROARE] Docker nu raspunde - Docker Desktop e PORNIT si vizibil pt contul care ruleaza task-ul?>> "%LOG%" & exit /b 2)

REM --- 1) Exista ceva nou pe GitHub? ---
git fetch origin main >> "%LOG%" 2>&1 || (echo [EROARE] 'git fetch' a esuat ^(retea / acces repo^).>> "%LOG%" & exit /b 3)
for /f %%a in ('git rev-parse HEAD') do set "PREV=%%a"
for /f %%a in ('git rev-parse origin/main') do set "REMOTE=%%a"
if "!PREV!"=="!REMOTE!" (
  echo [%date% %time%] La zi ^(!PREV:~0,7!^) - nimic de actualizat.>> "%LOG%"
  exit /b 0
)
echo [%date% %time%] Update gasit: !PREV:~0,7! -^> !REMOTE:~0,7!>> "%LOG%"

REM --- 2) BACKUP baza inainte de orice ---
docker run --rm -v amass-palnie_amass-data:/d -v "%cd%":/b alpine tar czf /b/backup-before-update.tgz -C /d . >> "%LOG%" 2>&1
echo [%date% %time%] Backup baza facut (backup-before-update.tgz).>> "%LOG%"

REM --- 3) PULL (VERIFICAT - daca esueaza NU mai rebuild-uim cod vechi tacut) ---
git pull --ff-only origin main >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [EROARE] 'git pull' a ESUAT ^(modificari locale? istoric divergent?^). NU continui.>> "%LOG%"
  echo         Pe server: 'git status' si rezolva, sau 'git reset --hard origin/main' ^(pierde modificari locale necomise^).>> "%LOG%"
  exit /b 4
)

REM --- 4) REBUILD (VERIFICAT - daca build-ul pica, mergem la rollback, nu raportam fals OK) ---
docker compose up -d --build >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [EROARE] 'docker compose up --build' a ESUAT. Fac ROLLBACK.>> "%LOG%"
  goto :rollback
)

REM --- 5) HEALTH-CHECK (pana la 2 min: 24 x 5s) ---
echo [%date% %time%] Health-check (max 2 min)...>> "%LOG%"
set "OK="
for /l %%i in (1,1,24) do (
  if not defined OK (
    timeout /t 5 /nobreak >nul
    curl -s -f http://localhost:3000/api/health >nul 2>&1 && set "OK=1"
  )
)
if defined OK (
  echo [%date% %time%] OK - update SANATOS aplicat ^(acum !REMOTE:~0,7!^).>> "%LOG%"
  exit /b 0
)
echo [%date% %time%] NESANATOS dupa 2 min - fac ROLLBACK.>> "%LOG%"

:rollback
echo [%date% %time%] ROLLBACK la versiunea anterioara !PREV:~0,7!...>> "%LOG%"
git reset --hard !PREV! >> "%LOG%" 2>&1
docker compose up -d --build >> "%LOG%" 2>&1
echo [%date% %time%] Rollback terminat - ruleaza versiunea anterioara (buna). Datele intacte.>> "%LOG%"
exit /b 1
