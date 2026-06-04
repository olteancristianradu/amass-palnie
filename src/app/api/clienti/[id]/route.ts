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

// ANTI-WIPE blob strategie (paritate spreadsheet, bug-ul istoric de wipe): la salvarea fișei NU lăsăm o
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

// ── MIGRARE strategie V1 ↔ V2 când se schimbă categoria clientului ──
// V1 (cat 1, construcție) și V2 (cat 2+) au chei de blob parțial diferite (vezi fisa-template-seed.ts).
// Cheile COMUNE (păstrate identic la migrare): suprafata, bransament, alternativa, motiv_principal,
//   tip_plata, interval_buget, nivel_bani, tipologie, preventie, obs_*, strategie_nevoi etc.
// Cheile cu ALIAS diferit între variante (se mapează 1:1):
//   V1.ca_sistem      ↔ V2.sistem_actual
//   V1.ca_cost_lunar  ↔ V2.suma
const ALIAS_V1_TO_V2: Record<string, string> = {
  ca_sistem: 'sistem_actual',
  ca_cost_lunar: 'suma',
};
const ALIAS_V2_TO_V1: Record<string, string> = Object.fromEntries(
  Object.entries(ALIAS_V1_TO_V2).map(([v1, v2]) => [v2, v1])
);

// Mapează un blob dintr-o variantă în cealaltă: cheile comune trec neatinse, cheile cu alias sunt
// redenumite. Cheile pur-calc (`_c_*`) nu sunt stocate, deci nu apar aici. Helper de mapare aliasuri.
function mapStrategieAliases(blob: Record<string, any>, aliasMap: Record<string, string>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(blob)) {
    const target = aliasMap[k] ?? k; // alias dacă există, altfel cheie comună (păstrată)
    out[target] = v;
  }
  return out;
}

function parseBlob(s: string | null): Record<string, any> {
  if (!s) return {};
  try { const b = JSON.parse(s); if (b && typeof b === 'object' && !Array.isArray(b)) return b; } catch {}
  return {};
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

  // Parsare dată robustă: acceptă ISO (yyyy-mm-dd / ISO complet) ȘI formatul RO dd.mm.yyyy (folosit de
  // celulele de dată din tabel). Întoarce null la valoare invalidă (NU „Invalid Date" → evită crash la save).
  const parseDateFlexible = (v: any): Date | null => {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(v)) { const [d, m, y] = v.split('.'); return new Date(+y, +m - 1, +d); }
    const dt = new Date(v); return isNaN(dt.getTime()) ? null : dt;
  };
  // Construiește data de update (whitelist; datele primesc Date sau null).
  const data: any = {};
  for (const f of SIMPLE_FIELDS) {
    if (updates[f] === undefined) continue;
    if (DATE_FIELDS.includes(f)) data[f] = parseDateFlexible(updates[f]);
    else data[f] = updates[f];
  }
  // ANTI-WIPE (restaurat — fusese revertit la JSON.stringify): gol nu suprascrie non-gol.
  if (updates.strategieV1 !== undefined) data.strategieV1 = mergeStrategieBlob(before.strategieV1, updates.strategieV1);
  if (updates.strategieV2 !== undefined) data.strategieV2 = mergeStrategieBlob(before.strategieV2, updates.strategieV2);

  // `categorie` (Int) și `isDT` (Boolean) — permise la update, cu coerciție de tip (nu sunt în
  // SIMPLE_FIELDS fiindcă acolo valorile se scriu brute). NOTĂ: categoria poate să NU fie încă
  // editabilă în UI; migrarea de mai jos e gata pentru momentul în care va deveni editabilă.
  if (updates.categorie !== undefined && updates.categorie !== null) data.categorie = Number(updates.categorie);
  if (updates.isDT !== undefined) data.isDT = Boolean(updates.isDT);

  // ── MIGRARE blob V1 ↔ V2 la schimbarea categoriei (1 → ≥2 sau ≥2 → 1) ──
  // V1 = categoria 1; V2 = categoria ≥2. Migrăm DOAR la traversarea acestei granițe.
  // NU ștergem blob-ul vechi (rămâne ca backup); creăm doar blob-ul lipsă în varianta-țintă.
  if (data.categorie !== undefined) {
    const wasV1 = before.categorie === 1;
    const willV1 = data.categorie === 1;
    if (wasV1 && !willV1) {
      // 1 → V2: dacă există strategieV1 și NU există strategieV2, generează strategieV2 din V1.
      const v1 = parseBlob(before.strategieV1);
      const hasV1 = Object.keys(v1).length > 0;
      const v2Exists = Object.keys(parseBlob(before.strategieV2)).length > 0
        || (data.strategieV2 !== undefined && Object.keys(parseBlob(data.strategieV2)).length > 0);
      if (hasV1 && !v2Exists && data.strategieV2 === undefined) {
        data.strategieV2 = JSON.stringify(mapStrategieAliases(v1, ALIAS_V1_TO_V2));
      }
    } else if (!wasV1 && willV1) {
      // ≥2 → 1: dacă există strategieV2 și NU există strategieV1, generează strategieV1 din V2.
      const v2 = parseBlob(before.strategieV2);
      const hasV2 = Object.keys(v2).length > 0;
      const v1Exists = Object.keys(parseBlob(before.strategieV1)).length > 0
        || (data.strategieV1 !== undefined && Object.keys(parseBlob(data.strategieV1)).length > 0);
      if (hasV2 && !v1Exists && data.strategieV1 === undefined) {
        data.strategieV1 = JSON.stringify(mapStrategieAliases(v2, ALIAS_V2_TO_V1));
      }
    }
  }

  // VALIDARE DE TRANZIȚIE (blocant la avansare) — dacă patch-ul schimbă stadiul derivat.
  if (STAGE_FIELDS.some(f => updates[f] !== undefined)) {
    const merged: any = { ...before, ...data };
    const v = checkStageTransition(before as any, merged);
    if (!v.ok) return NextResponse.json({ ok: false, validationErrors: v.errors, error: v.errors.join(' ') }, { status: 400 });
  }

  const updated = await prisma.client.update({ where: { id: params.id }, data });
  // Snapshot arhivă DOAR la salvarea strategiei (nu la editări inline stadiu/nevoia/schiță — ar spama).
  // THROTTLE anti-spam: salvarea AUTOMATĂ (debounce ~1.2s) ar crea zeci de snapshoturi quasi-identice.
  // Sărim crearea dacă ultimul snapshot al acestui client e mai recent de 3 minute → max 1 snapshot/3min.
  if (updates.strategieV1 !== undefined || updates.strategieV2 !== undefined) {
    const lastSnap = await prisma.arhivaEntry.findFirst({ where: { clientId: params.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const tooRecent = lastSnap && (Date.now() - lastSnap.createdAt.getTime() < 3 * 60 * 1000);
    if (!tooRecent) {
    await prisma.arhivaEntry.create({
      data: {
        clientId: params.id,
        versiune: updates.versiune ?? (before.categorie === 1 ? 'V1' : 'V2'),
        dataSnapshot: JSON.stringify(updated)
      }
    });
    // CAP anti-creștere nelimitată: păstrează DOAR ultimele 50 de snapshoturi per client.
    // Ia ID-urile celor mai vechi (peste primele 50, ordonate desc după createdAt) și le șterge.
    const old = await prisma.arhivaEntry.findMany({
      where: { clientId: params.id },
      orderBy: { createdAt: 'desc' },
      skip: 50,
      select: { id: true }
    });
    if (old.length > 0) {
      await prisma.arhivaEntry.deleteMany({ where: { id: { in: old.map(o => o.id) } } });
    }
    }
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
