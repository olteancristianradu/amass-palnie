@echo off
REM ============================================================
REM  AMASS Palnie - REPARARE bază (adaugă coloane lipsă) + reset admin.
REM  Rezolvă "column active does not exist" care bloca login-ul.
REM  NU pierde date: doar adaugă o coloană + setează parola adminului.
REM ============================================================
cd /d "%~dp0"
echo === [1/2] Sincronizez schema (db push)...
docker compose exec -T amass node node_modules/prisma/build/index.js db push --skip-generate
echo.
echo === [2/2] Ma asigur ca exista coloana 'active' + resetez admin@amass.ro ===
docker compose exec -T amass node -e "const{PrismaClient}=require('@prisma/client');const b=require('bcryptjs');const p=new PrismaClient();(async()=>{try{await p.$executeRawUnsafe('ALTER TABLE User ADD COLUMN active BOOLEAN DEFAULT 1')}catch(e){}try{await p.$executeRawUnsafe('UPDATE User SET active=1 WHERE active IS NULL')}catch(e){}const h=b.hashSync('Amass2026!',10);await p.$executeRawUnsafe('UPDATE User SET passwordHash=?, active=1 WHERE email=?',h,'admin@amass.ro');const c=await p.user.count();console.log('GATA. Useri in baza:',c,'| admin@amass.ro parola: Amass2026!')})().catch(e=>console.log('ERR',e.message))"
echo.
echo Acum login: http://localhost:3000/login  ^|  email: admin@amass.ro  ^|  parola: Amass2026!
echo.
pause
