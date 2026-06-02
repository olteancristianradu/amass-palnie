import { NextResponse } from 'next/server';
import { getScope } from '@/lib/scope';
import { isConfigured, getAuthUrl } from '@/lib/outlook';

// GET — pornește OAuth: redirect la login Microsoft. State = userId.
export async function GET() {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  if (!isConfigured()) return NextResponse.redirect(base + '/settings?outlook=notconfigured');
  return NextResponse.redirect(getAuthUrl(scope.userId));
}
