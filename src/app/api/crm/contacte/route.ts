import { NextRequest, NextResponse } from 'next/server';
import { fetchContacte } from '@/lib/crm-client';
import { getScope, findClientInScope } from '@/lib/scope';

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const idLucrare = new URL(req.url).searchParams.get('idLucrare');
  if (!idLucrare) return NextResponse.json({ ok: false, error: 'idLucrare lipsă' }, { status: 400 });
  // ANTI-IDOR (audit 2026-06-01): doar lucrări din scope-ul userului.
  const client = await findClientInScope(scope, idLucrare);
  if (!client) return NextResponse.json({ ok: false, error: 'Acces interzis la această lucrare' }, { status: 403 });
  try {
    // CRITIC (audit 2026-06-01): citește din CRM-ul OWNER-ului lucrării (client.ownerId), nu al cererii;
    // idLucrare e mapat per cont în gestcom (același id pe alt cont = altă lucrare sau inexistentă).
    const contacte = await fetchContacte(client.ownerId, idLucrare);
    return NextResponse.json({ ok: true, contacte });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
