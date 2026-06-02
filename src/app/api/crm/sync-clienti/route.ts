import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { syncNewClients } from '@/lib/sync-engine';
import { acquireSync, releaseSync } from '@/lib/auto-sync';

// POST /api/crm/sync-clienti — adaugă clienții NOI din CRM (detail doar pe cei noi). Manual + reutilizat de auto-sync.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const uid = (session.user as any).id;
  if (!acquireSync(uid)) return NextResponse.json({ ok: false, error: 'O sincronizare e deja în curs pentru acest cont — așteaptă să se termine.' }, { status: 409 });
  try {
    const r = await syncNewClients(uid);
    return NextResponse.json(r, { status: r.ok ? 200 : 500 });
  } finally { releaseSync(uid); }
}
