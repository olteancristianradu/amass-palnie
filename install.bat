@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ============================================================
echo    AMASS Palnie - Instalare automata (Windows)
echo ============================================================
echo.

REM --- 1) Verifica Docker ---
docker version >nul 2>&1
if errorlevel 1 (
  echo [EROARE] Docker nu raspunde.
  echo   - Deschide "Docker Desktop" si asteapta sa scrie "Engine running" jos-stanga.
  echo   - Daca nu e instalat: https://www.docker.com/products/docker-desktop/
  echo   Apoi ruleaza din nou acest fisier.
  echo.
  pause
  exit /b 1
)
echo [OK] Docker raspunde.
echo.

REM --- 2) Fisierul .env cu 2 chei generate automat ---
if exist ".env" (
  echo [INFO] .env exista deja - il pastrez (nu suprascriu cheile/datele).
) else (
  if not exist ".env.example" ( echo [EROARE] lipseste .env.example - esti in folderul gresit? & pause & exit /b 1 )
  copy /y ".env.example" ".env" >nul
  for /f "delims=" %%K in ('powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b)"') do set "NSEC=%%K"
  for /f "delims=" %%K in ('powershell -NoProfile -Command "$b=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b);[Convert]::ToBase64String($b)"') do set "CKEY=%%K"
  set "PUBURL="
  set /p "PUBURL=Adresa publica a serverului (ENTER pentru http://localhost:3000): "
  if "!PUBURL!"=="" set "PUBURL=http://localhost:3000"
  powershell -NoProfile -Command "(Get-Content .env) -replace '^NEXTAUTH_SECRET=.*','NEXTAUTH_SECRET=!NSEC!' -replace '^CRYPTO_KEY=.*','CRYPTO_KEY=!CKEY!' -replace '^NEXTAUTH_URL=.*','NEXTAUTH_URL=!PUBURL!' | Set-Content -Encoding ascii .env"
  echo [OK] .env creat (chei generate automat, NEXTAUTH_URL=!PUBURL!).
)
echo.

REM --- 3) Construieste si porneste ---
echo Construiesc si pornesc aplicatia (prima data dureaza 1-3 minute)...
docker compose up -d --build
if errorlevel 1 ( echo [EROARE] docker compose a esuat. Trimite-mi textul de mai sus. & pause & exit /b 1 )
echo [OK] Container pornit.
echo.

echo Astept sa fie gata...
timeout /t 20 /nobreak >nul

REM --- 4) Primul cont admin (doar daca nu exista deja) ---
echo === Creare primul cont ADMIN ===
set "AEMAIL="
set "APASS="
set "ANAME="
set /p "AEMAIL=Email admin: "
set /p "APASS=Parola admin (min 8 caractere): "
set /p "ANAME=Nume admin: "
curl -s -X POST http://localhost:3000/api/setup -H "Content-Type: application/json" -d "{\"email\":\"!AEMAIL!\",\"password\":\"!APASS!\",\"name\":\"!ANAME!\"}"
echo.
echo.
echo ============================================================
echo    GATA!  Deschide in browser:  http://localhost:3000
echo    Te loghezi cu adminul creat mai sus.
echo    (Daca scrie "Setup deja facut" = contul exista deja, e ok.)
echo ============================================================
echo.
pause
