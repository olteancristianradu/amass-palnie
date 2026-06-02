'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { PriorityStars, SyncBadge, type SyncInfo, type AutoSyncInfo } from '@/components/ui';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useT } from '@/lib/i18n';
import { deriveStage } from '@/lib/stage-rules';

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

// Etape (deriveStage) — cheie internă + etichetă afișată. Ordinea = pâlnia liniară.
const STAGE_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'intrare', label: 'Intrare' },
  { key: 't1', label: 'T1' },
  { key: 'schita', label: 'Schiță' },
  { key: 'preofertat', label: 'Pre-ofertat' },
  { key: 'ofertat', label: 'Ofertat' },
  { key: 'amanat', label: 'Amânat' },
  { key: 'contractat', label: 'Contractat' },
  { key: 'finalizat', label: 'Finalizat' },
  { key: 'anulat', label: 'Anulat' },
];
const STAGE_ORDER: Record<string, number> = Object.fromEntries(STAGE_OPTIONS.map((s, i) => [s.key, i]));

// Steluță (prioritate culoare) — index 0..4 (parity cu PriorityStars / stelutaCat).
const STELUTA_OPTIONS = ['Fără', 'Roșu', 'Portocaliu', 'Albastru', 'Verde'];

// Opțiuni de sortare. `cmp` întoarce comparatorul; folosit pe lista `filtered`.
type SortKey = 'supr-desc' | 'supr-asc' | 'data-desc' | 'data-asc' | 'prio-desc' | 'nume-asc' | 'etapa';
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'supr-desc', label: 'Suprafață ↓' },
  { key: 'supr-asc', label: 'Suprafață ↑' },
  { key: 'data-desc', label: 'Dată intrare ↓' },
  { key: 'data-asc', label: 'Dată intrare ↑' },
  { key: 'prio-desc', label: 'Prioritate (steluță) ↓' },
  { key: 'nume-asc', label: 'Nume A-Z' },
  { key: 'etapa', label: 'Etapă' },
];

// Default-ul de filtre (pt. reset + persistență localStorage).
interface FilterState {
  stage: string;        // cheie deriveStage sau ''
  stadiu: string;       // valoare STADII sau ''
  nevoia: string;       // valoare NEVOI sau ''
  steluta: string;      // '' sau '0'..'4'
  audio: 'all' | 'yes' | 'no';
  mpMin: string;
  mpMax: string;
  dateFrom: string;     // yyyy-mm-dd
  dateTo: string;       // yyyy-mm-dd
}
const DEFAULT_FILTERS: FilterState = { stage: '', stadiu: '', nevoia: '', steluta: '', audio: 'all', mpMin: '', mpMax: '', dateFrom: '', dateTo: '' };

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
  // Panou de filtre ample (colapsabil). `stadiuFilter` rămâne în obiectul `filters`.
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('data-desc');
  const setF = <K extends keyof FilterState>(k: K, v: FilterState[K]) => setFilters(prev => ({ ...prev, [k]: v }));
  const [msg, setMsg] = useState('');
  const [isManager, setIsManager] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [agentList, setAgentList] = useState<Array<{ id: string; name: string }>>([]);
  const [view, setView] = useState<'cards' | 'tabel' | 'kanban'>('cards');
  // Modal de motiv la închidere (Contractat/Anulat) — API-ul cere closureReason; fără el PATCH-ul dă 400.
  const [closeModal, setCloseModal] = useState<{ id: string; stadiu: 'Contractat' | 'Anulat' } | null>(null);
  useEffect(() => { const v = localStorage.getItem('amass-palnie-view'); if (v === 'tabel' || v === 'cards' || v === 'kanban') setView(v); }, []);
  const switchView = (v: 'cards' | 'tabel' | 'kanban') => { setView(v); try { localStorage.setItem('amass-palnie-view', v); } catch {} };

  // Persistență filtre + sortare în localStorage (opțional, restaurat la mount).
  useEffect(() => {
    try {
      const raw = localStorage.getItem('amass-palnie-filters');
      if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') setFilters({ ...DEFAULT_FILTERS, ...p }); }
      const sk = localStorage.getItem('amass-palnie-sort');
      if (sk && SORT_OPTIONS.some(o => o.key === sk)) setSortKey(sk as SortKey);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('amass-palnie-filters', JSON.stringify(filters)); } catch {} }, [filters]);
  useEffect(() => { try { localStorage.setItem('amass-palnie-sort', sortKey); } catch {} }, [sortKey]);
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

  // Helpers comparatori sortare.
  const mp = (c: Client) => (c.suprafata == null ? null : Number(c.suprafata));
  const dt = (c: Client) => { const t = c.dataIntrare ? new Date(c.dataIntrare).getTime() : NaN; return Number.isNaN(t) ? null : t; };
  // null-urile cad mereu la coadă, indiferent de direcție.
  const nullsLast = <T,>(av: T | null, bv: T | null, body: (a: T, b: T) => number) => {
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return body(av, bv);
  };

  const filtered = clienti
    .filter(c => {
      // Etapă (deriveStage)
      if (filters.stage && deriveStage(c) !== filters.stage) return false;
      // Stadiu (existent)
      if (filters.stadiu && (c.stadiu ?? '') !== filters.stadiu) return false;
      // Nevoia
      if (filters.nevoia && (c.nevoia ?? '') !== filters.nevoia) return false;
      // Steluță (prioritate culoare)
      if (filters.steluta !== '' && (c.stelutaCat ?? 0) !== Number(filters.steluta)) return false;
      // Audio
      if (filters.audio === 'yes' && !c.hasAudio) return false;
      if (filters.audio === 'no' && c.hasAudio) return false;
      // Suprafață min/max
      const supr = mp(c);
      if (filters.mpMin !== '') { if (supr == null || supr < Number(filters.mpMin)) return false; }
      if (filters.mpMax !== '') { if (supr == null || supr > Number(filters.mpMax)) return false; }
      // Dată intrare de la / până la (compar pe yyyy-mm-dd local)
      if (filters.dateFrom || filters.dateTo) {
        const t = dt(c);
        if (t == null) return false;
        const d = new Date(t);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (filters.dateFrom && iso < filters.dateFrom) return false;
        if (filters.dateTo && iso > filters.dateTo) return false;
      }
      // Search liber (păstrat)
      if (filter) {
        const q = filter.toLowerCase();
        if (!(c.nume + ' ' + (c.localitate ?? '') + ' ' + c.idLucrare).toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortKey) {
        case 'supr-desc': return nullsLast(mp(a), mp(b), (x, y) => y - x);
        case 'supr-asc': return nullsLast(mp(a), mp(b), (x, y) => x - y);
        case 'data-desc': return nullsLast(dt(a), dt(b), (x, y) => y - x);
        case 'data-asc': return nullsLast(dt(a), dt(b), (x, y) => x - y);
        case 'prio-desc': return (b.stelutaCat ?? 0) - (a.stelutaCat ?? 0);
        case 'nume-asc': return (a.nume || '').localeCompare(b.nume || '', 'ro', { sensitivity: 'base' });
        case 'etapa': return (STAGE_ORDER[deriveStage(a)] ?? 99) - (STAGE_ORDER[deriveStage(b)] ?? 99);
        default: return 0;
      }
    });

  // Nr. de filtre active (pt. badge) — search-ul nu intră, are propriul input.
  const activeFilterCount = (
    (filters.stage ? 1 : 0) + (filters.stadiu ? 1 : 0) + (filters.nevoia ? 1 : 0) +
    (filters.steluta !== '' ? 1 : 0) + (filters.audio !== 'all' ? 1 : 0) +
    (filters.mpMin !== '' || filters.mpMax !== '' ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0)
  );
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const pillClass = (s: string | null) => {
    const m: Record<string, string> = { Anulat: 'pill-anulat', Contractat: 'pill-contractat', Amanat: 'pill-amanat', Finalizat: 'pill-finalizat' };
    return m[s ?? ''] || 'pill-lucru';
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Layout>
      {/* Toolbar STICKY (rămâne vizibil la scroll); comutatorul de vizualizare e fixat lângă titlu → nu mai dispare */}
      <div className="sticky top-11 z-20 bg-[var(--bg)] -mx-6 px-6 pt-1.5 pb-2 mb-3 border-b border-[var(--border)] rise">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-[19px] whitespace-nowrap flex items-baseline gap-2">{t('Pâlnie clienți')}<span className="text-[12px] font-normal text-[var(--fg-faint)] tabular" title="afișați / total">{filtered.length}/{clienti.length}</span></h1>
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
            <input className="field w-44" placeholder={t('Caută client, oraș, #id…')} value={filter} onChange={e => setFilter(e.target.value)} />
            {/* (Agent + Sortare au fost mutate în panoul Filtre → rând de sus minimal, mai mult loc clienți) */}
            {/* FILTRE — buton compact colapsabil cu badge nr. filtre active */}
            <button onClick={() => setFiltersOpen(o => !o)}
              className={'btn ' + (activeFilterCount > 0 ? 'btn-primary' : 'btn-secondary')}
              aria-expanded={filtersOpen} title="Filtre ample (etapă, nevoie, suprafață, dată…)">
              ⌕ {t('Filtre')}
              {activeFilterCount > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--on-accent)] text-[var(--accent)] text-[10px] font-bold leading-none">{activeFilterCount}</span>}
              <span className="ml-1 text-[10px]">{filtersOpen ? '▲' : '▼'}</span>
            </button>
            {/* SYNC consolidat într-un singur dropdown compact (era 3 butoane care umpleau rândul) */}
            <select disabled={!!sync} value="" title="Sincronizare din CRM"
              onChange={e => { const v = e.currentTarget.value; e.currentTarget.value = ''; if (v === 'clienti') runSync('/api/crm/sync-clienti', 'Sync clienți'); else if (v === 'detalii') runSync('/api/crm/sync-detalii', 'Sync detalii'); else if (v === 'remindere') runSync('/api/crm/sync-remindere', 'Sync remindere'); }}
              className="field w-32 !py-1 !text-[12px] font-semibold">
              <option value="">{sync ? '⏳ Sync…' : '↻ ' + t('Sync') + ' ▾'}</option>
              <option value="clienti">↻ {t('Clienți (noi)')}</option>
              <option value="detalii">↻ {t('Detalii')}</option>
              <option value="remindere">↻ {t('Remindere')}</option>
            </select>
          </div>
        </div>

        {/* PANOU FILTRE — colapsabil, compact; aplicat pe `filtered` → afectează cards/tabel/kanban */}
        {filtersOpen && (
          <div className="mt-2.5 p-3 rounded-[var(--r-sm)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-sm rise">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-3 gap-y-2.5">
              {/* Sortare (mutată aici din rândul de sus) */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Sortare')}
                <select className="field !text-[12px] !py-1.5" value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>
                  {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </label>
              {/* Agent (echipă) — doar manager (mutat aici din rândul de sus) */}
              {isManager && (
                <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  {t('Agent (echipă)')}
                  <select className="field !text-[12px] !py-1.5" value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
                    <option value="all">{t('👥 Echipa mea')}</option>
                    {agentList.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              )}
              {/* Etapă (deriveStage) */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Etapă')}
                <select className="field !text-[12px] !py-1.5" value={filters.stage} onChange={e => setF('stage', e.target.value)}>
                  <option value="">{t('Toate etapele')}</option>
                  {STAGE_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              {/* Stadiu */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Stadiu')}
                <select className="field !text-[12px] !py-1.5" value={filters.stadiu} onChange={e => setF('stadiu', e.target.value)}>
                  <option value="">{t('Toate stadiile')}</option>
                  {STADII.filter(s => s).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {/* Nevoia */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Nevoia')}
                <select className="field !text-[12px] !py-1.5" value={filters.nevoia} onChange={e => setF('nevoia', e.target.value)}>
                  <option value="">{t('Orice nevoie')}</option>
                  {NEVOI.filter(n => n).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {/* Steluță (prioritate culoare) */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Prioritate (steluță)')}
                <select className="field !text-[12px] !py-1.5" value={filters.steluta} onChange={e => setF('steluta', e.target.value)}>
                  <option value="">{t('Orice prioritate')}</option>
                  {STELUTA_OPTIONS.map((s, i) => <option key={i} value={String(i)}>{s}</option>)}
                </select>
              </label>
              {/* Audio */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Audio')}
                <select className="field !text-[12px] !py-1.5" value={filters.audio} onChange={e => setF('audio', e.target.value as FilterState['audio'])}>
                  <option value="all">{t('Toate')}</option>
                  <option value="yes">{t('Cu audio')}</option>
                  <option value="no">{t('Fără audio')}</option>
                </select>
              </label>
              {/* Suprafață min/max */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                {t('Suprafață (mp)')}
                <div className="flex items-center gap-1">
                  <input type="number" min={0} inputMode="numeric" placeholder={t('min')} className="field !text-[12px] !py-1.5 w-full"
                    value={filters.mpMin} onChange={e => setF('mpMin', e.target.value)} />
                  <span className="text-[var(--fg-faint)]">–</span>
                  <input type="number" min={0} inputMode="numeric" placeholder={t('max')} className="field !text-[12px] !py-1.5 w-full"
                    value={filters.mpMax} onChange={e => setF('mpMax', e.target.value)} />
                </div>
              </label>
              {/* Dată intrare de la / până la */}
              <label className="flex flex-col gap-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:col-span-2 xl:col-span-2">
                {t('Dată intrare')}
                <div className="flex items-center gap-1">
                  <input type="date" className="field !text-[12px] !py-1.5 w-full" title={t('de la')}
                    value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} />
                  <span className="text-[var(--fg-faint)]">–</span>
                  <input type="date" className="field !text-[12px] !py-1.5 w-full" title={t('până la')}
                    value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} />
                </div>
              </label>
            </div>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border)]">
              <span className="text-[11px] text-[var(--fg-faint)]">
                {activeFilterCount > 0 ? `${activeFilterCount} ${t('filtre active')}` : t('Niciun filtru activ')}
              </span>
              <div className="flex gap-2">
                <button onClick={resetFilters} disabled={activeFilterCount === 0} className="btn btn-secondary !py-1 !text-[12px]">↺ {t('Resetează filtrele')}</button>
                <button onClick={() => setFiltersOpen(false)} className="btn btn-secondary !py-1 !text-[12px]">{t('Închide')}</button>
              </div>
            </div>
          </div>
        )}
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
