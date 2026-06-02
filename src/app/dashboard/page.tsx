'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { PriorityStars, SyncBadge, STAR_VAR, type SyncInfo } from '@/components/ui';

interface Stats {
  total: number;
  byStadiu: Record<string, number>;
  totalSuprafata: number;
  byCategorie: Record<string, number>;
  byPrioritate: Record<string, number>;
  funnel: { intrari: number; t1: number; nevoie: number; schita: number; preofertat: number; ofertat: number; contractat: number };
  rataConversie: number;
  schitaFaraOferta: number;
  ofertatFaraContract: number;
  recentSyncs: any[];
  agents: Array<{ id: string; name: string }>;
}

export default function DashboardPage() {
  const [s, setS] = useState<Stats | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [owner, setOwner] = useState('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  function load(o = owner, st = start, en = end) {
    const qs = new URLSearchParams({ owner: o });
    if (st) qs.set('start', st);
    if (en) qs.set('end', en);
    fetch('/api/dashboard?' + qs.toString()).then(r => {
      if (r.status === 401) { window.location.href = '/login'; return null; }  // sesiune expirată → login (nu lăsa dashboard gol)
      return r.json();
    }).then(j => { if (j && j.ok) { setS(j.stats); setIsManager(j.isManager); } });
  }
  useEffect(() => { load(); }, [owner, start, end]);
  // Auto-refresh la 30s (păstrează indicatorii la zi, respectă filtrele curente)
  useEffect(() => {
    const t = setInterval(() => load(owner, start, end), 30000);
    return () => clearInterval(t);
  }, [owner, start, end]);
  if (!s) return <Layout><div className="card p-10 text-center text-[var(--fg-soft)]">Calculez indicatorii…</div></Layout>;

  const maxStadiu = Math.max(1, ...Object.values(s.byStadiu));
  const catLabels: Record<string, string> = { '1': 'Cat 1 · construcție', '2': 'Cat 2', '3': 'Cat 3', '4': 'Cat 4', '5': 'Cat 5' };
  const fn = s.funnel;
  const lastSync: SyncInfo | null = (s.recentSyncs || [])[0] || null;
  const prioRosu = s.byPrioritate?.['1'] ?? 0; // cat 1 = 🔴 roșu = prioritar/urgent (NU cat 4 care e verde)
  const rataPct = (s.rataConversie * 100).toFixed(1) + '%';

  // Funnel REAL: bare proporțional descrescătoare + drop-off între trepte.
  // Treapta "Nevoie" = nevoie acoperită (acoperită / cu condiții), ca în Dashboard.gs.
  const steps = [
    { l: 'Intrări', v: fn.intrari, c: 'var(--ink)', note: '' },
    { l: 'T1 făcut', v: fn.t1, c: 'var(--ember)', note: '*' },
    { l: 'Nevoie', v: fn.nevoie, c: 'var(--ember)', note: '' },
    { l: 'Schiță', v: fn.schita, c: 'var(--ember)', note: '' },
    { l: 'Pre-ofertat', v: fn.preofertat, c: 'var(--ember)', note: '' },
    { l: 'Ofertat', v: fn.ofertat, c: 'var(--ember-deep)', note: '' },
    { l: 'Contract', v: fn.contractat, c: 'var(--pine)', note: '' }
  ];
  const base = Math.max(1, fn.intrari);

  return (
    <Layout>
      <div className="flex items-end justify-between mb-5 rise flex-wrap gap-3">
        <h1 className="text-[26px]">Dashboard</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          <SyncBadge last={lastSync} />
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-[var(--fg-faint)]">De la</label>
            <input type="date" className="field w-[140px]" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} />
            <label className="text-[11px] text-[var(--fg-faint)]">până la</label>
            <input type="date" className="field w-[140px]" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} />
            {(start || end) && (
              <button className="btn btn-ghost text-[12px] px-2" onClick={() => { setStart(''); setEnd(''); }} title="Șterge intervalul">✕</button>
            )}
          </div>
          {isManager && (
            <select className="field w-48" value={owner} onChange={e => setOwner(e.target.value)}>
              <option value="all">Echipa mea (toți)</option>
              {s.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <KPI label="Clienți în pâlnie" value={s.total.toLocaleString('ro-RO')} accent="ember" delay="rise-1" />
        <KPI label="Rata conversie" value={rataPct} accent="pine" delay="rise-2" sub="contract / intrați" />
        <KPI label="Contractați" value={s.byStadiu['Contractat'] ?? 0} accent="ok" delay="rise-3" />
        <KPI label="Suprafață totală" value={s.totalSuprafata.toLocaleString('ro-RO')} unit="mp" accent="muted" delay="rise-4" />
        <KPI label="Steluțe roșii" value={prioRosu} accent="ember" delay="rise-4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <UrgentCard
          label="Schiță fără ofertă"
          value={s.schitaFaraOferta}
          hint="schiță trimisă, dar încă neofertat — urmărire necesară"
          delay="rise-1"
        />
        <UrgentCard
          label="Ofertate fără contract"
          value={s.ofertatFaraContract}
          hint="ofertat, dar status încă ≠ Contractat — follow-up"
          delay="rise-2"
        />
      </div>

      <div className="card p-5 mb-5 rise rise-1">
        <div className="panel-head"><span className="dot" />Pâlnie — funnel de conversie</div>
        <div className="space-y-1">
          {steps.map((st, i) => {
            const pct = Math.round(st.v / base * 100);
            const prev = i > 0 ? steps[i - 1].v : null;
            const drop = prev && prev > 0 ? Math.round((st.v - prev) / prev * 100) : null;
            return (
              <div key={st.l}>
                {drop !== null && (
                  <div className="funnel-drop">↓ {drop}%</div>
                )}
                <div className="funnel-row">
                  <span className="w-[104px] text-[12px] text-[var(--fg-soft)] flex-shrink-0">
                    {st.l}{st.note && <span className="text-[var(--fg-faint)]" title="T1 = status, nu treaptă de conversie">{st.note}</span>}
                  </span>
                  <div className="funnel-track" style={{ width: `calc(${Math.max(8, pct)}% - 0px)` }}>
                    <div className="funnel-fill" style={{ width: '100%', background: st.c }}>{st.v}</div>
                  </div>
                  <span className="text-[11px] tabular text-[var(--fg-faint)] flex-shrink-0">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="text-[10.5px] text-[var(--fg-faint)] mt-3">* T1 = status (s-a făcut primul contact), nu o treaptă de conversie propriu-zisă. „Nevoie" = nevoie acoperită (eventual cu condiții).</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 rise rise-2">
          <div className="panel-head"><span className="dot" />Distribuție pe stadiu</div>
          {Object.entries(s.byStadiu).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="mb-2.5">
              <div className="flex justify-between text-[12.5px] mb-1">
                <span className="text-[var(--fg-soft)]">{k || 'în lucru'}</span>
                <span className="font-semibold tabular">{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: (v / maxStadiu * 100) + '%', background: k === 'Contractat' ? 'var(--ok)' : k === 'Anulat' ? 'var(--err)' : 'var(--ember)' }} />
              </div>
            </div>
          ))}

          <div className="panel-head mt-5"><span className="dot" />Distribuție pe prioritate</div>
          {[4, 3, 2, 1, 0].map(lvl => {
            const v = s.byPrioritate?.[String(lvl)] ?? 0;
            const maxP = Math.max(1, ...Object.values(s.byPrioritate || { '0': 1 }));
            return (
              <div key={lvl} className="flex items-center gap-2.5 mb-2">
                <span className="w-[78px] flex-shrink-0">{lvl === 0 ? <span className="text-[11px] text-[var(--fg-faint)]">fără stea</span> : <PriorityStars value={lvl} readOnly size={13} />}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: (v / maxP * 100) + '%', background: STAR_VAR[lvl] }} />
                </div>
                <span className="w-8 text-right text-[12px] font-semibold tabular">{v}</span>
              </div>
            );
          })}
        </div>

        <div className="card p-5 rise rise-3">
          <div className="panel-head"><span className="dot" />Pe categorie</div>
          <div className="flex flex-wrap gap-2 mb-5">
            {Object.entries(s.byCategorie).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => (
              <div key={k} className="flex-1 min-w-[88px] rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--paper)] px-3 py-2.5">
                <div className="kpi-label">{catLabels[k] || 'Cat ' + k}</div>
                <div className="font-display text-xl font-semibold tabular mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <div className="panel-head"><span className="dot" />Sincronizări recente</div>
          {s.recentSyncs.length === 0 && <div className="text-[var(--fg-faint)] text-[12.5px]">Nicio sincronizare încă.</div>}
          {s.recentSyncs.slice(0, 6).map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 text-[11.5px] py-1.5 border-b border-[var(--line)] last:border-0">
              <span className={'w-1.5 h-1.5 rounded-full ' + (r.status === 'COMPLETED' ? 'bg-[var(--ok)]' : r.status === 'FAILED' ? 'bg-[var(--err)]' : 'bg-[var(--warn)]')} />
              <span className="font-semibold text-[var(--fg)]">{r.type}</span>
              <span className="text-[var(--fg-faint)]">{new Date(r.startedAt).toLocaleString('ro-RO')}</span>
              <span className="ml-auto tabular text-[var(--fg-soft)]">{r.processed}/{r.total}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function KPI({ label, value, unit, accent, delay, sub }: { label: string; value: any; unit?: string; accent: string; delay: string; sub?: string }) {
  const bar: Record<string, string> = { ember: 'var(--ember)', pine: 'var(--pine)', ok: 'var(--ok)', muted: 'var(--fg-faint)' };
  return (
    <div className={'card p-5 relative overflow-hidden rise ' + delay}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: bar[accent] }} />
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mt-2">{value}{unit && <span className="text-sm font-normal text-[var(--fg-faint)] ml-1">{unit}</span>}</div>
      {sub && <div className="text-[10.5px] text-[var(--fg-faint)] mt-1">{sub}</div>}
    </div>
  );
}

function UrgentCard({ label, value, hint, delay }: { label: string; value: number; hint: string; delay: string }) {
  return (
    <div className={'card p-5 relative overflow-hidden rise ' + delay}>
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: 'var(--warn)' }} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="kpi-label">{label}</div>
          <div className="text-[11px] text-[var(--fg-faint)] mt-1">{hint}</div>
        </div>
        <div className="kpi-value sm" style={{ color: value > 0 ? 'var(--warn)' : 'var(--fg-faint)' }}>{value}</div>
      </div>
    </div>
  );
}
