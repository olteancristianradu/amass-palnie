import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope, clientScopeWhere, getVisibleOwnerIds } from '@/lib/scope';
import { getAutoSyncState } from '@/lib/auto-sync';

// Coeficient pentru proxy-ul „Valoare" (RON / m²): nu există câmp monetar pe Client,
// deci valoarea afișată = suprafata × acest coeficient. Etichetat transparent în UI.
const VALOARE_MP_RON = 1500;

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
  // FIX Bug #1: parsăm 'yyyy-mm-dd' prin componente locale (an, lună, zi) — nu prin string ISO.
  // new Date('yyyy-mm-ddT00:00:00') fără 'Z' este implementation-defined în ES5 și poate fi
  // interpretat ca UTC pe unele motoare/versiuni Node, decalând intervalul cu ±ore față de fus.
  // Construind cu new Date(y, m-1, d, ...) obținem garantat timp LOCAL, ca în parseDateFlexible
  // din src/app/api/clienti/[id]/route.ts.
  const parseLocalDay = (s: string | null): Date | null => {
    if (!s) return null;
    const parts = s.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const dt = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const validStart = parseLocalDay(startParam);
  const validEnd = parseLocalDay(endParam);
  if (validStart || validEnd) {
    const di: any = {};
    if (validStart) {
      di.gte = validStart; // deja 00:00:00 LOCAL
    }
    if (validEnd) {
      const endIncl = new Date(validEnd);
      endIncl.setDate(endIncl.getDate() + 1); // ziua următoare 00:00 LOCAL → end exclusiv
      di.lt = endIncl;
    }
    where.dataIntrare = di;
  }

  const clienti = await prisma.client.findMany({
    where,
    select: { id: true, nume: true, stadiu: true, categorie: true, suprafata: true, t1: true, nevoia: true, schitaStatus: true, preOfertat: true, ofertat: true, stelutaCat: true }
  });
  const byStadiu: Record<string, number> = {};
  const byCategorie: Record<string, number> = {};
  const byNevoie: Record<string, number> = {};
  const byPrioritate: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0 };
  let totalSuprafata = 0;
  const nz = (v: any) => v != null && String(v).trim() !== '';
  // Treapta "Nevoie identificată" = nevoia acoperită (eventual cu condiții), ca în Dashboard.gs.
  const isNevoieAcoperita = (v: any) => {
    const s = String(v ?? '').trim();
    return s === 'Nevoie Acoperita' || s === 'Nevoie Acoperita in anumite conditii';
  };
  const funnel = { intrari: clienti.length, t1: 0, nevoie: 0, schita: 0, preofertat: 0, ofertat: 0, contractat: 0 };
  // Funnel pe SUPRAFAȚĂ (m²): aceleași 7 trepte, aceeași logică de stadiu ca `funnel`,
  // dar agregăm `suprafata` în loc de a număra clienții (pentru „Mod afișare = Suprafață").
  const funnelSuprafata = { intrari: 0, t1: 0, nevoie: 0, schita: 0, preofertat: 0, ofertat: 0, contractat: 0 };
  // Funnel pe VALOARE (RON estimat): NU există câmp monetar pe Client, așa că folosim un proxy
  // TRANSPARENT — valoare estimată = suprafata × VALOARE_MP_RON (coeficient afișat în UI).
  // Aceleași 7 trepte/logică ca mai sus; doar metrica agregată diferă.
  const funnelValoare = { intrari: 0, t1: 0, nevoie: 0, schita: 0, preofertat: 0, ofertat: 0, contractat: 0 };
  // Indicatori urgenți (per-rând, precis):
  //  - schiță setată DAR ofertat gol  → urmărire necesară
  //  - ofertat setat DAR stadiu != Contractat → follow-up
  let schitaFaraOferta = 0;
  let ofertatFaraContract = 0;
  for (const c of clienti) {
    const k = c.stadiu ?? '';
    byStadiu[k] = (byStadiu[k] ?? 0) + 1;
    byCategorie[String(c.categorie)] = (byCategorie[String(c.categorie)] ?? 0) + 1;
    const nk = String(c.nevoia ?? '').trim();
    if (nk) byNevoie[nk] = (byNevoie[nk] ?? 0) + 1;
    byPrioritate[String(c.stelutaCat ?? 0)] = (byPrioritate[String(c.stelutaCat ?? 0)] ?? 0) + 1;
    const mp = c.suprafata || 0;          // m² ai clientului (0 dacă lipsește)
    const val = mp * VALOARE_MP_RON;       // valoare estimată (proxy din suprafață)
    if (c.suprafata) totalSuprafata += c.suprafata;
    funnelSuprafata.intrari += mp; funnelValoare.intrari += val;
    if (nz(c.t1)) { funnel.t1++; funnelSuprafata.t1 += mp; funnelValoare.t1 += val; }
    if (isNevoieAcoperita(c.nevoia)) { funnel.nevoie++; funnelSuprafata.nevoie += mp; funnelValoare.nevoie += val; }
    if (nz(c.schitaStatus)) { funnel.schita++; funnelSuprafata.schita += mp; funnelValoare.schita += val; }
    if (nz(c.preOfertat)) { funnel.preofertat++; funnelSuprafata.preofertat += mp; funnelValoare.preofertat += val; }
    if (nz(c.ofertat)) { funnel.ofertat++; funnelSuprafata.ofertat += mp; funnelValoare.ofertat += val; }
    if (c.stadiu === 'Contractat') { funnel.contractat++; funnelSuprafata.contractat += mp; funnelValoare.contractat += val; }
    if (nz(c.schitaStatus) && !nz(c.ofertat)) schitaFaraOferta++;
    if (nz(c.ofertat) && c.stadiu !== 'Contractat') ofertatFaraContract++;
  }
  // Rotunjim suprafața/valoarea la întreg (afișaj curat; agregarea internă rămâne exactă).
  for (const f of [funnelSuprafata, funnelValoare]) {
    f.intrari = Math.round(f.intrari); f.t1 = Math.round(f.t1); f.nevoie = Math.round(f.nevoie);
    f.schita = Math.round(f.schita); f.preofertat = Math.round(f.preofertat);
    f.ofertat = Math.round(f.ofertat); f.contractat = Math.round(f.contractat);
  }
  // Rata conversie = Contract / Intrați (cohortă), ca în KPI-ul din Dashboard.gs.
  const rataConversie = funnel.intrari > 0 ? funnel.contractat / funnel.intrari : 0;

  // Worklist „Clienți cu schiță în lucru" (paritate design pa-dashboard.jsx): schiță setată,
  // FĂRĂ pre-ofertă; sortat după vechimea schiței (cele mai vechi sus). Cap la 50 de rânduri.
  const parseRoDays = (v: any): number => {
    const m = String(v ?? '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return 0;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  };
  const schitaInLucru = clienti
    .filter(c => nz(c.schitaStatus) && !nz(c.preOfertat))
    .map(c => ({ id: c.id, nume: c.nume, schitaStatus: c.schitaStatus, stelutaCat: c.stelutaCat ?? 0, zile: parseRoDays(c.schitaStatus) }))
    .sort((a, b) => b.zile - a.zile)
    .slice(0, 50);

  const visible = await getVisibleOwnerIds(scope);
  // FIX Bug #2: manager cu zero rapoarte → visible = [] → { userId: { in: [] } } returnează
  // 0 rânduri (corect), dar evităm și cazul în care un array gol ar putea crea o query nenulă
  // nedorită. Dacă visible e array gol, nu are rost să interogăm — returnăm liste goale direct.
  const hasVisible = visible === 'ALL' || visible.length > 0;
  const recentSyncs = hasVisible ? await prisma.syncRun.findMany({
    where: visible === 'ALL' ? {} : { userId: { in: visible } },
    orderBy: { startedAt: 'desc' }, take: 10
  }) : [];

  // Lista agenților din subtree (pentru filtrul managerului) — doar cei de sub el
  let agents: Array<{ id: string; name: string }> = [];
  if (scope.isManager && hasVisible) {
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
    stats: { total: clienti.length, byStadiu, byCategorie, byNevoie, byPrioritate, totalSuprafata, funnel, funnelSuprafata, funnelValoare, valoareMpRon: VALOARE_MP_RON, rataConversie, schitaFaraOferta, ofertatFaraContract, schitaInLucru, recentSyncs, agents }
  });
}
