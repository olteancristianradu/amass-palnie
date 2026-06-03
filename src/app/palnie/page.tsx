'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { SyncBadge, type SyncInfo, type AutoSyncInfo } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { PriorityStar, StagePill, RotText, Segmented } from '@/components/indicators';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useT } from '@/lib/i18n';
import {
  deriveStage, daysSince, stelutaToPrio, prioToSteluta,
  ALL_STAGES, PRIORITIES, PRIORITY_MAP, STAGE_MAP,
} from '@/lib/aspect-meta';

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

// Grup de filtre re-stilizat ca în design: etichetă + chips (.fgroup / .chip).
function FilterGroup({ label, value, options, onChange, dotFn }: {
  label: string; value: string; options: Array<[string, string]>;
  onChange: (v: string) => void; dotFn?: (k: string) => string | null;
}) {
  return (
    <div className="fgroup">
      <span className="label">{label}</span>
      <div className="fgroup__chips">
        {options.map(([k, l]) => (
          <button key={k} className={'chip' + (value === k ? ' is-on' : '')} onClick={() => onChange(k)}>
            {dotFn && dotFn(k) && <span className="chip__dot" style={{ background: dotFn(k) as string }} />}{l}
          </button>
        ))}
      </div>
    </div>
  );
}

// Chip activ (în filterbar) cu buton de eliminare.
function Chip({ children, dot, onRemove }: { children: React.ReactNode; dot?: string | null; onRemove: () => void }) {
  return (
    <span className="chip is-on">
      {dot && <span className="chip__dot" style={{ background: dot }} />}{children}
      <button className="chip__x" onClick={onRemove} title="Elimină filtrul"><Icon name="x" size={12} /></button>
    </span>
  );
}

// Buton de etapă (toggle bifă) pentru cardurile-rând (.steptog).
function StepToggle({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button className={'steptog' + (done ? ' is-done' : '')} onClick={e => { e.stopPropagation(); onClick(); }} title={label}>
      <Icon name={done ? 'check' : 'clock'} size={12} />{label}
    </button>
  );
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

  // Toast-ul dispare SINGUR: succes/info după 4s, eroare după 8s (înainte rămânea agățat după sync).
  useEffect(() => {
    if (!msg) return;
    const ms = msg.startsWith('❌') ? 8000 : 4000;
    const id = setTimeout(() => setMsg(''), ms);
    return () => clearTimeout(id);
  }, [msg]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch('/api/clienti?limit=5000&owner=' + ownerFilter);
      // Sesiune expirată/invalidă → NU lăsa pagina goală; trimite la login.
      if (r.status === 401) { window.location.href = '/login'; return; }
      const j = await r.json().catch(() => ({} as any));
      if (r.ok && j.ok) { setClienti(j.clienti); setIsManager(j.isManager); }
      else if (!silent) setMsg('❌ ' + (j.error || `Eroare server (${r.status})`));
    } catch (e: any) {
      if (!silent) setMsg('❌ ' + (e?.message || 'Nu s-a putut încărca pâlnia'));
    } finally {
      // finally garantează că spinnerul „Se încarcă pâlnia…" nu rămâne agățat la o eroare/HTML neașteptat.
      if (!silent) setLoading(false);
    }
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
    const prevVal = prev ? (prev[field] ?? null) : null;
    const newVal = value || null;
    setClienti(p => p.map(c => c.id === id ? { ...c, [field]: newVal } : c));
    const r = await fetch(`/api/clienti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({} as any));
      setMsg('❌ ' + (j.validationErrors?.join(' ') || j.error || 'Nu s-a putut salva'));
      // Rollback DOAR dacă valoarea afișată e încă cea pe care AM setat-o noi. Dacă între timp a apărut o
      // a doua editare (alt val) pe același câmp, NU o suprascriem cu valoarea veche (anti-pierdere afișaj).
      setClienti(p => p.map(c => (c.id === id && (c as any)[field] === newVal) ? { ...c, [field]: prevVal } : c));
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
      setClienti(p => p.map(c => (c.id === id && (c as any).stadiu === stadiu) ? { ...c, stadiu: prev ? (prev.stadiu ?? null) : null } : c));
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

  // Chips active (rezumat în filterbar) — fiecare cu un „clear" propriu.
  const activeChips: Array<{ k: string; label: string; dot?: string | null; clear: () => void }> = [
    filters.stage ? { k: 'stage', label: STAGE_MAP[filters.stage]?.label || filters.stage, dot: 'var(--st-' + filters.stage + ')', clear: () => setF('stage', '') } : null,
    filters.stadiu ? { k: 'stadiu', label: filters.stadiu, clear: () => setF('stadiu', '') } : null,
    filters.nevoia ? { k: 'nevoia', label: filters.nevoia, clear: () => setF('nevoia', '') } : null,
    filters.steluta !== '' ? { k: 'steluta', label: 'Prio: ' + (STELUTA_OPTIONS[Number(filters.steluta)] || filters.steluta), clear: () => setF('steluta', '') } : null,
    filters.audio !== 'all' ? { k: 'audio', label: filters.audio === 'yes' ? 'Cu audio' : 'Fără audio', clear: () => setF('audio', 'all') } : null,
    (filters.mpMin !== '' || filters.mpMax !== '') ? { k: 'mp', label: `mp ${filters.mpMin || '0'}–${filters.mpMax || '∞'}`, clear: () => setFilters(p => ({ ...p, mpMin: '', mpMax: '' })) } : null,
    (filters.dateFrom || filters.dateTo) ? { k: 'date', label: `Dată ${filters.dateFrom || '…'}→${filters.dateTo || '…'}`, clear: () => setFilters(p => ({ ...p, dateFrom: '', dateTo: '' })) } : null,
  ].filter(Boolean) as Array<{ k: string; label: string; dot?: string | null; clear: () => void }>;

  const pillClass = (s: string | null) => {
    const m: Record<string, string> = { Anulat: 'pill-anulat', Contractat: 'pill-contractat', Amanat: 'pill-amanat', Finalizat: 'pill-finalizat' };
    return m[s ?? ''] || 'pill-lucru';
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Topbar (switcher + search) — pasat Layout-ului prin prop `topbar`, ca în design.
  const topbar = (
    <>
      <div className="topbar__switch">
        <Segmented value={view} size="sm"
          onChange={(v) => switchView(v as 'cards' | 'tabel' | 'kanban')}
          options={[
            { value: 'cards', label: t('Carduri'), icon: 'cards' },
            { value: 'tabel', label: t('Tabel'), icon: 'table' },
            { value: 'kanban', label: t('Kanban'), icon: 'kanban' },
          ]} />
      </div>
      <div className="topbar__sp" />
      <SyncBadge last={lastSync} syncing={!!sync} auto={autoSync} />
      <div className="topbar__search">
        <Icon name="search" size={15} />
        <input placeholder={t('Caută client, oraș, #id…')} value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
    </>
  );

  return (
    <Layout topbar={topbar} contentMod={view === 'kanban' ? 'content--kanban' : undefined}>
      {/* FILTERBAR — buton Filtre + chips active + contor (re-stilizat ca în design) */}
      <div className="filterbar">
        <button className={'btn btn-secondary btn-sm filter-toggle' + (filtersOpen ? ' is-on' : '')}
          onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}
          title="Filtre ample (etapă, nevoie, suprafață, dată…)">
          <Icon name="filter" size={14} />{t('Filtre')}
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
        <div className="chips-row">
          {activeChips.map(c => <Chip key={c.k} dot={c.dot} onRemove={c.clear}>{c.label}</Chip>)}
          {activeFilterCount > 0 && <button className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('Curăță')}</button>}
        </div>
        <span className="filterbar__count muted tabular">{filtered.length} {t('din')} {clienti.length}</span>
      </div>

      {/* PANOU FILTRE — colapsabil; chips (.fgroup) + inputuri numerice/dată + sincronizare */}
      {filtersOpen && (
        <div className="filter-panel">
          <FilterGroup label={t('Sortare')} value={sortKey}
            onChange={(k) => setSortKey(k as SortKey)}
            options={SORT_OPTIONS.map(o => [o.key, o.label])} />
          <FilterGroup label={t('Etapă')} value={filters.stage || 'toate'}
            onChange={(k) => setF('stage', k === 'toate' ? '' : k)}
            options={[['toate', t('Toate')], ...STAGE_OPTIONS.map(s => [s.key, s.label] as [string, string])]}
            dotFn={(k) => k !== 'toate' ? 'var(--st-' + k + ')' : null} />
          <FilterGroup label={t('Prioritate')} value={filters.steluta === '' ? 'toate' : filters.steluta}
            onChange={(k) => setF('steluta', k === 'toate' ? '' : k)}
            options={[['toate', t('Toate')], ...STELUTA_OPTIONS.map((s, i) => [String(i), s] as [string, string])]}
            dotFn={(k) => {
              if (k === 'toate') return null;
              const p = PRIORITY_MAP[stelutaToPrio(Number(k))];
              return p ? p.color : null;
            }} />
          <FilterGroup label={t('Stadiu')} value={filters.stadiu || 'toate'}
            onChange={(k) => setF('stadiu', k === 'toate' ? '' : k)}
            options={[['toate', t('Toate')], ...STADII.filter(s => s).map(s => [s, s] as [string, string])]} />
          <FilterGroup label={t('Nevoia')} value={filters.nevoia || 'toate'}
            onChange={(k) => setF('nevoia', k === 'toate' ? '' : k)}
            options={[['toate', t('Orice nevoie')], ...NEVOI.filter(n => n).map(n => [n, n] as [string, string])]} />
          <FilterGroup label={t('Audio')} value={filters.audio}
            onChange={(k) => setF('audio', k as FilterState['audio'])}
            options={[['all', t('Toate')], ['yes', t('Cu audio')], ['no', t('Fără audio')]]} />
          {isManager && (
            <FilterGroup label={t('Agent (echipă)')} value={ownerFilter}
              onChange={setOwnerFilter}
              options={[['all', t('👥 Echipa mea')], ...agentList.map(a => [a.id, a.name] as [string, string])]} />
          )}
          {/* Suprafață min/max */}
          <div className="fgroup">
            <span className="label">{t('Suprafață (mp)')}</span>
            <div className="flex items-center gap-1">
              <input type="number" min={0} inputMode="numeric" placeholder={t('min')} className="field w-full"
                value={filters.mpMin} onChange={e => setF('mpMin', e.target.value)} />
              <span className="muted">–</span>
              <input type="number" min={0} inputMode="numeric" placeholder={t('max')} className="field w-full"
                value={filters.mpMax} onChange={e => setF('mpMax', e.target.value)} />
            </div>
          </div>
          {/* Dată intrare de la / până la */}
          <div className="fgroup">
            <span className="label">{t('Dată intrare')}</span>
            <div className="flex items-center gap-1">
              <input type="date" className="field w-full" title={t('de la')}
                value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} />
              <span className="muted">–</span>
              <input type="date" className="field w-full" title={t('până la')}
                value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} />
            </div>
          </div>
          {/* SINCRONIZARE CRM (auto-sync rulează oricum în fundal) */}
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <span className="label">{t('Sincronizare CRM')}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => runSync('/api/crm/sync-clienti', 'Sync clienți')} disabled={!!sync} className="btn btn-secondary btn-sm" title="Importă clienți noi din CRM"><Icon name="refresh" size={13} />{t('Clienți')}</button>
              <button onClick={() => runSync('/api/crm/sync-detalii', 'Sync detalii')} disabled={!!sync} className="btn btn-secondary btn-sm" title="Reîmprospătează detalii (steluțe, audio, suprafață, observații→strategie)"><Icon name="refresh" size={13} />{t('Detalii')}</button>
              <button onClick={() => runSync('/api/crm/sync-remindere', 'Sync remindere')} disabled={!!sync} className="btn btn-secondary btn-sm" title="Reîmprospătează ultimul reminder"><Icon name="refresh" size={13} />{t('Remindere')}</button>
              <span className="muted" style={{ fontSize: '.6875rem' }}>{t('(auto la 90s/10min în fundal)')}</span>
              <span className="topbar__sp" />
              <button onClick={resetFilters} disabled={activeFilterCount === 0} className="btn btn-secondary btn-sm"><Icon name="reset" size={13} />{t('Resetează filtrele')}</button>
              <button onClick={() => setFiltersOpen(false)} className="btn btn-ghost btn-sm">{t('Închide')}</button>
            </div>
          </div>
        </div>
      )}

      {msg && <div className={'toast mb-4 whitespace-pre-wrap ' + (msg.startsWith('✅') ? 'toast--success' : msg.startsWith('❌') ? 'toast--error' : 'toast--info')}>{msg}</div>}

      {loading ? (
        <div className="empty-state">Se încarcă pâlnia…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {clienti.length === 0 ? 'Niciun client încă. Apasă „Sync clienți" pentru import din CRM.' : 'Niciun rezultat pentru filtrul curent.'}
        </div>
      ) : view === 'tabel' ? (
        <div className="table-wrap card rise">
          {(() => {
            const cnt = (f: (c: Client) => any) => filtered.filter(c => { const v = f(c); return v != null && String(v).trim() !== ''; }).length;
            const tot = { supr: cnt(c => c.suprafata), intrare: cnt(c => c.dataIntrare), t1: cnt(c => c.t1), nevoia: cnt(c => c.nevoia), schita: cnt(c => c.schitaStatus), preof: cnt(c => c.preOfertat), ofertat: cnt(c => c.ofertat), status: cnt(c => c.stadiu) };
            // dd.mm.yyyy <-> yyyy-mm-dd pentru <input type="date"> (calendar nativ, editabil, orice dată)
            const toISO = (v: string | null) => { const m = (v || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
            const fromISO = (iso: string) => { const p = iso.split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : ''; };
            const dcell = (c: Client, k: string, v: string | null) => (
              <td onClick={stop} className="text-center">
                <input type="date" value={toISO(v)} title="Alege data (calendar) — click pe celulă" className="date-input"
                  onChange={e => updateInline(c.id, k, e.target.value ? fromISO(e.target.value) : '')} />
              </td>);
            return (
              <div className="tbl-scroll scroll-thin">
                <table className="tbl tbl--fisa">
                  <thead>
                    <tr>
                      <th className="tbl__sticky tbl__name">Client</th>
                      <th className="num">Suprafață</th>
                      <th>Data Intrare</th>
                      <th>T1</th>
                      <th className="col-nevoie">Nevoia</th>
                      <th>Schiță</th>
                      <th>Pre-Ofertat</th>
                      <th>Ofertat</th>
                      <th>Status</th>
                      <th>Reminder</th>
                      <th>Observații Manager</th>
                    </tr>
                    <tr className="tbl__total">
                      <td className="tbl__sticky">Total / etapă</td>
                      <td className="num mono">{tot.supr}</td>
                      <td className="num mono">{tot.intrare}</td>
                      <td className="num mono">{tot.t1}</td>
                      <td className="num mono col-nevoie">{tot.nevoia}</td>
                      <td className="num mono">{tot.schita}</td>
                      <td className="num mono">{tot.preof}</td>
                      <td className="num mono">{tot.ofertat}</td>
                      <td className="num mono">{tot.status}</td>
                      <td></td><td></td>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} onClick={() => router.push('/strategie/' + c.id)} className="cursor-pointer">
                        <td className="tbl__sticky tbl__name">
                          <div className="cnm">
                            <span onClick={stop}>
                              <PriorityStar value={stelutaToPrio(c.stelutaCat)} size={15}
                                onClick={() => setSteluta(c.id, c.idLucrare, prioToSteluta(stelutaToPrio((c.stelutaCat + 1) % 5)))} />
                            </span>
                            {!c.hasAudio && <Icon name="alert" size={13} style={{ color: 'var(--warning)', flex: '0 0 13px' }} />}
                            <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${c.idLucrare}`} target="_blank" rel="noopener" onClick={stop} className="cnm__name">{c.nume || '(nume)'}</a>
                          </div>
                          <div className="cnm__sub mono">#{c.idLucrare} · ({c.categorie}{c.isDT ? 'DT' : ''}){c.localitate ? ' · ' + c.localitate : ''}{isManager && ownerFilter === 'all' && c.owner ? ' · ' + (c.owner.name || c.owner.email) : ''}</div>
                        </td>
                        <td className="num mono">{c.suprafata != null ? c.suprafata + ' mp' : ''}</td>
                        <td className="mono cell-date">{c.dataIntrare ? new Date(c.dataIntrare).toLocaleDateString('ro-RO') : '—'}</td>
                        <td>
                          <div className="t1cell">
                            <span className="mono" style={{ fontSize: '.75rem' }}>{c.t1 || '—'}</span>
                            {c.t1 && <span className="t1cell__badge t1cell__badge--auto" title="Termen 1 (din CRM)">T1</span>}
                          </div>
                        </td>
                        <td onClick={stop} className="col-nevoie">
                          <select className="cell-select" style={c.nevoia ? { ...nevoiaChip(c.nevoia), fontWeight: 600 } : undefined}
                            value={c.nevoia ?? ''} onChange={e => updateInline(c.id, 'nevoia', e.target.value)}>
                            {NEVOI.map(n => <option key={n} value={n}>{n || '—'}</option>)}
                          </select>
                        </td>
                        {dcell(c, 'schitaStatus', c.schitaStatus)}
                        {dcell(c, 'preOfertat', c.preOfertat)}
                        {dcell(c, 'ofertat', c.ofertat)}
                        <td onClick={stop}>
                          <select className={'cell-select status-sel ' + pillClass(c.stadiu)} value={c.stadiu ?? ''} onChange={e => setStadiu(c.id, e.target.value)}>
                            {STADII.map(s => <option key={s} value={s}>{s || 'în lucru'}</option>)}
                          </select>
                        </td>
                        <td className="cell-rem">
                          {c.reminderText
                            ? <span className="rem-cell" title={c.reminderText}><Icon name="clock" size={11} />{c.reminderText.slice(0, 120)}</span>
                            : <span className="muted">— fără</span>}
                        </td>
                        <td onClick={stop} className="cell-obs">
                          <textarea className="cell-obs__ta" rows={2}
                            defaultValue={c.notaManager ?? ''}
                            placeholder="Notă manager…"
                            title="Notă privată a managerului (separată de observații CRM)"
                            onBlur={e => { if ((e.target.value || '') !== (c.notaManager ?? '')) updateInline(c.id, 'notaManager', e.target.value); }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard clienti={filtered} isManager={isManager} ownerFilter={ownerFilter}
          onPatch={patchLocal} setMsg={setMsg} reload={() => load()} />
      ) : (
        <div className="funnel-list rise">
          {filtered.map(c => {
            const stage = deriveStage(c);
            const days = daysSince(c.dataIntrare);
            const prio = PRIORITY_MAP[stelutaToPrio(c.stelutaCat)];
            const stages = [
              { k: 'schitaStatus', l: 'Schiță', v: c.schitaStatus },
              { k: 'preOfertat', l: 'Pre-of.', v: c.preOfertat },
              { k: 'ofertat', l: 'Ofertat', v: c.ofertat }
            ];
            return (
              <article key={c.id} className="fr" style={{ '--rot': prio.color } as React.CSSProperties}
                onClick={() => router.push('/strategie/' + c.id)}
                title="Click oriunde → fișa de strategie">
                <span className="fr__band" />
                <div className="fr__id">
                  <div className="fr__head">
                    {!c.hasAudio && <Icon name="alert" size={14} style={{ color: 'var(--warning)' }} />}
                    <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${c.idLucrare}`}
                      target="_blank" rel="noopener" onClick={stop} className="fr__name crm-link">
                      {c.nume || '(nume lipsă)'}
                    </a>
                    {c.localitate && <span className="fr__city">· {c.localitate}</span>}
                    <StagePill stage={stage} size="sm" />
                    {isManager && ownerFilter === 'all' && c.owner && (
                      <span className="pill pill-lucru" style={{ padding: '0 6px', fontSize: '9px' }}>{c.owner.name || c.owner.email}</span>
                    )}
                  </div>
                  <div className="fr__sub mono">
                    ({c.categorie}{c.isDT ? 'DT' : ''}) #{c.idLucrare}
                    {c.suprafata != null && <> · {c.suprafata} mp</>}
                    {c.dataIntrare && <> · {new Date(c.dataIntrare).toLocaleDateString('ro-RO')}</>}
                    {c.t1 && <> · T1 {c.t1}</>}
                  </div>
                  {c.reminderText
                    ? <div className="fr__rem"><Icon name="clock" size={12} />Reminder: {c.reminderText}</div>
                    : <div className="fr__rem fr__rem--none"><Icon name="clock" size={12} />Fără reminder</div>}
                </div>

                <div className="fr__ctl" onClick={stop}>
                  <RotText stage={stage} days={days} />
                  <div className="fr__steps">
                    {stages.map(s => {
                      const on = !!(s.v && s.v.trim());
                      return <StepToggle key={s.k} label={s.l} done={on}
                        onClick={() => updateInline(c.id, s.k, on ? '' : todayRO())} />;
                    })}
                  </div>
                  <select className="cell-select fr__nevoie" style={c.nevoia ? { ...nevoiaChip(c.nevoia), fontWeight: 600 } : undefined}
                    value={c.nevoia ?? ''} onChange={e => updateInline(c.id, 'nevoia', e.target.value)}>
                    {NEVOI.map(n => <option key={n} value={n}>{n || 'Nevoia —'}</option>)}
                  </select>
                  <select className={'cell-select status-sel ' + pillClass(c.stadiu)}
                    value={c.stadiu ?? ''} onChange={e => setStadiu(c.id, e.target.value)}>
                    {STADII.map(s => <option key={s} value={s}>{s || 'în lucru'}</option>)}
                  </select>
                  <PriorityStar value={stelutaToPrio(c.stelutaCat)} withLabel size={16}
                    onClick={() => setSteluta(c.id, c.idLucrare, prioToSteluta(stelutaToPrio((c.stelutaCat + 1) % 5)))} />
                  <button className="btn btn-pine btn-sm fr__fisa" onClick={e => { stop(e); router.push('/strategie/' + c.id); }}>
                    VEZI FIȘA<Icon name="arrowR" size={14} />
                  </button>
                </div>
              </article>
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
