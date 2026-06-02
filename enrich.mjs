import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
const p = new PrismaClient();
const creds = await p.crmCredentials.findFirst({ where: { crmUser: { not: '' } } });
function gk(){const e=process.env.CRYPTO_KEY;return e?Buffer.from(e,'base64'):crypto.scryptSync('amass-dev-default-key','amass-salt',32);}
function dec(ct){const k=gk();const b=Buffer.from(ct,'base64');const iv=b.slice(0,12),t=b.slice(12,28),e=b.slice(28);const d=crypto.createDecipheriv('aes-256-gcm',k,iv);d.setAuthTag(t);return Buffer.concat([d.update(e),d.final()]).toString('utf8');}
const BASE='https://gestcom.ro/amass/index.php';
function cc(h){const s=[];h.forEach((v,k)=>{if(k.toLowerCase()==='set-cookie')v.split(',').forEach(pt=>{const eq=pt.split(';')[0];if(eq.includes('='))s.push(eq.trim());});});return s.join('; ');}
let r1=await fetch(BASE+'?m=login',{redirect:'manual'});let jar=cc(r1.headers);
let r2=await fetch(BASE,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:jar},body:new URLSearchParams({login:'autentificare',lostpass:'0',redirect:'',username:creds.crmUser,password:dec(creds.crmPassEnc)}).toString()});
jar=jar+'; '+cc(r2.headers);
function decE(s){return String(s||'').replace(/<br\s*\/?>/gi,'\n').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&nbsp;/g,' ').replace(/&abreve;/gi,'ă').replace(/&acirc;/gi,'â').replace(/&icirc;/gi,'î').replace(/&scedil;/gi,'ș').replace(/&scaron;/gi,'ș').replace(/&tcedil;/gi,'ț').replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(parseInt(d,10))).replace(/&amp;/g,'&').trim();}
const active = await p.client.findMany({ where: { OR:[{stadiu:null},{stadiu:''}] }, select:{id:true,idLucrare:true} });
console.log('enriching', active.length, 'active clients...');
let done=0, withObs=0;
for (const c of active) {
  try {
    const fr=await fetch(BASE+'?m=lucrari&a=addedit&id_lucrare='+c.idLucrare,{headers:{Cookie:jar}});
    const html=await fr.text();
    const obsM=html.match(/<textarea[^>]*name="observatii_lucrare"[^>]*>([\s\S]*?)<\/textarea>/i);
    const obs=obsM?decE(obsM[1]):'';
    // open reminders count + last
    let remTxt='';
    try{const rr=await fetch(BASE+'?m=remindere&a=lista_remindere&suppressHeaders=1&tip_reminder=0&status_reminder=0&idlucrare_reminder='+c.idLucrare,{headers:{Cookie:jar}});const rd=JSON.parse(await rr.text());if(Array.isArray(rd)&&rd.length){const o=rd.filter(x=>String(x.status_reminder)==='0').sort((a,b)=>String(a.datareminder_reminder).localeCompare(String(b.datareminder_reminder)));if(o[0]){const d=o[0].datareminder_reminder;remTxt=(d&&/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4):'')+' · '+decE(String(o[0].info_reminder||'')).replace(/\n+/g,' ').slice(0,300);}}}catch{}
    await p.client.update({where:{id:c.id},data:{observatii:obs||null,reminderText:remTxt||null}});
    if(obs)withObs++;
    done++;
    if(done%50===0)console.log(done+'/'+active.length+' ('+withObs+' cu obs)');
    await new Promise(r=>setTimeout(r,60));
  } catch(e){ console.log('err',c.idLucrare,e.message); }
}
console.log('DONE enrich:',done,'| cu observatii:',withObs);
await p.$disconnect();
