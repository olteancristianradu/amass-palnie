import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;
  const entries = await prisma.arhivaEntry.findMany({
    where: { client: { ownerId: userId } },
    include: { client: { select: { nume: true, localitate: true, idLucrare: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500
  });
  return NextResponse.json({ ok: true, entries });
}

// POST = RESTAURARE dintr-un snapshot de arhivă.
// body: { entryId } → restaurează strategieV1/V2 + obsSituatie + strategieNevoi din dataSnapshot
// înapoi pe client. Anti-IDOR: entry-ul trebuie să aparțină unui client al userului (client.ownerId).
// Înainte de restaurare creează un snapshot „pre-restore" → operația e reversibilă.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }
  const entryId = body?.entryId;
  if (!entryId || typeof entryId !== 'string') {
    return NextResponse.json({ ok: false, error: 'entryId lipsă' }, { status: 400 });
  }

  // Caută intrarea + clientul, verificând că aparține userului (scope prin ownerId).
  const entry = await prisma.arhivaEntry.findFirst({
    where: { id: entryId, client: { ownerId: userId } },
    include: { client: true }
  });
  if (!entry) return NextResponse.json({ ok: false, error: 'Snapshot inexistent' }, { status: 404 });

  // Parsează snapshot-ul (este JSON-ul clientului salvat la momentul creării).
  let snap: any = {};
  try { snap = JSON.parse(entry.dataSnapshot); } catch {
    return NextResponse.json({ ok: false, error: 'Snapshot corupt' }, { status: 422 });
  }
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
    return NextResponse.json({ ok: false, error: 'Snapshot invalid' }, { status: 422 });
  }

  // Creează ÎNTÂI un snapshot „pre-restore" din starea curentă → restaurarea e reversibilă.
  await prisma.arhivaEntry.create({
    data: {
      clientId: entry.clientId,
      versiune: entry.client.categorie === 1 ? 'V1' : 'V2',
      dataSnapshot: JSON.stringify(entry.client),
      obsExtra: 'pre-restore'
    }
  });

  // Restaurează DOAR câmpurile de strategie din snapshot pe client.
  const restored = await prisma.client.update({
    where: { id: entry.clientId },
    data: {
      strategieV1: snap.strategieV1 ?? null,
      strategieV2: snap.strategieV2 ?? null,
      obsSituatie: snap.obsSituatie ?? null,
      strategieNevoi: snap.strategieNevoi ?? null
    }
  });

  return NextResponse.json({ ok: true, restored });
}
