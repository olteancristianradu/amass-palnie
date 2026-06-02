import { NextRequest, NextResponse } from 'next/server';
import { addReminder } from '@/lib/crm-client';
import { auditLog } from '@/lib/audit';
import { getScope, findClientInScope } from '@/lib/scope';

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = scope.userId;
  const payload = await req.json();
  if (!payload.idLucrare || !payload.data || !payload.tip || !payload.info) {
    return NextResponse.json({ ok: false, error: 'Date lipsă (idLucrare, data, tip, info)' }, { status: 400 });
  }
  // ANTI-IDOR (audit 2026-06-01): doar lucrări din scope-ul userului.
  const client = await findClientInScope(scope, String(payload.idLucrare));
  if (!client) return NextResponse.json({ ok: false, error: 'Acces interzis la această lucrare' }, { status: 403 });
  // CRM cere subtip obligatoriu pentru INTALNIRE (1) / DELEGATIE (2)
  const tipNum = parseInt(String(payload.tip), 10);
  if ((tipNum === 1 || tipNum === 2) && (!payload.subtip || String(payload.subtip) === '0')) {
    return NextResponse.json({ ok: false, error: 'Pentru ÎNTÂLNIRE/DELEGAȚIE trebuie ales și subtipul.' }, { status: 400 });
  }
  try {
    // CRITIC (audit 2026-06-01): adaugă reminderul în CRM-ul OWNER-ului lucrării (client.ownerId),
    // nu al cererii; idLucrare e mapat per cont în gestcom. userId rămâne doar pentru audit.
    const r = await addReminder(client.ownerId, payload);
    await auditLog({ userId, func: 'reminder/add', action: 'CRM_WRITE', entityId: payload.idLucrare,
      fields: 'tip=' + payload.tip + '; data=' + payload.data, diff: r.ok ? 'OK' : r.error });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
