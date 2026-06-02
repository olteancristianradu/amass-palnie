# ============================================================
#  AMASS Palnie - instalare (PowerShell)
#  Rulare (din PowerShell, in folderul repo-ului):
#     Set-ExecutionPolicy -Scope Process Bypass -Force ; .\install.ps1
#  sau:  powershell -ExecutionPolicy Bypass -File .\install.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
if ($PSScriptRoot) { Set-Location $PSScriptRoot }
Write-Host ""
Write-Host "=== AMASS Palnie - instalare ===" -ForegroundColor Cyan
Write-Host ""

# 1) Docker pornit?
try { docker version *> $null } catch {
  Write-Host "[EROARE] Docker nu raspunde." -ForegroundColor Red
  Write-Host "  Deschide 'Docker Desktop', asteapta sa scrie 'Engine running' (verde, jos-stanga), apoi reia." -ForegroundColor Yellow
  Read-Host "Apasa Enter pentru a inchide"; exit 1
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "[EROARE] Docker nu raspunde. Porneste Docker Desktop si reia." -ForegroundColor Red
  Read-Host "Apasa Enter pentru a inchide"; exit 1
}
Write-Host "[OK] Docker ruleaza." -ForegroundColor Green

# 2) .env cu 2 chei generate automat
if (Test-Path .env) {
  Write-Host "[INFO] .env exista deja - il pastrez (nu schimb cheile/datele)."
} else {
  if (-not (Test-Path .env.example)) { Write-Host "[EROARE] lipseste .env.example - esti in folderul gresit?" -ForegroundColor Red; Read-Host "Enter"; exit 1 }
  Copy-Item .env.example .env
  function New-Key { $b = New-Object byte[] 32; [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); return [Convert]::ToBase64String($b) }
  $nsec = New-Key; $ckey = New-Key
  $url = Read-Host "Adresa publica a serverului (Enter pentru http://localhost:3000)"
  if ([string]::IsNullOrWhiteSpace($url)) { $url = "http://localhost:3000" }
  (Get-Content .env) `
    -replace '^NEXTAUTH_SECRET=.*', "NEXTAUTH_SECRET=$nsec" `
    -replace '^CRYPTO_KEY=.*', "CRYPTO_KEY=$ckey" `
    -replace '^NEXTAUTH_URL=.*', "NEXTAUTH_URL=$url" | Set-Content .env -Encoding ascii
  Write-Host "[OK] .env creat (chei generate automat, NEXTAUTH_URL=$url)." -ForegroundColor Green
}

# 3) Build + pornire
Write-Host ""
Write-Host "Construiesc si pornesc aplicatia (prima data 1-3 minute)..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Write-Host "[EROARE] docker compose a esuat (vezi mesajul de mai sus). Trimite-mi textul." -ForegroundColor Red; Read-Host "Enter"; exit 1 }
Write-Host "[OK] Container pornit." -ForegroundColor Green

Write-Host "Astept sa fie gata..."; Start-Sleep -Seconds 20

# 4) Primul cont admin
Write-Host ""
Write-Host "=== Creare primul cont ADMIN ===" -ForegroundColor Cyan
$email = Read-Host "Email admin"
$pass  = Read-Host "Parola admin (minim 8 caractere)"
$name  = Read-Host "Nume admin"
$body = @{ email = $email; password = $pass; name = $name } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Uri http://localhost:3000/api/setup -Method Post -ContentType 'application/json' -Body $body | Out-Null
  Write-Host "[OK] Cont admin creat." -ForegroundColor Green
} catch {
  Write-Host "[INFO] $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "       (daca raspunsul zice 'Setup deja facut' = contul exista deja, e in regula)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  GATA!  Deschide in browser:  http://localhost:3000" -ForegroundColor Green
Write-Host "  Te loghezi cu adminul creat mai sus." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Apasa Enter pentru a inchide"
