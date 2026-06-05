import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { getScope, clientScopeWhere } from '@/lib/scope';

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const { searchParams } = new URL(req.url);
  // Robustețe (audit 2026-06-01): ?limit=abc → parseInt NaN → take:NaN respins de Prisma (500).
  // Sanitizează: fallback la 2000 dacă nu e un întreg pozitiv finit, plafon 5000.
  const raw = parseInt(searchParams.get('limit') ?? '2000', 10);
  const limit = Math.min(Number.isFinite(raw) && raw > 0 ? raw : 2000, 5000);
  const owner = searchParams.get('owner');
  const where = await clientScopeWhere(scope, owner);

  const clienti = await prisma.client.findMany({
    where,
    orderBy: [{ stadiu: 'asc' }, { dataIntrare: 'desc' }],
    take: limit,
    ...(scope.isManager ? { include: { owner: { select: { id: true, name: true, email: true } } } } : {})
  });
  return NextResponse.json({ ok: true, count: clienti.length, isManager: scope.isManager, clienti });
}

// POST — creează un client MANUAL în webapp (nu există în gestcom). inCRM=false → ⚠ la nume.
// Owner = userul curent. idLucrare = cel dat sau un placeholder unic ('MAN-'+timestamp).
// Categorie 2 implicit (V2); 1 dacă numele conține „(1)" (paritate cu convenția fișei V1).
export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({} as any));
  const nume = typeof body.nume === 'string' ? body.nume.trim() : '';
  if (!nume) return NextResponse.json({ ok: false, error: 'Numele clientului este obligatoriu.' }, { status: 400 });

  // idLucrare: cel dat (trim) sau un placeholder unic, ca să nu coincidă cu lucrări reale din CRM.
  const idLucrareInput = typeof body.idLucrare === 'string' ? body.idLucrare.trim() : '';
  const idLucrare = idLucrareInput || ('MAN-' + Date.now());

  // Categorie: 2 implicit (V2); 1 dacă numele conține „(1)".
  const categorie = nume.includes('(1)') ? 1 : 2;

  // Suprafață: număr pozitiv finit sau null.
  let suprafata: number | null = null;
  if (body.suprafata !== undefined && body.suprafata !== null && String(body.suprafata).trim() !== '') {
    const n = Number(body.suprafata);
    if (Number.isFinite(n) && n >= 0) suprafata = n;
  }

  const localitate = typeof body.localitate === 'string' && body.localitate.trim() ? body.localitate.trim() : null;
  const judet = typeof body.judet === 'string' && body.judet.trim() ? body.judet.trim() : null;
  const telefon = typeof body.telefon === 'string' && body.telefon.trim() ? body.telefon.trim() : null;

  // @@unique([ownerId, idLucrare]) → dacă userul dă un idLucrare deja existent la el, întoarce o eroare clară.
  const dup = await prisma.client.findFirst({ where: { ownerId: scope.userId, idLucrare } });
  if (dup) return NextResponse.json({ ok: false, error: `Există deja un client cu #${idLucrare} la acest cont.` }, { status: 409 });

  const created = await prisma.client.create({
    data: {
      idLucrare,
      ownerId: scope.userId,
      nume,
      localitate,
      judet,
      telefon,
      categorie,
      suprafata,
      inCRM: false,
    }
  });

  // Audit log: nu trebuie să blocheze răspunsul (clientul e deja creat). `auditLog` își prinde intern
  // erorile, dar prindem și aici defensiv ca o eventuală eroare la salvarea audit-ului să fie măcar
  // LOGATĂ cu console.error (nu înghițită tăcut), păstrând răspunsul de succes.
  try {
    await auditLog({
      userId: scope.userId, func: 'clienti/create', action: 'CREATE',
      entity: 'Client', entityId: created.id, fields: 'nume,idLucrare,localitate,judet,telefon,suprafata'
    });
  } catch (e) {
    console.error('[clienti/create] audit log failed:', e);
  }

  return NextResponse.json({ ok: true, id: created.id });
}
