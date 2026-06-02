'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { PriorityStars, SyncBadge, type SyncInfo, type AutoSyncInfo } from '@/components/ui';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useT } from '@/lib/i18n';

interface Client {
  id: string;
  idLucrare: string;
  nume: string;
  localitate: string | null;
  judet: string | null;
  categorie: number;
  isDT: boolean;
  suprafata: number | null;
  dataIntrare: string | null;
  t1: string | null;
  hasAudio: boolean;
  nevoia: string | null;
  schitaStatus: string | null;
  preOfertat: string | null;
  ofertat: string | null;
  stadiu: string | null;
  stelutaCat: number;
  reminderText: string | null;
  observatii?: string | null;
  notaManager?: string | null;
  obsSituatie?: string | null;
  nextStepText?: string | null;
  nextStepDue?: string | null;
  owner?: { id: string; name: string | null; email: string } | null;
}

const STADII = ['', 'Anulat', 'Contractat', 'Amanat', 'Finalizat'];
const NEVOI = ['', 'Nevoie Acoperita', 'Tentativa', 'Nu il putem ajuta', 'Nevoie viitoare', 'Nevoie Acoperita in anumite conditii'];

// Chip colors pe Nevoia (parity cu Palnie.js ~175-183): verde / gri / roșu / galben / portocaliu.
function nevoiaChip(v: string | null): React.CSSProperties {
  const s = (v || '').toLowerCase();
  if (s.includes('anumite conditii')) return { background: 'var(--warning-soft)', color: 'var(--warning)' };       // portocaliu
  if (s.includes('nevoie acoperita')) return { background: 'var(--success-soft)', color: 'var(--success)' };       // verde
  if (s.includes('nu il putem ajuta')) return { background: 'var(--danger-soft)', color: 'var(--danger)' };        // roșu
  if (s.includes('nevoie viitoare')) return { background: '#F6EFDC', color: '#8A6D1F' };                           // galben
  if (s.includes('tentativa')) return { background: 'var(--surface-3)', color: 'var(--text-secondary)' };          // gri
  return {};
}

export default function PalniePage() {
  const router = useRouter();
  const { t } = useT();
  const [clienti, setClienti] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<{ type: string } | null>(null);
  const [lastSync, setLastSync] = useState<SyncInfo | null>(null);
  const [autoSync, setAutoSync] = useState<AutoSyncInfo | null>(null);
  const [filter, setFilter] = useState('');
  const [stadiuFilter, setStadiuFilter] = useState('');
  const [msg, setMsg] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [agentList, setAgentList] = useState<Array<{ id: string; name: string }>>([]);
  const [view, setView] = useState<'cards' | 'tabel' | 'kanban'>('cards');
  // Modal de motiv la închidere (Contractat/Anulat) — API-ul cere closureReason; fără el PATCH-ul dă 400.
  const [closeModal, setCloseModal] = useState<{ id: string; stadiu: 'Contractat' | 'Anulat' } | null>(null);
  useEffect(() => { const v = localStorage.getItem('amass-palnie-view'); if (v === 'tabel' || v === 'cards' || v === 'kanban') setView(v); }, []);
  const switchView = (v: 'cards' | 'tabel' | 'kanban') => { setView(v); try { localStorage.setItem('amass-palnie-view', v); } catch {} };
  // Update optimist local — folosit de Kanban (drag & drop) ca să reflecte mutarea instant.
  const patchLocal = (id: string, patch: Record<string, any>) => setClienti(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const r = await fetch('/api/clienti?limit=5000&owner=' + ownerFilter);
    const j = await r.json();
    if (j.ok) { setClienti(j.clienti); setIsManager(j.isManager); }
    if (!silent) setLoading(false);
  }
  useEffect(() => { load(); }, [ownerFilter]);

  // Lista agenților (manager) + ultimul sync + starea auto-sync pentru badge.
  function loadMeta() {
    fetch('/api/dashboard?owner=all').then(r => r.json()).then(j => {
      if (j.ok) {
        if (j.isManager) setAgentList(j.stats.agents || []);
        setLastSync((j.stats.recentSyncs || [])[0] || null);
        setAutoSync(j.autoSync || null);
      }
    }).catch(() => {});
  }
  useEffect(() => { loadMeta(); }, []);

  // Auto-refresh UI la ~30s (silent, fără spinner) — reflectă datele aduse de auto-sync în fundal.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) { load(true); loadMeta(); } }, 30000);
    return () => clearInterval(t);
  }, [ownerFilter]);

  async function runSync(endpoint: string, label: string) {
    setSync({ type: label });
    setMsg(`⏳ ${label} pornit… (nu închide tab-ul)`);
    try {
      const r = await fetch(endpoint, { method: 'POST' });
      const j = await r.json();
      if (j.ok) { setMsg(`✅ ${label}: ${JSON.stringify(j).slice(0, 200)}`); await load(); loadMeta(); }
      else { setMsg('❌ ' + j.error); }
    } catch (e: any) { setMsg('❌ ' + e.message); }
    setSync(null);
  }

  async function setSteluta(clientId: string, idLucrare: string, cat: number) {
    setClienti(prev => prev.map(c => c.id === clientId ? { ...c, stelutaCat: cat } : c)); // optimist
    setMsg(`⏳ Trimit steluța în CRM…`);
    const r = await fetch('/api/crm/steluta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, idLucrare, cat })
    });
    const j = await r.json();
    setMsg(j.ok ? `✅ Prioritate setată în CRM` : '❌ ' + j.error);
    if (!j.ok) await load();
  }

  async function updateInline(id: string, field: string, value: string) {
    const prev = clienti.find(c => c.id === id) as any;
    const newVal = value || null;
    setClienti(p => p.map(c => c.id === id ? { ...c, [field]: newVal } : c));
    const r = await fetch(`/api/clienti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({} as any));
      setMsg('❌ ' + (j.validationErrors?.join(' ') || j.error || 'Nu s-a putut salva'));
      setClienti(p => p.map(c => c.id === id ? { ...c, [field]: prev ? (prev[field] ?? null) : null } : c));
    }
  }

  // Schimbarea Stadiu: 'Contractat'/'Anulat' = închidere → cere motiv (modal) și trimite
  // { stadiu, closureReason, closureReasonDetail } într-un singur PATCH; restul merg direct.
  function setStadiu(id: string, value: string) {
    if (value === 'Contractat' || value === 'Anulat') { setCloseModal({ id, stadiu: value }); return; }
    updateInline(id, 'stadiu', value);
  }
  async function closeWithReason(id: string, stadiu: 'Contractat' | 'Anulat', detail: string) {
    const prev = clienti.find(c => c.id === id) as any;
    const closureReason = stadiu === 'Contractat' ? 'Won' : 'Lost';
    setClienti(p => p.map(c => c.id === id ? { ...c, stadiu } : c)); // optimist
    setMsg(`⏳ ${stadiu === 'Contractat' ? 'Contractare' : 'Anulare'} în CRM…`);
    const r = await fetch(`/api/clienti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stadiu, closureReason, closureReasonDetail: detail })
    });
    if (r.ok) { setMsg(`✅ Marcat „${stadiu}" (sincronizat în CRM)`); }
    else {
      const j = await r.json().catch(() => ({} as any));
      setMsg('❌ ' + (j.validationErrors?.join(' ') || j.error || 'Nu s-a putut salva'));
      setClienti(p => p.map(c => c.id === id ? { ...c, stadiu: prev ? (prev.stadiu ?? null) : null } : c));
    }
  }

  const filtered = clienti.filter(c => {
    if (stadiuFilter && (c.stadiu ?? '') !== stadiuFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (c.nume + ' ' + (c.localitate ?? '') + ' ' + c.idLucrare).toLowerCase().includes(q);
  });

  const pillClass = (s: string | null) => {
    const m: Record<string, string> = { Anulat: 'pill-anulat', Contractat: 'pill-contractat', Amanat: 'pill-amanat', Finalizat: 'pill-finalizat' };
    return m[s ?? ''] || 'pill-lucru';
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Layout>
      {/* Toolbar STICKY (rămâne vizibil la scroll); comutatorul de vizualizare e fixat lângă titlu → nu mai dispare */}
      <div className="sticky top-11 z-20 bg-[var(--bg)] -mx-6 px-6 pt-2 pb-3 mb-4 border-b border-[var(--border)] rise">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <h1 className="text-[22px] whitespace-nowrap">{t('Pâlnie clienți')}</h1>
            {/* COMUTATOR VIZUALIZARE — lângă titlu, flex-shrink-0, mereu vizibil */}
            <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--border-strong)] overflow-hidden text-[12px] font-semibold flex-shrink-0 shadow-sm">
              <button onClick={() => switchView('cards')} title="Carduri aerisite"
                className={'px-3 py-1.5 ' + (view === 'cards' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>{t('Carduri')}</button>
              <button onClick={() => switchView('tabel')} title="Tabel dens, ca în spreadsheet"
                className={'px-3 py-1.5 border-l border-[var(--border-strong)] ' + (view === 'tabel' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>{t('Tabel')}</button>
              <button onClick={() => switchView('kanban')} title="Pipeline Kanban (drag & drop)"
                className={'px-3 py-1.5 border-l border-[var(--border-strong)] ' + (view === 'kanban' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>{t('Kanban')}</button>
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <SyncBadge last={lastSync} syncing={!!sync} auto={autoSync} />
            {isManager && (
              <select className="field w-40" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} title="Vizualizezi pâlnia unui agent din echipa ta">
                <option value="all">{t('👥 Echipa mea')}</option>
                {agentList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
            <input className="field w-40" placeholder={t('Caută client, oraș, #id…')} value={filter} onChange={e => setFilter(e.target.value)} />
            {view !== 'kanban' && (
              <select className="field w-32" value={stadiuFilter} onChange={e => setStadiuFilter(e.target.value)}>
                <option value="">{t('Toate stadiile')}</option>
                {STADII.filter(s => s).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button onClick={() => runSync('/api/crm/sync-clienti', 'Sync clienți')} disabled={!!sync} className="btn btn-primary">{sync ? '⏳' : '↻'} {t('Sync clienți')}</button>
            <button onClick={() => runSync('/api/crm/sync-detalii', 'Sync detalii')} disabled={!!sync} className="btn btn-secondary">↻ {t('Detalii')}</button>
            <button onClick={() => runSync('/api/crm/sync-remindere', 'Sync remindere')} disabled={!!sync} className="btn btn-secondary">↻ {t('Remindere')}</button>
          </div>
        </div>
        <p className="text-[var(--fg-soft)] text-[12px] mt-1.5">
          <span className="font-semibold text-[var(--fg)]">{filtered.length}</span> {t('afișați din')} {clienti.length} · steluțe, observații și remindere merg <b>live</b> în CRM
        </p>
      </div>

      {msg && <div className={'toast mb-4 whitespace-pre-wrap ' + (msg.startsWith('✅') ? 'toast-ok' : msg.startsWith('❌') ? 'toast-err' : 'toast-info')}>{msg}</div>}

      {loading ? (
        <div className="card p-10 text-center text-[var(--fg-soft)]">Se încarcă pâlnia…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-[var(--fg-soft)]">
          {clienti.length === 0 ? 'Niciun client încă. Apasă „Sync clienți" pentru import din CRM.' : 'Niciun rezultat pentru filtrul curent.'}
        </div>
      ) : view === 'tabel' ? (
        <div className="card overflow-x-auto scroll-area rise">
          {(() => {
            const cnt = (f: (c: Client) => any) => filtered.filter(c => { const v = f(c); return v != null && String(v).trim() !== ''; }).length;
            const tot = { supr: cnt(c => c.suprafata), intrare: cnt(c => c.dataIntrare), t1: cnt(c => c.t1), nevoia: cnt(c => c.nevoia), schita: cnt(c => c.schitaStatus), preof: cnt(c => c.preOfertat), ofertat: cnt(c => c.ofertat), status: cnt(c => c.stadiu) };
            const GREEN = { background: 'var(--pine-soft)' } as React.CSSProperties;
            // dd.mm.yyyy <-> yyyy-mm-dd pentru <input type="date"> (calendar nativ, editabil, orice dată)
            const toISO = (v: string | null) => { const m = (v || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
            const fromISO = (iso: string) => { const p = iso.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : ''; };
            const dcell = (c: Client, k: string, v: string | null) => (
              <td onClick={stop} className="text-center !py-1 !px-1.5">
                <input type="date" value={toISO(v)} title="Alege data (calendar) — click pe celulă"
                  onChange={e => updateInline(c.id, k, e.target.value ? fromISO(e.target.value) : '')}
                  className="bg-transparent border border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent)] rounded-[var(--r-sm)] text-[12px] font-mono text-[var(--pine)] px-1.5 py-1 cursor-pointer outline-none w-[124px]" />
              </td>);
            return (
            <table className="tbl tbl-grid min-w-[1180px] [&_thead_th]:!text-[var(--text-secondary)] [&_thead_th]:!border-b-[var(--border-strong)] [&_thead_th]:!tracking-[.05em]">
              <thead><tr>
                <th>Client</th><th className="num">Suprafață</th><th className="text-center">Data Intrare</th><th className="text-center">T1</th>
                <th style={GREEN}>Nevoia</th><th className="text-center">Schiță</th><th className="text-center">Pre-Ofertat</th><th className="text-center">Ofertat</th><th>Status</th><th>◷ Reminder</th><th>Observații Manager</th>
              </tr></thead>
              <tbody>
                <tr style={{ background: 'var(--surface-2)' }} className="font-semibold">
                  <td className="strong italic text-[var(--fg-soft)]">Total / etapă</td>
                  <td className="num">{tot.supr}</td><td className="num">{tot.intrare}</td><td className="num">{tot.t1}</td>
                  <td className="num" style={GREEN}>{tot.nevoia}</td><td className="num">{tot.schita}</td><td className="num">{tot.preof}</td><td className="num">{tot.ofertat}</td><td className="num">{tot.status}</td><td></td><td></td>
                </tr>
                {filtered.map(c => (
                  <tr key={c.id} onClick={() => router.push('/strategie/' + c.id)} className="cursor-pointer">
                    <td className="strong">
                      <div className="flex items-center gap-1.5">
                        <span onClick={stop}><PriorityStars value={c.stelutaCat} size={13} onSet={cat => setSteluta(c.id, c.idLucrare, cat)} /></span>
                        {!c.hasAudio && <span className="text-[var(--warn)] flex-shrink-0" title="Fără audio">⚠</span>}
                        <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${c.idLucrare}`} target="_blank" rel="noopener" onClick={stop} className="crm-link">{c.nume || '(nume)'}</a>
                      </div>
                      <div className="text-[11px] text-[var(--fg-faint)] font-mono mt-0.5">#{c.idLucrare} · ({c.categorie}{c.isDT ? 'DT' : ''}){c.localitate ? ' · ' + c.localitate : ''}{isManager && ownerFilter === 'all' && c.owner ? ' · ' + (c.owner.name || c.owner.email) : ''}</div>
                    </td>
                    <td className="num">{c.suprafata != null ? c.suprafata + ' mp' : ''}</td>
                    <td className="text-[12px] font-mono text-center whitespace-nowrap">{c.dataIntrare ? new Date(c.dataIntrare).toLocaleDateString('ro-RO') : ''}</td>
                    <td className="text-[12px] font-mono text-center whitespace-nowrap">{c.t1 || ''}</td>
                    <td onClick={stop} className="!p-0" style={GREEN}>
                      <select className="field !border-0 !py-1.5 !px-2 !text-[12px] w-[136px] font-semibold rounded-[var(--r-sm)]"
                        style={c.nevoia ? nevoiaChip(c.nevoia) : { background: 'transparent' }}
                        value={c.nevoia ?? ''} onChange={e => updateInline(c.id, 'nevoia', e.target.value)}>
                        {NEVOI.map(n => <option key={n} value={n}>{n || '—'}</option>)}
                      </select>
                    </td>
                    {dcell(c, 'schitaStatus', c.schitaStatus)}
                    {dcell(c, 'preOfertat', c.preOfertat)}
                    {dcell(c, 'ofertat', c.ofertat)}
                    <td onClick={stop} className="!p-0">
                      <select className={'pill border-0 cursor-pointer ' + pillClass(c.stadiu)} value={c.stadiu ?? ''} onChange={e => setStadiu(c.id, e.target.value)}>
                        {STADII.map(s => <option key={s} value={s}>{s || 'în lucru'}</option>)}
                      </select>
                    </td>
                    <td className="text-[11px] text-[var(--fg-soft)] max-w-[260px] whitespace-pre-wrap leading-snug" title={c.reminderText || ''}>{(c.reminderText || '').slice(0, 160)}</td>
                    <td onClick={stop} className="!p-1 align-top">
                      <textarea
                        defaultValue={c.notaManager ?? ''}
                        placeholder="Notă manager…"
                        title="Notă privată a managerului (separată de observații CRM)"
                        onBlur={e => { if ((e.target.value || '') !== (c.notaManager ?? '')) updateInline(c.id, 'notaManager', e.target.value); }}
                        className="bg-transparent border border-transparent hover:border-[var(--border-strong)] focus:border-[var(--accent)] rounded-[var(--r-sm)] text-[11px] text-[var(--fg-soft)] leading-snug px-1.5 py-1 outline-none w-[220px] resize-y min-h-[28px]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            );
          })()}
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard clienti={filtered} isManager={isManager} ownerFilter={ownerFilter}
          onPatch={patchLocal} setMsg={setMsg} reload={() => load()} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((c, i) => {
            const stages = [
              { k: 'schitaStatus', l: 'Schiță', v: c.schitaStatus },
              { k: 'preOfertat', l: 'Pre-of.', v: c.preOfertat },
              { k: 'ofertat', l: 'Ofertat', v: c.ofertat }
            ];
            const stagesDone = stages.filter(s => s.v && s.v.trim()).length;
            const cold = stagesDone === 0 && !c.stadiu;
            return (
              <div key={c.id}
                   className={'client-card rise ' + (i < 4 ? 'rise-' + (i + 1) + ' ' : '') + (cold ? 'cold' : '')}
                   onClick={() => router.push('/strategie/' + c.id)}
                   title="Click oriunde → fișa de strategie">
                <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                  {/* Identitate client */}
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!c.hasAudio && <span className="text-[var(--warn)]" title="Fără audio">⚠</span>}
                      <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${c.idLucrare}`}
                         target="_blank" rel="noopener" onClick={stop}
                         className="crm-link font-display font-semibold text-[16px] text-[var(--fg)] transition-colors">
                        {c.nume || '(nume lipsă)'}
                      </a>
                      {c.localitate && <span className="text-[var(--fg-soft)] text-[13px]">· {c.localitate}</span>}
                      {isManager && ownerFilter === 'all' && c.owner && (
                        <span className="pill pill-lucru !py-0 !px-1.5 !text-[9px]">{c.owner.name || c.owner.email}</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--fg-faint)] font-mono mt-0.5">
                      ({c.categorie}{c.isDT ? 'DT' : ''}) #{c.idLucrare}
                      {c.suprafata != null && <span className="text-[var(--fg-soft)]"> · {c.suprafata} mp</span>}
                      {c.dataIntrare && <span> · {new Date(c.dataIntrare).toLocaleDateString('ro-RO')}</span>}
                      {c.t1 && <span> · T1 {c.t1}</span>}
                    </div>
                  </div>

                  {/* Progres pâlnie (3 etape ca puncte) */}
                  <div className="flex items-center gap-2.5" onClick={stop}>
                    {stages.map(s => {
                      const on = !!(s.v && s.v.trim());
                      return (
                        <button key={s.k} type="button" className="stage-toggle inline-flex items-center gap-1"
                                title={on ? `${s.l}: ${s.v} — click pentru anulare` : `Marchează „${s.l}" (data azi)`}
                                onClick={() => updateInline(c.id, s.k, on ? '' : todayRO())}>
                          <span className={'stage-dot ' + (on ? 'on' : 'off')} />
                          <span className={'text-[11px] ' + (on ? 'text-[var(--pine)] font-semibold' : 'text-[var(--fg-faint)]')}>{s.l}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Nevoia */}
                  <div onClick={stop} className="w-[150px]">
                    <select className={'field !py-1 !px-2 !text-[11.5px] !border-transparent hover:!border-[var(--line-2)] rounded-[var(--r-sm)] ' + (c.nevoia ? 'font-semibold' : '')}
                            style={c.nevoia ? nevoiaChip(c.nevoia) : { background: 'transparent' }}
                            value={c.nevoia ?? ''} onChange={e => updateInline(c.id, 'nevoia', e.target.value)}>
                      {NEVOI.map(n => <option key={n} value={n}>{n || 'Nevoia —'}</option>)}
                    </select>
                  </div>

                  {/* Stadiu */}
                  <div onClick={stop}>
                    <select className={'pill border-0 cursor-pointer ' + pillClass(c.stadiu)}
                            value={c.stadiu ?? ''} onChange={e => setStadiu(c.id, e.target.value)}>
                      {STADII.map(s => <option key={s} value={s}>{s || 'în lucru'}</option>)}
                    </select>
                  </div>

                  {/* Prioritate (stea) */}
                  <div onClick={stop} title="Prioritate — merge live în CRM">
                    <PriorityStars value={c.stelutaCat} onSet={cat => setSteluta(c.id, c.idLucrare, cat)} />
                  </div>

                  {/* Intrare în fișă — buton primar */}
                  <button onClick={e => { stop(e); router.push('/strategie/' + c.id); }} className="btn btn-fisa">VEZI FIȘA →</button>
                </div>

                {c.reminderText && (
                  <div className="mt-2 pt-2 border-t border-[var(--line)] text-[11.5px] text-[var(--fg-soft)] leading-snug line-clamp-2">
                    <span className="text-[var(--fg-faint)] font-semibold mr-1">⏰ Reminder:</span>{c.reminderText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {closeModal && (
        <CloseReasonModal stadiu={closeModal.stadiu}
          onClose={() => setCloseModal(null)}
          onConfirm={(detail) => { closeWithReason(closeModal.id, closeModal.stadiu, detail); setCloseModal(null); }} />
      )}
    </Layout>
  );
}

const WON_REASONS = ['ROI clar', 'Buget aprobat', 'Urgență (sezon)', 'Recomandare', 'Preț competitiv', 'Altul'];
const LOST_REASONS = ['Preț prea mare', 'A ales concurența', 'Fără decizie / amânat', 'Fără urgență', 'Buget tăiat', 'Necontactabil', 'Altul'];

// Modal de motiv la închidere (Contractat = câștigat / Anulat = pierdut). Trimite un motiv real
// (la „Altul" cere text liber) → ajunge în closureReasonDetail pentru raportul de win/loss.
function CloseReasonModal({ stadiu, onConfirm, onClose }: { stadiu: 'Contractat' | 'Anulat'; onConfirm: (detail: string) => void; onClose: () => void }) {
  const won = stadiu === 'Contractat';
  const reasons = won ? WON_REASONS : LOST_REASONS;
  const [sel, setSel] = useState(reasons[0]);
  const [free, setFree] = useState('');
  const detail = sel === 'Altul' ? free.trim() : sel;
  const blocked = sel === 'Altul' && !free.trim();
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">{won ? '✅ Contractat — de ce a câștigat?' : '❌ Anulat — de ce s-a pierdut?'}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">Motivul intră în raportul de win/loss (coaching).</p>
        <div className="space-y-1.5 mb-3">
          {reasons.map(r => (
            <label key={r} className={'flex items-center gap-2 px-3 py-2 rounded-[var(--r-sm)] border cursor-pointer text-[13px] ' + (sel === r ? 'border-[var(--ember)] bg-[var(--ember-soft)] font-semibold' : 'border-[var(--border-strong)]')}>
              <input type="radio" name="closeReason" checked={sel === r} onChange={() => setSel(r)} />{r}
            </label>
          ))}
        </div>
        {sel === 'Altul' && (
          <textarea className="field mb-4" rows={2} autoFocus placeholder="Scrie motivul concret…"
            value={free} onChange={e => setFree(e.target.value)} />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">Anulează</button>
          <button onClick={() => onConfirm(detail)} disabled={blocked} className={'btn ' + (won ? 'btn-pine' : 'btn-primary')}>Confirmă</button>
        </div>
      </div>
    </div>
  );
}

function todayRO() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}
