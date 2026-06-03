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
    // CRITIC (audit 2026-06-01): adaugă reminderul în CRM-ul OWNER-ului lucrării (client.ownerId),
    // nu al cererii; idLucrare e mapat per cont în gestcom. userId rămâne doar pentru audit.
    const r = await addReminder(client.ownerId, payload);
    await auditLog({ userId, func: 'reminder/add', action: 'CRM_WRITE', entityId: payload.idLucrare,
      fields: 'tip=' + payload.tip + '; data=' + payload.data, diff: r.ok ? 'OK' : r.error });

    // Paritate spreadsheet: la salvarea unui reminder, marchează reminderele deschise ca EXECUTATE.
    // Doar dacă reminderul nou a fost salvat și userul a cerut-o (markOthersDone, bifat implicit în UI).
    // Best-effort: NU bloca răspunsul dacă întârzie; întoarce markedDone dacă se rezolvă repede.
    let markedDone: number | undefined;
    if (r.ok && payload.markOthersDone) {
      try {
        const markPromise = markOpenRemindersExecuted(client.ownerId, String(payload.idLucrare))
          .then(async (mr) => {
            await auditLog({ userId, func: 'reminder/markOthersDone', action: 'CRM_WRITE', entityId: payload.idLucrare,
              fields: 'auto-executate la salvare reminder', diff: mr.ok ? ('marked=' + mr.marked) : (mr.error || 'eroare') });
            return mr;
          })
          .catch((e: any) => {
            console.warn('[reminder/route] markOpenRemindersExecuted eșuat: ' + (e?.message || e));
            return { ok: false, marked: 0 } as { ok: boolean; marked: number };
          });
        // Așteaptă scurt (best-effort): dacă se rezolvă repede întoarcem markedDone, altfel lăsăm fire-and-forget.
        const winner = await Promise.race([
          markPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
        ]);
        if (winner && typeof (winner as any).marked === 'number') markedDone = (winner as any).marked;
      } catch (e: any) {
        // Niciodată nu lăsa marcarea automată să strice răspunsul reminderului principal.
        console.warn('[reminder/route] markOthersDone wrapper eroare: ' + (e?.message || e));
      }
    }

    return NextResponse.json({ ...r, ...(markedDone !== undefined ? { markedDone } : {}) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
