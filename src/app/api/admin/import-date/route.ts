import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope } from '@/lib/scope';
import { auditLog } from '@/lib/audit';

// Import O SINGURĂ DATĂ al datelor din spreadsheet (strategii + status) — STRICT în contul propriu.
// Body: { clients: [ { idLucrare, strategieV1?, strategieV2?, stadiu?, nevoia?,
//                       schitaStatus?, preOfertat?, ofertat?, strategieNevoi?, obsSituatie?, t1? } ] }
// Match pe idLucrare DOAR în clienții lui scope.userId. idLucrare e unic per owner (@@unique([ownerId,idLucrare])),
// deci match-ul e NEAMBIGUU și NU se poate scrie pe clientul altui agent (fiecare agent își importă propriile date).
// UPDATE, nu creează clienți noi (aceia vin din sync CRM). Blob strategie = MERGE (nu pierde ce era).

function isPlainObject(x: any): x is Record<string, any> {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}
function mergeBlob(existing: string | null, incoming: any): string | undefined {
  if (incoming == null || incoming === '') return undefined;
  let base: Record<string, any> = {};
  if (existing) { try { const b = JSON.parse(existing); if (isPlainObject(b)) base = b; } catch { /* base = {} */ } }
  let inc: Record<string, any>;
  if (typeof incoming === 'string') { try { const p = JSON.parse(incoming); inc = isPlainObject(p) ? p : {}; } catch { return undefined; } }
  else if (isPlainObject(incoming)) inc = incoming;
  else return undefined; // number/boolean/array → nimic de merge-uit (fără write inutil, fără chei numerice '0','1')
  // import-ul are prioritate per cheie, dar NU suprascrie cu gol
  const merged: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(inc)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') merged[k] = v;
  }
  return JSON.stringify(merged);
}

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false, error: 'Neautentificat' }, { status: 401 });
  // Orice user autentificat își poate importa PROPRIILE date — match pe idLucrare DOAR în clienții lui
  // (ownerId: scope.userId). NU afectează alți agenți și NU poate nimeri clientul altcuiva cu același idLucrare.

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON invalid' }, { status: 400 }); }
  const items: any[] = Array.isArray(body) ? body : (body?.clients || []);
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'Lipsește lista de clienți (clients[]) sau e goală' }, { status: 400 });
  }

  let updated = 0, notFound = 0, skipped = 0;
  const notFoundSample: string[] = [];
  const SCALAR = ['stadiu', 'nevoia', 'schitaStatus', 'preOfertat', 'ofertat', 'strategieNevoi', 'obsSituatie', 't1'];

  for (const it of items) {
    const idLucrare = String(it?.idLucrare ?? it?.id_lucrare ?? '').trim();
    if (!idLucrare) { skipped++; continue; }
    // STRICT pe contul propriu → match neambiguu (idLucrare e unic per owner).
    const client = await prisma.client.findFirst({
      where: { idLucrare, ownerId: scope.userId },
      select: { id: true, strategieV1: true, strategieV2: true, t1Locked: true }
    });
    if (!client) { notFound++; if (notFoundSample.length < 50) notFoundSample.push(idLucrare); continue; }

    const data: Record<string, any> = {};
    const v1 = mergeBlob(client.strategieV1, it.strategieV1);
    const v2 = mergeBlob(client.strategieV2, it.strategieV2);
    if (v1 !== undefined) data.strategieV1 = v1;
    if (v2 !== undefined) data.strategieV2 = v2;
    for (const k of SCALAR) {
      if (k === 't1' && client.t1Locked) continue; // respectă T1 fixat manual (ca sync-engine.ts) — importul nu-l suprascrie
      if (it[k] != null && String(it[k]).trim() !== '') data[k] = String(it[k]);
    }
    if (Object.keys(data).length === 0) { skipped++; continue; }
    await prisma.client.update({ where: { id: client.id }, data });
    updated++;
  }

  await auditLog({ userId: scope.userId, func: 'import-date', action: 'IMPORT', entity: 'Client', fields: `updated=${updated} notFound=${notFound} skipped=${skipped} total=${items.length}` });
  return NextResponse.json({ ok: true, updated, notFound, skipped, total: items.length, notFoundSample });
}
