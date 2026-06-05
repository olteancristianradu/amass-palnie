'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { SyncBadge, type SyncInfo, type AutoSyncInfo } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { PriorityStar, Segmented } from '@/components/indicators';
import { KanbanBoard } from '@/components/KanbanBoard';
import { useT } from '@/lib/i18n';
import {
  deriveStage, daysSince, stelutaToPrio, prioToSteluta, rotLevel,
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
  t1Locked?: boolean | null;
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
  inCRM?: boolean | null;
  telefon?: string | null;
  updatedAt?: string | null;
  owner?: { id: string; name: string | null; email: string } | null;
}

// Răspuns minimal al API-urilor /api/clienti* și /api/crm/*.
interface ApiResp {
  ok?: boolean;
  error?: string;
  validationErrors?: string[];
  id?: string;
  clienti?: Client[];
  isManager?: boolean;
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
  categorie: string;    // '' sau '1'..'5' (clasificarea client gestcom)
  varsta: 'all' | 'fresh' | 'warn' | 'late';  // Vârstă (rotLevel pe etapă): Proaspete/Atenție/Întârziate
  audio: 'all' | 'yes' | 'no';
  inCRM: 'all' | 'yes' | 'no';   // Înregistrare CRM: Toate / În CRM / Fără CRM (null tratat ca în CRM)
  mpMin: string;
  mpMax: string;
  dateFrom: string;     // yyyy-mm-dd — Perioadă intrare (pe dataIntrare)
  dateTo: string;       // yyyy-mm-dd
  stageFrom: string;    // yyyy-mm-dd — Perioadă schimbare stadiu (pe updatedAt)
  stageTo: string;      // yyyy-mm-dd
}
const DEFAULT_FILTERS: FilterState = { stage: '', stadiu: '', nevoia: '', steluta: '', categorie: '', varsta: 'all', audio: 'all', inCRM: 'all', mpMin: '', mpMax: '', dateFrom: '', dateTo: '', stageFrom: '', stageTo: '' };

// Înregistrare CRM: null sau true = client real (în CRM); doar false = creat manual în webapp.
const isInCRM = (c: { inCRM?: boolean | null }) => c.inCRM !== false;

// Dată cu NUME DE LUNĂ (ex. „8 mai 2026"). Acceptă ISO (din DateTime) sau dd.mm.yyyy (text T1 din CRM).
function fmtDateRO(v: string | null | undefined): string {
  if (!v) return '—';
  let d: Date | null = null;
  const m = String(v).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // dd.mm.yyyy (ex. T1)
  if (m) d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  else { const t = new Date(v); if (!Number.isNaN(t.getTime())) d = t; }
  if (!d) return String(v);
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

// dd.mm.yyyy <-> yyyy-mm-dd (pentru <input type="date"> nativ; T1 din CRM vine ca dd.mm.yyyy).
function dateToISO(v: string | null | undefined): string {
  if (!v) return '';
  const m = String(v).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const t = new Date(v);
  if (!Number.isNaN(t.getTime())) return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return '';
}
function isoToDateRO(iso: string): string {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : '';
}
// T1 auto = Data intrare + 1 zi (paritate cu handoff: window.DB iso(+1)), format dd.mm.yyyy.
function t1Auto(dataIntrare: string | null | undefined): string {
  const iso = dateToISO(dataIntrare);
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

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
  const { t } = useT();
  return (
    <span className="chip is-on">
      {dot && <span className="chip__dot" style={{ background: dot }} />}{children}
      <button className="chip__x" onClick={onRemove} title={t('Elimină filtrul')}><Icon name="x" size={12} /></button>
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

// Celulă de dată editabilă (paritate handoff .datecell): afișează data cu NUME DE LUNĂ
// (ex. „8 mai 2026"); click → calendar nativ. `faint` = stil estompat (ex. T1 auto, nesetat manual).
function DateCell({ value, onChange, faint, title }: {
  value: string | null; onChange: (iso: string) => void; faint?: boolean; title?: string;
}) {
  const { t } = useT();
  const ref = useRef<HTMLInputElement>(null);
  const open = () => {
    const el = ref.current; if (!el) return;
    const elp = el as HTMLInputElement & { showPicker?: () => void };
    if (elp.showPicker) { try { elp.showPicker(); return; } catch {} }
    el.focus(); el.click();
  };
  const iso = dateToISO(value);
  return (
    <span className={'datecell' + (faint ? ' is-faint' : '') + (!value ? ' is-empty' : '')}
      onClick={open} title={title || (value ? t('Click pentru a schimba data') : t('Click pentru a seta data'))}>
      <Icon name="clock" size={11} />
      <span className="datecell__txt">{value ? fmtDateRO(value) : '—'}</span>
      <input ref={ref} type="date" className="datecell__native" value={iso} tabIndex={-1}
        onChange={e => onChange(e.target.value)} />
    </span>
  );
}

// Mini-buton info ⓘ (dreapta-sus a tabelului) → popover cu legenda celor 2 simboluri.
// Închide la click în afară (mousedown). Explicațiile stau sub trigger, nu permanent pe ecran.
function TableInfo() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span className="tbl-info" ref={ref}>
      <button className={'tbl-info__btn' + (open ? ' is-on' : '')} title={t('Legendă simboluri')}
        onClick={() => setOpen(o => !o)} aria-label={t('Legendă simboluri')}>
        <Icon name="info" size={15} />
      </button>
      {open && (
        <div className="tbl-info__pop">
          <div className="tbl-info__t">{t('Legendă simboluri')}</div>
          <div className="tbl-info__row">
            <span className="autodot__pulse" />
            <span>{t('Punct albastru =')} <b>{t('completat automat')}</b> {t('(din Data intrare). Scrii peste → devine manual și nu se mai suprascrie.')}</span>
          </div>
          <div className="tbl-info__row">
            <span className="cnm__warn"><Icon name="alert" size={13} /></span>
            <span>{t('Triunghi roșu la nume = client')} <b>{t('fără înregistrare în CRM')}</b>.</span>
          </div>
        </div>
      )}
    </span>
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
  // Modal „+ Client nou" (creare manuală, inCRM=false) — deschis din topbar.
  const [newModal, setNewModal] = useState(false);
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
  const patchLocal = (id: string, patch: Partial<Client>) => setClienti(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  // Token anti-race pentru load(): fiecare cerere primește un id; la întoarcere, dacă a pornit între
  // timp o cerere mai nouă (ex. managerul a comutat agentul), ignorăm rezultatul stale (nu mai facem setState).
  const loadToken = useRef(0);

  // Toast-ul dispare SINGUR: succes/info după 4s, eroare după 8s (înainte rămânea agățat după sync).
  useEffect(() => {
    if (!msg) return;
    const ms = msg.startsWith('❌') ? 8000 : 4000;
    const id = setTimeout(() => setMsg(''), ms);
    return () => clearTimeout(id);
  }, [msg]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    // Cheia cererii = ownerFilter de la momentul pornirii. Dacă se schimbă până se întoarce, rezultatul e stale.
    const myToken = ++loadToken.current;
    const reqOwner = ownerFilter;
    try {
      const r = await fetch('/api/clienti?limit=5000&owner=' + reqOwner);
      // Sesiune expirată/invalidă → NU lăsa pagina goală; trimite la login.
      if (r.status === 401) { window.location.href = '/login'; return; }
      const j: ApiResp = await r.json().catch(() => ({} as ApiResp));
      // ANTI-RACE: a pornit între timp o cerere mai nouă → ignorăm acest rezultat (nu suprapunem date stale).
      if (myToken !== loadToken.current) return;
      if (r.ok && j.ok) { setClienti(j.clienti ?? []); setIsManager(j.isManager ?? false); }
      else if (!silent) setMsg('❌ ' + (j.error || `${t('Eroare server')} (${r.status})`));
    } catch (e) {
      if (myToken !== loadToken.current) return; // eroarea unei cereri stale nu trebuie să afecteze UI-ul curent
      if (!silent) setMsg('❌ ' + (e instanceof Error ? e.message : t('Nu s-a putut încărca pâlnia')));
    } finally {
      // finally garantează că spinnerul „Se încarcă pâlnia…" nu rămâne agățat la o eroare/HTML neașteptat.
      // Doar cererea cea mai nouă are voie să stingă spinnerul (o cerere stale nu trebuie să-l stingă prematur).
      if (!silent && myToken === loadToken.current) setLoading(false);
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
      } else {
        // Răspuns ne-ok: NU pretindem succes pe badge — îl ducem într-o stare cunoscută (necunoscut),
        // ca să nu afișeze un status de sync stale/greșit.
        console.error('loadMeta: răspuns ne-ok de la /api/dashboard', j?.error);
        setLastSync(null); setAutoSync(null);
      }
    }).catch(e => {
      // FIX: nu mai înghițim eroarea (înainte badge-urile rămâneau pe valori vechi/greșite). Logăm și
      // lăsăm metadatele într-o stare cunoscută (necunoscut), nu pretindem succes.
      console.error('loadMeta: eroare la încărcarea metadatelor de sync', e);
      setLastSync(null); setAutoSync(null);
    });
  }
  useEffect(() => { loadMeta(); }, []);

  // Auto-refresh UI la ~30s (silent, fără spinner) — reflectă datele aduse de auto-sync în fundal.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) { load(true); loadMeta(); } }, 30000);
    return () => clearInterval(t);
  }, [ownerFilter]);

  async function runSync(endpoint: string, label: string) {
    setSync({ type: label });
    setMsg(`⏳ ${label} ${t('pornit… (nu închide tab-ul)')}`);
    try {
      const r = await fetch(endpoint, { method: 'POST' });
      const j = await r.json();
      if (j.ok) { setMsg(`✅ ${label}: ${JSON.stringify(j).slice(0, 200)}`); await load(); loadMeta(); }
      else { setMsg('❌ ' + j.error); }
    } catch (e) { setMsg('❌ ' + (e instanceof Error ? e.message : String(e))); }
    setSync(null);
  }

  // Creare client manual (inCRM=false) → POST /api/clienti. La succes: reîncarcă pâlnia și
  // navighează la fișa noului client (paritate cu fluxul „vezi fișa").
  async function createClient(payload: { nume: string; localitate: string; judet: string; telefon: string; idLucrare: string; suprafata: string }) {
    setMsg('⏳ ' + t('Creez clientul…'));
    try {
      const r = await fetch('/api/clienti', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j: ApiResp = await r.json().catch(() => ({} as ApiResp));
      if (r.ok && j.ok) {
        setMsg('✅ ' + t('Client creat (⚠ fără înregistrare CRM)'));
        setNewModal(false);
        await load();
        if (j.id) router.push('/strategie/' + j.id);
      } else {
        setMsg('❌ ' + (j.error || `${t('Eroare server')} (${r.status})`));
      }
    } catch (e) {
      setMsg('❌ ' + (e instanceof Error ? e.message : t('Nu s-a putut crea clientul')));
    }
  }

  async function setSteluta(clientId: string, idLucrare: string, cat: number) {
    setClienti(prev => prev.map(c => c.id === clientId ? { ...c, stelutaCat: cat } : c)); // optimist
    setMsg('⏳ ' + t('Trimit steluța în CRM…'));
    const r = await fetch('/api/crm/steluta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, idLucrare, cat })
    });
    const j = await r.json();
    setMsg(j.ok ? '✅ ' + t('Prioritate setată în CRM') : '❌ ' + j.error);
    if (!j.ok) await load();
  }

  async function updateInline(id: string, field: string, value: string) {
    const prev = clienti.find(c => c.id === id) as (Client & Record<string, unknown>) | undefined;
    const prevVal = prev ? (prev[field] ?? null) : null;
    const newVal = value || null;
    setClienti(p => p.map(c => c.id === id ? { ...c, [field]: newVal } : c));
    const r = await fetch(`/api/clienti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal })
    });
    if (!r.ok) {
      const j: ApiResp = await r.json().catch(() => ({} as ApiResp));
      setMsg('❌ ' + (j.validationErrors?.join(' ') || j.error || t('Nu s-a putut salva')));
      // Rollback DOAR dacă valoarea afișată e încă cea pe care AM setat-o noi. Dacă între timp a apărut o
      // a doua editare (alt val) pe același câmp, NU o suprascriem cu valoarea veche (anti-pierdere afișaj).
      setClienti(p => p.map(c => (c.id === id && (c as Client & Record<string, unknown>)[field] === newVal) ? { ...c, [field]: prevVal } : c));
    }
  }

  // Update optimist cu MAI MULTE câmpuri într-un singur PATCH (ex. T1 + t1Locked, sau stadiu + nevoia).
  // Aceeași logică de rollback ca updateInline, dar pe tot setul de câmpuri modificate.
  async function updateInlineMulti(id: string, patch: Record<string, unknown>) {
    const prev = clienti.find(c => c.id === id) as (Client & Record<string, unknown>) | undefined;
    const prevVals: Record<string, unknown> = {};
    const newVals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      prevVals[k] = prev ? (prev[k] ?? null) : null;
      newVals[k] = (typeof v === 'string') ? (v || null) : v;
    }
    setClienti(p => p.map(c => c.id === id ? { ...c, ...newVals } : c));
    const r = await fetch(`/api/clienti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVals)
    });
    if (!r.ok) {
      const j: ApiResp = await r.json().catch(() => ({} as ApiResp));
      setMsg('❌ ' + (j.validationErrors?.join(' ') || j.error || t('Nu s-a putut salva')));
      // Rollback COMPLET (toate câmpurile atinse), nu parțial — altfel pe un eșec cu mai multe câmpuri
      // ar rămâne o stare hibridă coruptă. Atomic, doar dacă încă suntem în starea optimistă pe care AM
      // setat-o noi (TOATE câmpurile încă au valorile optimiste): dacă între timp a apărut altă editare pe
      // ORICARE câmp, nu rescriem nimic (anti-pierdere afișaj).
      setClienti(p => p.map(c => {
        if (c.id !== id) return c;
        const stillOurs = Object.keys(newVals).every(k => (c as Client & Record<string, unknown>)[k] === newVals[k]);
        return stillOurs ? { ...c, ...prevVals } : c;
      }));
    }
  }

  // T1: editare manuală din celulă (calendar). O dată introdusă manual → t1Locked=true (nu se mai
  // suprascrie de import/auto). Setăm ambele câmpuri într-un singur PATCH.
  const setT1Manual = (id: string, iso: string) => updateInlineMulti(id, { t1: iso ? isoToDateRO(iso) : '', t1Locked: true });
  // „↺ auto": revine la completarea automată (T1 = Data intrare + 1 zi, t1Locked=false).
  const setT1AutoRevert = (id: string) => {
    const c = clienti.find(x => x.id === id);
    const auto = t1Auto(c?.dataIntrare);
    // ANTI-PIERDERE: dacă nu există dataIntrare, t1Auto e gol → NU șterge T1-ul existent; doar deblochează.
    updateInlineMulti(id, auto ? { t1: auto, t1Locked: false } : { t1Locked: false });
  };

  // Schimbarea Stadiu: 'Contractat'/'Anulat' = închidere → cere motiv (modal) și trimite
  // { stadiu, closureReason, closureReasonDetail } într-un singur PATCH; restul merg direct.
  function setStadiu(id: string, value: string) {
    if (value === 'Contractat' || value === 'Anulat') { setCloseModal({ id, stadiu: value }); return; }
    // INVERS BUSINESS RULE: dacă plecăm din 'Anulat' (Anulat implică nevoia='Nu il putem ajuta'), iar nevoia
    // a rămas EXACT acea valoare implicată, o resetăm la gol în ACELAȘI PATCH — altfel rămâne contradicția
    // „nu mai e Anulat, dar tot 'Nu il putem ajuta'". Nu atingem nevoia setată manual la altceva.
    const c = clienti.find(x => x.id === id);
    if (c?.stadiu === 'Anulat' && c?.nevoia === 'Nu il putem ajuta') {
      updateInlineMulti(id, { stadiu: value, nevoia: '' });
      return;
    }
    updateInline(id, 'stadiu', value);
  }
  async function closeWithReason(id: string, stadiu: 'Contractat' | 'Anulat', detail: string) {
    const prev = clienti.find(c => c.id === id);
    const closureReason = stadiu === 'Contractat' ? 'Won' : 'Lost';
    // BUSINESS RULE: la Anulat setăm și nevoia='Nu il putem ajuta' în ACELAȘI PATCH (paritate spreadsheet).
    const body: Record<string, unknown> = { stadiu, closureReason, closureReasonDetail: detail };
    if (stadiu === 'Anulat') body.nevoia = 'Nu il putem ajuta';
    setClienti(p => p.map(c => c.id === id ? { ...c, stadiu, ...(stadiu === 'Anulat' ? { nevoia: 'Nu il putem ajuta' } : {}) } : c)); // optimist
    setMsg(`⏳ ${stadiu === 'Contractat' ? t('Contractare') : t('Anulare')} ${t('în CRM…')}`);
    const r = await fetch(`/api/clienti/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (r.ok) { setMsg(`✅ ${t('Marcat')} „${t(stadiu)}" ${t('(sincronizat în CRM)')}`); }
    else {
      const j: ApiResp = await r.json().catch(() => ({} as ApiResp));
      setMsg('❌ ' + (j.validationErrors?.join(' ') || j.error || t('Nu s-a putut salva')));
      setClienti(p => p.map(c => (c.id === id && c.stadiu === stadiu)
        ? { ...c, stadiu: prev ? (prev.stadiu ?? null) : null, ...(stadiu === 'Anulat' && c.nevoia === 'Nu il putem ajuta' ? { nevoia: prev ? (prev.nevoia ?? null) : null } : {}) }
        : c));
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
      // Steluță (prioritate culoare) — compar pe CHEIA de prioritate, nu pe categoria gestcom brută,
      // ca să prindă și cat 5 (tot „verde") sub opțiunea „Verde" (gestcom cat 4); identic cu punctele din UI.
      if (filters.steluta !== '' && stelutaToPrio(c.stelutaCat ?? 0) !== stelutaToPrio(Number(filters.steluta))) return false;
      // Categorie client (1-5, clasificarea gestcom — afișată ca „(N)" lângă nume).
      if (filters.categorie !== '' && (c.categorie ?? 0) !== Number(filters.categorie)) return false;
      // Vârstă (rotLevel pe etapă: proaspăt / atenție / întârziat)
      if (filters.varsta !== 'all' && rotLevel(deriveStage(c), daysSince(c.dataIntrare)) !== filters.varsta) return false;
      // Audio
      if (filters.audio === 'yes' && !c.hasAudio) return false;
      if (filters.audio === 'no' && c.hasAudio) return false;
      // Înregistrare CRM (null tratat ca „în CRM")
      if (filters.inCRM === 'yes' && !isInCRM(c)) return false;
      if (filters.inCRM === 'no' && isInCRM(c)) return false;
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
      // Perioadă schimbare stadiu — proxy: updatedAt (ultima modificare). Compar pe yyyy-mm-dd local.
      if (filters.stageFrom || filters.stageTo) {
        const u = c.updatedAt ? new Date(c.updatedAt) : null;
        if (!u || Number.isNaN(u.getTime())) return false;
        const iso = `${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, '0')}-${String(u.getDate()).padStart(2, '0')}`;
        if (filters.stageFrom && iso < filters.stageFrom) return false;
        if (filters.stageTo && iso > filters.stageTo) return false;
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
    (filters.steluta !== '' ? 1 : 0) + (filters.categorie !== '' ? 1 : 0) + (filters.varsta !== 'all' ? 1 : 0) + (filters.audio !== 'all' ? 1 : 0) +
    (filters.inCRM !== 'all' ? 1 : 0) +
    (filters.mpMin !== '' || filters.mpMax !== '' ? 1 : 0) +
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    (filters.stageFrom || filters.stageTo ? 1 : 0)
  );
  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  // Chips active (rezumat în filterbar) — fiecare cu un „clear" propriu.
  const activeChips: Array<{ k: string; label: string; dot?: string | null; clear: () => void }> = [
    filters.stage ? { k: 'stage', label: STAGE_MAP[filters.stage]?.label || filters.stage, dot: 'var(--st-' + filters.stage + ')', clear: () => setF('stage', '') } : null,
    filters.stadiu ? { k: 'stadiu', label: filters.stadiu, clear: () => setF('stadiu', '') } : null,
    filters.nevoia ? { k: 'nevoia', label: filters.nevoia, clear: () => setF('nevoia', '') } : null,
    filters.steluta !== '' ? { k: 'steluta', label: 'Prio: ' + (STELUTA_OPTIONS[Number(filters.steluta)] || filters.steluta), clear: () => setF('steluta', '') } : null,
    filters.categorie !== '' ? { k: 'categorie', label: 'Categorie ' + filters.categorie, clear: () => setF('categorie', '') } : null,
    filters.varsta !== 'all' ? { k: 'varsta', label: 'Vârstă: ' + ({ fresh: 'Proaspete', warn: 'Atenție', late: 'Întârziate' }[filters.varsta] || filters.varsta), clear: () => setF('varsta', 'all') } : null,
    filters.audio !== 'all' ? { k: 'audio', label: filters.audio === 'yes' ? 'Cu audio' : 'Fără audio', clear: () => setF('audio', 'all') } : null,
    filters.inCRM !== 'all' ? { k: 'inCRM', label: filters.inCRM === 'yes' ? 'În CRM' : 'Fără CRM', clear: () => setF('inCRM', 'all') } : null,
    (filters.mpMin !== '' || filters.mpMax !== '') ? { k: 'mp', label: `mp ${filters.mpMin || '0'}–${filters.mpMax || '∞'}`, clear: () => setFilters(p => ({ ...p, mpMin: '', mpMax: '' })) } : null,
    (filters.dateFrom || filters.dateTo) ? { k: 'date', label: `Intrare ${filters.dateFrom || '…'}→${filters.dateTo || '…'}`, clear: () => setFilters(p => ({ ...p, dateFrom: '', dateTo: '' })) } : null,
    (filters.stageFrom || filters.stageTo) ? { k: 'stage-date', label: `Stadiu ${filters.stageFrom || '…'}→${filters.stageTo || '…'}`, clear: () => setFilters(p => ({ ...p, stageFrom: '', stageTo: '' })) } : null,
  ].filter(Boolean) as Array<{ k: string; label: string; dot?: string | null; clear: () => void }>;

  const pillClass = (s: string | null) => {
    const m: Record<string, string> = { Anulat: 'pill-anulat', Contractat: 'pill-contractat', Amanat: 'pill-amanat', Finalizat: 'pill-finalizat' };
    return m[s ?? ''] || 'pill-lucru';
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Topbar (switcher + search + filtre) — pasat Layout-ului prin prop `topbar`, ca în design.
  // Ordinea handoff: switcher → spacer → search → buton Filtre (lipit de search) → Client nou.
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
      <div className="topbar__search">
        <Icon name="search" size={15} />
        <input placeholder={t('Caută client, oraș, #id…')} value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      <button className={'btn btn-secondary btn-sm filter-toggle' + (filtersOpen ? ' is-on' : '')}
        onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}
        title={t('Filtre ample (etapă, nevoie, suprafață, dată…)')}>
        <Icon name="filter" size={15} /><span className="filter-toggle__lbl">{t('Filtre')}</span>
        {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => setNewModal(true)} title={t('Adaugă un client manual (fără înregistrare CRM)')}>
        <Icon name="plus" size={14} />{t('Client nou')}
      </button>
      <SyncBadge last={lastSync} syncing={!!sync} auto={autoSync} />
    </>
  );

  return (
    <Layout topbar={topbar} contentMod={view === 'kanban' ? 'content--kanban' : view === 'tabel' ? 'content--table' : undefined}>
      {/* FILTERBAR (rezumat) — apare DOAR când există filtre active (paritate handoff): chips + Curăță tot + contor */}
      {activeFilterCount > 0 && (
        <div className="filterbar">
          <div className="chips-row">
            {activeChips.map(c => <Chip key={c.k} dot={c.dot} onRemove={c.clear}>{c.label}</Chip>)}
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>{t('Curăță tot')}</button>
          </div>
          <span className="filterbar__count muted tabular">{filtered.length} {t('din')} {clienti.length}</span>
        </div>
      )}

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
          <FilterGroup label={t('Categorie')} value={filters.categorie === '' ? 'toate' : filters.categorie}
            onChange={(k) => setF('categorie', k === 'toate' ? '' : k)}
            options={[['toate', t('Toate')], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]} />
          <FilterGroup label={t('Vârstă')} value={filters.varsta}
            onChange={(k) => setF('varsta', k as FilterState['varsta'])}
            options={[['all', t('Toate')], ['fresh', t('Proaspete')], ['warn', t('Atenție')], ['late', t('Întârziate')]]} />
          <FilterGroup label={t('Stadiu')} value={filters.stadiu || 'toate'}
            onChange={(k) => setF('stadiu', k === 'toate' ? '' : k)}
            options={[['toate', t('Toate')], ...STADII.filter(s => s).map(s => [s, s] as [string, string])]} />
          <FilterGroup label={t('Nevoia')} value={filters.nevoia || 'toate'}
            onChange={(k) => setF('nevoia', k === 'toate' ? '' : k)}
            options={[['toate', t('Orice nevoie')], ...NEVOI.filter(n => n).map(n => [n, n] as [string, string])]} />
          <FilterGroup label={t('Audio')} value={filters.audio}
            onChange={(k) => setF('audio', k as FilterState['audio'])}
            options={[['all', t('Toate')], ['yes', t('Cu audio')], ['no', t('Fără audio')]]} />
          <FilterGroup label={t('Înregistrare CRM')} value={filters.inCRM}
            onChange={(k) => setF('inCRM', k as FilterState['inCRM'])}
            options={[['all', t('Toate')], ['yes', t('În CRM')], ['no', t('Fără CRM')]]} />
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
          {/* Perioadă intrare de la / până la (pe dataIntrare) */}
          <div className="fgroup">
            <span className="label">{t('Perioadă intrare')}</span>
            <div className="flex items-center gap-1">
              <input type="date" className="field w-full" title={t('de la')}
                value={filters.dateFrom} onChange={e => setF('dateFrom', e.target.value)} />
              <span className="muted">–</span>
              <input type="date" className="field w-full" title={t('până la')}
                value={filters.dateTo} onChange={e => setF('dateTo', e.target.value)} />
            </div>
          </div>
          {/* Perioadă schimbare stadiu de la / până la (pe updatedAt — ultima schimbare) */}
          <div className="fgroup">
            <span className="label">{t('Perioadă schimbare stadiu')}</span>
            <div className="flex items-center gap-1">
              <input type="date" className="field w-full" title={t('de la')}
                value={filters.stageFrom} onChange={e => setF('stageFrom', e.target.value)} />
              <span className="muted">–</span>
              <input type="date" className="field w-full" title={t('până la')}
                value={filters.stageTo} onChange={e => setF('stageTo', e.target.value)} />
            </div>
          </div>
          {/* SINCRONIZARE CRM (auto-sync rulează oricum în fundal) */}
          <div className="fgroup" style={{ gridColumn: '1 / -1' }}>
            <span className="label">{t('Sincronizare CRM')}</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => runSync('/api/crm/sync-clienti', 'Sync clienți')} disabled={!!sync} className="btn btn-secondary btn-sm" title={t('Importă clienți noi din CRM')}><Icon name="refresh" size={13} />{t('Clienți')}</button>
              <button onClick={() => runSync('/api/crm/sync-detalii', 'Sync detalii')} disabled={!!sync} className="btn btn-secondary btn-sm" title={t('Reîmprospătează detalii (steluțe, audio, suprafață, observații→strategie)')}><Icon name="refresh" size={13} />{t('Detalii')}</button>
              <button onClick={() => runSync('/api/crm/sync-remindere', 'Sync remindere')} disabled={!!sync} className="btn btn-secondary btn-sm" title={t('Reîmprospătează ultimul reminder')}><Icon name="refresh" size={13} />{t('Remindere')}</button>
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
        <div className="empty-state">{t('Se încarcă pâlnia…')}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {clienti.length === 0 ? t('Niciun client încă. Apasă „Sync clienți" pentru import din CRM.') : t('Niciun rezultat pentru filtrul curent.')}
        </div>
      ) : view === 'tabel' ? (
        <div className="table-wrap card rise">
          <TableInfo />
          {(() => {
            const cnt = (f: (c: Client) => unknown) => filtered.filter(c => { const v = f(c); return v != null && String(v).trim() !== ''; }).length;
            const tot = { supr: cnt(c => c.suprafata), intrare: cnt(c => c.dataIntrare), t1: cnt(c => c.t1), nevoia: cnt(c => c.nevoia), schita: cnt(c => c.schitaStatus), preof: cnt(c => c.preOfertat), ofertat: cnt(c => c.ofertat), status: cnt(c => c.stadiu) };
            const faraCRM = filtered.filter(c => c.inCRM === false).length;
            // Celulă de dată editabilă (DateCell): calendar nativ, format cu nume de lună (paritate handoff).
            const dcell = (c: Client, k: string, v: string | null) => (
              <td onClick={stop} className="cell-date">
                <DateCell value={v} onChange={iso => updateInline(c.id, k, iso ? isoToDateRO(iso) : '')} />
              </td>);
            // Total / etapă centrat: valoare mare deasupra etichetei mici (paritate .tcell handoff).
            const totCell = (val: React.ReactNode, lbl: string, cls?: string) => (
              <td className={'tcell ' + (cls || '')}><span className="tcell__v mono">{val}</span><span className="tcell__l">{lbl}</span></td>);
            return (
              <div className="tbl-scroll scroll-thin">
                <table className="tbl tbl--fisa">
                  <colgroup>
                    <col className="cg-name" /><col className="cg-mp" /><col className="cg-date" /><col className="cg-t1" />
                    <col className="cg-nevoie" /><col className="cg-date" /><col className="cg-date" /><col className="cg-date" />
                    <col className="cg-status" /><col className="cg-rem" /><col className="cg-obs" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="tbl__sticky tbl__name">{t('Client')}</th>
                      <th className="num">{t('Suprafață')}</th>
                      <th>{t('Data Intrare')}</th>
                      <th>{t('T1')}</th>
                      <th className="col-nevoie">{t('Nevoia')}</th>
                      <th>{t('Schiță')}</th>
                      <th>{t('Pre-Ofertat')}</th>
                      <th>{t('Ofertat')}</th>
                      <th>{t('Status')}</th>
                      <th>{t('Reminder')}</th>
                      <th>{t('Observații Manager')}</th>
                    </tr>
                    <tr className="tbl__total">
                      <td className="tbl__sticky tbl__total-lbl">{t('Total / etapă')} <span className="tbl__total-n">({filtered.length})</span></td>
                      {totCell(tot.supr, t('suprafețe'), 'num')}
                      {totCell(tot.intrare, t('intrate'))}
                      {totCell(tot.t1, 'T1')}
                      {totCell(tot.nevoia, t('calific.'), 'col-nevoie')}
                      {totCell(tot.schita, t('schițe'))}
                      {totCell(tot.preof, t('pre-of.'))}
                      {totCell(tot.ofertat, t('oferte'))}
                      {totCell(tot.status, t('cu status'))}
                      {totCell(faraCRM, t('fără CRM'))}
                      <td></td>
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
                            {/* ⚠ client fără înregistrare în CRM. Modelul webapp NU are câmp inCRM → tratăm ca TRUE (deci nu apare acum); logica e gata. */}
                            {c.inCRM === false && (
                              <span className="cnm__warn" title={t('Fără înregistrare în CRM — de sincronizat')}><Icon name="alert" size={13} /></span>
                            )}
                            {/* Numele preia culoarea STELEI doar dacă are steluță colorată; altfel rămâne neutru (din CSS). */}
                            <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${c.idLucrare}`} target="_blank" rel="noopener" onClick={stop} className="cnm__name"
                              style={{ color: (c.stelutaCat > 0 && PRIORITY_MAP[stelutaToPrio(c.stelutaCat)]) ? PRIORITY_MAP[stelutaToPrio(c.stelutaCat)].color : undefined }}>{c.nume || t('(nume)')}</a>
                          </div>
                          <div className="cnm__sub mono">#{c.idLucrare} · ({c.categorie}{c.isDT ? 'DT' : ''}){c.localitate ? ' · ' + c.localitate : ''}{isManager && ownerFilter === 'all' && c.owner ? ' · ' + (c.owner.name || c.owner.email) : ''}</div>
                        </td>
                        <td className="num mono cell-mp">{c.suprafata != null ? <><b>{c.suprafata}</b> <span className="cell-mp__u">mp</span></> : ''}</td>
                        <td className="cell-date">
                          {/* Data intrare = read-only (din CRM); stilizată ca .datecell, format cu nume de lună. */}
                          <span className={'datecell' + (!c.dataIntrare ? ' is-empty' : '')} style={{ cursor: 'default' }} title={t('Data intrării (din CRM)')}>
                            <Icon name="clock" size={11} />
                            <span className="datecell__txt">{c.dataIntrare ? fmtDateRO(c.dataIntrare) : '—'}</span>
                          </span>
                        </td>
                        <td onClick={stop}>
                          <div className="t1cell">
                            <DateCell value={c.t1} faint={!c.t1Locked}
                              onChange={iso => setT1Manual(c.id, iso)} />
                            {c.t1 && (c.t1Locked
                              ? <button className="t1revert" title={t('Setat manual — apasă pentru a reveni la completarea automată (Data intrare + 1 zi)')}
                                  onClick={() => setT1AutoRevert(c.id)}><Icon name="refresh" size={9} /> {t('auto')}</button>
                              : <span className="autodot" title={t('Completat automat din Data intrare (+1 zi). Scrie o dată ca să-l faci manual.')}><span className="autodot__pulse" /></span>)}
                          </div>
                        </td>
                        <td onClick={stop} className="col-nevoie">
                          <select className="cell-select" style={c.nevoia ? { ...nevoiaChip(c.nevoia), fontWeight: 600 } : undefined}
                            value={c.nevoia ?? ''} onChange={e => updateInline(c.id, 'nevoia', e.target.value)}>
                            {NEVOI.map(n => <option key={n} value={n}>{n ? t(n) : '—'}</option>)}
                          </select>
                        </td>
                        {dcell(c, 'schitaStatus', c.schitaStatus)}
                        {dcell(c, 'preOfertat', c.preOfertat)}
                        {dcell(c, 'ofertat', c.ofertat)}
                        <td onClick={stop}>
                          <select className={'cell-select status-sel ' + pillClass(c.stadiu)} value={c.stadiu ?? ''} onChange={e => setStadiu(c.id, e.target.value)}>
                            {STADII.map(s => <option key={s} value={s}>{s ? t(s) : t('în lucru')}</option>)}
                          </select>
                        </td>
                        <td className="cell-rem">
                          {c.reminderText
                            ? <span className="rem-cell" title={c.reminderText}><Icon name="clock" size={11} />{c.reminderText.slice(0, 120)}</span>
                            : <span className="muted">{t('— fără')}</span>}
                        </td>
                        <td onClick={stop} className="cell-obs">
                          <textarea className="cell-obs__ta" rows={2}
                            defaultValue={c.notaManager ?? ''}
                            placeholder={t('Notă manager…')}
                            title={t('Notă privată a managerului (separată de observații CRM)')}
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
          onPatch={patchLocal} setMsg={setMsg} reload={() => load()} sortKey={sortKey} />
      ) : (
        <div className="funnel-list rise">
          {filtered.map(c => {
            const prio = PRIORITY_MAP[stelutaToPrio(c.stelutaCat)];
            const stages = [
              { k: 'schitaStatus', l: t('Schiță'), v: c.schitaStatus },
              { k: 'preOfertat', l: t('Pre-of.'), v: c.preOfertat },
              { k: 'ofertat', l: t('Ofertat'), v: c.ofertat }
            ];
            return (
              <article key={c.id} className="fr" style={{ '--rot': prio.color } as React.CSSProperties}
                onClick={() => router.push('/strategie/' + c.id)}
                title={t('Click oriunde → fișa de strategie')}>
                <span className="fr__band" />
                <div className="fr__id">
                  <div className="fr__head">
                    <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${c.idLucrare}`}
                      target="_blank" rel="noopener" onClick={stop} className="fr__name crm-link">
                      {c.nume || t('(nume lipsă)')}
                    </a>
                    {c.localitate && <span className="fr__city">· {c.localitate}</span>}
                  </div>
                  <div className="fr__sub mono">
                    ({c.categorie}{c.isDT ? 'DT' : ''}) #{c.idLucrare}
                    {c.suprafata != null && <> · {c.suprafata} mp</>}
                    {c.dataIntrare && <> · {new Date(c.dataIntrare).toLocaleDateString('ro-RO')}</>}
                  </div>
                  {c.reminderText
                    ? <div className="fr__rem"><Icon name="clock" size={12} />{t('Reminder:')} {c.reminderText}</div>
                    : <div className="fr__rem fr__rem--none"><Icon name="clock" size={12} />{t('Fără reminder')}</div>}
                </div>

                <div className="fr__ctl" onClick={stop}>
                  <div className="fr__steps">
                    {stages.map(s => {
                      const on = !!(s.v && s.v.trim());
                      return <StepToggle key={s.k} label={s.l} done={on}
                        onClick={() => updateInline(c.id, s.k, on ? '' : todayRO())} />;
                    })}
                  </div>
                  <select className="cell-select fr__nevoie" style={c.nevoia ? { ...nevoiaChip(c.nevoia), fontWeight: 600 } : undefined}
                    value={c.nevoia ?? ''} onChange={e => updateInline(c.id, 'nevoia', e.target.value)}>
                    {NEVOI.map(n => <option key={n} value={n}>{n ? t(n) : t('Nevoia —')}</option>)}
                  </select>
                  <select className={'cell-select status-sel ' + pillClass(c.stadiu)}
                    value={c.stadiu ?? ''} onChange={e => setStadiu(c.id, e.target.value)}>
                    {STADII.map(s => <option key={s} value={s}>{s ? t(s) : t('în lucru')}</option>)}
                  </select>
                  <PriorityStar value={stelutaToPrio(c.stelutaCat)} withLabel size={16}
                    onClick={() => setSteluta(c.id, c.idLucrare, prioToSteluta(stelutaToPrio((c.stelutaCat + 1) % 5)))} />
                  <button className="btn btn-pine btn-sm fr__fisa" onClick={e => { stop(e); router.push('/strategie/' + c.id); }}>
                    {t('VEZI FIȘA')}<Icon name="arrowR" size={14} />
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

      {newModal && (
        <NewClientModal onClose={() => setNewModal(false)} onCreate={createClient} />
      )}
    </Layout>
  );
}

const WON_REASONS = ['ROI clar', 'Buget aprobat', 'Urgență (sezon)', 'Recomandare', 'Preț competitiv', 'Altul'];
const LOST_REASONS = ['Preț prea mare', 'A ales concurența', 'Fără decizie / amânat', 'Fără urgență', 'Buget tăiat', 'Necontactabil', 'Altul'];

// Modal de motiv la închidere (Contractat = câștigat / Anulat = pierdut). Trimite un motiv real
// (la „Altul" cere text liber) → ajunge în closureReasonDetail pentru raportul de win/loss.
function CloseReasonModal({ stadiu, onConfirm, onClose }: { stadiu: 'Contractat' | 'Anulat'; onConfirm: (detail: string) => void; onClose: () => void }) {
  const { t } = useT();
  const won = stadiu === 'Contractat';
  const reasons = won ? WON_REASONS : LOST_REASONS;
  const [sel, setSel] = useState(reasons[0]);
  const [free, setFree] = useState('');
  const detail = sel === 'Altul' ? free.trim() : sel;
  const blocked = sel === 'Altul' && !free.trim();
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">{won ? t('✅ Contractat — de ce a câștigat?') : t('❌ Anulat — de ce s-a pierdut?')}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{t('Motivul intră în raportul de win/loss (coaching).')}</p>
        <div className="space-y-1.5 mb-3">
          {reasons.map(r => (
            <label key={r} className={'flex items-center gap-2 px-3 py-2 rounded-[var(--r-sm)] border cursor-pointer text-[13px] ' + (sel === r ? 'border-[var(--ember)] bg-[var(--ember-soft)] font-semibold' : 'border-[var(--border-strong)]')}>
              <input type="radio" name="closeReason" checked={sel === r} onChange={() => setSel(r)} />{t(r)}
            </label>
          ))}
        </div>
        {sel === 'Altul' && (
          <textarea className="field mb-4" rows={2} autoFocus placeholder={t('Scrie motivul concret…')}
            value={free} onChange={e => setFree(e.target.value)} />
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
          <button onClick={() => onConfirm(detail)} disabled={blocked} className={'btn ' + (won ? 'btn-pine' : 'btn-primary')}>{t('Confirmă')}</button>
        </div>
      </div>
    </div>
  );
}

function todayRO() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// Modal „+ Client nou" — creare manuală a unui client (inCRM=false → ⚠ la nume). Doar Nume e
// obligatoriu; restul sunt opționale. idLucrare gol → backend-ul pune un placeholder unic ('MAN-…').
function NewClientModal({ onCreate, onClose }: {
  onCreate: (p: { nume: string; localitate: string; judet: string; telefon: string; idLucrare: string; suprafata: string }) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [nume, setNume] = useState('');
  const [localitate, setLocalitate] = useState('');
  const [judet, setJudet] = useState('');
  const [telefon, setTelefon] = useState('');
  const [idLucrare, setIdLucrare] = useState('');
  const [suprafata, setSuprafata] = useState('');
  const [saving, setSaving] = useState(false);
  const blocked = !nume.trim() || saving;
  const submit = () => {
    if (blocked) return;
    setSaving(true);
    onCreate({ nume: nume.trim(), localitate, judet, telefon, idLucrare, suprafata });
  };
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="card !shadow-[var(--shadow-lg)] max-w-sm w-full p-6 rise" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg mb-1">{t('+ Client nou')}</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{t('Creat manual în webapp — apare cu ⚠ (fără înregistrare CRM) până la sincronizare.')}</p>
        <div className="space-y-3 mb-4">
          <label className="block">
            <span className="label">{t('Nume *')}</span>
            <input className="field w-full" autoFocus value={nume} onChange={e => setNume(e.target.value)}
              placeholder={t('Numele clientului')} onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="label">{t('Localitate')}</span>
              <input className="field w-full" value={localitate} onChange={e => setLocalitate(e.target.value)} placeholder={t('Oraș/comună')} />
            </label>
            <label className="block flex-1">
              <span className="label">{t('Județ')}</span>
              <input className="field w-full" value={judet} onChange={e => setJudet(e.target.value)} placeholder={t('Județ')} />
            </label>
          </div>
          <label className="block">
            <span className="label">{t('Telefon')}</span>
            <input className="field w-full" value={telefon} onChange={e => setTelefon(e.target.value)} placeholder={t('Telefon')} />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="label">{t('idLucrare (opțional)')}</span>
              <input className="field w-full" value={idLucrare} onChange={e => setIdLucrare(e.target.value)} placeholder={t('lasă gol → automat')} />
            </label>
            <label className="block flex-1">
              <span className="label">{t('Suprafață (mp)')}</span>
              <input className="field w-full" type="number" min={0} inputMode="numeric"
                value={suprafata} onChange={e => setSuprafata(e.target.value)} placeholder={t('mp')} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
          <button onClick={submit} disabled={blocked} className="btn btn-pine">{t('Creează')}</button>
        </div>
      </div>
    </div>
  );
}
