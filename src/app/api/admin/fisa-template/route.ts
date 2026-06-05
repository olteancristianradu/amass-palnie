import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope } from '@/lib/scope';
import { auditLog } from '@/lib/audit';
import { validateTemplate, type FisaTemplateData } from '@/lib/fisa-template';
import { SEED_V1, SEED_V2 } from '@/lib/fisa-template-seed';

// Template-ul fișei: GET = orice user autentificat (cu auto-seed), PATCH = doar admin.

const SEEDS: Record<'V1' | 'V2', FisaTemplateData> = { V1: SEED_V1, V2: SEED_V2 };

// Întoarce template-ul unei variante din DB; dacă lipsește, auto-seed din SEED_V1/V2.
async function loadTemplate(variant: 'V1' | 'V2'): Promise<FisaTemplateData> {
  const seed = SEEDS[variant];
  const row = await prisma.fisaTemplate.upsert({
    where: { variant },
    update: {}, // dacă există, nu modificăm nimic — doar citim
    create: { variant, titlu: seed.titlu, zones: JSON.stringify(seed.zones) },
  });
  // JSON.parse protejat: zones corupt în DB nu trebuie să arunce 500 pe toată aplicația.
  let zones: any = [];
  try { zones = JSON.parse(row.zones) || []; } catch { zones = []; }
  return { variant, titlu: row.titlu, zones };
}

export async function GET() {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false, error: 'Neautentificat' }, { status: 401 });
  const [V1, V2] = await Promise.all([loadTemplate('V1'), loadTemplate('V2')]);
  return NextResponse.json({ ok: true, templates: { V1, V2 } });
}

export async function PATCH(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false, error: 'Neautentificat' }, { status: 401 });
  if (scope.role !== 'admin') return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });

  const { variant, titlu, zones, allowRemoveKeys } = await req.json();
  if (variant !== 'V1' && variant !== 'V2')
    return NextResponse.json({ ok: false, error: 'variant trebuie V1 sau V2' }, { status: 400 });

  // Protecție anti-orfanizare: încarcă template-ul curent și respinge dacă vreo cheie existentă dispare
  // din noul payload (redenumire/ștergere de câmp existent = pierdere de date la clienți).
  // EXCEPȚIE: cheile din `allowRemoveKeys` au fost curățate explicit (prin /api/admin/fisa-field) ÎNAINTE
  // de acest PATCH (ștergere câmp) sau confirmate de admin la resetarea la structura implicită.
  const allow = Array.isArray(allowRemoveKeys) ? allowRemoveKeys.filter((k: any) => typeof k === 'string') : undefined;
  const prev = await loadTemplate(variant);
  const v = validateTemplate({ variant, titlu, zones }, prev, allow);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });

  const seed = SEEDS[variant as 'V1' | 'V2'];
  await prisma.fisaTemplate.upsert({
    where: { variant },
    update: { titlu, zones: JSON.stringify(zones), version: { increment: 1 }, updatedBy: scope.userId },
    create: { variant, titlu: titlu || seed.titlu, zones: JSON.stringify(zones), updatedBy: scope.userId },
  });
  await auditLog({ userId: scope.userId, func: 'fisa-template', action: 'UPDATE', entity: 'FisaTemplate', entityId: variant });
  return NextResponse.json({ ok: true });
}
