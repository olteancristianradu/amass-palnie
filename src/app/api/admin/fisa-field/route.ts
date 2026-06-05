import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope } from '@/lib/scope';
import { auditLog } from '@/lib/audit';
import { safeParseBlob, isNonEmptyValue, applyFieldDeletionToBlob, type FisaZone } from '@/lib/fisa-template';

// ── Operații DESTRUCTIVE pe un CÂMP al fișei (cheie din blob-ul strategieV1/V2) — DOAR admin ──
// Folosit de editorul de format (admin/fisa) când se șterge un câmp care are deja date la clienți.
//
// Body: { variant:'V1'|'V2', key, action:'count'|'delete-hard'|'delete-to-obs', obsKey? }
//   - 'count'         → numărul de clienți cu valoare non-goală la blob[key]. NU modifică nimic.
//   - 'delete-hard'   → șterge cheia din blob-ul fiecărui client ȘI din toate ArhivaEntry.dataSnapshot.
//   - 'delete-to-obs' → mută blob[key] în blob[obsKey] (append „\n[Eticheta]: valoare"), apoi șterge
//                       cheia. La fel în snapshoturile de arhivă. obsKey vine din body (obs zona câmpului).
//
// V1 → coloana Client.strategieV1; V2 → Client.strategieV2. Snapshot-ul de arhivă e JSON.stringify(client),
// deci câmpul de strategie e un JSON NESTED (string) în interiorul snapshotului — îl parsăm la al 2-lea nivel.
// DEFENSIV la JSON corupt (helpers safeParseBlob / applyFieldDeletionToBlob nu aruncă niciodată).

type Variant = 'V1' | 'V2';
type Action = 'count' | 'delete-hard' | 'delete-to-obs';

// Coloana Client în care stă blob-ul variantei.
function blobCol(variant: Variant): 'strategieV1' | 'strategieV2' {
  return variant === 'V1' ? 'strategieV1' : 'strategieV2';
}

export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false, error: 'Neautentificat' }, { status: 401 });
  if (scope.role !== 'admin') return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }
  const variant = body?.variant as Variant;
  const key = typeof body?.key === 'string' ? body.key.trim() : '';
  const action = body?.action as Action;
  const obsKey = typeof body?.obsKey === 'string' ? body.obsKey.trim() : '';
  const label = typeof body?.label === 'string' ? body.label : key;

  if (variant !== 'V1' && variant !== 'V2')
    return NextResponse.json({ ok: false, error: 'variant trebuie V1 sau V2' }, { status: 400 });
  if (!key)
    return NextResponse.json({ ok: false, error: 'key lipsă' }, { status: 400 });
  if (action !== 'count' && action !== 'delete-hard' && action !== 'delete-to-obs')
    return NextResponse.json({ ok: false, error: 'action invalid' }, { status: 400 });
  if (action === 'delete-to-obs' && !obsKey)
    return NextResponse.json({ ok: false, error: 'obsKey lipsă pentru delete-to-obs' }, { status: 400 });
  // Anti-shoot-in-foot: nu muta câmpul în el însuși.
  if (action === 'delete-to-obs' && obsKey === key)
    return NextResponse.json({ ok: false, error: 'obsKey nu poate fi același cu key' }, { status: 400 });

  const col = blobCol(variant);

  // ── FIX Bug 2: validare că obsKey există în template înainte de delete-to-obs ──
  // Fără această verificare, valorile ar fi mutate într-o cheie fantomă (dangling reference).
  if (action === 'delete-to-obs') {
    let templateZones: FisaZone[] = [];
    try {
      const tRow = await prisma.fisaTemplate.findUnique({ where: { variant } });
      if (tRow?.zones) templateZones = JSON.parse(tRow.zones) as FisaZone[];
    } catch { /* template corupt sau absent — procedăm la validare cu lista goală */ }
    const templateKeys = new Set<string>();
    for (const z of templateZones) for (const f of z.fields ?? []) if (f.key) templateKeys.add(f.key);
    if (templateKeys.size > 0 && !templateKeys.has(obsKey)) {
      return NextResponse.json(
        { ok: false, error: `obsKey "${obsKey}" nu există în template-ul ${variant} — verifică cheia câmpului de observații țintă` },
        { status: 400 }
      );
    }
  }

  // Admin = scope la TOȚI clienții. Tragem doar coloana blob-ului (+ id) ca să fim ușori la 820 clienți.
  // Filtrăm pe „coloana nu e goală" ca pre-filtru ieftin; verificarea fină a cheii e în JS.
  // Selectul folosește o cheie calculată ([col]) → inferența Prisma pe elementul de rând devine
  // un union prea larg (c.id ajunge inferat ca array). Tipăm explicit: garantat avem { id, [col] }.
  const clients = (await prisma.client.findMany({
    where: { [col]: { not: null } },
    select: { id: true, [col]: true } as any,
  })) as unknown as Array<{ id: string } & Record<string, unknown>>;

  // ── COUNT (non-destructiv) ──
  if (action === 'count') {
    let count = 0;
    for (const c of clients) {
      const blob = safeParseBlob(c[col]);
      if (isNonEmptyValue(blob[key])) count++;
    }
    // Audit ușor (read-only, dar util pentru trasabilitate „ce a verificat adminul").
    await auditLog({
      userId: scope.userId, func: 'fisa-field', action: 'COUNT',
      entity: 'FisaField', entityId: variant + ':' + key,
      fields: 'count=' + count,
    });
    return NextResponse.json({ ok: true, count });
  }

  // ── DELETE-HARD / DELETE-TO-OBS (destructive) ──
  const mode: 'hard' | 'to-obs' = action === 'delete-hard' ? 'hard' : 'to-obs';

  // Ținta vizată: clienții care chiar AU cheia în blob (existență, nu doar non-goală — la hard
  // ștergem cheia indiferent de valoare; la to-obs mutăm doar valori non-goale, dar tot ștergem cheia).
  const targets = clients.filter(c => key in safeParseBlob(c[col]));

  let affected = 0;
  // FIX Bug 1: acumulăm eșecurile per-client (idLucrare/id) în loc să raportăm un fals total.
  const failed: { id: string; error: string }[] = [];

  // Procesăm fiecare client într-o tranzacție proprie: blob-ul live + TOATE snapshoturile lui.
  // O tranzacție per client (nu una globală) → la 820 clienți o tranzacție uriașă ar putea bloca SQLite;
  // izolarea per client e atomică acolo unde contează (un client nu rămâne în stare inconsistentă).
  for (const c of targets) {
    const live = applyFieldDeletionToBlob(c[col], key, { mode, label, obsKey });

    // Snapshoturile clientului (dataSnapshot = JSON.stringify(client), cu strategieV1/V2 nested-string).
    const snaps = await prisma.arhivaEntry.findMany({
      where: { clientId: c.id },
      select: { id: true, dataSnapshot: true },
    });

    const snapUpdates: { id: string; dataSnapshot: string }[] = [];
    for (const s of snaps) {
      let snapObj: Record<string, unknown>;
      try { snapObj = JSON.parse(s.dataSnapshot); } catch { continue; } // snapshot corupt → îl lăsăm intact
      if (!snapObj || typeof snapObj !== 'object' || Array.isArray(snapObj)) continue;
      // Câmpul de strategie din snapshot e un JSON nested (string). Aplicăm aceeași ștergere.
      const nested = applyFieldDeletionToBlob(snapObj[col], key, { mode, label, obsKey });
      if (!nested.changed) continue; // cheia nu era în acest snapshot → nimic de modificat
      snapObj[col] = nested.blob; // string sau null (blob golit)
      snapUpdates.push({ id: s.id, dataSnapshot: JSON.stringify(snapObj) });
    }

    try {
      await prisma.$transaction([
        prisma.client.update({ where: { id: c.id }, data: { [col]: live.blob } as any }),
        ...snapUpdates.map(u =>
          prisma.arhivaEntry.update({ where: { id: u.id }, data: { dataSnapshot: u.dataSnapshot } })
        ),
      ]);
      affected++;
    } catch (e) {
      // FIX Bug 1 + Bug 3: înregistrăm eșecul (nu incrementăm affected) și logăm cu detalii.
      const errMsg = e instanceof Error ? e.message : (e == null ? 'eroare necunoscută' : String(e));
      failed.push({ id: c.id, error: errMsg });
      console.error('[fisa-field] update eșuat pt client', c.id, errMsg);
    }
  }

  // FIX Bug 3: audit log include și numărul/lista eșecurilor, nu doar succesele.
  const failedIds = failed.map(f => f.id).join(',');
  await auditLog({
    userId: scope.userId, func: 'fisa-field', action: action.toUpperCase().replace(/-/g, '_'),
    entity: 'FisaField', entityId: variant + ':' + key,
    fields: 'affected=' + affected + ' failed=' + failed.length
      + (failed.length > 0 ? ' failedIds=' + failedIds : '')
      + (mode === 'to-obs' ? ' obsKey=' + obsKey : ''),
  });

  // FIX Bug 1: returnăm numărul real de succese + lista eșecurilor (id + eroare) în răspuns.
  return NextResponse.json({
    ok: true,
    affected,
    ...(failed.length > 0 && { failedCount: failed.length, failed }),
  });
}
