# ============================================================
#  AMASS Palnie - acces din retea (LAN)
#  Detecteaza IP-ul serverului, il pune in .env (NEXTAUTH_URL),
#  deschide portul 3000 in firewall si reporneste aplicatia.
#  Rulare: Set-ExecutionPolicy -Scope Process Bypass -Force ; .\setup-network.ps1
#  (Pentru firewall e nevoie de Administrator — vezi mesajul daca nu esti.)
# ============================================================
$ErrorActionPreference = 'Stop'
if ($PSScriptRoot) { Set-Location $PSScriptRoot }
Write-Host ""
Write-Host "=== AMASS Palnie - acces din retea ===" -ForegroundColor Cyan

if (-not (Test-Path .env)) { Write-Host "[EROARE] lipseste .env - ruleaza intai install.ps1." -ForegroundColor Red; Read-Host "Enter"; exit 1 }

# 1) IP-ul LAN al serverului (primul IPv4 privat, non-loopback)
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)' } |
       Select-Object -First 1).IPAddress
if (-not $ip) { $ip = Read-Host "Nu am gasit IP-ul automat. Scrie IP-ul serverului (ex. 192.168.1.50)" }
Write-Host "IP server: $ip" -ForegroundColor Cyan

# 2) NEXTAUTH_URL = http://IP:3000 (altfel login-ul de pe alt PC nu merge)
(Get-Content .env) -replace '^NEXTAUTH_URL=.*', "NEXTAUTH_URL=http://${ip}:3000" | Set-Content .env -Encoding ascii
Write-Host "[OK] NEXTAUTH_URL = http://${ip}:3000" -ForegroundColor Green

# 3) Firewall: deschide portul 3000 (necesita Administrator)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
  Remove-NetFirewallRule -DisplayName "AMASS Palnie 3000" -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "AMASS Palnie 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow | Out-Null
  Write-Host "[OK] Port 3000 deschis in firewall." -ForegroundColor Green
} else {
  Write-Host "[ATENTIE] Nu rulezi ca Administrator -> portul 3000 NU a fost deschis." -ForegroundColor Yellow
  Write-Host "  Deschide PowerShell ca Administrator si ruleaza o singura data:" -ForegroundColor Yellow
  Write-Host '  New-NetFirewallRule -DisplayName "AMASS Palnie 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow' -ForegroundColor White
}

# 4) Reporneste containerul ca sa preia noul NEXTAUTH_URL
Write-Host "Repornesc aplicatia cu noua adresa..." -ForegroundColor Cyan
docker compose up -d

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  De pe ORICE PC din retea deschide:  http://${ip}:3000" -ForegroundColor Green
Write-Host "  (PC-ul server ramane si pe http://localhost:3000)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Sfat: pune IP STATIC / rezervare DHCP pe server, altfel daca se schimba IP-ul, rulezi iar acest script." -ForegroundColor DarkGray
Write-Host ""
Read-Host "Enter pentru a inchide"
