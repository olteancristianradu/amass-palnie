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
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
