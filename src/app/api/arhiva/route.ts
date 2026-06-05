import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;
  // take(500): limită conservatoare; include-ul pe client e deja select-restrâns la 3 câmpuri
  // (nume/localitate/idLucrare) deci cost-ul per-rând e mic. dataSnapshot (blob mare) nu e inclus în
  // include → se returnează direct din ArhivaEntry (câmpuri indexate). Monitorizează dacă un user
  // ajunge la sute de snapshot-uri și scade take la 200 sau adaugă paginare cursor.
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

  let body: Record<string, unknown> = {};
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
  let snap: Record<string, any> = {};
  try { snap = JSON.parse(entry.dataSnapshot); } catch {
    return NextResponse.json({ ok: false, error: 'Snapshot corupt' }, { status: 422 });
  }
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) {
    return NextResponse.json({ ok: false, error: 'Snapshot invalid' }, { status: 422 });
  }

  // Creează ÎNTÂI un snapshot „pre-restore" din starea curentă → restaurarea e reversibilă.
  // IMPORTANT: versiunea se derivă din snapshot-ul care SE RESTAUREAZĂ (nu din categoria CURENTĂ
  // a clientului) — categoria poate fi schimbat după snapshot → mislabeling altfel.
  const versiuneRestored = snap.categorie === 1 ? 'V1'
    : snap.categorie === 2 ? 'V2'
    : (entry.client.categorie === 1 ? 'V1' : 'V2'); // fallback defensiv dacă snapshot vechi nu are categorie
  await prisma.arhivaEntry.create({
    data: {
      clientId: entry.clientId,
      versiune: versiuneRestored,
      dataSnapshot: JSON.stringify(entry.client),
      obsExtra: 'pre-restore'
    }
  });

  // Restaurează DOAR câmpurile PREZENTE în snapshot. ANTI-PIERDERE: un snapshot vechi care NU are un
  // câmp (ex. obsSituatie adăugat ulterior) NU mai suprascrie valoarea curentă cu null.
  const data: Record<string, any> = {};
  if (snap.strategieV1 !== undefined) data.strategieV1 = snap.strategieV1;
  if (snap.strategieV2 !== undefined) data.strategieV2 = snap.strategieV2;
  if (snap.obsSituatie !== undefined) data.obsSituatie = snap.obsSituatie;
  if (snap.strategieNevoi !== undefined) data.strategieNevoi = snap.strategieNevoi;
  const restored = await prisma.client.update({ where: { id: entry.clientId }, data });

  return NextResponse.json({ ok: true, restored });
}
