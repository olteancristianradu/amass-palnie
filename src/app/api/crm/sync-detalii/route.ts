import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { refreshDetailsBatch } from '@/lib/sync-engine';
import { acquireSync, releaseSync } from '@/lib/auto-sync';

// POST /api/crm/sync-detalii — refresh COMPLET detalii pe clienții activi (manual, la cerere).
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const uid = (session.user as any).id;
  if (!acquireSync(uid)) return NextResponse.json({ ok: false, error: 'O sincronizare e deja în curs — așteaptă să se termine.' }, { status: 409 });
  try {
    const r = await refreshDetailsBatch(uid, 0);
    return NextResponse.json(r, { status: r.ok ? 200 : 500 });
  } finally { releaseSync(uid); }
}
