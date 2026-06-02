import { NextRequest, NextResponse } from 'next/server';
import { pushObservatii } from '@/lib/crm-client';
import { auditLog } from '@/lib/audit';
import { getScope, findClientInScope } from '@/lib/scope';

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = scope.userId;
  const { idLucrare, observatii } = await req.json();
  if (!idLucrare || !observatii) return NextResponse.json({ ok: false, error: 'Date lipsă' }, { status: 400 });
  // ANTI-IDOR (audit 2026-06-01): doar lucrări din scope-ul userului.
  const client = await findClientInScope(scope, String(idLucrare));
  if (!client) return NextResponse.json({ ok: false, error: 'Acces interzis la această lucrare' }, { status: 403 });
  try {
    // CRITIC (audit 2026-06-01): scrie în CRM-ul OWNER-ului lucrării (client.ownerId), nu al cererii;
    // idLucrare e mapat per cont în gestcom. userId rămâne doar pentru audit. (ca pushStatusPalnie)
    const r = await pushObservatii(client.ownerId, idLucrare, observatii);
    await auditLog({ userId, func: 'push-info', action: 'CRM_WRITE', entityId: idLucrare,
      fields: 'observatii len=' + observatii.length, diff: r.ok ? 'OK' : r.error });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
