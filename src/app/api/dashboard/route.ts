import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope, clientScopeWhere, getVisibleOwnerIds } from '@/lib/scope';
import { getAutoSyncState } from '@/lib/auto-sync';

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const owner = params.get('owner');
  const startParam = params.get('start');
  const endParam = params.get('end');
  const where = await clientScopeWhere(scope, owner);

  // Filtru pe dataIntrare (cohortă), echivalent C3/E3 din Dashboard.gs.
  // Interval inclusiv: start = 00:00 ziua start, end = sfârșitul zilei end (< end+1zi).
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  const validStart = start && !isNaN(start.getTime()) ? start : null;
  const validEnd = end && !isNaN(end.getTime()) ? end : null;
  if (validStart || validEnd) {
    const di: any = {};
    if (validStart) {
      validStart.setHours(0, 0, 0, 0);
      di.gte = validStart;
    }
    if (validEnd) {
      const endIncl = new Date(validEnd);
      endIncl.setHours(0, 0, 0, 0);
      endIncl.setDate(endIncl.getDate() + 1);
      di.lt = endIncl;
    }
    where.dataIntrare = di;
  }

  const clienti = await prisma.client.findMany({
    where,
    select: { stadiu: true, categorie: true, suprafata: true, t1: true, nevoia: true, schitaStatus: true, preOfertat: true, ofertat: true, stelutaCat: true }
  });
  const byStadiu: Record<string, number> = {};
  const byCategorie: Record<string, number> = {};
  const byPrioritate: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 };
  let totalSuprafata = 0;
  const nz = (v: any) => v != null && String(v).trim() !== '';
  // Treapta "Nevoie identificată" = nevoia acoperită (eventual cu condiții), ca în Dashboard.gs.
  const isNevoieAcoperita = (v: any) => {
    const s = String(v ?? '').trim();
    return s === 'Nevoie Acoperita' || s === 'Nevoie Acoperita in anumite conditii';
  };
  const funnel = { intrari: clienti.length, t1: 0, nevoie: 0, schita: 0, preofertat: 0, ofertat: 0, contractat: 0 };
  // Indicatori urgenți (per-rând, precis):
  //  - schiță setată DAR ofertat gol  → urmărire necesară
  //  - ofertat setat DAR stadiu != Contractat → follow-up
  let schitaFaraOferta = 0;
  let ofertatFaraContract = 0;
  for (const c of clienti) {
    const k = c.stadiu ?? '';
    byStadiu[k] = (byStadiu[k] ?? 0) + 1;
    byCategorie[String(c.categorie)] = (byCategorie[String(c.categorie)] ?? 0) + 1;
    byPrioritate[String(c.stelutaCat ?? 0)] = (byPrioritate[String(c.stelutaCat ?? 0)] ?? 0) + 1;
    if (c.suprafata) totalSuprafata += c.suprafata;
    if (nz(c.t1)) funnel.t1++;
    if (isNevoieAcoperita(c.nevoia)) funnel.nevoie++;
    if (nz(c.schitaStatus)) funnel.schita++;
    if (nz(c.preOfertat)) funnel.preofertat++;
    if (nz(c.ofertat)) funnel.ofertat++;
    if (c.stadiu === 'Contractat') funnel.contractat++;
    if (nz(c.schitaStatus) && !nz(c.ofertat)) schitaFaraOferta++;
    if (nz(c.ofertat) && c.stadiu !== 'Contractat') ofertatFaraContract++;
  }
  // Rata conversie = Contract / Intrați (cohortă), ca în KPI-ul din Dashboard.gs.
  const rataConversie = funnel.intrari > 0 ? funnel.contractat / funnel.intrari : 0;

  const visible = await getVisibleOwnerIds(scope);
  const recentSyncs = await prisma.syncRun.findMany({
    where: visible === 'ALL' ? {} : { userId: { in: visible } },
    orderBy: { startedAt: 'desc' }, take: 10
  });

  // Lista agenților din subtree (pentru filtrul managerului) — doar cei de sub el
  let agents: Array<{ id: string; name: string }> = [];
  if (scope.isManager) {
    const us = await prisma.user.findMany({
      where: visible === 'ALL' ? {} : { id: { in: visible } },
      select: { id: true, name: true, email: true }
    });
    agents = us.map(u => ({ id: u.id, name: u.name || u.email }));
  }

  return NextResponse.json({
    ok: true,
    isManager: scope.isManager,
    autoSync: getAutoSyncState(scope.userId),
    stats: { total: clienti.length, byStadiu, byCategorie, byPrioritate, totalSuprafata, funnel, rataConversie, schitaFaraOferta, ofertatFaraContract, recentSyncs, agents }
  });
}
