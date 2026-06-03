import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { getScope, canAccessClient } from '@/lib/scope';
import { pushStatusPalnie } from '@/lib/crm-client';
import { checkStageTransition, deriveStage } from '@/lib/stage-rules';

// Câmpurile de „status pâlnie" care, la modificare, se împing în Observații CRM (zona aleasă: push în observații).
const STATUS_FIELDS = ['schitaStatus', 'preOfertat', 'ofertat', 'nevoia', 'stadiu'];
// Câmpuri care pot schimba stadiul derivat → declanșează validarea de tranziție.
const STAGE_FIELDS = ['schitaStatus', 'preOfertat', 'ofertat', 'stadiu', 't1'];
// Câmpuri simple permise la update (pe lângă strategieV1/V2 tratate separat).
const SIMPLE_FIELDS = ['stadiu', 'nevoia', 'schitaStatus', 'preOfertat', 'ofertat', 'suprafata',
  't1', 't1Locked', 'probabilitate', 'closeDate', 'forecastCategory', 'closureReason', 'closureReasonDetail', 'nextStepText', 'nextStepDue', 'obsSituatie', 'strategieNevoi', 'notaManager'];
const DATE_FIELDS = ['closeDate', 'nextStepDue'];

// ANTI-WIPE blob strategie (paritate spreadsheet, bug-ul Paulian): la salvarea fișei NU lăsăm o
// valoare GOALĂ să suprascrie o valoare NON-GOALĂ deja stocată. Merge cheie-cu-cheie peste blob-ul
// existent: valorile noi non-goale se scriu; goalul peste non-gol păstrează existentul.
function mergeStrategieBlob(existing: string | null, incoming: any): string {
  let base: Record<string, any> = {};
  if (existing) { try { const b = JSON.parse(existing); if (b && typeof b === 'object' && !Array.isArray(b)) base = b; } catch {} }
  const inc = (incoming && typeof incoming === 'object' && !Array.isArray(incoming)) ? incoming : {};
  const merged: Record<string, any> = { ...base };
  for (const [k, v] of Object.entries(inc)) {
    const empty = v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
    if (!empty) merged[k] = v;            // valoare nouă utilă → scrie
    else if (!(k in base)) merged[k] = v; // cheie nouă goală (nu exista) → ok
    // altfel: gol peste non-gol → PĂSTREAZĂ existentul (anti-wipe)
  }
  return JSON.stringify(merged);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const c = await prisma.client.findUnique({ where: { id: params.id } });
  if (!c || !(await canAccessClient(scope, c.ownerId))) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true, client: c });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = scope.userId;
  const updates = await req.json();
  const before = await prisma.client.findUnique({ where: { id: params.id } });
  if (!before || !(await canAccessClient(scope, before.ownerId))) return NextResponse.json({ ok: false }, { status: 404 });

  // Construiește data de update (whitelist; datele primesc Date sau null).
  const data: any = {};
  for (const f of SIMPLE_FIELDS) {
    if (updates[f] === undefined) continue;
    if (DATE_FIELDS.includes(f)) data[f] = updates[f] ? new Date(updates[f]) : null;
    else data[f] = updates[f];
  }
  if (updates.strategieV1 !== undefined) data.strategieV1 = JSON.stringify(updates.strategieV1);
  if (updates.strategieV2 !== undefined) data.strategieV2 = JSON.stringify(updates.strategieV2);

  // VALIDARE DE TRANZIȚIE (blocant la avansare) — dacă patch-ul schimbă stadiul derivat.
  if (STAGE_FIELDS.some(f => updates[f] !== undefined)) {
    const merged: any = { ...before, ...data };
    const v = checkStageTransition(before as any, merged);
    if (!v.ok) return NextResponse.json({ ok: false, validationErrors: v.errors, error: v.errors.join(' ') }, { status: 400 });
  }

  const updated = await prisma.client.update({ where: { id: params.id }, data });
  // Snapshot arhivă DOAR la salvarea strategiei (nu la editări inline stadiu/nevoia/schiță — ar spama).
  if (updates.strategieV1 !== undefined || updates.strategieV2 !== undefined) {
    await prisma.arhivaEntry.create({
      data: {
        clientId: params.id,
        versiune: updates.versiune ?? (before.categorie === 1 ? 'V1' : 'V2'),
        dataSnapshot: JSON.stringify(updated)
      }
    });
  }
  await auditLog({
    userId, func: 'clienti/update', action: 'UPDATE',
    entity: 'Client', entityId: params.id,
    fields: Object.keys(updates).join(',')
  });
  // Write-back LIVE în CRM: dacă s-a schimbat o etapă de pâlnie / nevoia / stadiu,
  // împinge blocul STATUS PALNIE în Observații CRM. Fire-and-forget (nu blocăm UI-ul);
  // se face pe contul owner-ului clientului (are credențialele CRM).
  if (STATUS_FIELDS.some(f => updates[f] !== undefined)) {
    pushStatusPalnie(before.ownerId, updated.idLucrare, {
      schita: updated.schitaStatus, preOfertat: updated.preOfertat, ofertat: updated.ofertat,
      nevoia: updated.nevoia, stadiu: updated.stadiu
    }).then(r => { if (!r.ok) console.error('[status→CRM] id=' + updated.idLucrare, r.error); })
      .catch(e => console.error('[status→CRM] id=' + updated.idLucrare, e?.message));
  }
  return NextResponse.json({ ok: true, client: updated });
}
