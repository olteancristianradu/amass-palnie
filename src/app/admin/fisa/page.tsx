'use client';
import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { asMulti, type FisaControl, type FisaField, type FisaZone, type FisaTemplateData } from '@/lib/fisa-template';
import { calculate } from '@/lib/strategie-calc';
import { SEED_V1, SEED_V2 } from '@/lib/fisa-template-seed';

// ── Editor de admin pentru FORMATUL fișei (template V1/V2), cu PREVIZUALIZARE LIVE (WYSIWYG) ──
// STÂNGA: controalele de editare (etichetă, tip câmp, opțiuni, ordine, șterge).
// DREAPTA (sticky): randarea fișei EXACT ca pagina de strategie reală (.fz/.frow/.fstat/.chipset),
//   read-only, cu date demo, actualizată instant din starea curentă a template-ului.
// `key` rămâne READ-ONLY pentru câmpurile salvate (schimbarea ar orfaniza datele). Câmpurile 'calc'
//   au formulă fixă (calcKey) → read-only. Ștergerea unui câmp cu date deja completate trece prin
//   /api/admin/fisa-field (count + delete-hard | delete-to-obs), apoi PATCH fisa-template (scoate cheia).

const CONTROLS: { value: FisaControl; label: string }[] = [
  { value: 'number', label: 'Număr' },
  { value: 'text', label: 'Text' },
  { value: 'dropdown', label: 'Listă (1 opțiune)' },
  { value: 'multiselect', label: 'Listă (multi-selecție)' },
  { value: 'textarea', label: 'Text lung' },
  { value: 'calc', label: 'Calcul (auto, fix)' },
];
const SOURCES: { value: NonNullable<FisaField['source']>; label: string }[] = [
  { value: 'manual', label: 'Manual (agentul scrie)' },
  { value: 'autofill', label: 'Auto-completat (din date)' },
  { value: 'calc', label: 'Calculat' },
];

type Variant = 'V1' | 'V2';

const SEEDS: Record<Variant, FisaTemplateData> = { V1: SEED_V1, V2: SEED_V2 };

// Date demo pentru previzualizare (read-only). Suprafață 150 → calc-ul produce valori realiste.
const DEMO_FORM: Record<string, any> = {
  suprafata: 150,
  putere_pftv: 5,
  suma: 1200,
  ca_cost_lunar: 1200,
  prod_aplicatie: 6500,
  sistem_actual: 'CT gaz',
  ca_sistem: 'Centrala gaz',
  bransament: 'Trifazic',
  motiv_principal: 'Economie financiara',
  tip_plata: 'Esalonat',
  nivel_bani: 'Smart',
  tipologie: 'Logic',
  stadiu_constructie: 'La gri',
  constructie: ['Caramida', '15 cm', 'Parter'],
  constructie_izolatie: ['Caramida', '15 cm', 'Parter'],
  alternativa: ['Pompa de caldura (medie 2 ore/zi consum)'],
  obs_situatie: 'Casă orientată sud, izolație bună.',
  strategie_nevoi: 'Clientul caută economie pe termen lung.',
};

function newZoneId() { return 'z' + Math.random().toString(36).slice(2, 8); }
function newFieldKey() { return 'camp_' + Math.random().toString(36).slice(2, 8); }
function keyFromLabel(label: string): string {
  const slug = (label || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug ? 'camp_' + slug : newFieldKey();
}

// Pentru delete-to-obs: găsește cheia câmpului de observații al ZONEI din care face parte câmpul `key`.
// Preferință: un câmp 'textarea' din aceeași zonă, altfel orice câmp cu key care începe cu 'obs'.
// Întoarce '' dacă zona nu are un câmp de observații (atunci 'delete-to-obs' nu e oferită).
function findObsKeyInZone(zone: FisaZone, key: string): string {
  const candidates = zone.fields.filter(f => f.key !== key);
  const textareaObs = candidates.find(f => f.control === 'textarea' && /obs/i.test(f.key));
  if (textareaObs) return textareaObs.key;
  const anyTextarea = candidates.find(f => f.control === 'textarea');
  if (anyTextarea) return anyTextarea.key;
  const anyObs = candidates.find(f => /^obs/i.test(f.key));
  return anyObs ? anyObs.key : '';
}

// Stare pentru modalul de ștergere câmp cu date.
interface DeleteState {
  zi: number;
  fi: number;
  field: FisaField;
  count: number;
  obsKey: string;     // cheia obs a zonei (poate fi '' dacă zona n-are obs)
  busy: boolean;
}

export default function AdminFisaPage() {
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Variant>('V1');
  const [tpl, setTpl] = useState<Record<Variant, FisaTemplateData | null>>({ V1: null, V2: null });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  // Cheile câmpurilor ADĂUGATE în sesiunea curentă (nesalvate) — doar acestea au `key` editabil.
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  // Modalul de ștergere câmp-cu-date (count>0).
  const [del, setDel] = useState<DeleteState | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/fisa-template');
    if (r.status === 403 || r.status === 401) { setForbidden(true); setLoading(false); return; }
    const j = await r.json();
    if (j.ok) setTpl({ V1: j.templates.V1, V2: j.templates.V2 });
    setNewKeys(new Set());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const cur = tpl[tab];

  function update(fn: (t: FisaTemplateData) => FisaTemplateData) {
    setTpl(prev => {
      const c = prev[tab];
      if (!c) return prev;
      return { ...prev, [tab]: fn(c) };
    });
  }
  function setZones(fn: (zones: FisaZone[]) => FisaZone[]) {
    update(t => ({ ...t, zones: fn(t.zones) }));
  }

  // ── Zone ──
  function setZoneTitle(zi: number, titlu: string) {
    setZones(zs => zs.map((z, i) => i === zi ? { ...z, titlu } : z));
  }
  function addZone() {
    setZones(zs => [...zs, { id: newZoneId(), titlu: 'Zonă nouă', fields: [] }]);
  }
  function removeZone(zi: number) {
    if (!window.confirm('Ștergi zona și toate câmpurile ei din format?')) return;
    setZones(zs => zs.filter((_, i) => i !== zi));
  }
  function moveZone(zi: number, dir: -1 | 1) {
    setZones(zs => {
      const j = zi + dir;
      if (j < 0 || j >= zs.length) return zs;
      const next = zs.slice();
      [next[zi], next[j]] = [next[j], next[zi]];
      return next;
    });
  }

  // ── Câmpuri ──
  function setField(zi: number, fi: number, patch: Partial<FisaField>) {
    setZones(zs => zs.map((z, i) => i !== zi ? z : { ...z, fields: z.fields.map((f, k) => k === fi ? { ...f, ...patch } : f) }));
  }
  function addField(zi: number) {
    const f: FisaField = { key: newFieldKey(), label: 'Câmp nou', control: 'text', source: 'manual' };
    setNewKeys(prev => new Set(prev).add(f.key));
    setZones(zs => zs.map((z, i) => i !== zi ? z : { ...z, fields: [...z.fields, f] }));
  }
  function setFieldKey(zi: number, fi: number, oldKey: string, raw: string) {
    const next = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setNewKeys(prev => { const s = new Set(prev); s.delete(oldKey); s.add(next); return s; });
    setField(zi, fi, { key: next });
  }
  function ensureFieldKey(zi: number, fi: number, oldKey: string, label: string) {
    if (oldKey) return;
    const gen = keyFromLabel(label);
    setNewKeys(prev => { const s = new Set(prev); s.delete(oldKey); s.add(gen); return s; });
    setField(zi, fi, { key: gen });
  }
  // Scoate efectiv câmpul din template + sincronizează newKeys.
  function removeFieldLocal(zi: number, fi: number) {
    setZones(zs => zs.map((z, i) => {
      if (i !== zi) return z;
      const removed = z.fields[fi];
      if (removed) setNewKeys(prev => { const s = new Set(prev); s.delete(removed.key); return s; });
      return { ...z, fields: z.fields.filter((_, k) => k !== fi) };
    }));
  }
  function moveField(zi: number, fi: number, dir: -1 | 1) {
    setZones(zs => zs.map((z, i) => {
      if (i !== zi) return z;
      const j = fi + dir;
      if (j < 0 || j >= z.fields.length) return z;
      const fields = z.fields.slice();
      [fields[fi], fields[j]] = [fields[j], fields[fi]];
      return { ...z, fields };
    }));
  }

  // ── ȘTERGERE CÂMP (C): count → modal (dacă are date) → cleanup date → PATCH scoate cheia ──
  // 1) câmp nou (nesalvat) sau calc → scoatere directă, nu există date stocate.
  // 2) altfel: 'count' la endpoint. count===0 → scoatere directă. count>0 → modal cu 2 opțiuni.
  async function onRemoveField(zi: number, fi: number) {
    if (!cur) return;
    const zone = cur.zones[zi];
    const f = zone?.fields[fi];
    if (!f) return;
    // Câmp nesalvat sau calc → nu există date la clienți; scoatere locală directă.
    if (newKeys.has(f.key) || f.control === 'calc') { removeFieldLocal(zi, fi); return; }

    setMsg('');
    try {
      const r = await fetch('/api/admin/fisa-field', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: cur.variant, key: f.key, action: 'count' }),
      });
      if (r.status === 403) { setMsg('❌ Doar admin poate șterge câmpuri.'); return; }
      const j = await r.json().catch(() => ({ ok: false }));
      const count = j.ok ? (j.count as number) : 0;
      if (!count || count <= 0) {
        // Fără date completate la niciun client → scoatere directă + persistă (curățarea nu e necesară).
        removeFieldLocal(zi, fi);
        await persistRemoval(cur.variant, f.key);
        setMsg('✅ Câmp „' + f.label.replace(/:\s*$/, '') + '" șters (nu avea date completate).');
        return;
      }
      // Are date → modal cu opțiuni.
      setDel({ zi, fi, field: f, count, obsKey: findObsKeyInZone(zone, f.key), busy: false });
    } catch {
      setMsg('❌ Eroare la verificarea datelor câmpului.');
    }
  }

  // PATCH-ul care scoate cheia din template, permițând explicit ștergerea ei (datele sunt curățate).
  async function persistRemoval(variant: Variant, key: string) {
    const t = (variant === tab ? cur : tpl[variant]);
    if (!t) return;
    // Construiește zonele FĂRĂ câmpul șters (în caz că removeFieldLocal nu s-a propagat încă în state).
    const zones = t.zones.map(z => ({ ...z, fields: z.fields.filter(f => f.key !== key) }));
    const r = await fetch('/api/admin/fisa-template', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant, titlu: t.titlu, zones, allowRemoveKeys: [key] }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: 'Răspuns invalid' }));
    if (!j.ok) { setMsg('❌ ' + (j.error || 'Eroare la salvarea formatului')); return; }
    // Reflectă în UI (state) + scoate din newKeys.
    setTpl(prev => ({ ...prev, [variant]: { ...t, zones } }));
    setNewKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  // Confirmarea din modal: 'delete-hard' sau 'delete-to-obs'.
  async function confirmDelete(action: 'delete-hard' | 'delete-to-obs') {
    if (!del || !cur) return;
    setDel(d => d ? { ...d, busy: true } : d);
    const f = del.field;
    try {
      const r = await fetch('/api/admin/fisa-field', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant: cur.variant, key: f.key, action,
          obsKey: action === 'delete-to-obs' ? del.obsKey : undefined,
          label: f.label,
        }),
      });
      if (r.status === 403) { setMsg('❌ Doar admin poate șterge câmpuri.'); setDel(null); return; }
      const j = await r.json().catch(() => ({ ok: false, error: 'Răspuns invalid' }));
      if (!j.ok) { setMsg('❌ ' + (j.error || 'Eroare la ștergere')); setDel(d => d ? { ...d, busy: false } : d); return; }
      // Date curățate → scoate câmpul din template + persistă.
      removeFieldLocal(del.zi, del.fi);
      await persistRemoval(cur.variant, f.key);
      const lbl = f.label.replace(/:\s*$/, '');
      setMsg(action === 'delete-hard'
        ? '✅ Câmp „' + lbl + '" șters definitiv (' + j.affected + ' lucrări curățate, inclusiv arhiva).'
        : '✅ Câmp „' + lbl + '" șters; datele a ' + j.affected + ' lucrări salvate în Observații.');
      setDel(null);
    } catch {
      setMsg('❌ Eroare la ștergere.');
      setDel(d => d ? { ...d, busy: false } : d);
    }
  }

  async function save() {
    if (!cur) return;
    setMsg(''); setSaving(true);
    const r = await fetch('/api/admin/fisa-template', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: cur.variant, titlu: cur.titlu, zones: cur.zones }),
    });
    if (r.status === 403) { setMsg('❌ Doar admin poate salva formatul fișei.'); setSaving(false); return; }
    const j = await r.json().catch(() => ({ ok: false, error: 'Răspuns invalid' }));
    if (j.ok) setNewKeys(new Set());
    setMsg(j.ok ? '✅ Format ' + cur.variant + ' salvat.' : '❌ ' + (j.error || 'Eroare la salvare'));
    setSaving(false);
  }

  // ── RESETARE la structura implicită (SEED) — suprascrie varianta curentă cu seed-ul. ──
  // Cheile prezente acum dar absente din SEED (câmpuri custom) ar fi orfanizate → le trecem în
  // allowRemoveKeys (adminul confirmă explicit). Câmpurile DIN seed care lipseau revin.
  async function resetToSeed() {
    if (!cur) return;
    if (!window.confirm(
      'Resetezi formatul ' + cur.variant + ' la structura IMPLICITĂ?\n\n' +
      'Câmpurile pe care le-ai adăugat manual și nu există în structura standard vor fi SCOASE din fișă ' +
      '(datele lor rămân în baza de date, dar câmpul nu va mai fi afișat). Acțiunea suprascrie aranjarea curentă.'
    )) return;
    const seed = SEEDS[cur.variant];
    const curKeys = new Set<string>();
    for (const z of cur.zones) for (const f of z.fields) curKeys.add(f.key);
    const seedKeys = new Set<string>();
    for (const z of seed.zones) for (const f of z.fields) seedKeys.add(f.key);
    const allowRemoveKeys = [...curKeys].filter(k => !seedKeys.has(k));

    setMsg(''); setSaving(true);
    const r = await fetch('/api/admin/fisa-template', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant: seed.variant, titlu: seed.titlu, zones: seed.zones, allowRemoveKeys }),
    });
    if (r.status === 403) { setMsg('❌ Doar admin poate reseta formatul.'); setSaving(false); return; }
    const j = await r.json().catch(() => ({ ok: false, error: 'Răspuns invalid' }));
    if (j.ok) {
      // Reflectă seed-ul în UI (copie nouă imutabilă).
      setTpl(prev => ({ ...prev, [cur.variant]: JSON.parse(JSON.stringify(seed)) }));
      setNewKeys(new Set());
      setMsg('✅ Format ' + cur.variant + ' resetat la structura implicită.');
    } else {
      setMsg('❌ ' + (j.error || 'Eroare la resetare'));
    }
    setSaving(false);
  }

  if (forbidden) {
    return (
      <Layout>
        <div className="card p-10 text-center text-[var(--fg-soft)]">
          <div className="text-[18px] font-semibold text-[var(--text)] mb-1">Acces restricționat</div>
          Doar administratorul poate edita formatul fișei.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-[26px] mb-1 rise">Format fișă</h1>
      <p className="text-[var(--fg-soft)] text-[13px] mb-5 rise">
        Editezi <b>structura fișei de strategie</b> (etichete, tipuri de câmp, opțiuni, ordine). Modificările se aplică <b>tuturor agenților</b>.
        În dreapta vezi <b>previzualizarea live</b> a fișei, exact cum o văd agenții. Cheia de stocare a fiecărui câmp e fixă,
        iar câmpurile <b>calculate</b> au formulă fixă și nu se editează.
      </p>

      {/* Taburi variante + acțiuni globale sus */}
      <div className="flex items-center gap-2 mb-4 rise flex-wrap">
        <span className="kpi-label">Variantă:</span>
        <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--border)] overflow-hidden">
          {(['V1', 'V2'] as Variant[]).map((v, idx) => (
            <button key={v} type="button" onClick={() => { setTab(v); setMsg(''); setDel(null); }}
              className={'px-3 py-1 text-[12px] font-semibold transition-colors ' + (idx > 0 ? 'border-l border-[var(--border)] ' : '')
                + (tab === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg-soft)] hover:text-[var(--text)]')}>
              {v === 'V1' ? 'V1 (construcție)' : 'V2 (casă locuită)'}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={resetToSeed} disabled={saving || loading || !cur}
          className="btn btn-secondary !text-[12px] disabled:opacity-50" title="Suprascrie formatul curent cu structura standard">
          ↺ Resetează la structura implicită
        </button>
        <button type="button" onClick={save} disabled={saving || loading || !cur} className="btn btn-primary disabled:opacity-60">
          {saving ? 'Se salvează…' : 'Salvează ' + tab}
        </button>
      </div>

      {msg && <div className={'toast mb-3 ' + (msg.startsWith('✅') ? 'toast-ok' : 'toast-err')}>{msg}</div>}

      {loading || !cur ? (
        <div className="card p-10 text-center text-[var(--fg-soft)]">Se încarcă formatul…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* ── STÂNGA: editor ── */}
          <div>
            <div className="card p-5 rise rise-1 mb-4">
              <label className="kpi-label block mb-1">Titlu fișă ({cur.variant})</label>
              <input className="field" value={cur.titlu} onChange={e => update(t => ({ ...t, titlu: e.target.value }))} />
            </div>

            <div className="space-y-4">
              {cur.zones.map((z, zi) => (
                <div key={z.id || zi} className="card p-5 rise rise-2">
                  <div className="flex items-center gap-2 mb-3">
                    <input className="field !text-[15px] font-semibold flex-1" value={z.titlu}
                      onChange={e => setZoneTitle(zi, e.target.value)} placeholder="Titlu zonă" />
                    <button type="button" onClick={() => moveZone(zi, -1)} disabled={zi === 0}
                      className="btn btn-secondary !py-1 !px-2 !text-[12px] disabled:opacity-40" title="Mută zona sus">↑</button>
                    <button type="button" onClick={() => moveZone(zi, 1)} disabled={zi === cur.zones.length - 1}
                      className="btn btn-secondary !py-1 !px-2 !text-[12px] disabled:opacity-40" title="Mută zona jos">↓</button>
                    <button type="button" onClick={() => removeZone(zi)}
                      className="btn btn-secondary !py-1 !px-2 !text-[11px] whitespace-nowrap">Șterge zona</button>
                  </div>

                  <div className="space-y-3">
                    {z.fields.map((f, fi) => {
                      const isCalc = f.control === 'calc';
                      const hasOptions = f.control === 'dropdown' || f.control === 'multiselect';
                      const isNewField = newKeys.has(f.key);
                      return (
                        <div key={(z.id || zi) + '-' + fi} className="border border-[var(--border)] rounded-[var(--r-sm)] p-3 bg-[var(--surface-2)]">
                          <div className="flex items-start gap-3 flex-wrap">
                            <div className="flex-1 min-w-[180px]">
                              <label className="kpi-label block mb-1">Etichetă</label>
                              <input className="field" value={f.label} onChange={e => setField(zi, fi, { label: e.target.value })} />
                            </div>
                            <div className="min-w-[140px]">
                              <label className="kpi-label block mb-1">Tip câmp</label>
                              <select className="field" value={f.control} disabled={isCalc}
                                onChange={e => setField(zi, fi, { control: e.target.value as FisaControl })}>
                                {CONTROLS.map(c => <option key={c.value} value={c.value} disabled={c.value === 'calc'}>{c.label}</option>)}
                              </select>
                            </div>
                            <div className="min-w-[140px]">
                              <label className="kpi-label block mb-1">Sursă</label>
                              <select className="field" value={f.source ?? 'manual'} disabled={isCalc}
                                onChange={e => setField(zi, fi, { source: e.target.value as FisaField['source'] })}>
                                {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </div>
                            <div className="flex items-end gap-1 pb-0.5 self-stretch">
                              <button type="button" onClick={() => moveField(zi, fi, -1)} disabled={fi === 0}
                                className="btn btn-secondary !py-1 !px-2 !text-[12px] disabled:opacity-40" title="Sus">↑</button>
                              <button type="button" onClick={() => moveField(zi, fi, 1)} disabled={fi === z.fields.length - 1}
                                className="btn btn-secondary !py-1 !px-2 !text-[12px] disabled:opacity-40" title="Jos">↓</button>
                              <button type="button" onClick={() => onRemoveField(zi, fi)}
                                className="btn btn-secondary !py-1 !px-2 !text-[11px]" title="Șterge câmpul">✕</button>
                            </div>
                          </div>

                          {hasOptions && (
                            <div className="mt-2">
                              <label className="kpi-label block mb-1">Opțiuni (una pe linie)</label>
                              <textarea className="field !h-auto" rows={Math.max(3, (f.options?.length ?? 0))}
                                value={(f.options ?? []).join('\n')}
                                onChange={e => setField(zi, fi, { options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} />
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-4 flex-wrap text-[11px]">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[var(--fg-soft)]">
                              <input type="checkbox" checked={!!f.full} onChange={e => setField(zi, fi, { full: e.target.checked })} />
                              Ocupă tot rândul
                            </label>
                            <span className="flex items-center gap-1.5 text-[var(--fg-faint)]">
                              <span>Cheie:</span>
                              {isNewField ? (
                                <>
                                  <input
                                    className="field !py-0.5 !px-1.5 !h-auto font-mono !text-[10px] !w-[160px]"
                                    value={f.key}
                                    placeholder="se generează din etichetă"
                                    title="Cheia de stocare a câmpului nou. După prima salvare nu se mai poate schimba (ar orfaniza datele)."
                                    onChange={e => setFieldKey(zi, fi, f.key, e.target.value)}
                                    onBlur={() => ensureFieldKey(zi, fi, f.key, f.label)}
                                  />
                                  <span className="text-[var(--fg-faint)]">editabilă doar până la prima salvare</span>
                                </>
                              ) : (
                                <>
                                  <input
                                    className="field !py-0.5 !px-1.5 !h-auto font-mono !text-[10px] !w-[160px] disabled:opacity-100 disabled:cursor-not-allowed"
                                    value={f.key}
                                    disabled
                                    title="Cheia nu se poate schimba după creare (ar orfaniza datele)"
                                  />
                                  <span title="Cheia nu se poate schimba după creare (ar orfaniza datele)">cheie de stocare — nu se schimbă</span>
                                </>
                              )}
                            </span>
                            {isCalc && (
                              <span className="pill pill-lucru text-[10px]">formulă fixă{f.calcKey ? ' · ' + f.calcKey : ''} (read-only)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <button type="button" onClick={() => addField(zi)} className="btn btn-secondary !py-1.5 !text-[12px]">
                      + Adaugă câmp
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addZone} className="btn btn-secondary">+ Adaugă zonă</button>
            </div>
          </div>

          {/* ── DREAPTA: previzualizare live (sticky) ── */}
          <div className="xl:sticky xl:top-4">
            <FisaPreview tpl={cur} />
          </div>
        </div>
      )}

      {/* Modal ștergere câmp cu date (C) */}
      {del && cur && (
        <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="card !shadow-[var(--shadow-lg)] max-w-lg w-full p-6 rise">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-[17px] font-semibold pr-4">⚠ {del.count} lucrări au date completate în acest rând</h2>
              <button onClick={() => setDel(null)} className="btn btn-ghost btn-xs text-base" disabled={del.busy}>✕</button>
            </div>
            <p className="text-[13px] text-[var(--fg-soft)] mb-4">
              Câmpul <b>„{del.field.label.replace(/:\s*$/, '')}"</b> (cheie <span className="font-mono">{del.field.key}</span>)
              are date completate la <b>{del.count}</b> {del.count === 1 ? 'lucrare' : 'lucrări'}. Cum vrei să ștergi?
            </p>
            <div className="space-y-2">
              <button type="button" onClick={() => confirmDelete('delete-hard')} disabled={del.busy}
                className="btn btn-secondary w-full justify-start !text-left disabled:opacity-60">
                <span className="block">
                  <span className="font-semibold block">Șterge definitiv (inclusiv din arhivă)</span>
                  <span className="text-[11px] text-[var(--fg-faint)]">Datele dispar din toate lucrările și din toate snapshoturile de arhivă. Ireversibil.</span>
                </span>
              </button>
              {del.obsKey ? (
                <button type="button" onClick={() => confirmDelete('delete-to-obs')} disabled={del.busy}
                  className="btn btn-primary w-full justify-start !text-left disabled:opacity-60">
                  <span className="block">
                    <span className="font-semibold block">Șterge, dar salvează datele în Observații</span>
                    <span className="text-[11px] opacity-80">Valoarea fiecărei lucrări se mută în observațiile zonei (prefixată cu eticheta câmpului).</span>
                  </span>
                </button>
              ) : (
                <div className="text-[11px] text-[var(--fg-faint)] border border-dashed border-[var(--border)] rounded-[var(--r-sm)] p-2">
                  Zona nu are un câmp de observații → opțiunea „salvează în Observații" nu e disponibilă.
                </div>
              )}
            </div>
            <div className="flex justify-end mt-4">
              <button type="button" onClick={() => setDel(null)} disabled={del.busy} className="btn btn-secondary !text-[12px]">
                {del.busy ? 'Se procesează…' : 'Anulează'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── PREVIZUALIZARE LIVE (WYSIWYG) — randează fișa EXACT ca pagina de strategie reală, read-only. ──
// Reutilizează clasele design globale .fz/.frow/.fstat/.chipset. Date demo (DEMO_FORM), calc demo.
function FisaPreview({ tpl }: { tpl: FisaTemplateData }) {
  const calc = useMemo(() => calculate({
    suprafata: DEMO_FORM.suprafata,
    putere_pftv: DEMO_FORM.putere_pftv,
    prod_aplicatie: DEMO_FORM.prod_aplicatie,
    suma: tpl.variant === 'V1' ? DEMO_FORM.ca_cost_lunar : DEMO_FORM.suma,
    consum_unitate: DEMO_FORM.consum_unitate,
    sistem_actual: tpl.variant === 'V1' ? DEMO_FORM.ca_sistem : DEMO_FORM.sistem_actual,
    bransament: DEMO_FORM.bransament,
  }), [tpl.variant]);

  // Zona „strategie & nevoi" se afișează ca bloc dedicat full-width (ca în fișa reală).
  const gridZones = tpl.zones.filter(z => !z.fields.some(f => f.key === 'strategie_nevoi'));
  const nevoiZone = tpl.zones.find(z => z.fields.some(f => f.key === 'strategie_nevoi'));

  return (
    <div className="card p-4 rise rise-1">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="kpi-label">Previzualizare live (cum o văd agenții)</span>
        <span className="pill pill-lucru text-[10px]">read-only · date demo</span>
      </div>
      {/* Container fișei (clasă .fisa pt scoping) */}
      <div className="fisa">
        <div className="fisa__title" style={{ marginBottom: 'var(--sp-3)' }}>
          <h1 style={{ fontSize: '1.05rem' }}>{tpl.titlu}</h1>
        </div>
        <div className="fisa__grid">
          {gridZones.map((zone, zi) => (
            <PZone key={zone.id || zi} title={zone.titlu} auto={zone.id === 'zamass'}>
              {zone.fields.map((f, fi) => <PField key={(zone.id || zi) + '-' + fi} f={f} calc={calc} />)}
            </PZone>
          ))}
        </div>
        {nevoiZone && (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <PZone title={nevoiZone.titlu}>
              <textarea className="input fisa__notes" rows={4} readOnly value={DEMO_FORM.strategie_nevoi}
                style={{ pointerEvents: 'none' }} />
            </PZone>
          </div>
        )}
      </div>
    </div>
  );
}

// Zonă preview = .fz card (auto-calc → .fz--auto + badge „AUTO").
function PZone({ title, children, auto }: { title: string; children: React.ReactNode; auto?: boolean }) {
  return (
    <section className={'fz card' + (auto ? ' fz--auto' : '')}>
      <header className="fz__head">
        <span className={'fz__dot' + (auto ? '' : ' is-accent')} />
        <h3>{title}</h3>
        {auto && <span className="fz__autobadge">AUTO</span>}
      </header>
      <div className="fz__body">{children}</div>
    </section>
  );
}

// Câmp preview, randat după control, read-only (doar aspect), cu date demo.
function PField({ f, calc }: { f: FisaField; calc: any }) {
  const label = f.label.replace(/:\s*$/, '');
  const v = DEMO_FORM[f.key];

  switch (f.control) {
    case 'calc': {
      const cv = f.calcKey ? calc[f.calcKey] : null;
      const display = typeof cv === 'number'
        ? cv.toLocaleString('ro-RO')
        : (typeof cv === 'string' && cv ? cv : '—');
      return (
        <div className="fstat">
          <span className="fstat__l">{label}</span>
          <span className="fstat__v mono">{display}</span>
        </div>
      );
    }
    case 'textarea':
      return (
        <div className="frow frow--col">
          <span className="frow__l">{label}</span>
          <textarea className="input" rows={2} readOnly value={v ?? ''} style={{ pointerEvents: 'none' }} />
        </div>
      );
    case 'multiselect': {
      const sel = asMulti(v);
      const opts = f.options ?? [];
      const all = [...opts.slice(0, 8)];
      // include selectate demo care nu-s în primele 8
      for (const s of sel) if (!all.includes(s)) all.unshift(s);
      return (
        <div className="frow frow--col">
          <span className="frow__l">{label}</span>
          <div className="chipset">
            {all.map(o => (
              <span key={o} className={'chipset__c' + (sel.includes(o) ? ' is-on' : '')} style={{ cursor: 'default' }}>{o}</span>
            ))}
          </div>
        </div>
      );
    }
    case 'dropdown': {
      const val = v ?? (f.options && f.options[0]) ?? '';
      return (
        <label className="frow">
          <span className="frow__l">{label}</span>
          <div className="frow__c">
            <select className="select" value={String(val)} disabled style={{ pointerEvents: 'none' }}>
              <option>{String(val) || '—'}</option>
            </select>
          </div>
        </label>
      );
    }
    case 'number':
    case 'text':
    default:
      return (
        <label className="frow">
          <span className="frow__l">{label}</span>
          <div className="frow__c">
            <input className="input" readOnly value={v ?? ''} style={{ pointerEvents: 'none' }} />
          </div>
        </label>
      );
  }
}
