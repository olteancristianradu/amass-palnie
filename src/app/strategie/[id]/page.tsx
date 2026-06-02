'use client';
import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { calculate, type StrategieInput } from '@/lib/strategie-calc';
import { parseObservatii } from '@/lib/strategie-autofill';
import { buildEmail } from '@/lib/email-redactare';
import { asMulti, type FisaTemplateData, type FisaField } from '@/lib/fisa-template';
import { SEED_V1, SEED_V2 } from '@/lib/fisa-template-seed';
import { useParams } from 'next/navigation';
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);

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
          fillEmpty('ca_sistem', parsed.sistem_actual);
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

  function set(key: string, val: any) { setForm(prev => ({ ...prev, [key]: val })); }

  // Randare dinamică a unui câmp din template, în funcție de control.
  // Câmpurile stau într-o coloană (space-y-2), deci ocupă deja toată lățimea cardului (f.full = informativ).
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
    setSaving(true); setMsg('');
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
    setSaving(false);
    setMsg(j.ok ? '✅ Salvat (+ snapshot arhivă)' : '❌ ' + j.error);
  }

  async function pushInCRM() {
    if (!client) return;
    setMsg('⏳ Push observații în CRM...');
    const obs = [
      'STRATEGIE - ' + (form.strategie_nevoi || ''),
      'Suprafata: ' + (form.suprafata || ''),
      'Bransament: ' + (form.bransament || ''),
      'PFTV: ' + (form.putere_pftv || ''),
      'Consum PFTV (aplicatie): ' + (form.consum_pftv_aplicatie || ''),
      'Sistem actual: ' + (form.sistem_actual || ''),
      'Cost lunar: ' + (form.suma || ''),
      'Preventie (sistem/brand): ' + (form.preventie || '') + (form.obs_preventie ? ' - ' + form.obs_preventie : ''),
      'Observatii: ' + (form.obs_situatie || ''),
      '---',
      client.observatii || ''
    ].join('\n');
    const r = await fetch('/api/crm/push-info', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idLucrare: client.idLucrare, observatii: obs })
    });
    const j = await r.json();
    setMsg(j.ok ? '✅ Observații împinse în CRM' : '❌ ' + j.error);
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

  if (!client || !template) return <Layout><div className="card p-10 text-center text-[var(--fg-soft)]">Se încarcă fișa…</div></Layout>;

  const email = buildEmail({
    nume: client.nume, localitate: client.localitate ?? '',
    categorie: client.categorie + (client.isDT ? ' DT' : ''), isDT: client.isDT,
    judet: client.judet ?? undefined, telefon: client.telefon ?? undefined,
    email: client.email ?? undefined, sursa: client.sursa ?? undefined,
    v: form, f: calc
  });

  return (
    <Layout>
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3 rise">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link href="/palnie" className="btn btn-ghost btn-xs">← Pâlnie</Link>
            <span className={'pill ' + (client.categorie === 1 ? 'pill-amanat' : 'pill-lucru')}>
              {client.categorie === 1 ? 'V1 · construcție' : 'V2 · casă locuită'} (cat {client.categorie}{client.isDT ? ' DT' : ''})
            </span>
            <span className="text-[11px] text-[var(--fg-faint)]">Stadiu:</span>
            <select
              className={'pill border-0 cursor-pointer ' + (
                client.stadiu === 'Anulat' ? 'pill-anulat' : client.stadiu === 'Contractat' ? 'pill-contractat' :
                client.stadiu === 'Amanat' ? 'pill-amanat' : client.stadiu === 'Finalizat' ? 'pill-finalizat' : 'pill-lucru')}
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
          <h1 className="text-[24px] leading-tight">{client.nume}{client.localitate && <span className="text-[var(--fg-soft)] font-normal"> · {client.localitate}</span>}</h1>
          <p className="text-[12px] text-[var(--fg-faint)] mt-1 font-mono">
            #{client.idLucrare}{client.judet ? ' · ' + client.judet : ''}{client.telefon ? ' · ' + client.telefon : ''}{client.email ? ' · ' + client.email : ''}
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? '…' : '✔ Salvează'}</button>
          <button onClick={pushInCRM} className="btn btn-pine">↗ Push CRM</button>
          <button onClick={() => setEmailOpen(true)} className="btn btn-secondary">Email</button>
          <button onClick={() => setReminderOpen(true)} className="btn btn-secondary">Reminder</button>
          <button onClick={downloadPDF} className="btn btn-secondary">PDF</button>
          <button onClick={downloadWord} className="btn btn-secondary">Word</button>
          <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${client.idLucrare}`}
             target="_blank" rel="noopener" className="btn btn-ghost">CRM ↗</a>
        </div>
      </div>

      {msg && <div className={'toast mb-4 ' + (msg.startsWith('✅') ? 'toast-ok' : msg.startsWith('❌') ? 'toast-err' : 'toast-info')}>{msg}</div>}

      {/* Fișă RANDATĂ DINAMIC din template (nu mai e hardcodată). Grid pe 2 coloane păstrat.
          Zona 'strategie_nevoi' rămâne în blocul dedicat full-width de mai jos. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 rise rise-1">
        {template.zones
          .filter(zone => !zone.fields.some(f => f.key === 'strategie_nevoi'))
          .map(zone => (
            <Zone key={zone.id} title={zone.titlu} pine={zone.id === 'zamass'}>
              {zone.fields.map(renderField)}
            </Zone>
          ))}
      </div>

      <div className="mt-4"><Zone title="Strategie & nevoi identificate / note diverse">
        <textarea className="field min-h-[140px]" value={form.strategie_nevoi ?? ''}
                  onChange={e => set('strategie_nevoi', e.target.value)}
                  placeholder="Notez aici nevoi, strategie, ce a spus clientul, observații..." />
      </Zone></div>

      {client.observatii && (
        <div className="mt-4"><Zone title="Observații CRM (read-only)">
          <pre className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap bg-[var(--paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--line)] max-h-44 overflow-y-auto scroll-area text-[var(--fg-soft)]">{client.observatii}</pre>
        </Zone></div>
      )}

      {emailOpen && <EmailModal email={email} clientId={client.id} onClose={() => setEmailOpen(false)} />}
      {reminderOpen && <ReminderModal client={client} onClose={() => setReminderOpen(false)} onDone={(m) => { setMsg(m); setReminderOpen(false); }} />}
    </Layout>
  );
}

// Indicator de completitudine a fișei — semnal vizual cât de „gata" e strategia.
function CompletenessBadge({ form }: { form: Record<string, any> }) {
  const keys = ['suprafata', 'bransament', 'sistem_actual', 'ca_sistem', 'putere_pftv', 'suma', 'ca_cost_lunar',
    'motiv_principal', 'nivel_bani', 'tipologie', 'tip_plata', 'strategie_nevoi', 'obs_situatie'];
  const present = keys.filter(k => { const v = form[k]; return v !== undefined && v !== null && String(v).trim() !== ''; }).length;
  const ratio = present / keys.length;
  if (ratio >= 0.6) return <span className="pill pill-contractat">✓ Strategie completă</span>;
  if (ratio >= 0.3) return <span className="pill pill-amanat">◐ În completare</span>;
  return <span className="pill pill-anulat">⚠ De completat</span>;
}

function Zone({ title, children, pine }: { title: string; children: React.ReactNode; pine?: boolean }) {
  return (
    <div className={'card p-5 ' + (pine ? 'panel-pine' : '')}>
      <div className="panel-head"><span className="dot" />{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', options, textarea }: {
  label: string; value: any; onChange: (v: any) => void; type?: string; options?: string[]; textarea?: boolean;
}) {
  return (
    <div className={textarea ? 'text-[12.5px]' : 'grid grid-cols-[170px_1fr] gap-2 items-center text-[12.5px]'}>
      <label className="text-[var(--fg-soft)]">{label}:</label>
      {textarea ? (
        <textarea className="field min-h-[64px] mt-1" value={value} onChange={e => onChange(e.target.value)} />
      ) : options ? (
        // Dacă valoarea curentă (ex. din date vechi) nu e în options, o injectăm ca să rămână vizibilă.
        <select className="field !py-1.5" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          {(value && !options.includes(String(value)) ? [String(value), ...options] : options)
            .map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      ) : (
        <input type={type} className="field !py-1.5" value={value}
               onChange={e => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)} />
      )}
    </div>
  );
}

// Selecție multiplă prin chip-uri toggle. Valoarea în form e string[]; click adaugă/scoate o opțiune.
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
    <div className="grid grid-cols-[170px_1fr] gap-2 items-start text-[12.5px]">
      <label className="text-[var(--fg-soft)] pt-1">{label}:</label>
      <div className="flex flex-wrap gap-1.5">
        {all.map(o => {
          const on = value.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)}
              className={'pill cursor-pointer border-0 ' + (on ? 'pill-contractat' : 'pill-lucru')}>
              {on ? '✓ ' : ''}{o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalcText({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-2 items-center text-[12.5px]">
      <span className="text-[var(--fg-soft)]">{label}:</span>
      <span className="font-semibold tabular">{value || '—'}</span>
    </div>
  );
}

function Calc({ label, value, unit, big }: { label: string; value: number | null; unit?: string; big?: boolean }) {
  return (
    <div className="grid grid-cols-[170px_1fr] gap-2 items-baseline text-[12.5px]">
      <span className="text-[var(--fg-soft)]">{label}:</span>
      <span className={'font-semibold tabular ' + (big ? 'font-display text-[18px] text-[var(--pine)]' : 'text-[var(--fg)]')}>
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
        <div className="toast toast-info mb-3 text-[12px]">
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

// Coduri tip CRM reale (din RemindereDialog.html). TELEFON=8, NU 0.
const TIP_OPTIONS = [
  { v: '8', l: '📞 TELEFON' }, { v: '9', l: '✉ EMAIL' }, { v: '10', l: '💬 SMS' },
  { v: '1', l: '🤝 ÎNTÂLNIRE' }, { v: '2', l: '🚗 DELEGAȚIE' }, { v: '4', l: 'ASISTENȚĂ' },
  { v: '5', l: 'SERVICE' }, { v: '6', l: 'MONTAJ' }, { v: '11', l: 'TRIMITERE OFERTĂ' },
  { v: '12', l: 'REDACTARE CONTRACT' }, { v: '13', l: 'ÎNTREBARE' }, { v: '14', l: 'RĂSPUNS' },
  { v: '16', l: 'ÎMPINGERE CONTRACT' }
];

function ReminderModal({ client, onClose, onDone }: { client: Client; onClose: () => void; onDone: (msg: string) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(today);
  const [ora, setOra] = useState('10:00');
  const [tip, setTip] = useState('8'); // TELEFON
  const [subtip, setSubtip] = useState('0');
  const [info, setInfo] = useState('');
  const [idContact, setIdContact] = useState('');
  const [contacte, setContacte] = useState<Array<{ idContact: string; nume: string; telefon: string; rol: string }>>([]);
  const [loadingContacte, setLoadingContacte] = useState(true);
  const [loading, setLoading] = useState(false);

  const needsSubtip = tip === '1' || tip === '2';

  useEffect(() => {
    fetch('/api/crm/contacte?idLucrare=' + client.idLucrare).then(r => r.json()).then(j => {
      if (j.ok) { setContacte(j.contacte); if (j.contacte[0]) setIdContact(j.contacte[0].idContact); }
      setLoadingContacte(false);
    }).catch(() => setLoadingContacte(false));
  }, [client.idLucrare]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (needsSubtip && (!subtip || subtip === '0')) { onDone('❌ Pentru ÎNTÂLNIRE/DELEGAȚIE alege subtipul'); return; }
    setLoading(true);
    const r = await fetch('/api/crm/reminder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idLucrare: client.idLucrare, idContact, data, ora, tip, subtip, info, notificare: 1 })
    });
    const j = await r.json();
    setLoading(false);
    onDone(j.ok ? '✅ Reminder salvat în CRM' : '❌ ' + j.error);
  }

  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <form onSubmit={submit} className="card !shadow-[var(--shadow-lg)] max-w-md w-full p-6 rise">
        <h2 className="text-lg mb-1">Adaugă reminder</h2>
        <p className="text-[12px] text-[var(--fg-soft)] mb-4">{client.nume} · merge live în CRM</p>
        <div className="grid grid-cols-[84px_1fr] gap-2.5 text-[12.5px] items-center">
          <label className="text-[var(--fg-soft)]">Contact</label>
          <select className="field" value={idContact} onChange={e => setIdContact(e.target.value)}>
            {loadingContacte && <option value="">se încarcă…</option>}
            {!loadingContacte && contacte.length === 0 && <option value="">(fără contacte)</option>}
            {contacte.map(c => <option key={c.idContact} value={c.idContact}>{c.nume}{c.telefon ? ' · ' + c.telefon : ''}{c.rol ? ' · ' + c.rol : ''}</option>)}
          </select>
          <label className="text-[var(--fg-soft)]">Data</label><input type="date" className="field" value={data} onChange={e => setData(e.target.value)} required />
          <label className="text-[var(--fg-soft)]">Ora</label><input type="time" className="field" value={ora} onChange={e => setOra(e.target.value)} />
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
          <label className="text-[var(--fg-soft)] self-start pt-1.5">Info</label><textarea className="field min-h-[100px]" value={info} onChange={e => setInfo(e.target.value)} placeholder="Notă reminder…" required />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="btn btn-secondary">Anulează</button>
          <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '…' : 'Salvează în CRM'}</button>
        </div>
      </form>
    </div>
  );
}
