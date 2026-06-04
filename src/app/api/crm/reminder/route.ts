import { NextRequest, NextResponse } from 'next/server';
import { addReminder, markOpenRemindersExecuted } from '@/lib/crm-client';
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
    // FIX 2026-06-03 (#9 excludere reminder nou): marchează reminderele deschise EXISTENTE ÎNAINTE de a
    // crea cel nou. Altfel cel nou — creat acum, status=0 — ar fi și el marcat „executat" (bug). Mark-
    // before-add = excludere sigură fără să depindem de id-ul returnat de gestcom (addReminder nu-l întoarce).
    // Best-effort: NU strică salvarea reminderului dacă marcarea eșuează.
    let markedDone: number | undefined;
    if (payload.markOthersDone) {
      try {
        const mr = await markOpenRemindersExecuted(client.ownerId, String(payload.idLucrare));
        if (typeof mr.marked === 'number') markedDone = mr.marked;
        await auditLog({ userId, func: 'reminder/markOthersDone', action: 'CRM_WRITE', entityId: payload.idLucrare,
          fields: 'auto-executate înainte de reminderul nou', diff: mr.ok ? ('marked=' + mr.marked) : (mr.error || 'eroare') });
      } catch (e: any) {
        console.warn('[reminder/route] markOpenRemindersExecuted eșuat: ' + (e?.message || e));
      }
    }

    // CRITIC (audit 2026-06-01): adaugă reminderul în CRM-ul OWNER-ului lucrării (client.ownerId),
    // nu al cererii; idLucrare e mapat per cont în gestcom. userId rămâne doar pentru audit.
    const r = await addReminder(client.ownerId, payload);
    await auditLog({ userId, func: 'reminder/add', action: 'CRM_WRITE', entityId: payload.idLucrare,
      fields: 'tip=' + payload.tip + '; data=' + payload.data, diff: r.ok ? 'OK' : r.error });

    return NextResponse.json({ ...r, ...(markedDone !== undefined ? { markedDone } : {}) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
