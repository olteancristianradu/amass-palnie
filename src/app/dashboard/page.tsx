'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Icon } from '@/components/Icon';
import { PriorityStars, SyncBadge, STAR_VAR, type SyncInfo } from '@/components/ui';
import { useT } from '@/lib/i18n';

interface Stats {
  total: number;
  byStadiu: Record<string, number>;
  totalSuprafata: number;
  byCategorie: Record<string, number>;
  byNevoie: Record<string, number>;
  byPrioritate: Record<string, number>;
  funnel: { intrari: number; t1: number; nevoie: number; schita: number; preofertat: number; ofertat: number; contractat: number };
  rataConversie: number;
  schitaFaraOferta: number;
  ofertatFaraContract: number;
  schitaInLucru: Array<{ id: string; nume: string | null; schitaStatus: string | null; stelutaCat: number; zile: number }>;
  recentSyncs: any[];
  agents: Array<{ id: string; name: string }>;
}

// Preset-uri perioadă (paritate design pa-dashboard.jsx) — setează start/end (filtrare server-side).
const DATE_PRESETS: Array<{ k: string; label: string }> = [
  { k: 'azi', label: 'Azi' }, { k: 'ieri', label: 'Ieri' }, { k: '7', label: '7 zile' },
  { k: '30', label: '30 zile' }, { k: 'an', label: 'Anul curent' }, { k: 'tot', label: 'Tot' },
];
// Dată LOCALĂ 'yyyy-mm-dd' (NU toISOString/UTC — evită decalajul de fus la granița zilei, ex. 00:00–02:00).
const isoDay = (off: number) => { const d = new Date(); d.setDate(d.getDate() - off); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// Stadiu (etichetă DB) → token de stadiu (--st-*) pentru StagePill / culori bare.
function stStadiu(k: string): string {
  const s = (k || '').toLowerCase();
  if (s.includes('contract')) return 'contractat';
  if (s.includes('anulat')) return 'anulat';
  if (s.includes('aman')) return 'amanat';
  if (s.includes('finalizat')) return 'finalizat';
  if (s.includes('ofertat')) return 'ofertat';
  if (s.includes('schi')) return 'schita';
  return 'intrare';
}

export default function DashboardPage() {
  const { t } = useT();
  const [s, setS] = useState<Stats | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [owner, setOwner] = useState('all');
  const [start, setStart] = useState(isoDay(30));
  const [end, setEnd] = useState(isoDay(0));
  const [preset, setPreset] = useState('30');
  const [mod, setMod] = useState('Activitate'); // Mod afișare (paritate design pa-dashboard.jsx)
  const [err, setErr] = useState<string | null>(null);
  function applyPreset(k: string) {
    setPreset(k);
    if (k === 'tot') { setStart(''); setEnd(''); }
    else if (k === 'azi') { setStart(isoDay(0)); setEnd(isoDay(0)); }
    else if (k === 'ieri') { setStart(isoDay(1)); setEnd(isoDay(1)); }
    else if (k === '7') { setStart(isoDay(7)); setEnd(isoDay(0)); }
    else if (k === '30') { setStart(isoDay(30)); setEnd(isoDay(0)); }
    else if (k === 'an') { setStart(new Date().getFullYear() + '-01-01'); setEnd(isoDay(0)); }
  }
  function load(o = owner, st = start, en = end) {
    const qs = new URLSearchParams({ owner: o });
    if (st) qs.set('start', st);
    if (en) qs.set('end', en);
    fetch('/api/dashboard?' + qs.toString())
      .then(async r => {
        if (r.status === 401) { window.location.href = '/login'; return null; }  // sesiune expirată → login (nu lăsa dashboard gol)
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(j => { if (j && j.ok) { setS(j.stats); setIsManager(j.isManager); setErr(null); } })
      .catch(e => { setErr(t('Nu am putut încărca indicatorii (') + (e?.message || t('eroare rețea')) + t('). Reîncerc automat în 30s.')); });
  }
  useEffect(() => { load(); }, [owner, start, end]);
  // Auto-refresh la 30s (păstrează indicatorii la zi, respectă filtrele curente)
  useEffect(() => {
    const id = setInterval(() => load(owner, start, end), 30000);
    return () => clearInterval(id);
  }, [owner, start, end]);
  if (!s) return (
    <Layout>
      <div className="card card--pad" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
        {err
          ? (<><div style={{ color: 'var(--danger)', marginBottom: 12 }}>{err}</div><button className="btn btn-primary" onClick={() => load()}>{t('Reîncearcă acum')}</button></>)
          : t('Calculez indicatorii…')}
      </div>
    </Layout>
  );

  const catLabels: Record<string, string> = { '1': 'Cat 1 · construcție', '2': 'Cat 2', '3': 'Cat 3', '4': 'Cat 4', '5': 'Cat 5' };
  const fn = s.funnel;
  const lastSync: SyncInfo | null = (s.recentSyncs || [])[0] || null;
  const num = (n: number) => (n ?? 0).toLocaleString('ro-RO');
  const conv = (s.rataConversie * 100).toFixed(1);
  const worklist = s.schitaInLucru || []; // guard defensiv (răspuns API mai vechi → listă goală)

  // Funnel REAL: 7 trepte, bare proporțional din "Intrări".
  // "Nevoie" = nevoie acoperită (acoperită / cu condiții). "T1" = status, nu treaptă propriu-zisă.
  const funnel = [
    { label: t('Intrări CRM'), n: fn.intrari, color: 'var(--st-intrare)' },
    { label: t('T1 făcut'), n: fn.t1, color: 'var(--st-t1)' },
    { label: t('Nevoie identificată'), n: fn.nevoie, color: 'var(--info)' },
    { label: t('Schiță trimisă'), n: fn.schita, color: 'var(--st-schita)' },
    { label: t('Pre-Ofertat'), n: fn.preofertat, color: 'var(--st-preofertat)' },
    { label: t('Ofertat'), n: fn.ofertat, color: 'var(--st-ofertat)' },
    { label: t('Contract semnat'), n: fn.contractat, color: 'var(--st-contractat)' },
  ];
  const top = Math.max(1, fn.intrari);
  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(2) : '0.00') + '%';

  // Conversii ÎNTRE etape — calculate din funnel-ul real (nu schimbă datele, doar derivă rapoarte).
  const conversii: [string, string][] = [
    [t('Nevoie / T1'), pct(fn.nevoie, fn.t1)],
    [t('Schiță / Nevoie'), pct(fn.schita, fn.nevoie)],
    [t('Pre-Ofertat / Schiță'), pct(fn.preofertat, fn.schita)],
    [t('Ofertat / Pre-Ofertat'), pct(fn.ofertat, fn.preofertat)],
    [t('Contract / Ofertat'), pct(fn.contractat, fn.ofertat)],
  ];

  // Raport de activitate — cifre reale din stats (paritate design pa-dashboard.jsx:66-72).
  //  - Calificați = nevoie acoperită (acoperită / în anumite condiții) = funnel.nevoie (aceeași definiție).
  //  - Tentativă  = clienți cu nevoia 'Tentativa'.
  //  - Anulați    = clienți cu stadiu 'Anulat'.
  const cCalificat = fn.nevoie;
  const cTentativa = s.byNevoie?.['Tentativa'] ?? 0;
  const cAnulat = s.byStadiu?.['Anulat'] ?? 0;
  const raport: [string, number][] = [
    [t('Clienți Intrați'), fn.intrari],
    [t('Clienți Sunați (T1)'), fn.t1],
    [t('Calificați (Nevoie Acoperită)'), cCalificat],
    [t('Tentativă'), cTentativa],
    [t('Anulați'), cAnulat],
  ];

  const stadiuEntries = Object.entries(s.byStadiu).sort((a, b) => b[1] - a[1]);
  const maxStadiu = Math.max(1, ...Object.values(s.byStadiu));
  const maxP = Math.max(1, ...Object.values(s.byPrioritate || { '0': 1 }));

  // Topbar (în header-ul global): badge sync + interval + selector agent (manager).
  const topbar = (
    <div className="topbar__tools" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
      <SyncBadge last={lastSync} />
      {isManager && (
        <select className="select" style={{ minHeight: 34, minWidth: 180 }} value={owner} onChange={e => setOwner(e.target.value)}>
          <option value="all">{t('Echipa mea (toți)')}</option>
          {s.agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
    </div>
  );

  const intervalLbl = start || end
    ? `${start ? new Date(start).toLocaleDateString('ro-RO') : '…'} — ${end ? new Date(end).toLocaleDateString('ro-RO') : '…'}`
    : t('Toate înregistrările');

  return (
    <Layout title="Dashboard" topbar={topbar}>
      <div className="dash2">
        {/* Bara titlu închisă la culoare (raport Claude) */}
        <div className="dash2__bar">
          <h2>{t('Dashboard')}</h2>
          <span className="dash2__sub">{t('Privire de ansamblu ·')} {intervalLbl}</span>
        </div>

        {/* Filtru perioadă: preset-uri + interval manual (paritate design pa-dashboard.jsx) */}
        <div className="dash2__ctrls drange">
          <div className="drange__presets">
            {DATE_PRESETS.map(p => (
              <button key={p.k} className={'drange__preset' + (preset === p.k ? ' is-on' : '')} onClick={() => applyPreset(p.k)}>{t(p.label)}</button>
            ))}
          </div>
          <label className="d2ctrl"><span className="label">{t('De la')}</span>
            <input className="input" type="date" value={start} max={end || undefined} onChange={e => { setStart(e.target.value); setPreset('custom'); }} /></label>
          <label className="d2ctrl"><span className="label">{t('până la')}</span>
            <input className="input" type="date" value={end} min={start || undefined} onChange={e => { setEnd(e.target.value); setPreset('custom'); }} /></label>
          <label className="d2ctrl"><span className="label">{t('Mod afișare')}</span>
            <select className="select" value={mod} onChange={e => setMod(e.target.value)}>
              <option value="Activitate">{t('Activitate')}</option>
              <option value="Valoare">{t('Valoare')}</option>
              <option value="Suprafață">{t('Suprafață')}</option>
            </select></label>
        </div>

        {/* Cifre cheie */}
        <div className="d2sec-lbl">{t('Cifre cheie')}</div>
        <div className="d2-keyrow">
          <div className="d2key"><span className="d2key__l">{t('Clienți în pâlnie')}</span><span className="d2key__v">{num(s.total)}</span><span className="d2key__s">{t('în intervalul selectat')}</span></div>
          <div className="d2key"><span className="d2key__l">{t('Rată conversie (contract / intrați)')}</span><span className="d2key__v">{conv}%</span><span className="d2key__s">{t('contract semnat din total')}</span></div>
          <div className="d2key"><span className="d2key__l">{t('Deal-uri semnate')}</span><span className="d2key__v">{s.byStadiu?.['Contractat'] ?? 0}</span><span className="d2key__s">{t('status = Contractat')}</span></div>
          <div className="d2key"><span className="d2key__l">{t('Suprafață totală (m²)')}</span><span className="d2key__v accent">{num(s.totalSuprafata)}</span><span className="d2key__s">{t('suma mp clienți în interval')}</span></div>
        </div>

        {/* Funnel — bare pe etape (7 trepte) */}
        <div className="card card--pad">
          <div className="d2sec-lbl">{t('Cum curge pâlnia')}</div>
          <div className="d2funnel">
            {funnel.map(f => (
              <a key={f.label} href="/palnie" className="d2fn" title={t('Vezi clienții în pâlnie')} style={{ cursor: 'pointer' }}>
                <span className="d2fn__lbl">{f.label}</span>
                <span className="d2fn__n mono">{f.n}</span>
                <span className="d2fn__track"><span className="d2fn__bar" style={{ width: Math.max(f.n / top * 100, 2) + '%', background: f.color }} /></span>
                <span className="d2fn__pct mono">{Math.round(f.n / top * 100)}%</span>
              </a>
            ))}
          </div>
          <div className="muted" style={{ fontSize: '.6875rem', marginTop: 12 }}>
            {t('T1 = status (s-a făcut primul contact), nu o treaptă de conversie propriu-zisă. „Nevoie identificată" = nevoie acoperită (eventual cu condiții).')}
          </div>
        </div>

        {/* Conversii între etape + Raport activitate */}
        <div className="d2-2col">
          <div className="card card--pad">
            <div className="d2sec-lbl">{t('Conversii între etape')}</div>
            <div className="d2list">
              {conversii.map(([l, v]) => <div key={l} className="d2li"><span className="d2li__pct">{v}</span><span className="d2li__l">{l}</span></div>)}
            </div>
          </div>
          <div className="card card--pad">
            <div className="d2sec-lbl">{t('Raport activitate')}</div>
            <div className="d2list">
              {raport.map(([l, v]) => <div key={l} className="d2li d2li--r"><span className="d2li__l">{l}</span><span className="d2li__n mono">{num(v)}</span></div>)}
            </div>
          </div>
        </div>

        {/* Indicatori urgenți */}
        <div className="card card--pad">
          <div className="d2sec-lbl">{t('Indicatori urgenți')}</div>
          <div className="d2-urg">
            <a className="d2urg" href="/palnie">
              <Icon name="alert" size={16} style={{ color: 'var(--rot-warn)' }} />
              <span>{t('Schiță fără ofertă')} <small>{t('(urmărire necesară)')}</small></span>
              <b className="mono">{s.schitaFaraOferta}</b>
            </a>
            <a className="d2urg" href="/palnie">
              <Icon name="alert" size={16} style={{ color: 'var(--rot-late)' }} />
              <span>{t('Ofertate fără contract')} <small>{t('(follow-up)')}</small></span>
              <b className="mono">{s.ofertatFaraContract}</b>
            </a>
          </div>
        </div>

        {/* Clienți cu schiță în lucru (paritate design pa-dashboard.jsx) — worklist acționabil */}
        <div className="card">
          <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'var(--sp-4)' }}>
            <h2>{t('Clienți cu schiță în lucru')}</h2>
            <span className="muted" style={{ fontSize: '.8125rem' }}>{worklist.length} {t('clienți')}</span>
          </div>
          <div className="tbl-scroll">
            <table className="tbl">
              <thead><tr><th>{t('Client')}</th><th>{t('Data schiță')}</th><th className="num">{t('Zile așteptare')}</th><th /></tr></thead>
              <tbody>
                {worklist.map(c => (
                  <tr key={c.id}>
                    <td className="strong"><PriorityStars value={c.stelutaCat} readOnly size={13} /> {c.nume || t('(fără nume)')}</td>
                    <td className="mono">{c.schitaStatus}</td>
                    <td className="num"><span className={'rot rot--' + (c.zile >= 10 ? 'late' : c.zile >= 5 ? 'warn' : 'fresh')}><span className="mono">{c.zile}z</span></span></td>
                    <td className="num"><a className="btn btn-ghost btn-sm" href={'/strategie/' + c.id}>{t('Fișă')}<Icon name="arrowR" size={13} /></a></td>
                  </tr>
                ))}
                {!worklist.length && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 18 }}>{t('Nicio schiță în lucru.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ───────────── Analize suplimentare (peste handoff; mutate sub secțiunile prototipului) ───────────── */}
        <div className="d2sec-lbl" style={{ marginTop: 'var(--sp-2)' }}>{t('Analize suplimentare')}</div>

        {/* Distribuție pe stadiu + pe prioritate */}
        <div className="d2-2col">
          <div className="card card--pad">
            <div className="d2sec-lbl">{t('Distribuție pe stadiu')}</div>
            <div className="d2funnel">
              {stadiuEntries.map(([k, v]) => {
                const stage = stStadiu(k);
                return (
                  <div key={k} className="d2fn" style={{ cursor: 'default', gridTemplateColumns: '150px 36px 1fr 48px' }}>
                    <span className="d2fn__lbl">{k || t('în lucru')}</span>
                    <span className="d2fn__n mono">{v}</span>
                    <span className="d2fn__track"><span className="d2fn__bar" style={{ width: Math.max(v / maxStadiu * 100, 2) + '%', background: 'var(--st-' + stage + ')' }} /></span>
                    <span className="d2fn__pct mono">{Math.round(v / maxStadiu * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card card--pad">
            <div className="d2sec-lbl">{t('Distribuție pe prioritate')}</div>
            <div className="d2list">
              {[4, 3, 2, 1, 0].map(lvl => {
                const v = s.byPrioritate?.[String(lvl)] ?? 0;
                return (
                  <div key={lvl} className="d2fn" style={{ cursor: 'default', gridTemplateColumns: '78px 36px 1fr 48px' }}>
                    <span className="d2fn__lbl" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {lvl === 0 ? <span className="muted" style={{ fontSize: '.6875rem' }}>{t('fără stea')}</span> : <PriorityStars value={lvl} readOnly size={14} />}
                    </span>
                    <span className="d2fn__n mono">{v}</span>
                    <span className="d2fn__track"><span className="d2fn__bar" style={{ width: Math.max(v / maxP * 100, 2) + '%', background: STAR_VAR[lvl] }} /></span>
                    <span className="d2fn__pct mono">{Math.round(v / maxP * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Pe categorie + Sincronizări recente */}
        <div className="d2-2col">
          <div className="card card--pad">
            <div className="d2sec-lbl">{t('Pe categorie')}</div>
            <div className="d2-keyrow" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}>
              {Object.entries(s.byCategorie).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => (
                <div key={k} className="d2key">
                  <span className="d2key__l">{catLabels[k] ? t(catLabels[k]) : t('Cat ') + k}</span>
                  <span className="d2key__v" style={{ fontSize: '1.5rem' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card--pad">
            <div className="d2sec-lbl">{t('Sincronizări recente')}</div>
            {s.recentSyncs.length === 0 && <div className="muted" style={{ fontSize: '.8125rem' }}>{t('Nicio sincronizare încă.')}</div>}
            <div className="d2list">
              {s.recentSyncs.slice(0, 6).map((r: any) => (
                <div key={r.id} className="d2li d2li--r" style={{ fontSize: '.8125rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', flex: '0 0 7px', background: r.status === 'COMPLETED' ? 'var(--success)' : r.status === 'FAILED' ? 'var(--danger)' : 'var(--warning)' }} />
                    <b>{r.type}</b>
                    <span className="muted">{new Date(r.startedAt).toLocaleString('ro-RO')}</span>
                  </span>
                  <span className="mono muted">{r.processed}/{r.total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
