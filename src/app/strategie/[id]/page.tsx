'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Icon } from '@/components/Icon';
import { calculate, type StrategieInput } from '@/lib/strategie-calc';
import { parseObservatii } from '@/lib/strategie-autofill';
import { buildEmail } from '@/lib/email-redactare';
import { buildInfoCrmText } from '@/lib/info-crm-text';
import { asMulti, type FisaTemplateData, type FisaField } from '@/lib/fisa-template';
import { SEED_V1, SEED_V2 } from '@/lib/fisa-template-seed';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Client {
  id: string;
  idLucrare: string;
  nume: string;
  localitate: string;
  judet: string | null;
  telefon: string | null;
  email: string | null;
  sursa: string | null;
  categorie: number;
  isDT: boolean;
  suprafata: number | null;
  stadiu: string | null;
  strategieV1: string | null;
  strategieV2: string | null;
  obsSituatie: string | null;
  strategieNevoi: string | null;
  observatii: string | null;
}

export default function StrategiePage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [template, setTemplate] = useState<FisaTemplateData | null>(null);
  // Indicator salvare automată: idle | saving | saved (afișat în .fisa__actions).
  // Înlocuiește vechiul state `saving` + butonul „✔ Salvează".
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [msg, setMsg] = useState('');
  // Refs pentru salvarea automată cu debounce: nu declanșăm la prima încărcare a form-ului,
  // doar după ce userul a editat efectiv ceva.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDirty = useRef(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [infoCrmOpen, setInfoCrmOpen] = useState(false);
  const [infoText, setInfoText] = useState('');
  const { data: session } = useSession();

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/clienti/${params.id}`).then(r => r.json()).then(j => {
      if (j.ok) {
        setClient(j.client);
        const stored = j.client.categorie === 1 ? j.client.strategieV1 : j.client.strategieV2;
        const base: Record<string, any> = {
          ...(stored ? JSON.parse(stored) : {}),
          suprafata: j.client.suprafata,
          obs_situatie: j.client.obsSituatie ?? '',
          strategie_nevoi: j.client.strategieNevoi ?? ''
        };
        // Autofill din Observatii CRM — parser portat 1:1 din Apps Script (strategie-autofill.ts).
        // FILL-ONLY-EMPTY: completăm doar câmpurile goale, nu suprascriem ce a pus agentul.
        const parsed = parseObservatii(j.client.observatii);
        const isV1 = j.client.categorie === 1;
        // helper: setează cheia DOAR dacă e goală în form și valoarea parsată e utilă.
        const fillEmpty = (key: string, val: any) => {
          const cur = base[key];
          const curEmpty = cur === undefined || cur === null || String(cur).trim() === '';
          const valOk = val !== undefined && val !== null && String(val).trim() !== '';
          if (curEmpty && valOk) base[key] = val;
        };
        // Câmpuri comune (V1 + V2): branșament + putere PFTV existentă.
        fillEmpty('bransament', parsed.bransament);
        fillEmpty('putere_pftv', parsed.puterePftv);
        // Alternative de încălzire (zona 04, comună ambelor variante).
        fillEmpty('alternativa', parsed.alternativa);
        if (isV1) {
          // V1 (construcție): sistemul/costul actual țin de CASA ACTUALĂ → ca_sistem / ca_cost_lunar.
          // mapare V1 (dropdown ca_sistem are etichete diferite de V2 — vezi mapSistemActualV1).
          fillEmpty('ca_sistem', parsed.sistem_actual_v1);
          fillEmpty('ca_cost_lunar', parsed.costLunar);
          fillEmpty('doreste_pftv', parsed.doresteOftv);
          fillEmpty('plata_esalonata', parsed.bugetAchizitie);
        } else {
          // V2 (casă locuită): mirror 1:1 arhivaV2AutofillDinCrm_ (sistem_actual / suma / consum_unitate).
          fillEmpty('sistem_actual', parsed.sistem_actual);
          fillEmpty('suma', parsed.costLunar);
          if (typeof parsed.costLunar === 'number' && parsed.costLunar > 0) {
            fillEmpty('consum_unitate', 'lei/luna');
          }
          fillEmpty('plata_esalonata', parsed.bugetAchizitie);
        }
        setForm(base);

        // Template-ul fișei (editabil de admin). Alegem după categorie: 1 -> V1, restul -> V2.
        // Fallback: dacă fetch-ul eșuează sau nu găsește varianta, folosim SEED-ul local.
        const seed = isV1 ? SEED_V1 : SEED_V2;
        const wantVariant = isV1 ? 'V1' : 'V2';
        fetch('/api/admin/fisa-template')
          .then(r => (r.ok ? r.json() : null))
          .then(t => {
            // Acceptăm mai multe forme de răspuns: array, {templates:[...]}, {template} sau template direct.
            const list: FisaTemplateData[] = Array.isArray(t) ? t
              : Array.isArray(t?.templates) ? t.templates
              : t?.template ? [t.template]
              : (t?.variant ? [t] : []);
            const tpl = list.find(x => x && x.variant === wantVariant);
            setTemplate(tpl || seed);
          })
          .catch(() => setTemplate(seed));
      }
    });
  }, [params?.id]);

  const isV1 = client?.categorie === 1;
  // V1 (construcție): costul actual vine din ca_cost_lunar (casa actuală), nu din suma.
  const calc = useMemo(() => calculate({
    suprafata: form.suprafata,
    putere_pftv: form.putere_pftv,
    prod_aplicatie: form.prod_aplicatie,
    suma: isV1 ? form.ca_cost_lunar : form.suma,
    consum_unitate: form.consum_unitate,
    sistem_actual: isV1 ? form.ca_sistem : form.sistem_actual,
    bransament: form.bransament
  } as StrategieInput), [form, isV1]);

  function set(key: string, val: any) {
    // Orice editare a userului marchează form-ul ca „dirty" → permite salvarea automată.
    formDirty.current = true;
    setForm(prev => ({ ...prev, [key]: val }));
  }

  // SALVARE AUTOMATĂ: la modificarea `form` (după ce userul a editat), debounce ~1200ms,
  // apoi apelăm save() existentă. NU declanșăm la prima încărcare (formDirty rămâne false).
  useEffect(() => {
    if (!formDirty.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { void save(); }, 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Curăță timerele la unmount.
  useEffect(() => () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // Randare dinamică a unui câmp din template, în funcție de control.
  // Câmpurile stau în corpul zonei (.fz__body), pe rânduri .frow (label stânga / control dreapta).
  function renderField(f: FisaField) {
    // Etichetele din template se termină în ':'; componentele adaugă tot ':' → tăiem dublura.
    const label = f.label.replace(/:\s*$/, '');
    switch (f.control) {
      case 'calc': {
        // Valoarea read-only vine din obiectul `calc` (prin calcKey).
        const v = f.calcKey ? (calc as any)[f.calcKey] : null;
        // String -> CalcText (intervale/text), numeric/null -> Calc.
        return typeof v === 'string'
          ? <CalcText key={f.key} label={label} value={v} />
          : <Calc key={f.key} label={label} value={typeof v === 'number' ? v : null} />;
      }
      case 'textarea':
        return <Field key={f.key} label={label} value={form[f.key] ?? ''} onChange={v => set(f.key, v)} textarea />;
      case 'multiselect':
        return <MultiSelect key={f.key} label={label} value={asMulti(form[f.key])} options={f.options ?? []} onChange={v => set(f.key, v)} />;
      case 'dropdown':
        // Prepend '' pentru opțiunea goală (ca înainte); Field păstrează valoarea curentă chiar dacă nu e în listă.
        return <Field key={f.key} label={label} value={form[f.key] ?? ''} onChange={v => set(f.key, v)} options={['', ...(f.options ?? [])]} />;
      case 'number':
        return <Field key={f.key} label={label} value={form[f.key] ?? ''} onChange={v => set(f.key, v)} type="number" />;
      case 'text':
      default:
        return <Field key={f.key} label={label} value={form[f.key] ?? ''} onChange={v => set(f.key, v)} />;
    }
  }

  async function save() {
    if (!client) return;
    setMsg('');
    // Indicator salvare automată: „⟳ Se salvează…" cât rulează PATCH-ul.
    if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; }
    setSaveState('saving');
    const key = client.categorie === 1 ? 'strategieV1' : 'strategieV2';
    const r = await fetch(`/api/clienti/${client.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [key]: form,
        suprafata: form.suprafata ? parseFloat(String(form.suprafata)) : null,
        obsSituatie: form.obs_situatie || null,
        strategieNevoi: form.strategie_nevoi || null
      })
    });
    const j = await r.json();
    // „✓ Salvat" ~2s, apoi revine la starea idle.
    if (j.ok) {
      setSaveState('saved');
      savedTimer.current = setTimeout(() => setSaveState('idle'), 2000);
    } else {
      setSaveState('idle');
    }
    setMsg(j.ok ? '✅ Salvat (+ snapshot arhivă)' : '❌ ' + j.error);
  }

  // INFO CRM: generează textul COMPLET din toată fișa (toate câmpurile + auto-calc, ca în spreadsheet)
  // și deschide un preview înainte de push. NU mai re-injectăm client.observatii în bloc —
  // replaceObsBlock (server) păstrează deja observațiile manuale ale agentului, în afara markerilor.
  function openInfoCrm() {
    if (!client || !template) return;
    const now = new Date();
    const p2 = (n: number) => String(n).padStart(2, '0');
    const stamp = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()} ${p2(now.getHours())}:${p2(now.getMinutes())}`;
    const userName = (session?.user as any)?.name || (session?.user as any)?.email || '';
    setInfoText(buildInfoCrmText(template, form, calc, { userName, now: stamp }));
    setInfoCrmOpen(true);
  }

  async function downloadPDF() {
    if (!client) return;
    setMsg('⏳ Generez PDF...');
    const r = await fetch('/api/export/pdf?id=' + client.id);
    if (r.status !== 200) { setMsg('❌ Eroare PDF'); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategie-' + client.idLucrare + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
    setMsg('✅ PDF descărcat');
  }

  async function downloadWord() {
    if (!client) return;
    setMsg('⏳ Generez Word...');
    const r = await fetch('/api/export/docx?id=' + client.id);
    if (r.status !== 200) { setMsg('❌ Eroare DOCX'); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategie-' + client.idLucrare + '.docx';
    a.click();
    URL.revokeObjectURL(url);
    setMsg('✅ Word descărcat');
  }

  if (!client || !template) {
    return (
      <Layout contentMod="content--fisa">
        <div className="fisa"><div className="empty-state">Se încarcă fișa…</div></div>
      </Layout>
    );
  }

  const email = buildEmail({
    nume: client.nume, localitate: client.localitate ?? '',
    categorie: client.categorie + (client.isDT ? ' DT' : ''), isDT: client.isDT,
    judet: client.judet ?? undefined, telefon: client.telefon ?? undefined,
    email: client.email ?? undefined, sursa: client.sursa ?? undefined,
    v: form, f: calc
  });

  return (
    <Layout contentMod="content--fisa" title={client.nume}>
      <div className="fisa rise">
        {/* ── breadcrumb + bară de acțiuni ── */}
        <header className="fisa__top">
          <div className="fisa__crumbs">
            <Link href="/palnie" className="crumb"><Icon name="chevL" size={14} />Pâlnie</Link>
            <span className="crumb-sep">·</span>
            <span className="crumb-tag">
              {client.categorie === 1 ? 'V1 — construcție' : 'V2 — casă locuită'} (cat {client.categorie}{client.isDT ? ' DT' : ''})
            </span>
            <span className="crumb-sep">·</span>
            <span className="crumb-muted">Stadiu:</span>
            <select
              className="cell-select"
              style={{ width: 'auto' }}
              value={client.stadiu ?? ''}
              onChange={async e => {
                const v = e.target.value;
                setClient({ ...client, stadiu: v || null });
                await fetch(`/api/clienti/${client.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stadiu: v || null }) });
                setMsg('✅ Stadiu actualizat: ' + (v || 'în lucru'));
              }}>
              {['', 'Anulat', 'Contractat', 'Amanat', 'Finalizat'].map(s => <option key={s} value={s}>{s || 'în lucru'}</option>)}
            </select>
            <CompletenessBadge form={form} />
          </div>
          {/* Bară de acțiuni — salvare automată + butoane colorate ca în design. */}
          <div className="fisa__actions">
            {/* Indicator salvare automată (înlocuiește butonul „✔ Salvează"). */}
            <span className={'autosave autosave--' + saveState} title="Modificările se salvează automat">
              {saveState === 'saving'
                ? <><Icon name="refresh" size={13} className="spin" />⟳ Se salvează…</>
                : <><Icon name="check" size={13} />{saveState === 'saved' ? '✓ Salvat' : 'Salvare automată'}</>}
            </span>
            <button onClick={openInfoCrm} className="btn btn-sm text-white" style={{ background: '#1e7a3c' }}>📋 INFO CRM</button>
            <button onClick={() => setReminderOpen(true)} className="btn btn-amber btn-sm">⏰ Reminder</button>
            <button onClick={() => setEmailOpen(true)} className="btn btn-sm text-white" style={{ background: '#3f7d4e' }}>✉ Email redactare</button>
            <button onClick={downloadPDF} className="btn btn-pdf btn-sm">📄 PDF</button>
            <button onClick={downloadWord} className="btn btn-word btn-sm">📝 Word</button>
            <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${client.idLucrare}`}
               target="_blank" rel="noopener" className="btn btn-secondary btn-sm">CRM ↗</a>
          </div>
        </header>

        {/* ── titlu: nume + oraș + id + contact ── */}
        <div className="fisa__title">
          <h1>{client.nume}</h1>
          {client.localitate && <span className="fisa__city">· {client.localitate}</span>}
          <span className="fisa__id mono">#{client.idLucrare}{client.judet ? ' · ' + client.judet : ''}</span>
          {(client.telefon || client.email) && (
            <div className="fisa__contact mono">
              <Icon name="phone" size={14} />
              {[client.telefon, client.email].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {msg && <div className={'toast mb-4 ' + (msg.startsWith('✅') ? 'toast--success' : msg.startsWith('❌') ? 'toast--error' : 'toast--info')}>{msg}</div>}

        {/* Fișă RANDATĂ DINAMIC din template. Grid pe 2 coloane.
            Zona 'strategie_nevoi' rămâne în blocul dedicat full-width de mai jos. */}
        <div className="fisa__grid">
          {template.zones
            .filter(zone => !zone.fields.some(f => f.key === 'strategie_nevoi'))
            .map(zone => (
              <Zone key={zone.id} title={zone.titlu} auto={zone.id === 'zamass'}>
                {zone.fields.map(renderField)}
              </Zone>
            ))}
        </div>

        <div style={{ marginTop: 'var(--sp-4)' }}>
          <Zone title="Strategie & nevoi identificate / note diverse">
            <textarea className="input fisa__notes" rows={5} value={form.strategie_nevoi ?? ''}
                      onChange={e => set('strategie_nevoi', e.target.value)}
                      placeholder="Notez aici nevoi, strategie, ce a spus clientul, observații..." />
          </Zone>
        </div>

        {client.observatii && (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <Zone title="Observații CRM (read-only)">
              <pre className="mono" style={{ fontSize: '11px', lineHeight: 1.55, whiteSpace: 'pre-wrap', background: 'var(--surface-sunk)', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', maxHeight: 176, overflowY: 'auto', color: 'var(--text-secondary)', margin: 0 }}>{client.observatii}</pre>
            </Zone>
          </div>
        )}
      </div>

      {emailOpen && <EmailModal email={email} clientId={client.id} onClose={() => setEmailOpen(false)} />}
      {reminderOpen && <ReminderModal client={client} onClose={() => setReminderOpen(false)} onDone={(m) => { setMsg(m); setReminderOpen(false); }} />}
      {infoCrmOpen && <InfoCrmModal client={client} text={infoText} setText={setInfoText} onClose={() => setInfoCrmOpen(false)} onDone={(m) => setMsg(m)} />}
    </Layout>
  );
}

// Indicator de completitudine a fișei — semnal vizual cât de „gata" e strategia.
// În noul design: badge-todo când fișa e prea goală, altfel un badge „completă/în completare".
function CompletenessBadge({ form }: { form: Record<string, any> }) {
  const keys = ['suprafata', 'bransament', 'sistem_actual', 'ca_sistem', 'putere_pftv', 'suma', 'ca_cost_lunar',
    'motiv_principal', 'nivel_bani', 'tipologie', 'tip_plata', 'strategie_nevoi', 'obs_situatie'];
  const present = keys.filter(k => { const v = form[k]; return v !== undefined && v !== null && String(v).trim() !== ''; }).length;
  const ratio = present / keys.length;
  if (ratio >= 0.6) return <span className="badge-todo" style={{ color: 'var(--success)', background: 'var(--success-soft)' }}><Icon name="check" size={12} />Strategie completă</span>;
  if (ratio >= 0.3) return <span className="badge-todo" style={{ color: 'var(--warning)', background: 'var(--warning-soft)' }}><Icon name="clock" size={12} />În completare</span>;
  return <span className="badge-todo"><Icon name="alert" size={12} />De completat</span>;
}

// Zonă = card .fz (design Claude). Zona auto-calc primește .fz--auto + badge „auto-calc".
function Zone({ title, children, auto }: { title: string; children: React.ReactNode; auto?: boolean }) {
  return (
    <section className={'fz card' + (auto ? ' fz--auto' : '')}>
      <header className="fz__head">
        <span className={'fz__dot' + (auto ? '' : ' is-accent')} />
        <h3>{title}</h3>
        {auto && <span className="fz__autobadge">auto-calc</span>}
      </header>
      <div className="fz__body">{children}</div>
    </section>
  );
}

// Câmp editabil — rând .frow (label / control). Textarea folosește .frow--col (full-width).
function Field({ label, value, onChange, type = 'text', options, textarea }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; options?: string[]; textarea?: boolean;
}) {
  if (textarea) {
    return (
      <div className="frow frow--col">
        <span className="frow__l">{label}</span>
        <textarea className="input" rows={3} value={value} onChange={e => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <label className="frow">
      <span className="frow__l">{label}</span>
      <div className="frow__c">
        {options ? (
          // Dacă valoarea curentă (ex. din date vechi) nu e în options, o injectăm ca să rămână vizibilă.
          <select className="select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
            {(value && !options.includes(String(value)) ? [String(value), ...options] : options)
              .map(o => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        ) : (
          <input type={type} className="input" value={value}
                 onChange={e => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)} />
        )}
      </div>
    </label>
  );
}

// Selecție multiplă prin chip-uri toggle (.chipset). Valoarea în form e string[]; click adaugă/scoate o opțiune.
function MultiSelect({ label, value, options, onChange }: {
  label: string; value: string[]; options: string[]; onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt]);
  }
  // Valori vechi care nu mai sunt în options rămân vizibile (selectate) ca să nu se piardă.
  const extra = value.filter(v => !options.includes(v));
  const all = [...options, ...extra];
  return (
    <div className="frow frow--col">
      <span className="frow__l">{label}</span>
      <div className="chipset">
        {all.map(o => (
          <button key={o} type="button" onClick={() => toggle(o)}
            className={'chipset__c' + (value.includes(o) ? ' is-on' : '')}>{o}</button>
        ))}
      </div>
    </div>
  );
}

// Valoare calculată text (intervale etc.) — rând .fstat read-only.
function CalcText({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="fstat">
      <span className="fstat__l">{label}</span>
      <span className="fstat__v mono">{value || '—'}</span>
    </div>
  );
}

// Valoare calculată numerică — rând .fstat read-only.
function Calc({ label, value, unit, big }: { label: string; value: number | null; unit?: string; big?: boolean }) {
  return (
    <div className="fstat">
      <span className="fstat__l">{label}</span>
      <span className={'fstat__v mono' + (big ? ' is-strong' : '')}>
        {value !== null ? (value.toLocaleString('ro-RO') + (unit ? ' ' + unit : '')) : '—'}
      </span>
    </div>
  );
}

function EmailModal({ email, clientId, onClose }: { email: any; clientId?: string; onClose: () => void }) {
  const [body, setBody] = useState(email.body);
  const [subject, setSubject] = useState(email.subject || '');
  const [to, setTo] = useState(email.to || '');
  const [cc, setCc] = useState(email.cc || '');
  const [status, setStatus] = useState('');
  const [outlookOn, setOutlookOn] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { fetch('/api/outlook/status').then(r => r.json()).then(o => setOutlookOn(!!(o.ok && o.connected))).catch(() => {}); }, []);
  async function sendViaOutlook() {
    setSending(true); setStatus('⏳ Trimit prin Outlook…');
    const r = await fetch('/api/outlook/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, cc, subject, html: body, clientId, attachPdf: true }) });
    const j = await r.json();
    setSending(false);
    setStatus(j.ok ? '✅ Email trimis prin Outlook (cu PDF atașat).' : '❌ ' + (j.error || 'eroare'));
  }
  const plain = () => body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  async function copyBody() {
    try {
      const blob = new Blob([body], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([plain()], { type: 'text/plain' }) })]);
      setStatus('✅ Body copiat cu format (bold păstrat la paste).');
    } catch {
      await navigator.clipboard.writeText(plain());
      setStatus('✅ Body copiat (plain text).');
    }
    setTimeout(() => setStatus(''), 3500);
  }
  // Deschide compose în Outlook web pre-completat (firmă = office.com / personal = live.com).
  // Nu necesită Azure; trimiterea automată din aplicație (Graph) e pasul următor (vezi roadmap).
  function openOutlook(host: 'office' | 'live') {
    const base = host === 'office'
      ? 'https://outlook.office.com/mail/deeplink/compose'
      : 'https://outlook.live.com/mail/0/deeplink/compose';
    const qs = new URLSearchParams({ to, cc, subject, body: plain() }).toString();
    window.open(base + '?' + qs, '_blank', 'noopener');
    setStatus('✅ Outlook deschis cu emailul pre-completat. Verifică și apasă Trimite în Outlook.');
    setTimeout(() => setStatus(''), 5000);
  }
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card !shadow-[var(--shadow-lg)] max-w-4xl w-full max-h-[90vh] overflow-y-auto scroll-area p-6 rise">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg">Email redactare deviz</h2>
          <button onClick={onClose} className="btn btn-ghost btn-xs text-base">✕</button>
        </div>
        <div className="toast toast--info mb-3 text-[12px]">
          Câmpurile <b>bold</b> le completezi manual. „Deschide în Outlook" pre-completează un email nou (firmă sau personal).
        </div>
        <div className="grid grid-cols-[64px_1fr] gap-2 mb-3 text-[12.5px] items-center">
          <label className="kpi-label">Subject</label><input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
          <label className="kpi-label">To</label><input className="field" value={to} onChange={e => setTo(e.target.value)} />
          <label className="kpi-label">Cc</label><input className="field" value={cc} onChange={e => setCc(e.target.value)} />
        </div>
        <div contentEditable className="field min-h-[360px] !text-[13px] leading-relaxed overflow-y-auto scroll-area"
             style={{ whiteSpace: 'pre-wrap' }}
             dangerouslySetInnerHTML={{ __html: body }}
             onBlur={e => setBody((e.target as HTMLDivElement).innerHTML)} />
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <span className="text-[12px] text-[var(--ok)] font-medium">{status}</span>
          <div className="flex gap-2 flex-wrap">
            {outlookOn && <button onClick={sendViaOutlook} disabled={sending} className="btn btn-primary">{sending ? '…' : '✈ Trimite prin Outlook (+PDF)'}</button>}
            <button onClick={() => openOutlook('office')} className="btn btn-pine">↗ Outlook firmă</button>
            <button onClick={() => openOutlook('live')} className="btn btn-secondary">↗ Outlook personal</button>
            <button onClick={copyBody} className="btn btn-secondary">Copiază body</button>
            <button onClick={onClose} className="btn btn-secondary">Închide</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal INFO CRM — preview text COMPLET (toate câmpurile fișei + auto-calc) înainte de push, ca în spreadsheet.
function InfoCrmModal({ client, text, setText, onClose, onDone }: {
  client: Client; text: string; setText: (s: string) => void; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [status, setStatus] = useState('');
  const [pushing, setPushing] = useState(false);
  async function pushNow() {
    setPushing(true); setStatus('⏳ Push în CRM…');
    try {
      const r = await fetch('/api/crm/push-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idLucrare: client.idLucrare, observatii: text })
      });
      const j = await r.json();
      if (j.ok) { setStatus('✅ Împins în CRM (' + (j.action || 'ok') + ').'); onDone('✅ Info împins în CRM'); }
      else { setStatus('❌ ' + (j.error || 'eroare')); }
    } catch (e: any) { setStatus('❌ ' + e.message); }
    setPushing(false);
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(text); setStatus('✅ Text copiat.'); }
    catch { setStatus('❌ Nu am putut copia.'); }
    setTimeout(() => setStatus(''), 3000);
  }
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card !shadow-[var(--shadow-lg)] max-w-3xl w-full max-h-[90vh] overflow-y-auto scroll-area p-6 rise">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg">📋 Info CRM — {client.nume}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-xs text-base">✕</button>
        </div>
        <p className="text-[11px] text-[var(--fg-faint)] mb-2 font-mono">id_lucrare = {client.idLucrare}</p>
        <div className="toast toast--info mb-3 text-[12px]">
          Push automat în Observații CRM (marker <b>══ STRATEGIE FISA ══</b> — observațiile manuale ale agentului rămân intacte). Poți edita textul înainte de push.
        </div>
        <textarea className="field w-full font-mono text-[11px] leading-relaxed min-h-[340px]" value={text} onChange={e => setText(e.target.value)} />
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <span className={'text-[12px] font-medium ' + (status.startsWith('✅') ? 'text-[var(--ok)]' : status.startsWith('❌') ? 'text-[var(--danger)]' : 'text-[var(--fg-soft)]')}>{status}</span>
          <div className="flex gap-2 flex-wrap">
            <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${client.idLucrare}`} target="_blank" rel="noopener" className="btn btn-secondary">↗ Deschide CRM</a>
            <button onClick={copyText} className="btn btn-secondary">📋 Copy text</button>
            <button onClick={pushNow} disabled={pushing} className="btn text-white" style={{ background: '#1e7a3c' }}>{pushing ? '…' : '↗ Push în CRM'}</button>
            <button onClick={onClose} className="btn btn-secondary">Închide</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Coduri tip CRM reale (din RemindereDialog.html). TELEFON=8, NU 0.
const TIP_OPTIONS = [
  { v: '8', l: '📞 TELEFON' }, { v: '9', l: '✉ EMAIL' }, { v: '10', l: '💬 SMS' },
  { v: '1', l: '🤝 ÎNTÂLNIRE' }, { v: '2', l: '🚗 DELEGAȚIE' }, { v: '4', l: 'ASISTENȚĂ' },
  { v: '5', l: 'SERVICE' }, { v: '6', l: 'MONTAJ' }, { v: '11', l: 'TRIMITERE OFERTĂ' },
  { v: '12', l: 'REDACTARE CONTRACT' }, { v: '13', l: 'ÎNTREBARE' }, { v: '14', l: 'RĂSPUNS' },
  { v: '16', l: 'ÎMPINGERE CONTRACT' }
];

// Sugestie de reminder pe baza stadiului (versiune inițială; se rafinează cu logica din spreadsheet).
function suggestReminder(stadiu: string | null): { titlu: string; info: string } {
  const s = (stadiu || '').toLowerCase();
  if (s.includes('contract')) return { titlu: 'Post-vânzare', info: 'Stadiu: Post-vânzare — clientul a semnat contractul\n\nDe aflat:\n• Plata eșalonată (formular)\n\nDe punctat:\n• ' };
  if (s.includes('anulat')) return { titlu: 'Reactivare', info: 'Stadiu: Anulat — de reactivat\n\nDe aflat:\n• ce a decis / ce l-a oprit\n\nDe punctat:\n• ' };
  if (s.includes('aman')) return { titlu: 'Revenire (amânat)', info: 'Stadiu: Amânat — revenire la termenul stabilit\n\nDe aflat:\n• dacă s-a schimbat situația\n\nDe punctat:\n• ' };
  if (s.includes('finalizat')) return { titlu: 'Follow-up final', info: 'Stadiu: Finalizat\n\nDe aflat:\n• satisfacție / recomandări\n\nDe punctat:\n• ' };
  return { titlu: 'Urmărire ofertă', info: 'Stadiu: în lucru\n\nDe aflat:\n• unde s-a blocat decizia\n\nDe punctat:\n• ' };
}

function ReminderModal({ client, onClose, onDone }: { client: Client; onClose: () => void; onDone: (msg: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [ora, setOra] = useState('10:00');
  const [durata, setDurata] = useState('30');
  const [notificare, setNotificare] = useState('1');
  const [tip, setTip] = useState('8'); // TELEFON
  const [subtip, setSubtip] = useState('0');
  const [info, setInfo] = useState('');
  const [idContact, setIdContact] = useState('');
  const [contacte, setContacte] = useState<Array<{ idContact: string; nume: string; telefon: string; rol: string }>>([]);
  const [loadingContacte, setLoadingContacte] = useState(true);
  const [existing, setExisting] = useState<Array<{ data: string; ora: string; tip: string; info: string; status: string }> | null>(null);
  const [loading, setLoading] = useState(false);

  const needsSubtip = tip === '1' || tip === '2';
  const suggestion = suggestReminder(client.stadiu);

  useEffect(() => {
    fetch('/api/crm/contacte?idLucrare=' + client.idLucrare).then(r => r.json()).then(j => {
      if (j.ok) { setContacte(j.contacte); if (j.contacte[0]) setIdContact(j.contacte[0].idContact); }
      setLoadingContacte(false);
    }).catch(() => setLoadingContacte(false));
    // Lista COMPLETĂ de remindere existente (panoul din dreapta, ca în spreadsheet).
    fetch('/api/crm/remindere?idLucrare=' + client.idLucrare).then(r => r.json())
      .then(j => setExisting(j.ok ? j.remindere : []))
      .catch(() => setExisting([]));
  }, [client.idLucrare]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsSubtip && (!subtip || subtip === '0')) { onDone('❌ Pentru ÎNTÂLNIRE/DELEGAȚIE alege subtipul'); return; }
    setLoading(true);
    const r = await fetch('/api/crm/reminder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idLucrare: client.idLucrare, idContact, data, ora, durata, tip, subtip, info, notificare })
    });
    const j = await r.json();
    setLoading(false);
    onDone(j.ok ? '✅ Reminder salvat în CRM' : '❌ ' + j.error);
  }

  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card !shadow-[var(--shadow-lg)] max-w-4xl w-full max-h-[90vh] overflow-y-auto scroll-area p-6 rise">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg">⏰ Reminder — {client.nume}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-xs text-base">✕</button>
        </div>
        <p className="text-[11px] text-[var(--fg-faint)] mb-4 font-mono">id_lucrare = {client.idLucrare} · merge live în CRM gestcom</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* STÂNGA: reminder nou */}
          <form onSubmit={submit}>
            <div className="panel-head"><span className="dot" />Reminder nou</div>
            <div className="grid grid-cols-[92px_1fr] gap-2.5 text-[12.5px] items-center">
              <label className="text-[var(--fg-soft)]">Contact</label>
              <select className="field" value={idContact} onChange={e => setIdContact(e.target.value)}>
                {loadingContacte && <option value="">se încarcă…</option>}
                {!loadingContacte && contacte.length === 0 && <option value="">(fără contacte)</option>}
                {contacte.map(c => <option key={c.idContact} value={c.idContact}>{c.nume}{c.telefon ? ' · ' + c.telefon : ''}{c.rol ? ' · ' + c.rol : ''}</option>)}
              </select>
              <label className="text-[var(--fg-soft)]">Tip</label>
              <select className="field" value={tip} onChange={e => setTip(e.target.value)}>
                {TIP_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              {needsSubtip && (<>
                <label className="text-[var(--fg-soft)]">Subtip</label>
                <select className="field" value={subtip} onChange={e => setSubtip(e.target.value)} required>
                  <option value="0">— alege —</option>
                  <option value="1">Prima întâlnire</option>
                  <option value="2">Revenire</option>
                  <option value="3">Semnare contract</option>
                  <option value="4">Tehnic / măsurători</option>
                </select>
              </>)}
              <label className="text-[var(--fg-soft)]">Data</label><input type="date" className="field" value={data} onChange={e => setData(e.target.value)} required />
              <label className="text-[var(--fg-soft)]">Ora</label><input type="time" className="field" value={ora} onChange={e => setOra(e.target.value)} />
              <label className="text-[var(--fg-soft)]">Durată (min)</label><input type="number" className="field" value={durata} onChange={e => setDurata(e.target.value)} />
              <label className="text-[var(--fg-soft)]">Notificare</label>
              <select className="field" value={notificare} onChange={e => setNotificare(e.target.value)}>
                <option value="0">fără</option>
                <option value="1">la timp</option>
                <option value="2">cu 1 oră înainte</option>
                <option value="3">cu 1 zi înainte</option>
              </select>
              <label className="text-[var(--fg-soft)] self-start pt-1.5">Info</label><textarea className="field min-h-[100px]" value={info} onChange={e => setInfo(e.target.value)} placeholder="Detalii reminder (obligatoriu)…" required />
            </div>
            <div className="toast toast--info mt-3 text-[12px]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <b>💡 Propunere: {suggestion.titlu}</b>
                <button type="button" onClick={() => setInfo(suggestion.info)} className="btn btn-secondary btn-xs">Populează info</button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-[var(--fg-soft)] m-0">{suggestion.info}</pre>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={onClose} className="btn btn-secondary">Anulează</button>
              <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '…' : 'Salvează în CRM'}</button>
            </div>
          </form>
          {/* DREAPTA: remindere existente */}
          <div>
            <div className="panel-head"><span className="dot" />Remindere existente</div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto scroll-area pr-1">
              {existing === null && <div className="text-[12px] text-[var(--fg-faint)]">se încarcă…</div>}
              {existing !== null && existing.length === 0 && <div className="text-[12px] text-[var(--fg-faint)]">(niciun reminder în CRM)</div>}
              {existing?.map((rem, i) => (
                <div key={i} className="border border-[var(--line)] rounded-[var(--radius-sm)] p-2.5 bg-[var(--paper)]">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold tabular">{rem.data}{rem.ora ? ' · ' + rem.ora : ''}</span>
                    <span className={'pill text-[10px] ' + (rem.status === 'executat' ? 'pill-contractat' : 'pill-lucru')}>{rem.status === 'executat' ? '✓ executat' : '○ deschis'}</span>
                  </div>
                  {rem.tip && <div className="text-[10px] text-[var(--fg-faint)] uppercase tracking-wide">{rem.tip}</div>}
                  {rem.info && <div className="text-[11.5px] text-[var(--fg-soft)] mt-0.5 whitespace-pre-wrap">{rem.info}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
