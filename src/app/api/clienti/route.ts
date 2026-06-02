import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
