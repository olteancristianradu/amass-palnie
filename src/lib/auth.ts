import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

// Rate-limit anti brute-force (in-memory, per email+IP). FAIL-OPEN prin design: orice eroare a
// limitatorului NU trebuie să blocheze un login legitim. Prag GENEROS (20 eșecuri / 10 min) ca
// greșelile normale de tastare să nu declanșeze niciodată un blocaj.
//
// NOTE DESIGN: contoarele sunt in-memory BY DESIGN pentru că aplicația rulează single-instance
// în spatele unui tunel privat (Cloudflare Tunnel). Persistența pe DB/Redis ar adăuga complexitate
// nejustificată — în caz de restart al serverului contoarele se resetează, ceea ce e acceptabil
// deoarece: (1) tunel privat = suprafață de atac limitată, (2) pragul de 20/10min e suficient
// pentru tentative umane, (3) fail-open garantează că un restart nu blochează utilizatori valizi.
const _loginFails = new Map<string, { count: number; first: number }>();
const _LF_WINDOW = 10 * 60_000, _LF_MAX = 20;
function _lfKey(email: string, ip: string) { return email + '|' + ip; }
function _lfBlocked(k: string): boolean {
  const e = _loginFails.get(k); if (!e) return false;
  if (Date.now() - e.first > _LF_WINDOW) { _loginFails.delete(k); return false; }
  return e.count >= _LF_MAX;
}
function _lfBump(k: string) {
  const e = _loginFails.get(k);
  if (!e || Date.now() - e.first > _LF_WINDOW) _loginFails.set(k, { count: 1, first: Date.now() });
  else e.count++;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Parola', type: 'password' }
      },
      async authorize(creds, req) {
        try {
          if (!creds?.email || !creds?.password) return null;
          const email = creds.email.toLowerCase();
          const ipRaw = ((req?.headers?.['x-forwarded-for'] as string) || (req?.headers?.['x-real-ip'] as string) || '');
          const ip = ipRaw.split(',')[0].trim() || 'local';
          const lk = _lfKey(email, ip);
          // Throttle DOAR după 20 de eșecuri în 10 min (verificare izolată în try → fail-open).
          try { if (_lfBlocked(lk)) { console.warn('[auth] login throttled', email, ip); return null; } } catch {}
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) { try { _lfBump(lk); } catch {} return null; }
          if ((user as any).active === false) return null; // cont înghețat → login refuzat (NULL/true = permis)
          const ok = await bcrypt.compare(creds.password, user.passwordHash);
          if (!ok) { try { _lfBump(lk); console.warn('[auth] failed login', email, ip); } catch {} return null; }
          try { _loginFails.delete(lk); } catch {} // succes → resetează contorul
          return { id: user.id, email: user.email, name: user.name ?? user.email, role: user.role };
        } catch (e: any) {
          console.error('[auth] authorize error:', e?.message);
          return null;
        }
      }
    })
  ],
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },  // 7 zile (CRM cu date sensibile — fereastră mai scurtă decât 30z; getScope verifică active/rol la fiecare request)
  pages: { signIn: '/login' },
  // App intern pe rețea locală, accesat prin HTTP (http://IP:3000) → cookie-urile NU trebuie marcate
  // „Secure" (altfel browserul nu le trimite pe HTTP și login-ul eșuează „silent", indiferent de parolă).
  // Protocol-aware: pe HTTP → false (neschimbat); dacă ajunge vreodată pe HTTPS (reverse-proxy / Cloudflare
  // Tunnel) și NEXTAUTH_URL devine https://… → Secure se activează automat, fără modificare de cod.
  // Normalizăm: trim + lowercase pe prefix → tolerează spații/majuscule/trailing-slash accidentale.
  useSecureCookies: (process.env.NEXTAUTH_URL || '').trim().toLowerCase().startsWith('https://'),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Login proaspăt: populăm token din datele returnate de authorize()
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.active = true; // cont valid la momentul login-ului
      } else if (token.id) {
        // Reînnoire token (sesiune existentă): re-citim rolul + active din DB pentru a elimina
        // stale permissions — un user retrogradat/dezactivat nu trebuie să păstreze vechile
        // drepturi până la expirarea JWT (7 zile). FAIL-SAFE: orice eroare DB păstrează
        // token-ul existent (nu blocăm useri valizi dacă DB are o eroare tranzitorie).
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, active: true }
          });
          if (fresh) {
            token.role = fresh.role;
            token.active = (fresh.active as boolean | null) !== false; // null/true = activ
          }
        } catch (e: any) {
          // DB indisponibil temporar → păstrăm token-ul curent, NU delogăm userul
          console.warn('[auth] jwt refresh DB error (fallback la token existent):', e?.message);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Dacă userul e marcat inactiv (detectat la reînnoire token), golim sesiunea →
      // middleware/getServerSession va trata sesiunea ca neautentificată.
      if (token.active === false) {
        return { ...session, user: undefined, expires: session.expires };
      }
      if (session.user && token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  secret: (() => {
    const s = process.env.NEXTAUTH_SECRET;
    if (s) return s;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXTAUTH_SECRET lipsește în producție. Setează un secret (openssl rand -base64 32).');
    }
    return 'amass-dev-secret-change-in-prod';
  })()
};
