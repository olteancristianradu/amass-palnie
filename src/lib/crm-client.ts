/**
 * CRM Client — comunicare directă cu gestcom.ro/amass.
 * Reverse-engineered din Apps Script CRM_Sync.js v23.X (cod testat live).
 */

import { prisma } from './db';
import { decrypt } from './crypto';

const CRM_BASE = 'https://gestcom.ro/amass/index.php';
const CRM_LOGIN = CRM_BASE + '?m=login';

interface CookieJar { cookie: string; utilizatorId?: string; }

async function getCachedOrLogin(userId: string): Promise<CookieJar> {
  const creds = await prisma.crmCredentials.findUnique({ where: { userId } });
  if (!creds) throw new Error('Utilizatorul nu are credentiale CRM.');
  if (creds.cookieJar && creds.cookieTs) {
    // FIX 2026-05-31: gestcom expiră sesiunea sub 24h (verificat: cookie de 19h era deja mort).
    // Coborât la 6h ca să re-logăm proactiv; bounce-retry-ul din fetchList/push/steluță/reminder
    // rămâne plasa de siguranță dacă expiră chiar și mai devreme.
    const ageHours = (Date.now() - creds.cookieTs.getTime()) / (1000 * 60 * 60);
    if (ageHours < 6) return { cookie: creds.cookieJar, utilizatorId: creds.utilizatorId ?? undefined };
  }
  const password = decrypt(creds.crmPassEnc);
  return await loginFresh(userId, creds.crmUser, password);
}

async function loginFresh(userId: string, user: string, pass: string): Promise<CookieJar> {
  const r1 = await fetch(CRM_LOGIN, { redirect: 'manual' });
  let jar = collectCookies(r1.headers);
  const payload = new URLSearchParams({
    login: 'autentificare', lostpass: '0', redirect: '',
    username: user, password: pass
  }).toString();
  const r2 = await fetch(CRM_BASE, {
    method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: jar },
    body: payload
  });
  jar = mergeCookies(jar, collectCookies(r2.headers));
  const r3 = await fetch(CRM_BASE + '?m=lucrari', { redirect: 'manual', headers: { Cookie: jar } });
  const html = await r3.text();
  if (html.includes('loginform') || (html.includes('Autentificare') && !html.includes('id_lucrare'))) {
    throw new Error('Login CRM eșuat — verifică user/parolă.');
  }
  let utilizatorId: string | undefined;
  const selMatch = html.match(/<select[^>]*name=["']utilizator_id["'][^>]*>([\s\S]*?)<\/select>/i);
  if (selMatch) {
    const optMatch = selMatch[1].match(/<option[^>]*value=["'](\d+)["'][^>]*>(?!\s*-\s*<)([^<]+)<\/option>/i);
    if (optMatch && optMatch[1] !== '0') utilizatorId = optMatch[1];
  }
  await prisma.crmCredentials.update({
    where: { userId },
    data: { cookieJar: jar, cookieTs: new Date(), utilizatorId }
  });
  return { cookie: jar, utilizatorId };
}

function collectCookies(headers: Headers): string {
  const setCookies: string[] = [];
  // FIX 2026-06-01: NU mai sparge pe virgulă. Atributele de cookie conțin virgule
  // (ex. `Expires=Wed, 09 Jun 2027 ...`) iar `value.split(',')` rupea perechea în fragmente
  // → jar corupt/incomplet → login intermitent eșuat. Folosim getSetCookie() (undici/Node 18.14+,
  // runtime Next nodejs) care întoarce un array de header-e Set-Cookie deja separate corect.
  // Fallback pe split robust /,(?=[^;]+?=)/ doar dacă getSetCookie lipsește (runtime mai vechi).
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  let raw: string[];
  if (typeof getSetCookie === 'function') {
    raw = getSetCookie.call(headers) || [];
  } else {
    const combined = headers.get('set-cookie') || '';
    // Spargere pe virgula care PRECEDE un nume de cookie (`name=`), nu pe virgula din Expires.
    raw = combined ? combined.split(/,(?=[^;,]+?=)/) : [];
  }
  raw.forEach(entry => {
    const eq = entry.split(';')[0];
    if (eq.includes('=')) setCookies.push(eq.trim());
  });
  return setCookies.join('; ');
}

function mergeCookies(a: string, b: string): string {
  const map = new Map<string, string>();
  [a, b].forEach(s => s.split(';').forEach(p => {
    const [k, ...v] = p.trim().split('=');
    if (k) map.set(k, v.join('='));
  }));
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

export async function login(userId: string): Promise<CookieJar> { return await getCachedOrLogin(userId); }

// Detectează dacă răspunsul e pagina de login (sesiune expirată) în loc de conținut real.
function isLoginPage(html: string): boolean {
  return html.includes('loginform') ||
    (html.includes('name="username"') && html.includes('name="password"')) ||
    (html.includes('Autentificare') && !html.includes('id_lucrare'));
}

export async function invalidateCookie(userId: string): Promise<void> {
  await prisma.crmCredentials.updateMany({
    where: { userId }, data: { cookieJar: null, cookieTs: null }
  });
}

/** Listă lucrări — paginare suppressHeaders cu return tot HTML cu id_lucrare-uri */
/**
 * Listă COMPLETĂ lucrări — replicat 1:1 din Apps Script fetchCRMList_.
 * gestcom NU folosește paginare URL; folosește SESSION STATE:
 *   1. POST inregpepag_id=5000 (page size 5000)
 *   2. POST filtru complet (situatielucrare_id=-1 toate, data_start 01.01.2020, utilizator_id)
 *   3. GET ?m=lucrari → toate id_lucrare pe o pagină
 */
export async function fetchList(userId: string): Promise<string[]> {
  let { cookie, utilizatorId } = await login(userId);

  const post = (payload: Record<string, string>) =>
    fetch(CRM_BASE + '?m=lucrari', {
      method: 'POST', redirect: 'follow',
      headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload).toString()
    });

  // Aplică starea de filtrare (page size 5000 + toate situațiile + istoric complet).
  const applyFilter = async () => {
    await post({ inregpepag_id: '5000' });
    await post({
      contactutilizator_id: '0', lucraredata_id: '0', tipdata_id: '0', culoare_id: '0',
      aplicatie_id: '0', sursalucrare_id: '0', situatielucrare_id: '-1',
      utilizator_id: utilizatorId || '0',
      data_start: '01.01.2020', judet_id: '0', localitate_id: '0', localitate_nume: '',
      prioritatelucrare_id: '0', info_filtre_extra: '', suprafata_min: '0', suprafata_max: '0', search_string: ''
    });
  };
  await applyFilter();
  // GET lista filtrată
  let r = await fetch(CRM_BASE + '?m=lucrari', { headers: { Cookie: cookie } });
  let html = await r.text();
  if (isLoginPage(html)) {
    await invalidateCookie(userId);
    const re = await login(userId); cookie = re.cookie; utilizatorId = re.utilizatorId;
    await applyFilter();  // FIX 2026-05-31: re-aplică filtrul COMPLET pe re-login, nu doar page-size (altfel lista revine filtrată default → mai puține id-uri)
    r = await fetch(CRM_BASE + '?m=lucrari', { headers: { Cookie: cookie } });
    html = await r.text();
  }
  const ids = new Set<string>();
  [...html.matchAll(/id_lucrare=(\d+)/g)].forEach(m => ids.add(m[1]));
  return [...ids].sort((a, b) => Number(a) - Number(b));
}

export interface CrmDetail {
  id: string;
  name: string;
  dataIntrare: string;
  situatie: string;
  t1: string;
  suprafata: number | '';
  hasAudio?: boolean;   // undefined = nedeterminat (eroare la listarea fișierelor) → NU suprascrie în DB
  stelutaCat: number;
  judet?: string;
  localitate?: string;
  sursa?: string;
  telefon?: string;
  email?: string;
  observatii?: string;
}

function decHtml(s: string): string {
  return String(s || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&abreve;/gi, 'ă').replace(/&acirc;/gi, 'â').replace(/&icirc;/gi, 'î')
    .replace(/&scedil;/gi, 'ș').replace(/&scaron;/gi, 'ș').replace(/&tcedil;/gi, 'ț')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .trim();
}

export async function fetchDetail(userId: string, idLucrare: string): Promise<CrmDetail> {
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  if (!idSafe) throw new Error('id_lucrare invalid');
  let { cookie } = await login(userId);
  let r = await fetch(CRM_BASE + '?m=lucrari&a=view&id_lucrare=' + idSafe, { headers: { Cookie: cookie } });
  if (r.status !== 200) throw new Error('CRM HTTP ' + r.status);
  let html = await r.text();
  if (isLoginPage(html)) {
    // sesiune expirată → re-login o dată
    await invalidateCookie(userId);
    cookie = (await login(userId)).cookie;
    r = await fetch(CRM_BASE + '?m=lucrari&a=view&id_lucrare=' + idSafe, { headers: { Cookie: cookie } });
    html = await r.text();
    if (isLoginPage(html)) throw new Error('CRM_SESSION_EXPIRED');
  }

  // Parse nume DIN INPUT name="nume_lucrare" value="..."
  let name = '';
  const nameMatch = html.match(/name="nume_lucrare"[^>]*value="([^"]*)"/);
  if (nameMatch) name = nameMatch[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

  // Data Intrare = Creator date
  let dataIntrare = '';
  const dateMatch = html.match(/Creator:[\s\S]{0,500}?(\d{2})\.(\d{2})\.(\d{4})/);
  if (dateMatch) dataIntrare = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;

  // Situatie din <select selected>
  let situatie = '';
  const sitSelectM = html.match(/<select[^>]*name=["']situatie_lucrare["'][\s\S]*?<\/select>/i);
  if (sitSelectM) {
    const selOpt = sitSelectM[0].match(/<option[^>]*\bselected\b[^>]*>([^<]+)</i);
    if (selOpt) situatie = selOpt[1].trim().toUpperCase();
  }
  if (!situatie) {
    const sitMatch = html.match(/SITUA[TȚ]IE\s*:\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (sitMatch) situatie = sitMatch[1].trim().toUpperCase();
  }

  // T1 = primul reminder bifat (status=3) cel mai vechi
  let t1 = '';
  try {
    const remUrl = CRM_BASE + '?m=remindere&a=lista_remindere&suppressHeaders=1&tip_reminder=0&status_reminder=0&idlucrare_reminder=' + idSafe;
    const remR = await fetch(remUrl, { headers: { Cookie: cookie } });
    const remTxt = await remR.text();
    const reminders = JSON.parse(remTxt);
    if (Array.isArray(reminders) && reminders.length > 0) {
      const dates = reminders
        .filter((r: any) => String(r.status_reminder) === '3')
        .map((r: any) => r.datareminder_reminder)
        .filter((d: string) => d && d !== '0000-00-00' && /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort();
      if (dates.length > 0) {
        const p = dates[0].split('-');
        t1 = `${p[2]}/${p[1]}/${p[0]}`;
      }
    }
  } catch {}

  // Suprafata din class="hilite">SUPRAFATA:</td><td class="hilite2">NUM m²</td>
  let suprafata: number | '' = '';
  const supMatch = html.match(/class="hilite">SUPRAFATA:<\/td>\s*<td[^>]*class="hilite2"[^>]*>([\s\S]*?)<\/td>/);
  if (supMatch) {
    const supRaw = supMatch[1].trim();
    const numMatch = supRaw.match(/([\d.,]+)/);
    if (numMatch) suprafata = parseFloat(numMatch[1].replace(',', '.')) || '';
  }

  // Audio prin AJAX fișiere. FAIL-SAFE (paritate spreadsheet): o eroare tranzitorie la listarea
  // fișierelor NU trebuie să marcheze fals clientul „fără audio". undefined ⇒ Prisma update sare
  // peste câmp ⇒ păstrează marcajul existent (la create cade pe default-ul de schemă = true).
  let hasAudio: boolean | undefined = false;
  try {
    const filesR = await fetch(CRM_BASE + '?m=files&a=lista_fisiere&suppressHeaders=1&id_lucrare=' + idSafe,
      { headers: { Cookie: cookie } });
    if (filesR.status !== 200) throw new Error('files HTTP ' + filesR.status);
    const filesTxt = await filesR.text();
    if (isLoginPage(filesTxt)) throw new Error('files: sesiune expirată');
    hasAudio = /\.(amr|mp3|mp4|ogg|wav|m4a|aac|opus|3gp|wma|flac)/i.test(filesTxt) || /WhatsApp\s+Audio/i.test(filesTxt);
  } catch {
    hasAudio = undefined;
  }

  // Steluță categorie favorit
  let stelutaCat = 0;
  const stelM = html.match(new RegExp('adfav\\(' + idSafe + ',\\s*this\\)[\\s\\S]{0,1500}<\\/select>', 'i'));
  if (stelM) {
    const optM = stelM[0].match(/<option\b[^>]*value=["'](\d)["'][^>]*\bselected\b/i)
              || stelM[0].match(/<option\b[^>]*\bselected\b[^>]*value=["'](\d)["']/i);
    if (optM) stelutaCat = parseInt(optM[1], 10);
  }

  // Observatii pentru autofill strategie + contact
  let observatii = '';
  const obsTextarea = html.match(/<textarea[^>]*name="observatii_lucrare"[^>]*>([\s\S]*?)<\/textarea>/i);
  if (obsTextarea) observatii = decHtml(obsTextarea[1]);

  // Județ, localitate, sursa, telefon, email — best-effort
  const getTd = (re: RegExp) => { const m = html.match(re); return m ? decHtml(m[1]) : ''; };
  const judet = getTd(/JUDET\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const localitate = getTd(/LOCALITATE\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const sursa = getTd(/SURSA\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  const telM = observatii.match(/Telefon:\s*([^\n]+)/i);
  const emailM = observatii.match(/Email:\s*([^\n\s]+)/i);

  return {
    id: idSafe, name, dataIntrare, situatie, t1,
    suprafata, hasAudio, stelutaCat,
    judet, localitate, sursa,
    telefon: telM ? telM[1].trim() : undefined,
    email: emailM ? emailM[1].trim() : undefined,
    observatii
  };
}

export async function fetchUltimulReminderDeschis(userId: string, idLucrare: string): Promise<string> {
  const { cookie } = await login(userId);
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  const url = CRM_BASE + '?m=remindere&a=lista_remindere&suppressHeaders=1&tip_reminder=0&status_reminder=0&idlucrare_reminder=' + idSafe;
  const r = await fetch(url, { headers: { Cookie: cookie } });
  const txt = await r.text();
  let data: any;
  try { data = JSON.parse(txt); } catch { return ''; }
  if (!Array.isArray(data)) return '';

  // Caut reminders deschise (status=0) sortez după data ASC, iau primul
  const deschise = data
    .filter((x: any) => String(x.status_reminder) === '0')
    .sort((a: any, b: any) => String(a.datareminder_reminder).localeCompare(String(b.datareminder_reminder)));
  if (deschise.length === 0) return '';

  const r0 = deschise[0];
  // Coduri reale CRM gestcom (din RemindereDialog.html): 8=TELEFON, NU 0.
  const TIPURI: Record<string, string> = {
    '1': 'INTALNIRE', '2': 'DELEGATIE', '4': 'ASISTENTA', '5': 'SERVICE', '6': 'MONTAJ',
    '8': 'TELEFON', '9': 'EMAIL', '10': 'SMS', '11': 'TRIM. OFERTA', '12': 'REDACTARE CONTRACT',
    '13': 'INTREBARE', '14': 'RASPUNS', '16': 'IMPINGERE CONTRACT'
  };
  const d = r0.datareminder_reminder;
  const dataf = /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '';
  const ora = String(r0.orareminder_reminder || '').slice(0, 5);
  const tip = TIPURI[String(r0.tip_reminder)] || '';

  let info = String(r0.info_reminder || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&abreve;/gi, 'ă').replace(/&Abreve;/g, 'Ă')
    .replace(/&acirc;/gi, 'â').replace(/&Acirc;/g, 'Â')
    .replace(/&icirc;/gi, 'î').replace(/&Icirc;/g, 'Î')
    .replace(/&scedil;/gi, 'ș').replace(/&Scedil;/g, 'Ș').replace(/&scaron;/gi, 'ș')
    .replace(/&tcedil;/gi, 'ț').replace(/&Tcedil;/g, 'Ț')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();

  return [dataf, ora].filter(Boolean).join(' ') + (tip ? ' · ' + tip : '') + (info ? ' · ' + info : '');
}

// Coduri tip reminder gestcom (din RemindereDialog.html).
const TIP_REMINDER: Record<string, string> = {
  '1': 'INTALNIRE', '2': 'DELEGATIE', '4': 'ASISTENTA', '5': 'SERVICE', '6': 'MONTAJ',
  '8': 'TELEFON', '9': 'EMAIL', '10': 'SMS', '11': 'TRIM. OFERTA', '12': 'REDACTARE CONTRACT',
  '13': 'INTREBARE', '14': 'RASPUNS', '16': 'IMPINGERE CONTRACT'
};

/** LISTA COMPLETĂ de remindere ale unei lucrări (pt panoul „Remindere existente" din fișă, ca în spreadsheet). */
export async function listRemindere(userId: string, idLucrare: string): Promise<Array<{ data: string; ora: string; tip: string; info: string; status: string }>> {
  const { cookie } = await login(userId);
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  const url = CRM_BASE + '?m=remindere&a=lista_remindere&suppressHeaders=1&tip_reminder=0&status_reminder=0&idlucrare_reminder=' + idSafe;
  const r = await fetch(url, { headers: { Cookie: cookie } });
  const txt = await r.text();
  let data: any;
  try { data = JSON.parse(txt); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const STATUS: Record<string, string> = { '0': 'deschis', '3': 'executat' };
  const cleanInfo = (s: string) => String(s || '')
    .replace(/<br\s*\/?>/gi, ' ').replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&abreve;/gi, 'ă').replace(/&acirc;/gi, 'â').replace(/&icirc;/gi, 'î')
    .replace(/&scedil;/gi, 'ș').replace(/&scaron;/gi, 'ș').replace(/&tcedil;/gi, 'ț')
    .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const sortKey = (d: string) => d.split('.').reverse().join(''); // dd.mm.yyyy → yyyymmdd
  return data.map((x: any) => {
    const d = String(x.datareminder_reminder || '');
    const dataf = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : d;
    return {
      data: dataf,
      ora: String(x.orareminder_reminder || '').slice(0, 5),
      tip: TIP_REMINDER[String(x.tip_reminder)] || '',
      info: cleanInfo(x.info_reminder),
      status: STATUS[String(x.status_reminder)] || String(x.status_reminder || '')
    };
  }).sort((a, b) => sortKey(b.data).localeCompare(sortKey(a.data))); // newest first
}

export async function setSteluta(userId: string, idLucrare: string, cat: number): Promise<boolean> {
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  const url = CRM_BASE + '?m=lucrari&a=adfav&suppressHeaders=1&id_lucrare=' + idSafe + '&categorie_favorit=' + cat;
  // FIX 2026-05-31: sesiunea gestcom poate expira sub pragul de cache 24h. Pe sesiune moartă
  // CRM-ul răspunde 200 cu pagina de login → vechiul `r.status===200` raporta SUCCES fals
  // (steluța NU se seta). Acum detectăm bounce-ul, re-logăm și reîncercăm o dată.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie } = await login(userId);
    const r = await fetch(url, { headers: { Cookie: cookie } });
    if (r.status !== 200) return false;
    const body = await r.text();
    if (isLoginPage(body)) { await invalidateCookie(userId); continue; }
    // READBACK (paritate spreadsheet): confirmă valoarea aplicată; loghează MISMATCH = eșec silențios.
    try {
      const vr = await fetch(CRM_BASE + '?m=lucrari&a=view&id_lucrare=' + idSafe, { headers: { Cookie: cookie } });
      const vhtml = await vr.text();
      if (!isLoginPage(vhtml)) {
        const m = vhtml.match(new RegExp('adfav\\(' + idSafe + ',\\s*this\\)[\\s\\S]{0,1500}<\\/select>', 'i'));
        const om = m && (m[0].match(/<option\b[^>]*value=["'](\d)["'][^>]*\bselected\b/i) || m[0].match(/<option\b[^>]*\bselected\b[^>]*value=["'](\d)["']/i));
        if (om) {
          const applied = parseInt(om[1], 10);
          if (applied !== Number(cat)) { console.warn('[setSteluta] MISMATCH id=' + idSafe + ' cerut=' + cat + ' aplicat=' + applied); return false; }
        }
      }
    } catch { /* readback flaky → nu penaliza; set-ul a întors 200 fără pagină de login */ }
    return true;
  }
  return false;
}

/** Push Observatii din strategie înapoi în CRM. */
export const INFO_MARKER_START = '════════════ STRATEGIE FISA ════════════';
export const INFO_MARKER_END   = '══════════ END STRATEGIE FISA ══════════';

// Decode DOAR entități (NU strip tag-uri) — pentru valori de formular re-POST-ate.
// decHtml strip-uia toate tag-urile, ceea ce corupea valorile la full-form replace.
function decodeEntities(s: string): string {
  return String(s || '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú')
    .replace(/&acirc;/gi, 'â').replace(/&Acirc;/g, 'Â').replace(/&icirc;/gi, 'î').replace(/&Icirc;/g, 'Î')
    .replace(/&abreve;/gi, 'ă').replace(/&Abreve;/g, 'Ă')
    .replace(/&scedil;/gi, 'ș').replace(/&Scedil;/g, 'Ș').replace(/&scaron;/gi, 'ș').replace(/&Scaron;/g, 'Ș')
    .replace(/&tcedil;/gi, 'ț').replace(/&Tcedil;/g, 'Ț')
    .replace(/&#(\d+);/g, (_, d) => { const c = parseInt(d, 10); return isNaN(c) ? '' : String.fromCharCode(c); })
    .replace(/&#x([\da-f]+);/gi, (_, h) => { const c = parseInt(h, 16); return isNaN(c) ? '' : String.fromCharCode(c); })
    .replace(/&amp;/g, '&');
}

// Parser form gestcom (#gc): input/textarea/select name→value. Port din Apps Script _parseFormFields_.
function parseFormFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const formMatch = html.match(/<form[^>]*id=["']gc["'][\s\S]*?<\/form>/i);
  const zone = formMatch ? formMatch[0] : html;

  // input
  const re1 = /<input\b[^>]*>/gi; let m: RegExpExecArray | null;
  while ((m = re1.exec(zone)) !== null) {
    const tag = m[0];
    const typeM = tag.match(/\btype=["']?(\w+)["']?/i);
    const type = (typeM ? typeM[1] : 'text').toLowerCase();
    if (['submit', 'button', 'image', 'reset'].includes(type)) continue;
    const nameM = tag.match(/\bname=["']([^"']+)["']/i);
    if (!nameM) continue;
    const name = nameM[1];
    if (type === 'checkbox' || type === 'radio') {
      if (!/\bchecked\b/i.test(tag)) { if (!(name in fields)) fields[name] = ''; continue; }
      const valM = tag.match(/\bvalue=["']([^"']*)["']/i);
      fields[name] = decodeEntities(valM ? valM[1] : 'on');
    } else {
      const valM2 = tag.match(/\bvalue=["']([^"']*)["']/i);
      fields[name] = decodeEntities(valM2 ? valM2[1] : '');
    }
  }
  // textarea
  const re2 = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
  while ((m = re2.exec(zone)) !== null) {
    const nameM2 = m[1].match(/\bname=["']([^"']+)["']/i);
    if (nameM2) fields[nameM2[1]] = decodeEntities(m[2]);
  }
  // select
  const re3 = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((m = re3.exec(zone)) !== null) {
    const sNameM = m[1].match(/\bname=["']([^"']+)["']/i);
    if (!sNameM) continue;
    const sContent = m[2];
    const sel = sContent.match(/<option\b[^>]*\bselected\b[^>]*value=["']([^"']*)["']/i)
             || sContent.match(/<option\b[^>]*value=["']([^"']*)["'][^>]*\bselected\b/i);
    if (sel) fields[sNameM[1]] = decodeEntities(sel[1]);
    else {
      const first = sContent.match(/<option\b[^>]*value=["']([^"']*)["']/i);
      fields[sNameM[1]] = decodeEntities(first ? first[1] : '');
    }
  }
  return fields;
}

function normalizeObs(s: string): string {
  return String(s || '')
    .replace(/\r\n?/g, '\n')             // CRLF/CR → LF (uniformizează ÎNTÂI)
    // gestcom face nl2br pe Observatii: stochează `<br>` PESTE newline-ul existent. Dacă tratam
    // `<br>`→`\n` independent de `\r\n`→`\n`, fiecare linie căpăta DUBLU newline la fiecare push
    // (spațiere care se acumula). Tratăm `<br>` lipit de un newline ca UN SINGUR break.
    .replace(/<br\s*\/?>\n/gi, '\n')     // <br>\n  → \n
    .replace(/\n<br\s*\/?>/gi, '\n')     // \n<br>  → \n
    .replace(/<br\s*\/?>/gi, '\n')       // <br> rămas singur → \n
    .replace(/[ \t]+\n/g, '\n')          // taie spațiile dinaintea unui newline
    .replace(/\n{3,}/g, '\n\n');         // maxim o linie goală între paragrafe
}

/**
 * Push bloc strategie în observatii_lucrare — FULL-FORM REPLACE (nu pierde celelalte câmpuri).
 * Port 1:1 din Apps Script pushInfoInCrm: GET addedit → parse toate câmpurile →
 * înlocuiește DOAR blocul între markeri (sau append) → POST full form.
 */
// Markere pentru blocul de STATUS PÂLNIE (etape funnel + nevoia + stadiu) în observatii.
export const STATUS_MARKER_START = '──────────── STATUS PALNIE ────────────';
export const STATUS_MARKER_END   = '────────── END STATUS PALNIE ──────────';

/**
 * Generic: înlocuiește (sau adaugă) DOAR blocul dintre markeri în observatii_lucrare,
 * via FULL-FORM REPLACE (nu pierde celelalte câmpuri). Cu retry pe sesiune expirată.
 */
async function replaceObsBlock(userId: string, idLucrare: string, startMarker: string, endMarker: string, body: string): Promise<{ ok: boolean; error?: string; action?: string }> {
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  let attempt = 0;
  while (attempt < 2) {
    attempt++;
    const { cookie } = await login(userId);
    const formUrl = CRM_BASE + '?m=lucrari&a=addedit&id_lucrare=' + idSafe;
    const r = await fetch(formUrl, { headers: { Cookie: cookie } });
    const html = await r.text();
    if (isLoginPage(html)) { await invalidateCookie(userId); if (attempt < 2) continue; return { ok: false, error: 'Sesiune CRM expirată' }; }

    const fields = parseFormFields(html);
    if (!('observatii_lucrare' in fields)) {
      return { ok: false, error: 'Câmpul observatii_lucrare lipsește din formular (id ' + idSafe + ').' };
    }
    const obsCurent = normalizeObs(fields['observatii_lucrare']);
    const idxStart = obsCurent.indexOf(startMarker);
    const idxEnd = obsCurent.indexOf(endMarker);
    const bloc = startMarker + '\n' + body.trim() + '\n' + endMarker;
    let obsNou: string, action: string;
    if (idxStart >= 0 && idxEnd >= 0 && idxEnd > idxStart) {
      const inainte = obsCurent.substring(0, idxStart).replace(/\s+$/, '');
      const dupa = obsCurent.substring(idxEnd + endMarker.length).replace(/^\s+/, '');
      obsNou = (inainte ? inainte + '\n\n' : '') + bloc + (dupa ? '\n\n' + dupa : '');
      action = 'înlocuit bloc existent';
    } else {
      const sep = obsCurent.trim() ? '\n\n' : '';
      obsNou = obsCurent.replace(/\s+$/, '') + sep + bloc;
      action = obsCurent.trim() ? 'adăugat la sfârșit' : 'creat (Observatii erau goale)';
    }
    obsNou = obsNou.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    fields['observatii_lucrare'] = obsNou;

    const payload: Record<string, string> = { dosql: 'do_lucrare_aed', dialog: '0' };
    Object.keys(fields).forEach(k => { payload[k] = fields[k]; });
    if (!payload.id_lucrare) payload.id_lucrare = idSafe;

    const postR = await fetch(CRM_BASE + '?m=lucrari', {
      method: 'POST', redirect: 'manual',
      headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest', 'Referer': formUrl },
      body: new URLSearchParams(payload).toString()
    });
    if ([200, 302, 303].includes(postR.status)) return { ok: true, action };
    return { ok: false, error: 'CRM HTTP ' + postR.status };
  }
  return { ok: false, error: 'Sesiune CRM expirată după retry' };
}

export async function pushObservatii(userId: string, idLucrare: string, textNou: string) {
  return replaceObsBlock(userId, idLucrare, INFO_MARKER_START, INFO_MARKER_END, textNou);
}

/** Scrie statusul de pâlnie (etape funnel + nevoia + stadiu) în Observatii CRM (zona aleasă: „push în observații"). */
export async function pushStatusPalnie(userId: string, idLucrare: string, st: {
  schita?: string | null; preOfertat?: string | null; ofertat?: string | null; nevoia?: string | null; stadiu?: string | null;
}) {
  const nz = (v: any) => v != null && String(v).trim() !== '';
  const linie = [
    'Schiță: ' + (nz(st.schita) ? st.schita : '—'),
    'Pre-ofertat: ' + (nz(st.preOfertat) ? st.preOfertat : '—'),
    'Ofertat: ' + (nz(st.ofertat) ? st.ofertat : '—'),
    'Nevoia: ' + (nz(st.nevoia) ? st.nevoia : '—'),
    'Stadiu: ' + (nz(st.stadiu) ? st.stadiu : 'în lucru')
  ].join('  |  ');
  return replaceObsBlock(userId, idLucrare, STATUS_MARKER_START, STATUS_MARKER_END, linie);
}

/** Listă contacte lucrare (m=lucrari&a=lista_conluc) — pentru reminder. */
export async function fetchContacte(userId: string, idLucrare: string): Promise<Array<{ idContact: string; nume: string; telefon: string; rol: string }>> {
  const { cookie } = await login(userId);
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  const url = CRM_BASE + '?m=lucrari&a=lista_conluc&suppressHeaders=1&id_lucrare=' + idSafe;
  const r = await fetch(url, { headers: { Cookie: cookie } });
  const txt = await r.text();
  let data: any;
  try { data = JSON.parse(txt); } catch { return []; }
  if (!Array.isArray(data)) return [];
  // lista_conluc e join table — are idcontact_conluc + rol_conluc (nu nume/telefon direct).
  const ROL: Record<string, string> = { '1': 'Beneficiar', '2': 'Plătitor', '3': 'Contact', '4': 'Arhitect', '5': 'Constructor' };
  const seen = new Set<string>();
  const out: Array<{ idContact: string; nume: string; telefon: string; rol: string }> = [];
  for (const c of data) {
    const id = String(c.idcontact_conluc || c.idcontact || c.id || '').trim();
    if (!id || id === '0' || seen.has(id)) continue;
    seen.add(id);
    const rolCode = String(c.rol_conluc || c.rol || '').trim();
    out.push({
      idContact: id,
      nume: decHtml(String(c.nume_contact || c.nume || c.denumire || '')).trim() || ('Contact #' + id),
      telefon: String(c.nrtel_reminder || c.telefon_contact || c.telefon || '').replace(/^0$/, '').trim(),
      rol: ROL[rolCode] || (rolCode ? 'rol ' + rolCode : '')
    });
  }
  return out;
}

/** Adăugă reminder nou în CRM. */
export async function addReminder(userId: string, payload: {
  idLucrare: string;
  idContact?: string;
  tip: string;     // coduri reale: 8=TELEFON, 1=INTALNIRE, 2=DELEGATIE, 9=EMAIL, 10=SMS...
  subtip?: string;
  data: string;    // yyyy-mm-dd
  ora?: string;    // HH:MM
  durata?: string;
  notificare?: string;
  info: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const idSafe = String(payload.idLucrare).replace(/[^0-9]/g, '');
  const dParts = payload.data.split('-');
  const roData = dParts.length === 3 ? `${dParts[2]}.${dParts[1]}.${dParts[0]}` : '';

  // FIX 2026-05-31: pe sesiune expirată gestcom răspunde 200 cu pagina de login →
  // vechiul check `200||302` raporta reminder salvat fals. Re-login + retry o dată.
  for (let attempt = 0; attempt < 2; attempt++) {
  const { cookie, utilizatorId } = await login(userId);

  const form: Record<string, string> = {
    dosql: 'do_reminder_aed',
    id_lucrare: idSafe, nume_lucrare: '',
    idlucrare_conluc: idSafe, idlucrare_contract: idSafe, idlucrare_oferta: idSafe,
    id_reminder: '',
    idlucrare_reminder: idSafe, idcontact_reminder: String(payload.idContact || ''),
    tip_reminder: String(payload.tip), subtip_reminder: String(payload.subtip || 0),
    idlocalitate_reminder: '', nume_localitate: '',
    datareminder_reminder: payload.data,
    ro_datareminder_reminder: roData,
    orareminder_reminder: String(payload.ora || ''),
    durata_reminder: String(payload.durata || ''),
    notificare_reminder: String(payload.notificare || 0),
    info_reminder: payload.info.trim()
  };
  if (utilizatorId && utilizatorId !== '0') form['destinatar_reminder' + utilizatorId] = '1';

  const r = await fetch(CRM_BASE + '?m=remindere', {
    method: 'POST', redirect: 'manual',
    headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    body: new URLSearchParams(form).toString()
  });
  // 302 către login = sesiune expirată; 200 cu HTML login = la fel. Altfel = succes real.
  const loc = r.headers.get('location') || '';
  if (r.status === 302) {
    if (/m=login/i.test(loc)) { await invalidateCookie(userId); continue; }
    return { ok: true };
  }
  if (r.status === 200) {
    const body = await r.text();
    if (isLoginPage(body)) { await invalidateCookie(userId); continue; }
    return { ok: true };
  }
  return { ok: false, error: 'HTTP ' + r.status };
  }
  return { ok: false, error: 'Sesiune CRM expirată după retry' };
}

/**
 * Marchează TOATE reminderele DESCHISE (status_reminder='0') ale unei lucrări ca EXECUTATE
 * (status_reminder='3'). Paritate cu spreadsheet: la salvarea unui reminder nou, vechile
 * remindere deschise se închid automat.
 *
 * gestcom editează (nu creează) un reminder când id_reminder e setat la POST do_reminder_aed.
 * Re-trimitem ACELEAȘI câmpuri ale reminderului existent + id_reminder + status_reminder='3'.
 *
 * BEST-EFFORT: scriere în CRM de producție → fiecare reminder într-un try/catch propriu;
 * NU aruncă niciodată, doar loghează și întoarce câte a marcat. Retry pe sesiune expirată
 * la nivel de citire a listei, ca celelalte funcții.
 */
export async function markOpenRemindersExecuted(userId: string, idLucrare: string): Promise<{ ok: boolean; marked: number; error?: string }> {
  const idSafe = String(idLucrare).replace(/[^0-9]/g, '');
  if (!idSafe) return { ok: false, marked: 0, error: 'id_lucrare invalid' };

  // 1) Citește lista de remindere (raw JSON), cu retry pe sesiune expirată.
  let deschise: any[] = [];
  let cookie = '';
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const sess = await login(userId);
      cookie = sess.cookie;
      const url = CRM_BASE + '?m=remindere&a=lista_remindere&suppressHeaders=1&tip_reminder=0&status_reminder=0&idlucrare_reminder=' + idSafe;
      const r = await fetch(url, { headers: { Cookie: cookie } });
      const txt = await r.text();
      if (isLoginPage(txt)) { await invalidateCookie(userId); continue; }
      let data: any;
      try { data = JSON.parse(txt); } catch { data = null; }
      if (!Array.isArray(data)) { deschise = []; break; }
      deschise = data.filter((x: any) => String(x.status_reminder) === '0');
      break;
    }
  } catch (e: any) {
    console.warn('[markOpenRemindersExecuted] eroare la citirea listei id_lucrare=' + idSafe + ': ' + (e?.message || e));
    return { ok: false, marked: 0, error: 'Nu am putut citi reminderele deschise' };
  }

  if (deschise.length === 0) return { ok: true, marked: 0 };

  // 2) Pentru fiecare reminder deschis, re-POST cu id_reminder + status_reminder='3' (executat).
  //    Best-effort: orice eroare pe un reminder e logată, NU oprește restul.
  let marked = 0;
  for (const rem of deschise) {
    try {
      const idReminder = String(rem.id_reminder ?? rem.idreminder_reminder ?? '').replace(/[^0-9]/g, '');
      if (!idReminder) { console.warn('[markOpenRemindersExecuted] reminder fără id, sărit (id_lucrare=' + idSafe + ')'); continue; }

      const d = String(rem.datareminder_reminder || '');
      const roData = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '';

      const form: Record<string, string> = {
        dosql: 'do_reminder_aed',
        id_lucrare: idSafe, nume_lucrare: '',
        idlucrare_conluc: idSafe, idlucrare_contract: idSafe, idlucrare_oferta: idSafe,
        id_reminder: idReminder,
        idlucrare_reminder: idSafe,
        idcontact_reminder: String(rem.idcontact_reminder ?? rem.idcontact ?? ''),
        tip_reminder: String(rem.tip_reminder ?? ''),
        subtip_reminder: String(rem.subtip_reminder ?? 0),
        idlocalitate_reminder: String(rem.idlocalitate_reminder ?? ''),
        nume_localitate: '',
        datareminder_reminder: d,
        ro_datareminder_reminder: roData,
        orareminder_reminder: String(rem.orareminder_reminder ?? '').slice(0, 5),
        durata_reminder: String(rem.durata_reminder ?? ''),
        notificare_reminder: String(rem.notificare_reminder ?? 0),
        info_reminder: String(rem.info_reminder ?? ''),
        status_reminder: '3'
      };

      const r = await fetch(CRM_BASE + '?m=remindere', {
        method: 'POST', redirect: 'manual',
        headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
        body: new URLSearchParams(form).toString()
      });
      const loc = r.headers.get('location') || '';
      if (r.status === 302 && /m=login/i.test(loc)) {
        console.warn('[markOpenRemindersExecuted] sesiune expirată la id_reminder=' + idReminder + ' (id_lucrare=' + idSafe + ')');
        continue;
      }
      if (r.status === 200) {
        const body = await r.text();
        if (isLoginPage(body)) {
          console.warn('[markOpenRemindersExecuted] sesiune expirată (200/login) la id_reminder=' + idReminder + ' (id_lucrare=' + idSafe + ')');
          continue;
        }
      } else if (r.status !== 302 && r.status !== 303) {
        console.warn('[markOpenRemindersExecuted] HTTP ' + r.status + ' la id_reminder=' + idReminder + ' (id_lucrare=' + idSafe + ')');
        continue;
      }
      marked++;
    } catch (e: any) {
      console.warn('[markOpenRemindersExecuted] eroare la marcarea unui reminder (id_lucrare=' + idSafe + '): ' + (e?.message || e));
    }
  }

  return { ok: true, marked };
}
