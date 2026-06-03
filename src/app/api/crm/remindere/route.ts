import { NextRequest, NextResponse } from 'next/server';
import { listRemindere } from '@/lib/crm-client';
import { getScope, findClientInScope } from '@/lib/scope';

// GET /api/crm/remindere?idLucrare=NNN — lista COMPLETĂ de remindere (pt panoul din fișă, ca în spreadsheet).
export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const idLucrare = req.nextUrl.searchParams.get('idLucrare') || '';
  if (!idLucrare) return NextResponse.json({ ok: false, error: 'idLucrare lipsă' }, { status: 400 });
  // ANTI-IDOR: doar lucrări din scope-ul userului. Citim din CRM-ul OWNER-ului lucrării.
  const client = await findClientInScope(scope, String(idLucrare));
  if (!client) return NextResponse.json({ ok: false, error: 'Acces interzis la această lucrare' }, { status: 403 });
  try {
    const remindere = await listRemindere(client.ownerId, idLucrare);
    return NextResponse.json({ ok: true, remindere });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
