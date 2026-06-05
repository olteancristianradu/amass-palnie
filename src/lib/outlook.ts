/**
 * Outlook / Microsoft Graph — OAuth2 (cont de domeniu M365 SAU outlook.com personal)
 * + trimitere email prin /me/sendMail. Token-uri criptate AES-256 per user.
 * Necesită env: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (+ opțional AZURE_REDIRECT_URI).
 */
import { prisma } from './db';
import { encrypt, decrypt } from './crypto';

const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'offline_access openid email profile User.Read Mail.Send';

export function isConfigured(): boolean {
  return !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
}
function redirectUri(): string {
  return process.env.AZURE_REDIRECT_URI || ((process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '') + '/api/outlook/callback');
}

export function getAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID!, response_type: 'code', redirect_uri: redirectUri(),
    response_mode: 'query', scope: SCOPES, state
  });
  return AUTH + '/authorize?' + p.toString();
}

async function tokenRequest(body: Record<string, string>) {
  let r: Response;
  try {
    r = await fetch(AUTH + '/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.AZURE_CLIENT_ID!, client_secret: process.env.AZURE_CLIENT_SECRET!, redirect_uri: redirectUri(), ...body }).toString()
    });
  } catch {
    // Rețea inaccesibilă (timeout, DNS fail etc.) — eroare clară, nu TypeError brut.
    throw new Error('Microsoft Graph inaccesibil — verifică conexiunea la internet sau încearcă mai târziu.');
  }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'token error ' + r.status);
  return j as { access_token: string; refresh_token?: string; expires_in: number };
}

/** Schimbă codul OAuth pe token-uri + aduce email-ul contului, salvează criptat. */
export async function exchangeCode(userId: string, code: string): Promise<string> {
  const t = await tokenRequest({ grant_type: 'authorization_code', code, scope: SCOPES });
  const me = await fetch(GRAPH + '/me', { headers: { Authorization: 'Bearer ' + t.access_token } }).then(r => r.json()).catch(() => ({}));
  const account = me.mail || me.userPrincipalName || 'cont Microsoft';
  await prisma.outlookToken.upsert({
    where: { userId },
    create: { userId, account, accessEnc: encrypt(t.access_token), refreshEnc: encrypt(t.refresh_token || ''), expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) },
    update: { account, accessEnc: encrypt(t.access_token), refreshEnc: encrypt(t.refresh_token || ''), expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) }
  });
  return account;
}

/** Întoarce un access_token valid (refresh dacă a expirat). */
async function getValidAccessToken(userId: string): Promise<string> {
  const tok = await prisma.outlookToken.findUnique({ where: { userId } });
  if (!tok) throw new Error('Outlook neconectat');
  // decrypt protejat: un token corupt / CRYPTO_KEY schimbat nu trebuie să arunce o eroare criptică.
  let refresh: string;
  try {
    if (tok.expiresAt.getTime() > Date.now()) {
      const access = decrypt(tok.accessEnc);
      // Token gol după decrypt = date corupte (NU expirat), mesaj clar.
      if (!access) throw new Error('TOKEN_CORUPT');
      return access;
    }
    refresh = decrypt(tok.refreshEnc);
  } catch (err: any) {
    if (err?.message === 'TOKEN_CORUPT')
      throw new Error('Token Outlook corupt sau lipsă — reconectează contul Outlook din Setări.');
    throw new Error('Token Outlook corupt sau CRYPTO_KEY schimbat — reconectează contul Outlook din Setări.');
  }
  // Refresh gol după decrypt = date corupte (NU expirat), mesaj clar.
  if (!refresh) throw new Error('Token Outlook corupt sau lipsă — reconectează contul Outlook din Setări.');
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh, scope: SCOPES });
  await prisma.outlookToken.update({
    where: { userId },
    data: { accessEnc: encrypt(t.access_token), refreshEnc: encrypt(t.refresh_token || refresh), expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) }
  });
  return t.access_token;
}

export async function getStatus(userId: string) {
  const tok = await prisma.outlookToken.findUnique({ where: { userId }, select: { account: true } });
  return { configured: isConfigured(), connected: !!tok, account: tok?.account || null };
}

export async function disconnect(userId: string) {
  if (!userId) return; // GUARD: userId gol → deleteMany ar șterge TOATE token-urile (bug updateMany/deleteMany-undefined)
  await prisma.outlookToken.deleteMany({ where: { userId } });
}

interface Attachment { name: string; contentType: string; contentBytesBase64: string; }

/** Trimite email prin Graph /me/sendMail (HTML + atașamente opționale). */
export async function sendMail(userId: string, msg: { to: string; cc?: string; subject: string; html: string; attachments?: Attachment[] }): Promise<void> {
  const access = await getValidAccessToken(userId);
  const recips = (s?: string) => (s || '').split(/[;,]/).map(x => x.trim()).filter(Boolean).map(a => ({ emailAddress: { address: a } }));
  const message: any = {
    subject: msg.subject,
    body: { contentType: 'HTML', content: msg.html },
    toRecipients: recips(msg.to),
    ccRecipients: recips(msg.cc)
  };
  if (msg.attachments?.length) {
    message.attachments = msg.attachments.map(a => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.name, contentType: a.contentType, contentBytes: a.contentBytesBase64 }));
  }
  let r: Response;
  try {
    r = await fetch(GRAPH + '/me/sendMail', {
      method: 'POST', headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true })
    });
  } catch {
    // Rețea inaccesibilă — eroare clară pentru caller, nu TypeError brut.
    throw new Error('Microsoft Graph inaccesibil — verifică conexiunea la internet sau încearcă mai târziu.');
  }
  if (!r.ok) { const e = await r.text(); throw new Error('Graph sendMail ' + r.status + ': ' + e.slice(0, 200)); }
}
