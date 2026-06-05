'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Icon } from '@/components/Icon';
import { PriorityStar } from '@/components/indicators';
import { stelutaToPrio } from '@/lib/aspect-meta';
import { calculate, type StrategieInput } from '@/lib/strategie-calc';
import { parseObservatii } from '@/lib/strategie-autofill';
import { buildEmail } from '@/lib/email-redactare';
import { buildInfoCrmText } from '@/lib/info-crm-text';
import { asMulti, type FisaTemplateData, type FisaField, type FisaColorFam } from '@/lib/fisa-template';
import { SEED_V1, SEED_V2 } from '@/lib/fisa-template-seed';
import { migrateFisaBlob } from '@/lib/fisa-migrate';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useT } from '@/lib/i18n';
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

// Micro-definiții pentru chip-urile de tipologie emoțională (tooltip pe chip).
const TIPOLOGIE_DEF: Record<string, string> = {
  'Logic': 'Decide pe cifre, ROI, specificații. Dă-i date.',
  'Emoțional': 'Decide pe confort, familie, siguranță. Spune-i povești.',
  'Vânător de preț': 'Caută cel mai bun preț. Arată-i valoarea, nu doar costul.',
  'Nehotărât': 'Amână decizia. Ghidează-l ferm spre următorul pas.',
  'Grăbit': 'Vrea repede. Mergi direct la soluție și ofertă.',
  'Sceptic': 'Neîncrezător. Studii de caz, garanții, dovezi.',
};

// Format numeric RO pentru valorile calculate (read-only).
function nfmt(n: number, d = 0): string {
  return Number(n).toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function StrategiePage() {
  const { t } = useT();
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
  // Mod prezentare (paritate handoff .fisa--present): ascunde inputurile, lasă doar panoul AMASS (vedere client).
  const [present, setPresent] = useState(false);
  const [infoCrmOpen, setInfoCrmOpen] = useState(false);
  const [infoText, setInfoText] = useState('');
  // Contact LIVE din CRM (telefon/email reale) pentru header-ul fișei.
  // null = încă nu am încărcat / fetch eșuat => fallback la client.telefon / client.email.
  const [liveContact, setLiveContact] = useState<{ telefon?: string; email?: string } | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/clienti/${params.id}`).then(r => r.json()).then(j => {
      if (j.ok) {
        setClient(j.client);
        const isV1 = j.client.categorie === 1;
        const variant: 'V1' | 'V2' = isV1 ? 'V1' : 'V2';
        const stored = j.client.categorie === 1 ? j.client.strategieV1 : j.client.strategieV2;
        // A) MIGRARE LAZY: după ce iau blob-ul stocat, aplic migrarea aditivă (cheile vechi → cheile noi).
        // Datele vechi apar în cheile noi ale template-ului. Idempotentă, fill-only-empty, nu pierde nimic.
        // JSON.parse protejat: un blob corupt în DB nu trebuie să arunce pagina în „ecran alb".
        let parsedStored: any = {};
        if (stored) { try { parsedStored = JSON.parse(stored) || {}; } catch { parsedStored = {}; } }
        const { blob: migrated } = migrateFisaBlob(parsedStored, variant);
        const base: Record<string, any> = {
          ...migrated,
          suprafata: j.client.suprafata,
          obs_situatie: j.client.obsSituatie ?? '',
          strategie_nevoi: j.client.strategieNevoi ?? ''
        };
        // Autofill din Observatii CRM — parser portat 1:1 din Apps Script (strategie-autofill.ts).
        // FILL-ONLY-EMPTY: completăm doar câmpurile goale, nu suprascriem ce a pus agentul.
        const parsed = parseObservatii(j.client.observatii);
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
        // Re-migrare după autofill: cheile vechi completate ACUM din CRM (ca_sistem / sistem_actual)
        // se propagă în cheile noi ale template-ului (ca_sursa_caldura / sursa_caldura). Idempotent, fill-only-empty.
        const { blob: finalBase } = migrateFisaBlob(base, variant);
        setForm(finalBase);

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

  // CONTACT LIVE: după ce s-a încărcat clientul, citim contactele reale din CRM
  // (/api/crm/contacte?idLucrare=...) și folosim telefonul primului contact util în header.
  // Email-ul nu e expus de endpoint-ul de contacte => îl luăm din client.email.
  // Orice eșec (fetch, lipsă contacte) => liveContact rămâne null și header-ul cade pe client.*.
  useEffect(() => {
    if (!client?.idLucrare) return;
    let cancelled = false;
    fetch('/api/crm/contacte?idLucrare=' + client.idLucrare)
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (cancelled || !j?.ok || !Array.isArray(j.contacte)) return;
        const cuTel = j.contacte.find((c: any) => c && String(c.telefon || '').trim() !== '');
        const tel = (cuTel?.telefon || '').trim();
        if (tel) setLiveContact({ telefon: tel, email: client.email ?? undefined });
      })
      .catch(() => { /* fallback la client.telefon / client.email */ });
    return () => { cancelled = true; };
  }, [client?.idLucrare, client?.email]);

  const isV1 = client?.categorie === 1;
  // V1 (construcție): costul actual vine din ca_cost_lunar (casa actuală), nu din suma.
  const calc = useMemo(() => calculate({
    suprafata: form.suprafata,
    putere_pftv: form.putere_pftv,
    prod_aplicatie: form.prod_aplicatie,
    suma: isV1 ? form.ca_cost_lunar : form.suma,
    consum_unitate: form.consum_unitate,
    sistem_actual: isV1 ? (form.ca_sursa_caldura ?? form.ca_sistem) : (form.sursa_caldura ?? form.sistem_actual),
    bransament: form.bransament
  } as StrategieInput), [form, isV1]);

  function set(key: string, val: any) {
    // Orice editare a userului marchează form-ul ca „dirty" → permite salvarea automată.
    formDirty.current = true;
    setForm(prev => ({ ...prev, [key]: val }));
  }
  // Cost lunar ↔ sezon (×6 / ÷6) reciproc — păstrat din comportamentul fișei (V1, casa actuală).
  function setLunar(v: any) {
    const sezon = v !== '' && v != null ? String(Math.round(Number(v) * 6)) : '';
    formDirty.current = true;
    setForm(prev => ({ ...prev, ca_cost_lunar: v, ca_cost_sezon: sezon }));
  }
  function setSezon(v: any) {
    const lunar = v !== '' && v != null ? String(Math.round(Number(v) / 6)) : '';
    formDirty.current = true;
    setForm(prev => ({ ...prev, ca_cost_sezon: v, ca_cost_lunar: lunar }));
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
    setMsg(j.ok ? t('✅ Salvat (+ snapshot arhivă)') : '❌ ' + j.error);
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
    setMsg(t('⏳ Generez PDF...'));
    const r = await fetch('/api/export/pdf?id=' + client.id);
    if (r.status !== 200) { setMsg(t('❌ Eroare PDF')); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategie-' + client.idLucrare + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
    setMsg(t('✅ PDF descărcat'));
  }

  async function downloadWord() {
    if (!client) return;
    setMsg(t('⏳ Generez Word...'));
    const r = await fetch('/api/export/docx?id=' + client.id);
    if (r.status !== 200) { setMsg(t('❌ Eroare DOCX')); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategie-' + client.idLucrare + '.docx';
    a.click();
    URL.revokeObjectURL(url);
    setMsg(t('✅ Word descărcat'));
  }

  if (!client || !template) {
    return (
      <Layout contentMod="content--fisa">
        <div className="fisa"><div className="empty-state">{t('Se încarcă fișa…')}</div></div>
      </Layout>
    );
  }

  // Mod „în CRM": clientul are id_lucrare real (numeric) → există în gestcom.
  const inCRM = !!client.idLucrare && /\d/.test(client.idLucrare);

  const email = buildEmail({
    nume: client.nume, localitate: client.localitate ?? '',
    categorie: client.categorie + (client.isDT ? ' DT' : ''), isDT: client.isDT,
    judet: client.judet ?? undefined, telefon: client.telefon ?? undefined,
    email: client.email ?? undefined, sursa: client.sursa ?? undefined,
    v: form, f: calc
  });

  // Câmpul cu o cheie dată dintr-o zonă (helper pentru randarea custom a blocului construcție etc.).
  const zone = (id: string) => template.zones.find(z => z.id === id);
  const fld = (zid: string, key: string) => zone(zid)?.fields.find(f => f.key === key);

  // Verifică `cond`: câmpul apare doar dacă valoarea din form[cond.key] ∈ cond.in.
  const condOk = (f: FisaField) => !f.cond || (f.cond.in || []).includes(String(form[f.cond.key] ?? ''));

  // ── Bara de progres: câmpuri cheie completate (min 15%), ca în pa-fisa.jsx ──
  const progressFields = [
    form.suprafata, form.bransament, form.putere_pftv,
    isV1 ? form.ca_sursa_caldura : form.sursa_caldura, form.distributie ?? form.ca_distributie,
    form.material, form.izolatie_tip, form.izolatie_cm, form.tip_locuinta,
    isV1 ? form.ca_cost_lunar : form.suma, form.consum_unitate, form.tip_plata,
    form.motiv_principal, form.nivel_bani, form.tipologie, form.strategie_nevoi,
  ];
  const filledCount = progressFields.filter(v => v && (Array.isArray(v) ? v.length : String(v).trim())).length;
  const pct = Math.max(15, Math.round(filledCount / progressFields.length * 100));

  // Randare a unui câmp din template (renderField NOU), respectând control + cond + fam + source.
  const renderField = (f: FisaField, opts?: { bare?: boolean; famLabel?: boolean }) => {
    if (!condOk(f)) return null;
    const label = f.label.replace(/:\s*$/, '');
    const src = srcFor(f);

    // 'calc' → CalcRow read-only cu InfoDot (formula + note); valoarea din `calc` prin calcKey.
    if (f.control === 'calc') {
      const raw = f.calcKey ? (calc as any)[f.calcKey] : null;
      const value = typeof raw === 'number'
        ? nfmt(raw, Number.isInteger(raw) ? 0 : 2)
        : (raw == null || raw === '' ? '—' : String(raw));
      const unit = f.calcKey ? CALC_UNITS[f.calcKey] : undefined;
      return <CalcRow key={f.key} label={t(label)} value={value} formula={f.formula ? t(f.formula) : f.formula} note={f.note ? t(f.note) : f.note} fam={f.fam} unit={unit} hero={f.calcKey === 'cost_investitie_eur'} />;
    }

    const control = renderControl(f);

    // 'textarea' din corpul zonei (obs etc.) → rând pe coloană, cu badge „opțional · după apel" dacă e obs.
    if (f.control === 'textarea') {
      const isObs = /^obs/i.test(f.key);
      return (
        <div className="inrow inrow--col" key={f.key}>
          <div className="inrow__lbl">
            <Icon name="note" size={13} style={{ color: 'var(--text-muted)' }} />{t(label)}
            {src && <Src t={src} />}
            {isObs && <span className="after-call">{t('opțional · după apel')}</span>}
          </div>
          {control}
        </div>
      );
    }

    // Câmp „bare" (fără wrapper InRow) — folosit în blocul construcție unde eticheta e colorată separat.
    if (opts?.bare) return <div key={f.key}>{control}</div>;

    return <InRow key={f.key} label={t(label)} src={src} fam={opts?.famLabel ? f.fam : undefined}>{control}</InRow>;
  };

  // Randează DOAR controlul (input/select/chips/pills/textarea), fără etichetă.
  function renderControl(f: FisaField) {
    const v = form[f.key];
    switch (f.control) {
      case 'number':
        return f.unit ? (
          <div className="unitfield">
            <input className="input mono" type="number" value={v ?? ''}
              onChange={e => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
            <span className="unitfield__u">{f.unit}</span>
          </div>
        ) : (
          <input className="input mono" type="number" value={v ?? ''}
            onChange={e => set(f.key, e.target.value === '' ? '' : Number(e.target.value))} />
        );
      case 'dropdown': {
        const opts = f.options ?? [];
        const cls = 'select' + (f.fam ? ' fam-' + f.fam + '-b' : '');
        const cur = v ?? '';
        const all = (cur && !opts.includes(String(cur))) ? [String(cur), ...opts] : opts;
        return (
          <select className={cls} value={cur} onChange={e => set(f.key, e.target.value)}>
            <option value="">—</option>
            {all.map(o => <option key={o} value={o}>{t(o)}</option>)}
          </select>
        );
      }
      case 'pills':
        return <Pills options={f.options ?? []} value={v ?? ''} fam={f.fam}
          defs={f.key === 'tipologie' ? TIPOLOGIE_DEF : undefined} onChange={nv => set(f.key, nv)} />;
      case 'chips':
      case 'multiselect': {
        const arr = asMulti(v);
        const toggle = (o: string) => set(f.key, arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
        return <ChipSet options={f.options ?? []} value={arr} fam={f.fam} onToggle={toggle} />;
      }
      case 'textarea':
        return <textarea className="input" rows={3} value={v ?? ''} onChange={e => set(f.key, e.target.value)}
          placeholder={t('Ce a spus clientul, context, facturi, istoric…')} />;
      case 'text':
      default:
        return <input className="input" value={v ?? ''} onChange={e => set(f.key, e.target.value)} />;
    }
  }

  // ── Bloc CONSTRUCȚIE: 4 câmpuri tipizate + progressive disclosure (.constr), ca în pa-fisa.jsx ──
  function renderConstr(zid: string) {
    const fMaterial = fld(zid, 'material');
    const fMaterialAlt = fld(zid, 'material_altele');
    const fIzol = fld(zid, 'izolatie_tip');
    const fIzolAlt = fld(zid, 'izolatie_tip_altele');
    const fGrosime = fld(zid, 'izolatie_cm');
    const fLoc = fld(zid, 'tip_locuinta');
    const fNiv = fld(zid, 'niveluri');
    const fAptEtaj = fld(zid, 'apartament_etaj');
    const fAptDin = fld(zid, 'apartament_din');
    const fAptPoz = fld(zid, 'apartament_pozitie');
    const fLocAlt = fld(zid, 'tip_locuinta_altele');
    if (!fMaterial && !fIzol && !fGrosime && !fLoc) return null;
    return (
      <div className="constr">
        <div className="constr__t">{t('Construcție / izolație / locuință')} <Src t="list" /></div>
        <div className="constr__grid">
          {fMaterial && <label className="constr__f"><span className="fam-coral">{t('Material pereți')}</span>{renderControl(fMaterial)}</label>}
          {fIzol && <label className="constr__f"><span className="fam-teal">{t('Tip izolație')}</span>{renderControl(fIzol)}</label>}
        </div>
        {fMaterialAlt && condOk(fMaterialAlt) && <label className="constr__f cond"><span>{t('Din ce e construită?')}</span>{renderControl(fMaterialAlt)}</label>}
        {fIzolAlt && condOk(fIzolAlt) && <label className="constr__f cond"><span>{t('Ce izolație?')}</span>{renderControl(fIzolAlt)}</label>}
        {fGrosime && <div className="constr__niv"><span className="fam-gri">{t('Grosime izolație')}</span>{renderControl(fGrosime)}</div>}
        {fLoc && <div className="constr__niv"><span className="fam-roz">{t('Tip locuință')}</span>{renderControl(fLoc)}</div>}
        {fNiv && condOk(fNiv) && <div className="constr__niv cond"><span>{t('Niveluri')}</span>{renderControl(fNiv)}</div>}
        {fAptEtaj && condOk(fAptEtaj) && (
          <div className="apt-grid cond">
            <label className="constr__f"><span>{t('Etaj')}</span>{renderControl(fAptEtaj)}</label>
            {fAptDin && <label className="constr__f"><span>{t('din')}</span>{renderControl(fAptDin)}</label>}
            {fAptPoz && <label className="constr__f"><span>{t('Poziție')}</span>{renderControl(fAptPoz)}</label>}
          </div>
        )}
        {fLocAlt && condOk(fLocAlt) && <label className="constr__f cond"><span>{t('Ce tip de locuință?')}</span>{renderControl(fLocAlt)}</label>}
      </div>
    );
  }

  // Câmpurile „construcție" gestionate separat în blocul .constr → excluse din randarea liniară a zonei 01.
  const CONSTR_KEYS = new Set(['material', 'material_altele', 'izolatie_tip', 'izolatie_tip_altele',
    'izolatie_cm', 'tip_locuinta', 'niveluri', 'apartament_etaj', 'apartament_din',
    'apartament_pozitie', 'tip_locuinta_altele']);

  // ── Randare zona 01 (Situația actuală) cu blocul construcție inserat ──
  function renderZone01() {
    const z = zone('z01');
    if (!z) return null;
    return (
      <section className="fz card">
        <header className="fz__head"><span className="fz__num">01</span><h3>{t('Situația actuală')}</h3></header>
        <div className="fz__body">
          {z.fields.filter(f => !CONSTR_KEYS.has(f.key)).map(f => renderField(f))}
          {renderConstr('z01')}
        </div>
      </section>
    );
  }

  // ── Randare zona 02 (sistem actual / casă actuală) + linked cost lunar↔sezon la V1 ──
  function renderZone02() {
    const z = zone('z02');
    if (!z) return null;
    const num = '02';
    const title = isV1 ? t('Info casă actuală (obișnuința clientului)') : t('Sistemul actual & observații');
    const linkedKeys = new Set(['ca_cost_lunar', 'ca_cost_sezon']);
    const fLunar = fld('z02', 'ca_cost_lunar');
    const fSezon = fld('z02', 'ca_cost_sezon');
    return (
      <section className="fz card">
        <header className="fz__head"><span className="fz__num">{num}</span><h3>{title}</h3></header>
        <div className="fz__body">
          {/* Sursa de căldură (dropdown) primește border colorat (fam-<fam>-b) — randată prin InRow standard. */}
          {z.fields.filter(f => !linkedKeys.has(f.key)).map(f => renderField(f))}
          {/* Cost lunar ↔ sezon (×6 / ÷6) — doar V1, în bloc .linked */}
          {isV1 && fLunar && fSezon && (
            <div className="linked">
              <InRow label={t('Cost lunar actual')} src="man">
                <div className="unitfield">
                  <input className="input mono" value={form.ca_cost_lunar ?? ''} onChange={e => setLunar(e.target.value)} placeholder={t('lei/lună')} />
                  <span className="unitfield__u">lei</span>
                </div>
              </InRow>
              <span className="linked__x" title={t('Legat: ×6 / ÷6')}><Icon name="swap" size={14} /></span>
              <InRow label={t('Cost sezon (×6)')} src="man">
                <div className="unitfield">
                  <input className="input mono" value={form.ca_cost_sezon ?? ''} onChange={e => setSezon(e.target.value)} placeholder={t('lei/sezon')} />
                  <span className="unitfield__u">lei</span>
                </div>
              </InRow>
            </div>
          )}
        </div>
      </section>
    );
  }

  // ── Coloana DREAPTA: zona AMASS calc (.fz--amass) cu ∑ auto-calc ──
  function renderZoneAmass() {
    const z = zone('zamass');
    if (!z) return null;
    return (
      <section className="fz card fz--amass">
        <header className="fz__head fz__head--amass"><Icon name="trending" size={16} /><h3>{t('Cu sistemul AMASS')}</h3><span className="fz__autobadge">{t('∑ auto-calc')}</span></header>
        <div className="fz__body">{z.fields.map(f => renderField(f))}</div>
      </section>
    );
  }

  // ── Zonă „valoare calculată ← → citat client" (03 & 04), layout .qrow ──
  function renderQuoteZone(zid: string, num: string, title: string, hint: string) {
    const z = zone(zid);
    if (!z) return null;
    // Perechi: câmp de control (calc/pills/text/dropdown/chips) ↔ obs_* corespunzător (citat).
    const obsFields = z.fields.filter(f => /^obs/i.test(f.key) || f.control === 'textarea');
    const mainFields = z.fields.filter(f => !(/^obs/i.test(f.key) || f.control === 'textarea'));
    // Asociem fiecărui câmp principal un câmp de citat în ordine; restul de obs rămân randate jos.
    return (
      <section className="fz card">
        <header className="fz__head"><span className="fz__num">{num}</span><h3>{title}</h3><span className="fz__hint-r">{hint}</span></header>
        <div className="fz__body qbody">
          {mainFields.map((f, i) => {
            const obs = obsFields[i];
            return (
              <div className="qrow" key={f.key}>
                <div className="qrow__left">
                  <div className="qrow__lbl">{t(f.label.replace(/:\s*$/, ''))}{srcFor(f) && <Src t={srcFor(f)!} />}</div>
                  <div className="qrow__ctl">{f.control === 'calc' ? renderCalcInline(f) : renderControl(f)}</div>
                </div>
                <div className="qrow__right">
                  {obs ? (
                    <textarea className="qrow__quote" rows={2} value={form[obs.key] ?? ''}
                      onChange={e => set(obs.key, e.target.value)}
                      placeholder={t('Ce a spus clientul, cuvânt-cu-cuvânt…')} />
                  ) : <span />}
                </div>
              </div>
            );
          })}
          {/* Câmpuri obs rămase (mai multe decât câmpurile principale) — randate ca rânduri pe coloană. */}
          {obsFields.slice(mainFields.length).map(f => (
            <div className="inrow inrow--col" key={f.key}>
              <div className="inrow__lbl"><Icon name="note" size={13} style={{ color: 'var(--text-muted)' }} />{t(f.label.replace(/:\s*$/, ''))} <span className="after-call">{t('opțional · după apel')}</span></div>
              <textarea className="input" rows={2} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} placeholder={t('Ce a spus clientul…')} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Valoare calc afișată inline (în .qrow, zona 03) cu InfoDot.
  function renderCalcInline(f: FisaField) {
    const raw = f.calcKey ? (calc as any)[f.calcKey] : null;
    const value = typeof raw === 'number' ? nfmt(raw, Number.isInteger(raw) ? 0 : 2) : (raw == null || raw === '' ? '—' : String(raw));
    return (
      <div className="calcinline">
        <b className="mono">{value}</b>
        {(f.formula || f.note) && <InfoDot formula={f.formula ? t(f.formula) : f.formula} note={f.note ? t(f.note) : f.note} />}
      </div>
    );
  }

  // ── Secțiunea 05 · Diferențe & concluzii (DOAR V2 — V1 construcție nouă NU are §05, exact ca în spreadsheet) ──
  function renderConcl() {
    if (isV1) return null;            // V1 nu are „Diferențe & concluzii" — confirmat de Radu + paritate spreadsheet
    const z = zone('z05');
    if (!z) return null;
    const cell = (key: string, unit: string, accent?: boolean, signed?: boolean) => {
      const f = z.fields.find(x => x.key === key);
      if (!f) return null;
      const raw = f.calcKey ? (calc as any)[f.calcKey] : null;
      const num = typeof raw === 'number' ? raw : null;
      const tone = accent ? 'accent' : num != null && num > 0 ? 'pos' : num != null && num < 0 ? 'neg' : '';
      const txt = num == null ? '—' : (signed && num > 0 ? '+' : '') + nfmt(num, Number.isInteger(num) ? 0 : (key === '_c_dif_pftv' || key === '_c_amortizare' ? (Number.isInteger(num) ? 0 : (key === '_c_amortizare' ? 1 : 2)) : 0));
      return (
        <div className={'concl__cell' + (accent ? ' concl__cell--accent' : '')}>
          <span className="concl__l">{t(f.label.replace(/:\s*$/, ''))}
            {(f.formula || f.note) && <InfoDot formula={f.formula ? t(f.formula) : f.formula} note={f.note ? t(f.note) : f.note} />}
          </span>
          <span className={'concl__v ' + tone}>{txt}<i>{t(unit)}</i></span>
        </div>
      );
    };
    const ready = calc.diferenta_consum_lei != null || calc.profit_anual_lei != null || calc.diferenta_pftv_kw != null;
    return (
      <section className="fz card fz--concl">
        <header className="fz__head"><span className="fz__num">05</span><h3>{t('Diferențe & concluzii')}</h3><span className="fz__hint-r">{t('comparație client ↔ AMASS')}</span></header>
        <div className="fz__body">
          <div className="concl">
            {cell('_c_dif_consum', 'lei/lună', false, true)}
            {cell('_c_profit', 'lei/an', false, true)}
            {cell('_c_dif_pftv', 'kW', false, false)}
            {cell('_c_amortizare', 'ani', true, false)}
          </div>
          {!ready && <p className="aspect__hint" style={{ marginTop: 12 }}><Icon name="alert" size={13} style={{ color: 'var(--warning)' }} /> {t('Completează Suprafață + Suma (cost actual) + Putere PFTV ca să apară cifrele.')}</p>}
        </div>
      </section>
    );
  }

  // ── Secțiunea 06 · Strategie & nevoi (zona cu strategie_nevoi din template) ──
  function renderStrategie() {
    const num = isV1 ? '05' : '06'; // V1 (fără §05) → Strategie e 05; V2 (cu §05) → Strategie e 06
    return (
      <section className="fz card">
        <header className="fz__head"><span className="fz__num">{num}</span><h3>{t('Strategie & rezistențe & nevoi identificate')}</h3></header>
        <div className="fz__body">
          <textarea className="input fisa__notes" rows={5} value={form.strategie_nevoi ?? ''}
            onChange={e => set('strategie_nevoi', e.target.value)}
            placeholder={t('Notează nevoi, strategie, obiecții, rezistențe, butoane de apăsat…')} />
        </div>
      </section>
    );
  }

  return (
    <Layout contentMod="content--fisa" title={client.nume}>
      <div className={'fisa rise' + (present ? ' fisa--present' : '')}>
        {/* ── breadcrumb (Pâlnie + cat-tag) + Stadiu + bară de acțiuni (autosave + butoane colorate) ── */}
        <header className="fisa__top">
          <div className="fisa__crumbs">
            <Link href="/palnie" className="crumb"><Icon name="chevL" size={14} />{t('Pâlnie')}</Link>
            <span className="crumb-sep">·</span>
            <span className={'cat-tag cat-tag--' + (isV1 ? 'v1' : 'v2')}>
              {isV1 ? t('V1 — casă în construcție') : t('V2 — casă locuită')} ({t('cat')} {client.categorie}{client.isDT ? ' DT' : ''})
            </span>
            <span className="crumb-sep">·</span>
            <span className="crumb-muted">{t('Stadiu:')}</span>
            <select
              className="cell-select"
              style={{ width: 'auto' }}
              value={client.stadiu ?? ''}
              onChange={async e => {
                const v = e.target.value;
                setClient({ ...client, stadiu: v || null });
                await fetch(`/api/clienti/${client.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stadiu: v || null }) });
                setMsg('✅ ' + t('Stadiu actualizat:') + ' ' + (v ? t(v) : t('în lucru')));
              }}>
              {['', 'Anulat', 'Contractat', 'Amanat', 'Finalizat'].map(s => <option key={s} value={s}>{s ? t(s) : t('în lucru')}</option>)}
            </select>
          </div>
          {/* Bară de acțiuni — salvare automată + butoane colorate ca în design. */}
          <div className="fisa__actions">
            {/* Indicator salvare automată (înlocuiește butonul „✔ Salvează"). */}
            <span className={'autosave autosave--' + saveState} title={t('Modificările se salvează automat')}>
              {saveState === 'saving'
                ? <><Icon name="refresh" size={13} className="spin" />{t('Se salvează…')}</>
                : <><Icon name="check" size={13} />{saveState === 'saved' ? t('Salvat') : t('Salvare automată')}</>}
            </span>
            {/* „Push CRM" deschide modalul INFO CRM (preview), NU pushează orbește. */}
            <button onClick={openInfoCrm} className="btn btn-pine btn-sm"><Icon name="upload" size={14} />{t('Push CRM')}</button>
            <button onClick={() => setEmailOpen(true)} className="btn btn-info btn-sm"><Icon name="mail" size={14} />{t('Email')}</button>
            <button onClick={() => setReminderOpen(true)} className="btn btn-amber btn-sm"><Icon name="bell" size={14} />{t('Reminder')}</button>
            <button onClick={downloadPDF} className="btn btn-pdf btn-sm"><Icon name="download" size={14} />{t('PDF')}</button>
            <button onClick={downloadWord} className="btn btn-word btn-sm"><Icon name="note" size={14} />{t('Word')}</button>
            <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${client.idLucrare}`}
               target="_blank" rel="noopener" className="btn btn-secondary btn-sm">{t('CRM ↗')}</a>
            {/* Mod prezentare (paritate handoff): ascunde inputurile, lasă doar panoul AMASS pentru client. */}
            <button onClick={() => setPresent(p => !p)} className={'btn btn-sm ' + (present ? 'btn-primary' : 'btn-secondary')}
              title={t('Vedere client: doar economia cu AMASS')}><Icon name={present ? 'eyeOff' : 'eye'} size={14} />{present ? t('Ieși din prezentare') : t('Prezentare')}</button>
          </div>
        </header>

        {/* ── titlu: ⚠ (dacă !inCRM) + nume + oraș + id + contact ── */}
        <div className="fisa__title">
          <PriorityStar value={stelutaToPrio(Number((client as any).stelutaCat ?? 0))} size={18} />
          {!inCRM && <span className="cnm__warn" title={t('Fără înregistrare în CRM')}><Icon name="alert" size={16} /></span>}
          <h1>{client.nume}</h1>
          {client.localitate && <span className="fisa__city">· {client.localitate}</span>}
          <span className="fisa__id mono">#{client.idLucrare}{client.judet ? ' · ' + client.judet : ''}</span>
          {(() => {
            // Telefon/email REALE din CRM (liveContact), cu fallback la datele clientului.
            const telDisplay = liveContact?.telefon || client.telefon;
            const emailDisplay = liveContact?.email || client.email;
            if (!telDisplay && !emailDisplay) return null;
            return (
              <div className="fisa__contact mono">
                <Icon name="phone" size={14} />
                {[telDisplay, emailDisplay].filter(Boolean).join(' · ')}
              </div>
            );
          })()}
        </div>

        {/* ── bară de progres (min 15%) ── */}
        <div className="fisa__progress" title={filledCount + ' ' + t('din') + ' ' + progressFields.length + ' ' + t('câmpuri cheie completate')}>
          <div className="fisa__progress-bar"><span style={{ width: pct + '%' }} /></div>
          <span className="fisa__progress-lbl mono">{pct}{t('% completată')}</span>
        </div>

        {msg && <div className={'toast mb-4 ' + (msg.startsWith('✅') ? 'toast--success' : msg.startsWith('❌') ? 'toast--error' : 'toast--info')}>{msg}</div>}

        {/* ── două coloane: STÂNGA (01 + 02) ↔ DREAPTA (AMASS calc) ── */}
        <div className="fisa__cols">
          <div className="fisa__colL">
            {renderZone01()}
            {renderZone02()}
          </div>
          <div className="fisa__colR">
            {renderZoneAmass()}
          </div>
        </div>

        {/* ── 03 · Reacții financiare ── */}
        {renderQuoteZone('z03', '03', t('Reacții financiare'), t('valoare calculată ← → ce a spus clientul'))}

        {/* ── 04 · Cum gândește clientul ── */}
        {renderQuoteZone('z04', '04', t('Cum gândește clientul'), t('profil ← → ce a spus clientul'))}

        {/* ── 05 · Diferențe & concluzii (DOAR V2) ── */}
        {renderConcl()}

        {/* ── 06 · Strategie & nevoi ── */}
        {renderStrategie()}

        {client.observatii && (
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <section className="fz card">
              <header className="fz__head"><span className="fz__num">CRM</span><h3>{t('Observații CRM (read-only)')}</h3></header>
              <div className="fz__body">
                <pre className="mono" style={{ fontSize: '11px', lineHeight: 1.55, whiteSpace: 'pre-wrap', background: 'var(--surface-sunk)', padding: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', maxHeight: 176, overflowY: 'auto', color: 'var(--text-secondary)', margin: 0 }}>{client.observatii}</pre>
              </div>
            </section>
          </div>
        )}
      </div>

      {emailOpen && <EmailModal email={email} clientId={client.id} onClose={() => setEmailOpen(false)} />}
      {reminderOpen && <ReminderModal client={client} onClose={() => setReminderOpen(false)} onDone={(m) => { setMsg(m); setReminderOpen(false); }} />}
      {infoCrmOpen && <InfoCrmModal client={client} text={infoText} setText={setInfoText} onClose={() => setInfoCrmOpen(false)} onDone={(m) => setMsg(m)} />}
    </Layout>
  );
}

// ── Badge sursă completare (.srcb) — manual / listă / CRM / calc / chip ──
type SrcKind = 'man' | 'list' | 'crm' | 'calc' | 'chip';
const SRC_META: Record<SrcKind, { ic: string; t: string }> = {
  man: { ic: 'note', t: 'Completat manual' },
  list: { ic: 'chevD', t: 'Alegi din listă' },
  crm: { ic: 'refresh', t: 'Auto din CRM (doar pe gol)' },
  calc: { ic: 'trending', t: 'Calculat automat (read-only)' },
  chip: { ic: 'grip', t: 'Selecție multiplă' },
};
function Src({ t }: { t: SrcKind }) {
  const { t: tr } = useT();
  const s = SRC_META[t];
  if (!s) return null;
  return <span className={'srcb srcb--' + t} title={tr(s.t)}><Icon name={s.ic} size={10} /></span>;
}
// Mapă f.source + control → tipul de badge afișat lângă etichetă.
function srcFor(f: FisaField): SrcKind | null {
  if (f.source === 'autofill') return 'crm';
  if (f.source === 'calc' || f.control === 'calc') return 'calc';
  if (f.source === 'manual' && (f.control === 'chips' || f.control === 'multiselect')) return 'chip';
  if (f.control === 'dropdown' || f.control === 'pills') return 'list';
  if (f.control === 'chips' || f.control === 'multiselect') return 'chip';
  if (f.source === 'manual') return 'man';
  return null;
}

// ── Rând input (stânga): etichetă + badge sursă + control ──
function InRow({ label, src, fam, children }: { label: string; src?: SrcKind | null; fam?: FisaColorFam; children: React.ReactNode }) {
  return (
    <div className="inrow">
      <div className="inrow__lbl">
        {fam ? <span className={'fam-' + fam}>{label}</span> : label}
        {src && <Src t={src} />}
      </div>
      <div className="inrow__ctl">{children}</div>
    </div>
  );
}

// ── Buton info CLICKABIL (formula + nota din spreadsheet) — închidere la click în afară ──
function InfoDot({ formula, note }: { formula?: string; note?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span className="infodot" ref={ref}>
      <button type="button" className={'infodot__btn' + (open ? ' is-on' : '')} onClick={e => { e.stopPropagation(); setOpen(o => !o); }} aria-label={t('Cum se calculează')}>
        <Icon name="info" size={12} />
      </button>
      {open && (
        <span className="infodot__pop" onClick={e => e.stopPropagation()}>
          <span className="infodot__t">{t('Din fișa AMASS (spreadsheet)')}</span>
          {formula && <code className="infodot__f">{formula}</code>}
          {note && <span className="infodot__n">{note}</span>}
        </span>
      )}
    </span>
  );
}

// ── Câmp calculat AMASS (read-only) cu info clickabil (.calcrow) ──
// Sufix unitate per rând de calcul (paritate handoff pa-fisa.jsx calcrow__u). Doar SCALARI;
// range-urile (cost_esalonare_range / reactie_esalonare_range) au deja unitatea în valoare → omise.
const CALC_UNITS: Record<string, string> = {
  putere_necesara_kw: 'kW', consum_zilnic_kwh: 'kWh', consum_lunar_kwh: 'kWh',
  consum_anual_kwh: 'kWh', necesar_pftv_amass_kw: 'kW', productie_estimata: 'kWh',
  cost_investitie_eur: '€', cost_investitie_economic_eur: '€', cost_promo_eur: '€',
  diferenta_consum_lei: 'lei/lună', profit_anual_lei: 'lei', diferenta_pftv_kw: 'kW', amortizare_ani: 'ani',
};

function CalcRow({ label, value, formula, note, fam, unit, hero }: { label: string; value: string; formula?: string; note?: string; fam?: FisaColorFam; unit?: string; hero?: boolean }) {
  const strong = fam === 'verde';
  return (
    <div className={'calcrow' + (hero ? ' is-hero' : strong ? ' is-strong' : '')}>
      <span className="calcrow__lbl">{label}
        {(formula || note) && <InfoDot formula={formula} note={note} />}
      </span>
      <span className="calcrow__v mono">{value}
        {value !== '—' && unit ? <span className="calcrow__u" style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 3, fontSize: '.82em' }}>{unit}</span> : null}
      </span>
    </div>
  );
}

// ── Selecție multiplă (chips multi, colorate pe familie) ──
function ChipSet({ options, value, onToggle, fam, defs }: {
  options: string[]; value: string[]; onToggle: (o: string) => void; fam?: FisaColorFam; defs?: Record<string, string>;
}) {
  const { t } = useT();
  const cls = fam ? ' chipfam--' + fam : '';
  // Valori vechi care nu mai sunt în options rămân vizibile (selectate) ca să nu se piardă.
  const extra = value.filter(v => !options.includes(v));
  const all = [...options, ...extra];
  return (
    <div className="chipset">
      {all.map(o => (
        <button key={o} type="button" title={defs?.[o] ? t(defs[o]) : undefined}
          className={'chipset__c' + cls + (value.includes(o) ? ' is-on' : '')}
          onClick={() => onToggle(o)}>{t(o)}</button>
      ))}
    </div>
  );
}

// ── Pills single-select (one-tap, colorat pe familie) ──
function Pills({ options, value, onChange, fam, defs }: {
  options: string[]; value: string; onChange: (v: string) => void; fam?: FisaColorFam; defs?: Record<string, string>;
}) {
  const { t } = useT();
  const cls = fam ? ' chipfam--' + fam : '';
  const all = (value && !options.includes(value)) ? [...options, value] : options;
  return (
    <div className="chipset">
      {all.map(o => (
        <button key={o} type="button" title={defs?.[o] ? t(defs[o]) : undefined}
          className={'chipset__c' + cls + (value === o ? ' is-on' : '')}
          onClick={() => onChange(value === o ? '' : o)}>{t(o)}</button>
      ))}
    </div>
  );
}

function EmailModal({ email, clientId, onClose }: { email: any; clientId?: string; onClose: () => void }) {
  const { t } = useT();
  const [body, setBody] = useState(email.body);
  const [subject, setSubject] = useState(email.subject || '');
  const [to, setTo] = useState(email.to || '');
  const [cc, setCc] = useState(email.cc || '');
  const [status, setStatus] = useState('');
  const [outlookOn, setOutlookOn] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { fetch('/api/outlook/status').then(r => r.json()).then(o => setOutlookOn(!!(o.ok && o.connected))).catch(() => {}); }, []);
  async function sendViaOutlook() {
    setSending(true); setStatus(t('⏳ Trimit prin Outlook…'));
    const r = await fetch('/api/outlook/send', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, cc, subject, html: body, clientId, attachPdf: true }) });
    const j = await r.json();
    setSending(false);
    setStatus(j.ok ? t('✅ Email trimis prin Outlook (cu PDF atașat).') : '❌ ' + (j.error || t('eroare')));
  }
  const plain = () => body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  async function copyBody() {
    try {
      const blob = new Blob([body], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([plain()], { type: 'text/plain' }) })]);
      setStatus(t('✅ Body copiat cu format (bold păstrat la paste).'));
    } catch {
      await navigator.clipboard.writeText(plain());
      setStatus(t('✅ Body copiat (plain text).'));
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
    setStatus(t('✅ Outlook deschis cu emailul pre-completat. Verifică și apasă Trimite în Outlook.'));
    setTimeout(() => setStatus(''), 5000);
  }
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card !shadow-[var(--shadow-lg)] max-w-4xl w-full max-h-[90vh] overflow-y-auto scroll-area p-6 rise">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg">{t('Email redactare deviz')}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-xs text-base">✕</button>
        </div>
        <div className="toast toast--info mb-3 text-[12px]">
          {t('Câmpurile')} <b>{t('bold')}</b> {t('le completezi manual. „Deschide în Outlook" pre-completează un email nou (firmă sau personal).')}
        </div>
        <div className="grid grid-cols-[64px_1fr] gap-2 mb-3 text-[12.5px] items-center">
          <label className="kpi-label">{t('Subject')}</label><input className="field" value={subject} onChange={e => setSubject(e.target.value)} />
          <label className="kpi-label">{t('To')}</label><input className="field" value={to} onChange={e => setTo(e.target.value)} />
          <label className="kpi-label">{t('Cc')}</label><input className="field" value={cc} onChange={e => setCc(e.target.value)} />
        </div>
        <div contentEditable className="field min-h-[360px] !text-[13px] leading-relaxed overflow-y-auto scroll-area"
             style={{ whiteSpace: 'pre-wrap' }}
             dangerouslySetInnerHTML={{ __html: body }}
             onBlur={e => setBody((e.target as HTMLDivElement).innerHTML)} />
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <span className="text-[12px] text-[var(--ok)] font-medium">{status}</span>
          <div className="flex gap-2 flex-wrap">
            {outlookOn && <button onClick={sendViaOutlook} disabled={sending} className="btn btn-primary">{sending ? '…' : t('✈ Trimite prin Outlook (+PDF)')}</button>}
            <button onClick={() => openOutlook('office')} className="btn btn-pine">{t('↗ Outlook firmă')}</button>
            <button onClick={() => openOutlook('live')} className="btn btn-secondary">{t('↗ Outlook personal')}</button>
            <button onClick={copyBody} className="btn btn-secondary">{t('Copiază body')}</button>
            <button onClick={onClose} className="btn btn-secondary">{t('Închide')}</button>
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
  const { t } = useT();
  const [status, setStatus] = useState('');
  const [pushing, setPushing] = useState(false);
  async function pushNow() {
    setPushing(true); setStatus(t('⏳ Push în CRM…'));
    try {
      const r = await fetch('/api/crm/push-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idLucrare: client.idLucrare, observatii: text })
      });
      const j = await r.json();
      if (j.ok) { setStatus(t('✅ Împins în CRM (') + (j.action || 'ok') + ').'); onDone(t('✅ Info împins în CRM')); }
      else { setStatus('❌ ' + (j.error || t('eroare'))); }
    } catch (e: any) { setStatus('❌ ' + e.message); }
    setPushing(false);
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(text); setStatus(t('✅ Text copiat.')); }
    catch { setStatus(t('❌ Nu am putut copia.')); }
    setTimeout(() => setStatus(''), 3000);
  }
  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card !shadow-[var(--shadow-lg)] max-w-3xl w-full max-h-[90vh] overflow-y-auto scroll-area p-6 rise">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg">{t('📋 Info CRM —')} {client.nume}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-xs text-base">✕</button>
        </div>
        <p className="text-[11px] text-[var(--fg-faint)] mb-2 font-mono">id_lucrare = {client.idLucrare}</p>
        <div className="toast toast--info mb-3 text-[12px]">
          {t('Push automat în Observații CRM (marker')} <b>══ STRATEGIE FISA ══</b> {t('— observațiile manuale ale agentului rămân intacte). Poți edita textul înainte de push.')}
        </div>
        <textarea className="field w-full font-mono text-[11px] leading-relaxed min-h-[340px]" value={text} onChange={e => setText(e.target.value)} />
        <div className="flex justify-between items-center mt-3 flex-wrap gap-2">
          <span className={'text-[12px] font-medium ' + (status.startsWith('✅') ? 'text-[var(--ok)]' : status.startsWith('❌') ? 'text-[var(--danger)]' : 'text-[var(--fg-soft)]')}>{status}</span>
          <div className="flex gap-2 flex-wrap">
            <a href={`https://gestcom.ro/amass/index.php?m=lucrari&a=view&id_lucrare=${client.idLucrare}`} target="_blank" rel="noopener" className="btn btn-secondary">{t('↗ Deschide CRM')}</a>
            <button onClick={copyText} className="btn btn-secondary">{t('📋 Copy text')}</button>
            <button onClick={pushNow} disabled={pushing} className="btn btn-pine">{pushing ? '…' : t('↗ Push în CRM')}</button>
            <button onClick={onClose} className="btn btn-secondary">{t('Închide')}</button>
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
  const { t } = useT();
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
  // Paritate spreadsheet: la salvare, marchează automat reminderele deschise ca efectuate (bifat implicit).
  const [markOthersDone, setMarkOthersDone] = useState(true);

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
    if (needsSubtip && (!subtip || subtip === '0')) { onDone(t('❌ Pentru ÎNTÂLNIRE/DELEGAȚIE alege subtipul')); return; }
    setLoading(true);
    const r = await fetch('/api/crm/reminder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idLucrare: client.idLucrare, idContact, data, ora, durata, tip, subtip, info, notificare, markOthersDone })
    });
    const j = await r.json();
    setLoading(false);
    if (j.ok) {
      const suf = (markOthersDone && typeof j.markedDone === 'number' && j.markedDone > 0)
        ? ` (+ ${j.markedDone} reminder${j.markedDone === 1 ? '' : 'e'} deschis${j.markedDone === 1 ? '' : 'e'} marcat${j.markedDone === 1 ? '' : 'e'} ca efectuat${j.markedDone === 1 ? '' : 'e'})`
        : '';
      onDone(t('✅ Reminder salvat în CRM') + suf);
    } else {
      onDone('❌ ' + j.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-[rgba(20,32,28,.5)] backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="card !shadow-[var(--shadow-lg)] max-w-4xl w-full max-h-[90vh] overflow-y-auto scroll-area p-6 rise">
        <div className="flex justify-between items-center mb-1">
          <h2 className="text-lg">{t('⏰ Reminder —')} {client.nume}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-xs text-base">✕</button>
        </div>
        <p className="text-[11px] text-[var(--fg-faint)] mb-4 font-mono">id_lucrare = {client.idLucrare} {t('· merge live în CRM gestcom')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* STÂNGA: reminder nou */}
          <form onSubmit={submit}>
            <div className="panel-head"><span className="dot" />{t('Reminder nou')}</div>
            <div className="grid grid-cols-[92px_1fr] gap-2.5 text-[12.5px] items-center">
              <label className="text-[var(--fg-soft)]">{t('Contact')}</label>
              <select className="field" value={idContact} onChange={e => setIdContact(e.target.value)}>
                {loadingContacte && <option value="">{t('se încarcă…')}</option>}
                {!loadingContacte && contacte.length === 0 && <option value="">{t('(fără contacte)')}</option>}
                {contacte.map(c => <option key={c.idContact} value={c.idContact}>{c.nume}{c.telefon ? ' · ' + c.telefon : ''}{c.rol ? ' · ' + c.rol : ''}</option>)}
              </select>
              <label className="text-[var(--fg-soft)]">{t('Tip')}</label>
              <select className="field" value={tip} onChange={e => setTip(e.target.value)}>
                {TIP_OPTIONS.map(o => <option key={o.v} value={o.v}>{t(o.l)}</option>)}
              </select>
              {needsSubtip && (<>
                <label className="text-[var(--fg-soft)]">{t('Subtip')}</label>
                <select className="field" value={subtip} onChange={e => setSubtip(e.target.value)} required>
                  <option value="0">{t('— alege —')}</option>
                  <option value="1">{t('Prima întâlnire')}</option>
                  <option value="2">{t('Revenire')}</option>
                  <option value="3">{t('Semnare contract')}</option>
                  <option value="4">{t('Tehnic / măsurători')}</option>
                </select>
              </>)}
              <label className="text-[var(--fg-soft)]">{t('Data')}</label><input type="date" className="field" value={data} onChange={e => setData(e.target.value)} required />
              <label className="text-[var(--fg-soft)]">{t('Ora')}</label><input type="time" className="field" value={ora} onChange={e => setOra(e.target.value)} />
              <label className="text-[var(--fg-soft)]">{t('Durată (min)')}</label><input type="number" className="field" value={durata} onChange={e => setDurata(e.target.value)} />
              <label className="text-[var(--fg-soft)]">{t('Notificare')}</label>
              <select className="field" value={notificare} onChange={e => setNotificare(e.target.value)}>
                <option value="0">{t('fără')}</option>
                <option value="1">{t('la timp')}</option>
                <option value="2">{t('cu 1 oră înainte')}</option>
                <option value="3">{t('cu 1 zi înainte')}</option>
              </select>
              <label className="text-[var(--fg-soft)] self-start pt-1.5">{t('Info')}</label><textarea className="field min-h-[100px]" value={info} onChange={e => setInfo(e.target.value)} placeholder={t('Detalii reminder (obligatoriu)…')} required />
            </div>
            <div className="toast toast--info mt-3 text-[12px]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <b>{t('💡 Propunere:')} {t(suggestion.titlu)}</b>
                <button type="button" onClick={() => setInfo(suggestion.info)} className="btn btn-secondary btn-xs">{t('Populează info')}</button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-[var(--fg-soft)] m-0">{suggestion.info}</pre>
            </div>
            <label className="flex items-start gap-2 mt-3 text-[12px] text-[var(--fg-soft)] cursor-pointer select-none">
              <input type="checkbox" className="mt-0.5" checked={markOthersDone} onChange={e => setMarkOthersDone(e.target.checked)} />
              <span>{t('La salvare: marchează')} <b>{t('TOATE')}</b> {t('reminderele deschise ca efectuate')} <span className="text-[var(--fg-faint)]">{t('(paritate spreadsheet)')}</span></span>
            </label>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={onClose} className="btn btn-secondary">{t('Anulează')}</button>
              <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '…' : t('Salvează în CRM')}</button>
            </div>
          </form>
          {/* DREAPTA: remindere existente */}
          <div>
            <div className="panel-head"><span className="dot" />{t('Remindere existente')}</div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto scroll-area pr-1">
              {existing === null && <div className="text-[12px] text-[var(--fg-faint)]">{t('se încarcă…')}</div>}
              {existing !== null && existing.length === 0 && <div className="text-[12px] text-[var(--fg-faint)]">{t('(niciun reminder în CRM)')}</div>}
              {existing?.map((rem, i) => (
                <div key={i} className="border border-[var(--line)] rounded-[var(--radius-sm)] p-2.5 bg-[var(--paper)]">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold tabular">{rem.data}{rem.ora ? ' · ' + rem.ora : ''}</span>
                    <span className={'pill text-[10px] ' + (rem.status === 'executat' ? 'pill-contractat' : 'pill-lucru')}>{rem.status === 'executat' ? t('✓ executat') : t('○ deschis')}</span>
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
