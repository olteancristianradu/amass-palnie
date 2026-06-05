import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { login, invalidateCookie } from '@/lib/crm-client';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;
  try {
    await invalidateCookie(userId);
    const { cookie, utilizatorId } = await login(userId);
    return NextResponse.json({ ok: true, cookieLength: cookie.length, utilizatorId });
  } catch (e: any) {
    // Nu scurgem detalii de sesiune/infra gestcom; logăm pe server, răspundem generic.
    console.error('[crm/test] eroare autentificare CRM:', e?.message ?? e);
    const mesaj = /credenti|parol|user|autentific/i.test(e?.message ?? '')
      ? 'Credențiale CRM lipsă sau invalide.'
      : 'Conectarea la CRM a eșuat, reîncearcă.';
    return NextResponse.json({ ok: false, error: mesaj }, { status: 500 });
  }
}
