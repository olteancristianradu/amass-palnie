@echo off
REM ============================================================
REM  AMASS Palnie - BACKUP ZILNIC al bazei de date
REM  ------------------------------------------------------------
REM  Ce face:
REM    1. EXTRAGE baza din containerul Docker (amass:/app/prisma/dev.db = volumul amass-data)
REM       in  backups\dev-AAAALLZZ-HHMM.db (cu data si ora in nume, ca sa nu se suprascrie).
REM    2. Pastreaza doar ultimele 30 de copii; pe cele mai vechi
REM       le sterge automat.
REM
REM  Rulat automat in fiecare zi la ora 02:00 de catre sarcina
REM  Windows creata cu  setup-backup.bat .
REM  Poti rula si manual oricand (dublu-click).
REM ============================================================
setlocal EnableExtensions
cd /d "%~dp0"

set "DEST=backups"
set "KEEP=30"

REM --- Verific ca Docker raspunde (baza traieste in VOLUMUL containerului, nu pe disc local) ---
docker info >nul 2>&1
if errorlevel 1 (
  echo [EROARE] Docker nu raspunde. Porneste Docker Desktop si reincearca.
  exit /b 1
)

REM --- Ma asigur ca exista folderul de backup-uri ---
if not exist "%DEST%" mkdir "%DEST%"

REM --- Construiesc marca de timp AAAALLZZ-HHMM, independent de regiune ---
REM  WMIC da o data fixa  AAAALLZZHHMMSS  (fara ambiguitati de format).
for /f %%i in ('wmic os get LocalDateTime ^| find "."') do set "DT=%%i"
set "STAMP=%DT:~0,8%-%DT:~8,4%"
REM  Daca WMIC nu e disponibil (Windows mai nou), cad pe data din sistem.
if "%STAMP%"=="-" set "STAMP=%date:~-4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%"
set "STAMP=%STAMP: =0%"

set "TARGET=%DEST%\dev-%STAMP%.db"

REM --- Fac copia: EXTRAG baza din containerul Docker (volumul amass-data), nu de pe disc local ---
echo.
echo === Fac backup: amass:/app/prisma/dev.db  ->  %TARGET%
docker compose cp amass:/app/prisma/dev.db "%TARGET%" >nul 2>&1
if errorlevel 1 (
  echo [EROARE] Nu am putut extrage baza din container. Containerul 'amass-console' ruleaza? (docker compose ps)
  exit /b 1
)
echo [OK] Backup creat: %TARGET%

REM --- Pastrez doar ultimele %KEEP% copii, sterg restul (cele mai vechi) ---
REM  Listez fisierele dev-*.db ordonate dupa data (cele mai noi primele),
REM  sar peste primele %KEEP% si sterg ce ramane.
set /a IDX=0
for /f "delims=" %%f in ('dir /b /o-d "%DEST%\dev-*.db" 2^>nul') do (
  set /a IDX+=1
  setlocal EnableDelayedExpansion
  if !IDX! GTR %KEEP% (
    del /f /q "%DEST%\%%f" >nul 2>&1
    echo     - Sters backup vechi: %%f
  )
  endlocal
)

echo.
echo === GATA. Pastrez ultimele %KEEP% copii in folderul "%DEST%".
endlocal
exit /b 0
