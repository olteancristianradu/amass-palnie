'use client';
import { useEffect, useState, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { calculate, type StrategieInput } from '@/lib/strategie-calc';
import { parseObservatii } from '@/lib/strategie-autofill';
import { buildEmail } from '@/lib/email-redactare';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// Dropdown-uri cu valori EXACTE din Apps Script FisaV2.js (aliniere mapping arhivă).
const SISTEM_OPTS = ['', 'CT gaz', 'CT lemne', 'CT peleti', 'CT electrica', 'Pompa caldura', 'Calorifere electrice', 'Aer conditionat', 'Soba', 'Nu are sistem'];
const MOTIV_OPTS = ['', 'Efort scazut', 'Confort termic', 'Economie financiara', 'Independenta energetica', 'Sanatate', 'Valoare imobil', 'Eco / mediu', 'Siguranta'];
const NIVEL_OPTS = ['', 'Necumpatat', 'Cumpatat', 'Smart', 'Lux'];
const TIPOLOGIE_OPTS = ['', 'Logic', 'Emotional', 'Vanator de pret', 'Nehotarat', 'Grabit', 'Increzator', 'Sceptic'];
const TIPPLATA_OPTS = ['', 'Integral', 'Esalonat', 'Mixt', 'Credit bancar', 'Nehotarat'];

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

  if (!client) return <Layout><div className="card p-10 text-center text-[var(--fg-soft)]">Se încarcă fișa…</div></Layout>;

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 rise rise-1">
        {isV1 ? (
          <Zone title="01 SITUAȚIA ACTUALĂ (proiect în construcție)">
            <Field label="Suprafață (mp)" value={form.suprafata ?? ''} onChange={v => set('suprafata', v)} type="number" />
            <Field label="Stadiu construcție" value={form.stadiu_constructie ?? ''} onChange={v => set('stadiu_constructie', v)} />
            <Field label="Când intră electricianul" value={form.cand_electrician ?? ''} onChange={v => set('cand_electrician', v)} />
            <Field label="Când toarnă șapele" value={form.cand_sape ?? ''} onChange={v => set('cand_sape', v)} />
            <Field label="Când estimează mutarea" value={form.cand_mutare ?? ''} onChange={v => set('cand_mutare', v)} />
            <Field label="Branșament" value={form.bransament ?? ''} onChange={v => set('bransament', v)} options={['', 'Monofazic', 'Trifazic', 'Nedecis']} />
            <Field label="Construcție / izolație / etaje" value={form.constructie_izolatie ?? ''} onChange={v => set('constructie_izolatie', v)} />
            <Field label="Dorește PFTV" value={form.doreste_pftv ?? ''} onChange={v => set('doreste_pftv', v)} options={['', 'Da', 'Nu', 'Nehotărât', 'De evaluat']} />
            <Field label="Putere PFTV existentă (kW)" value={form.putere_pftv ?? ''} onChange={v => set('putere_pftv', v)} type="number" />
            <Field label="Producție anuală PFTV (Aplicație)" value={form.prod_aplicatie ?? ''} onChange={v => set('prod_aplicatie', v)} type="number" />
          </Zone>
        ) : (
          <Zone title="01 SITUAȚIA ACTUALĂ">
            <Field label="Suprafață (mp)" value={form.suprafata ?? ''} onChange={v => set('suprafata', v)} type="number" />
            <Field label="Branșament" value={form.bransament ?? ''} onChange={v => set('bransament', v)} options={['', 'Monofazic', 'Trifazic', 'Nedecis']} />
            <Field label="Putere PFTV existentă (kW)" value={form.putere_pftv ?? ''} onChange={v => set('putere_pftv', v)} type="number" />
            <Field label="Producție anuală PFTV (Aplicație)" value={form.prod_aplicatie ?? ''} onChange={v => set('prod_aplicatie', v)} type="number" />
            <Field label="Consum anual PFTV (Aplicație)" value={form.consum_pftv_aplicatie ?? ''} onChange={v => set('consum_pftv_aplicatie', v)} type="number" />
            <Field label="Construcție / izolație / etaje" value={form.constructie ?? ''} onChange={v => set('constructie', v)} />
          </Zone>
        )}

        <Zone title="→ Cu sistemul AMASS (auto-calc)" pine>
          <Calc label="Putere necesară" value={calc.putere_necesara_kw} unit="kW" />
          <Calc label="Consum zilnic" value={calc.consum_zilnic_kwh} unit="kWh" />
          <Calc label="Consum lunar" value={calc.consum_lunar_kwh} unit="kWh" />
          <Calc label="Consum anual" value={calc.consum_anual_kwh} unit="kWh" />
          <Calc label="Necesar PFTV AMASS" value={calc.necesar_pftv_amass_kw} unit="kW" />
          <Calc label="Cost investiție AMASS (F10)" value={calc.cost_investitie_eur} unit="EUR" big />
          <CalcText label="Cost eșalonare lunară (F11)" value={calc.cost_esalonare_range} />
        </Zone>

        {isV1 ? (
          <Zone title="02 INFO CASA ACTUALĂ (obișnuința clientului)">
            <Field label="Suprafață casa actuală (mp)" value={form.ca_suprafata ?? ''} onChange={v => set('ca_suprafata', v)} type="number" />
            <Field label="Ce sistem de încălzire folosește" value={form.ca_sistem ?? ''} onChange={v => set('ca_sistem', v)} options={SISTEM_OPTS} />
            <Field label="Cost lunar actual (lei)" value={form.ca_cost_lunar ?? ''} onChange={v => set('ca_cost_lunar', v)} type="number" />
            <Field label="Cost sezon actual (lei)" value={form.ca_cost_sezon ?? ''} onChange={v => set('ca_cost_sezon', v)} type="number" />
            <Field label="Observații situație actuală" value={form.obs_situatie ?? ''} onChange={v => set('obs_situatie', v)} textarea />
          </Zone>
        ) : (
          <Zone title="02 SISTEM ACTUAL & OBSERVAȚII">
            <Field label="Sistem actual încălzire" value={form.sistem_actual ?? ''} onChange={v => set('sistem_actual', v)} options={SISTEM_OPTS} />
            <Field label="Consum unitate" value={form.consum_unitate ?? ''} onChange={v => set('consum_unitate', v)} options={['', 'lei/luna', 'lei/sezon', 'kWh/luna', 'litri/luna', 'mc/luna']} />
            <Field label="Suma (cost actual)" value={form.suma ?? ''} onChange={v => set('suma', v)} type="number" />
            <Field label="Observații situație actuală" value={form.obs_situatie ?? ''} onChange={v => set('obs_situatie', v)} textarea />
          </Zone>
        )}

        <Zone title="03 REACȚII FINANCIARE (auto)">
          <Calc label="Reacție limita buget (C17)" value={calc.cost_investitie_economic_eur} unit="EUR" />
          <Calc label="Reacție plată integrală + Promo (C18)" value={calc.cost_promo_eur} unit="EUR" />
          <CalcText label="Reacție eșalonare (C19)" value={calc.reactie_esalonare_range} />
          <Field label="Tip plată preferat" value={form.tip_plata ?? ''} onChange={v => set('tip_plata', v)} options={TIPPLATA_OPTS} />
          <Field label="Interval buget / eșalonare" value={form.interval_buget ?? ''} onChange={v => set('interval_buget', v)} />
        </Zone>

        <Zone title="04 CUM GÂNDEȘTE CLIENTUL">
          <Field label='Motivul principal ("Doriti sa...?")' value={form.motiv_principal ?? ''} onChange={v => set('motiv_principal', v)} options={MOTIV_OPTS} />
          <Field label="Plată eșalonată (din formular)" value={form.plata_esalonata ?? ''} onChange={v => set('plata_esalonata', v)} />
          <Field label="Alternative de încălzire" value={form.alternativa ?? ''} onChange={v => set('alternativa', v)} />
          <Field label="Preventie (sistem / brand)" value={form.preventie ?? ''} onChange={v => set('preventie', v)} options={['', 'Sistem', 'Brand']} />
          <Field label="Detalii preventie (ce sistem / brand)" value={form.obs_preventie ?? ''} onChange={v => set('obs_preventie', v)} />
          <Field label="Tipologie emoțională" value={form.tipologie ?? ''} onChange={v => set('tipologie', v)} options={TIPOLOGIE_OPTS} />
        </Zone>

        <Zone title="05 DIFERENȚE & CONCLUZII (auto)">
          <Calc label="Diferență consum (C29)" value={calc.diferenta_consum_lei} unit="lei/lună" />
          <Calc label="Diferență PFTV (C30)" value={calc.diferenta_pftv_kw} unit="kW" />
          {/* Profit/Amortizare (ROI) — DOAR V2 (casă locuită cu istoric de consum real).
              Pentru V1 (construcție) nu există baseline de cost actual → ROI ar fi înșelător. */}
          {!isV1 && <>
            <Calc label="Profit anual estimat (F29)" value={calc.profit_anual_lei} unit="lei" big />
            <Calc label="Amortizare investiție (F30)" value={calc.amortizare_ani} unit="ani" />
          </>}
        </Zone>
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
        <select className="field !py-1.5" value={value} onChange={e => onChange(e.target.value)}>
          {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      ) : (
        <input type={type} className="field !py-1.5" value={value}
               onChange={e => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)} />
      )}
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
