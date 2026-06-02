'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import type { FisaControl, FisaField, FisaZone, FisaTemplateData } from '@/lib/fisa-template';

// ── Editor de admin pentru FORMATUL fișei (template V1/V2) ──
// Adminul editează label/control/opțiuni/source/full + ordinea câmpurilor și zonelor.
// `key` rămâne READ-ONLY (cheia de stocare — schimbarea ar orfaniza datele existente).
// Câmpurile control='calc' au formulă fixă (calcKey) → read-only, nu se editează.
// GET /api/admin/fisa-template la load; PATCH per tab (variant) la Salvează.

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

// Generează un id de zonă unic (nu se afișează, doar pentru cheia de randare).
function newZoneId() { return 'z' + Math.random().toString(36).slice(2, 8); }
// Generează un key nou pentru un câmp manual adăugat (cheie de stocare, vizibilă read-only).
function newFieldKey() { return 'camp_' + Math.random().toString(36).slice(2, 8); }

export default function AdminFisaPage() {
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Variant>('V1');
  const [tpl, setTpl] = useState<Record<Variant, FisaTemplateData | null>>({ V1: null, V2: null });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/fisa-template');
    if (r.status === 403 || r.status === 401) { setForbidden(true); setLoading(false); return; }
    const j = await r.json();
    if (j.ok) setTpl({ V1: j.templates.V1, V2: j.templates.V2 });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const cur = tpl[tab];

  // Helper: aplică o transformare imutabilă pe template-ul tab-ului curent.
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
    setZones(zs => zs.map((z, i) => i !== zi ? z : { ...z, fields: [...z.fields, f] }));
  }
  function removeField(zi: number, fi: number) {
    setZones(zs => zs.map((z, i) => i !== zi ? z : { ...z, fields: z.fields.filter((_, k) => k !== fi) }));
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
    setMsg(j.ok ? '✅ Format ' + cur.variant + ' salvat.' : '❌ ' + (j.error || 'Eroare la salvare'));
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
        Cheia de stocare a fiecărui câmp e fixă, iar câmpurile <b>calculate</b> au formulă fixă și nu se editează.
      </p>

      {/* Taburi variante */}
      <div className="flex items-center gap-2 mb-4 rise">
        <span className="kpi-label">Variantă:</span>
        <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--border)] overflow-hidden">
          {(['V1', 'V2'] as Variant[]).map((v, idx) => (
            <button key={v} type="button" onClick={() => { setTab(v); setMsg(''); }}
              className={'px-3 py-1 text-[12px] font-semibold transition-colors ' + (idx > 0 ? 'border-l border-[var(--border)] ' : '')
                + (tab === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg-soft)] hover:text-[var(--text)]')}>
              {v === 'V1' ? 'V1 (construcție)' : 'V2 (casă locuită)'}
            </button>
          ))}
        </div>
      </div>

      {loading || !cur ? (
        <div className="card p-10 text-center text-[var(--fg-soft)]">Se încarcă formatul…</div>
      ) : (
        <>
          {/* Titlu fișă (editabil) */}
          <div className="card p-5 rise rise-1 mb-4">
            <label className="kpi-label block mb-1">Titlu fișă ({cur.variant})</label>
            <input className="field" value={cur.titlu} onChange={e => update(t => ({ ...t, titlu: e.target.value }))} />
          </div>

          {/* Zone */}
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

                {/* Câmpuri */}
                <div className="space-y-3">
                  {z.fields.map((f, fi) => {
                    const isCalc = f.control === 'calc';
                    const hasOptions = f.control === 'dropdown' || f.control === 'multiselect';
                    return (
                      <div key={f.key} className="border border-[var(--border)] rounded-[var(--r-sm)] p-3 bg-[var(--surface-2)]">
                        <div className="flex items-start gap-3 flex-wrap">
                          {/* Label */}
                          <div className="flex-1 min-w-[200px]">
                            <label className="kpi-label block mb-1">Etichetă</label>
                            <input className="field" value={f.label} onChange={e => setField(zi, fi, { label: e.target.value })} />
                          </div>
                          {/* Control */}
                          <div className="min-w-[150px]">
                            <label className="kpi-label block mb-1">Tip câmp</label>
                            <select className="field" value={f.control} disabled={isCalc}
                              onChange={e => setField(zi, fi, { control: e.target.value as FisaControl })}>
                              {CONTROLS.map(c => <option key={c.value} value={c.value} disabled={c.value === 'calc'}>{c.label}</option>)}
                            </select>
                          </div>
                          {/* Source */}
                          <div className="min-w-[150px]">
                            <label className="kpi-label block mb-1">Sursă</label>
                            <select className="field" value={f.source ?? 'manual'} disabled={isCalc}
                              onChange={e => setField(zi, fi, { source: e.target.value as FisaField['source'] })}>
                              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          {/* Acțiuni câmp */}
                          <div className="flex items-end gap-1 pb-0.5 self-stretch">
                            <button type="button" onClick={() => moveField(zi, fi, -1)} disabled={fi === 0}
                              className="btn btn-secondary !py-1 !px-2 !text-[12px] disabled:opacity-40" title="Sus">↑</button>
                            <button type="button" onClick={() => moveField(zi, fi, 1)} disabled={fi === z.fields.length - 1}
                              className="btn btn-secondary !py-1 !px-2 !text-[12px] disabled:opacity-40" title="Jos">↓</button>
                            <button type="button" onClick={() => removeField(zi, fi)}
                              className="btn btn-secondary !py-1 !px-2 !text-[11px]" title="Șterge câmpul">✕</button>
                          </div>
                        </div>

                        {/* Opțiuni — doar pentru dropdown/multiselect */}
                        {hasOptions && (
                          <div className="mt-2">
                            <label className="kpi-label block mb-1">Opțiuni (una pe linie)</label>
                            <textarea className="field !h-auto" rows={Math.max(3, (f.options?.length ?? 0))}
                              value={(f.options ?? []).join('\n')}
                              onChange={e => setField(zi, fi, { options: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} />
                          </div>
                        )}

                        {/* Rând opțiuni meta: full + key + nota calc */}
                        <div className="mt-2 flex items-center gap-4 flex-wrap text-[11px]">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[var(--fg-soft)]">
                            <input type="checkbox" checked={!!f.full} onChange={e => setField(zi, fi, { full: e.target.checked })} />
                            Ocupă tot rândul
                          </label>
                          <span className="text-[var(--fg-faint)]">
                            <span className="font-mono text-[10px] bg-[var(--bg)] border border-[var(--border)] rounded px-1.5 py-0.5">{f.key}</span>
                            <span className="ml-1">cheie de stocare — nu se schimbă</span>
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
          </div>

          {/* Acțiuni globale */}
          <div className="flex items-center gap-2 mt-4 flex-wrap rise">
            <button type="button" onClick={addZone} className="btn btn-secondary">+ Adaugă zonă</button>
            <div className="flex-1" />
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary disabled:opacity-60">
              {saving ? 'Se salvează…' : 'Salvează ' + cur.variant}
            </button>
          </div>

          {msg && <div className={'toast mt-3 ' + (msg.startsWith('✅') ? 'toast-ok' : 'toast-err')}>{msg}</div>}
        </>
      )}
    </Layout>
  );
}
