@echo off
REM ============================================================
REM  AMASS Palnie - RESETARE ADMIN de urgenta (cand nu mai poti intra).
REM  Reseteaza parola TUTUROR conturilor admin la:  Amass2026!
REM  si le reactiveaza (active=true). NU sterge nimic, NU atinge clientii.
REM  Dublu-click, apoi te loghezi cu emailul de admin afisat + parola Amass2026!
REM ============================================================
cd /d "%~dp0"
echo Resetez parola adminului la "Amass2026!" si reactivez contul...
echo.
docker compose exec -T amass node -e "const{PrismaClient}=require('@prisma/client');const b=require('bcryptjs');const p=new PrismaClient();(async()=>{const h=await b.hash('Amass2026!',10);const r=await p.user.updateMany({where:{role:'admin'},data:{passwordHash:h,active:true}});const a=await p.user.findMany({where:{role:'admin'},select:{email:true}});console.log('OK - resetat',r.count,'cont(uri) admin:');a.forEach(x=>console.log('   email:',x.email));console.log('   parola: Amass2026!')})().catch(e=>console.log('EROARE:',e.message))"
echo.
echo Acum deschide aplicatia si logheaza-te cu un email de admin de mai sus + parola: Amass2026!
echo (Schimba parola din Setari/Echipa dupa ce intri.)
echo.
pause
