import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setSteluta } from '@/lib/crm-client';
import { auditLog } from '@/lib/audit';
import { getScope, canAccessClient, findClientInScope } from '@/lib/scope';

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = scope.userId;
  const { clientId, idLucrare, cat } = await req.json().catch(() => ({} as any));
  if (!idLucrare || cat === undefined) return NextResponse.json({ ok: false, error: 'Date lipsă' }, { status: 400 });
  // ANTI-IDOR (audit 2026-06-01): verifică proprietatea înainte de scrierea locală/CRM.
  // idLucrare NU e unic singur (@@unique([ownerId, idLucrare])) → folosim findClientInScope
  // (filtrează pe owner în set) ca să nu prindem un client din afara scope-ului (fals 403/ambiguitate).
  const client = clientId
    ? await prisma.client.findUnique({ where: { id: clientId } })
    : await findClientInScope(scope, String(idLucrare));
  if (!client || !(await canAccessClient(scope, client.ownerId))) {
    return NextResponse.json({ ok: false, error: 'Acces interzis la acest client' }, { status: 403 });
  }
  try {
    // CRITIC (audit 2026-06-01): apelul CRM se face pe contul OWNER-ului lucrării (client.ownerId),
    // nu pe contul celui care face cererea — idLucrare e mapat per cont în gestcom. (ca pushStatusPalnie)
    const ok = await setSteluta(client.ownerId, idLucrare, parseInt(String(cat), 10));
    if (ok) {
      await prisma.client.update({ where: { id: client.id }, data: { stelutaCat: parseInt(String(cat), 10) } });
    }
    // userId rămâne pentru audit (cine a inițiat acțiunea).
    await auditLog({ userId, func: 'steluta', action: 'CRM_WRITE', entityId: client.id, fields: 'cat=' + cat });
    return NextResponse.json({ ok });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
