import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Parola', type: 'password' }
      },
      async authorize(creds) {
        try {
          if (!creds?.email || !creds?.password) return null;
          const user = await prisma.user.findUnique({ where: { email: creds.email.toLowerCase() } });
          if (!user) return null;
          if ((user as any).active === false) return null; // cont înghețat → login refuzat (NULL/true = permis)
          const ok = await bcrypt.compare(creds.password, user.passwordHash);
          if (!ok) return null;
          return { id: user.id, email: user.email, name: user.name ?? user.email, role: user.role };
        } catch (e: any) {
          console.error('[auth] authorize error:', e?.message);
          return null;
        }
      }
    })
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  // App intern pe rețea locală, accesat prin HTTP (http://IP:3000) → cookie-urile NU trebuie marcate
  // „Secure" (altfel browserul nu le trimite pe HTTP și login-ul eșuează „silent", indiferent de parolă).
  useSecureCookies: false,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
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
