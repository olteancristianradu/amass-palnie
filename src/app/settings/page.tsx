'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Icon } from '@/components/Icon';
import { useT } from '@/lib/i18n';

// Mărimea textului/interfeței + tema/accentul se reglează acum în „Aspect aplicație" (motorul Aspect,
// prin --text-scale). Cardul vechi cu zoom a fost scos ca să nu intre în conflict cu motorul.
//
// Layout master-detail (portat din designul „pa-settings.jsx"): nav stânga pe secțiuni (.settings__nav)
// + panou dreapta (.settings__body). FIECARE secțiune funcțională existentă (credențiale CRM, auto-sync,
// Outlook, import, limbă, aspect) e mutată într-un panou selectabil — doar reorganizare de layout,
// toate fetch/PATCH/POST și handlerele rămân conectate exact ca înainte.

type NavKey = 'crm' | 'sync' | 'outlook' | 'import' | 'limba' | 'aspect';

export default function SettingsPage() {
  const { lang, setLang, t } = useT();
  const [crmUser, setCrmUser] = useState('');
  const [crmPass, setCrmPass] = useState('');
  const [hasCreds, setHasCreds] = useState(false);
  const [currentCrmUser, setCurrentCrmUser] = useState('');
  const [utilizatorId, setUtilizatorId] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [active, setActive] = useState<NavKey>('crm');

  const [outlook, setOutlook] = useState<{ configured: boolean; connected: boolean; account: string | null } | null>(null);
  async function load() {
    const r = await fetch('/api/crm/credentials');
    const j = await r.json();
    if (j.ok) {
      setHasCreds(j.hasCredentials);
      setCurrentCrmUser(j.crmUser ?? '');
      setUtilizatorId(j.utilizatorId ?? '');
      setAutoSync(!!j.autoSync);
    }
    fetch('/api/outlook/status').then(r => r.json()).then(o => { if (o.ok) setOutlook(o); }).catch(() => {});
  }
  useEffect(() => {
    load();
    // feedback după redirect-ul OAuth Microsoft
    const sp = new URLSearchParams(window.location.search);
    const o = sp.get('outlook');
    if (o === 'ok') setMsg(t('✅ Outlook conectat: ') + (sp.get('acct') || ''));
    else if (o === 'notconfigured') setMsg(t('⚠️ Outlook nu e configurat pe server (lipsesc AZURE_CLIENT_ID/SECRET).'));
    else if (o === 'err') setMsg(t('❌ Outlook: ') + (sp.get('msg') || 'eroare'));
    if (o) { setActive('outlook'); window.history.replaceState({}, '', '/settings'); }
  }, []);

  async function disconnectOutlook() {
    const r = await fetch('/api/outlook/status', { method: 'DELETE' });
    setMsg(r.ok ? t('ℹ️ Outlook deconectat') : '❌ ' + t('Eroare la deconectare')); load();
  }

  async function toggleAuto() {
    const next = !autoSync;
    setAutoSync(next); // optimist
    const r = await fetch('/api/crm/credentials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoSync: next }) });
    const j = await r.json();
    if (!j.ok) { setAutoSync(!next); setMsg('❌ ' + j.error); }
    else setMsg(next ? t('✅ Auto-sync PORNIT (verificare la ~90s, detalii la ~10min)') : t('ℹ️ Auto-sync oprit'));
  }

  // Sincronizare manuală — reutilizează exact endpoint-ul/patternul din pâlnie (runSync → POST /api/crm/sync-clienti).
  async function syncNow() {
    setSyncing(true); setMsg('⏳ ' + t('Sincronizare clienți pornită… (nu închide tab-ul)'));
    try {
      const r = await fetch('/api/crm/sync-clienti', { method: 'POST' });
      const j = await r.json();
      if (j.ok) { setMsg(t('✅ Sincronizat. ') + JSON.stringify(j).slice(0, 160)); await load(); }
      else setMsg('❌ ' + j.error);
    } catch (e: any) { setMsg('❌ ' + e.message); }
    setSyncing(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg('');
    const r = await fetch('/api/crm/credentials', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crmUser, crmPass })
    });
    const j = await r.json();
    setLoading(false);
    if (j.ok) {
      setMsg(t('✅ Credentiale salvate. Parola este criptată AES-256.'));
      setCrmPass('');
      await load();
    } else {
      setMsg('❌ ' + j.error);
    }
  }

  async function testLogin() {
    setLoading(true); setMsg(t('Test login CRM...'));
    const r = await fetch('/api/crm/test', { method: 'POST' });
    const j = await r.json();
    setLoading(false);
    setMsg(j.ok ? t('✅ Login OK. utilizator_id=') + `${j.utilizatorId ?? '?'}` : '❌ ' + j.error);
    await load();
  }

  // Bară de mesaj reutilizabilă (toast) — apare în panoul curent.
  const Toast = () => msg ? (
    <div className={'toast mt-4 ' + (msg.startsWith('✅') ? 'toast-ok' : msg.startsWith('❌') ? 'toast-err' : 'toast-info')}>{msg}</div>
  ) : null;

  // Definiția navului: două secțiuni, ca în design.
  const sections: { title: string; items: { key: NavKey; label: string; icon: string; desc: string }[] }[] = [
    { title: t('Tehnic & integrări'), items: [
      { key: 'crm',     label: t('Credențiale CRM'), icon: 'link',    desc: t('Conexiune gestcom.ro, test') },
      { key: 'sync',    label: t('Auto-sincronizare'), icon: 'refresh', desc: t('Pornit/oprit, sincronizare acum') },
      { key: 'outlook', label: t('Outlook'),         icon: 'mail',    desc: t('E-mail deviz din fișă') },
      { key: 'import',  label: t('Import date'),     icon: 'upload',  desc: t('Din pâlnia veche (spreadsheet)') },
      { key: 'limba',   label: t('Limbă'),           icon: 'globe',   desc: t('Română / English') },
    ] },
    { title: t('Aspect & afișare'), items: [
      { key: 'aspect',  label: t('Aspect aplicație'), icon: 'palette', desc: t('Teme, mod, accent, font, mărime, culori') },
    ] },
  ];

  return (
    <Layout contentMod="content--fisa">
      <div className="settings">
        <nav className="settings__nav scroll-thin">
          {sections.map(sec => (
            <div key={sec.title} className="set-navsec">
              <div className="set-navsec__t">{sec.title}</div>
              {sec.items.map(g => (
                <button key={g.key} className={'set-navitem' + (active === g.key ? ' is-on' : '')} onClick={() => setActive(g.key)}>
                  <Icon name={g.icon} size={18} />
                  <span className="col" style={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}><b>{g.label}</b><small>{g.desc}</small></span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="settings__body scroll-thin">
          {/* ────────────── CREDENȚIALE CRM (gestcom) ────────────── */}
          {active === 'crm' && (
            <div className="panel">
              <h2 className="panel__title"><Icon name="link" size={18} />{t('Credențiale CRM — gestcom.ro')}</h2>
              <p className="text-[var(--fg-soft)] text-[13px] mb-5">{t('Credențialele gestcom sunt criptate AES-256. Parola contului se gestionează de administrator (pagina Echipă).')}</p>
              <div className="card p-6 max-w-xl">
                {hasCreds && (
                  <div className="toast toast-ok mb-5">
                    {t('Conectat ca')} <b>{currentCrmUser}</b>{utilizatorId && <> · utilizator_id <b>{utilizatorId}</b></>}
                  </div>
                )}
                <form onSubmit={save} className="space-y-4">
                  <div>
                    <label className="kpi-label block mb-1.5">{t('User CRM (gestcom.ro)')}</label>
                    <input className="field" value={crmUser} onChange={e => setCrmUser(e.target.value)} placeholder={hasCreds ? currentCrmUser : 'amass.user@…'} required />
                  </div>
                  <div>
                    <label className="kpi-label block mb-1.5">{t('Parolă CRM')}</label>
                    <input type="password" className="field" value={crmPass} onChange={e => setCrmPass(e.target.value)} placeholder={hasCreds ? t('(reintrodu parola pentru a salva)') : ''} required />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '…' : t('Salvează criptat')}</button>
                    {hasCreds && <button type="button" onClick={testLogin} disabled={loading} className="btn btn-pine">{t('Test login CRM')}</button>}
                  </div>
                </form>
                <Toast />
              </div>
            </div>
          )}

          {/* ────────────── AUTO-SINCRONIZARE ────────────── */}
          {active === 'sync' && (
            <div className="panel">
              <h2 className="panel__title"><Icon name="refresh" size={18} />{t('Auto-sincronizare cu CRM')}</h2>
              {!hasCreds ? (
                <div className="card p-6 max-w-xl text-[12.5px] text-[var(--fg-soft)]">
                  {t('Conectează-te mai întâi la CRM (secțiunea „Credențiale CRM") ca să poți porni sincronizarea.')}
                </div>
              ) : (
                <div className="card p-6 max-w-xl">
                  {/* Comutator iOS — același handler PATCH /api/crm/credentials (toggleAuto). */}
                  <label className="flex items-center justify-between gap-4" style={{ cursor: 'pointer' }}>
                    <span className="font-semibold text-[14px] text-[var(--text)]">{t('Sincronizare automată')}</span>
                    <button type="button" onClick={toggleAuto} aria-pressed={autoSync}
                      title={autoSync ? t('Auto-sync pornit') : t('Auto-sync oprit')}
                      className={'switch' + (autoSync ? ' is-on' : '')}><span className="switch__knob" /></button>
                  </label>
                  <div className="text-[12.5px] text-[var(--fg-soft)] leading-relaxed mt-4">
                    {t('Sincronizare automată în fundal:')} <b>{t('clienți noi la ~90s')}</b>, <b>{t('detalii (lot rotativ) la ~10min')}</b>.
                    {t('Scrierile (steluțe, observații, etape pâlnie) merg')} <b>{t('instant')}</b> {t('în CRM. Pâlnia se reîmprospătează singură.')}
                    <div className="text-[var(--fg-faint)] text-[11.5px] mt-1.5">{t('gestcom nu are notificări push — deci e polling rapid, nu instant. Dacă apar erori, dă automat înapoi 5 min ca să nu-ți blocheze contul.')}</div>
                  </div>
                  {/* Sincronizare manuală — reutilizează POST /api/crm/sync-clienti (ca în pâlnie). */}
                  <div className="flex gap-2 pt-4 mt-4 border-t border-[var(--border)]">
                    <button onClick={syncNow} disabled={syncing} className="btn btn-secondary btn-sm" title={t('Importă clienții noi din CRM acum')}>
                      <Icon name="refresh" size={14} />{syncing ? t('Se sincronizează…') : t('Sincronizează acum')}
                    </button>
                  </div>
                  <Toast />
                </div>
              )}
            </div>
          )}

          {/* ────────────── OUTLOOK ────────────── */}
          {active === 'outlook' && (
            <div className="panel">
              <h2 className="panel__title"><Icon name="mail" size={18} />{t('Outlook — trimitere email deviz')}</h2>
              <div className="card p-6 max-w-xl">
                {!outlook ? <div className="text-[12.5px] text-[var(--fg-faint)]">{t('Se verifică…')}</div> : !outlook.configured ? (
                  <div className="text-[12.5px] text-[var(--fg-soft)]">
                    {t('⚠️ Integrarea Outlook nu e configurată pe server. Trebuie înregistrată o aplicație în Azure/Microsoft 365 și setate')}
                    <code className="font-mono"> AZURE_CLIENT_ID</code> + <code className="font-mono">AZURE_CLIENT_SECRET</code>. {t('Vezi raportul „Outlook setup" din pagina Rapoarte.')}
                  </div>
                ) : outlook.connected ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12.5px] text-[var(--fg-soft)]">{t('Conectat ca')} <b>{outlook.account}</b>. {t('Poți trimite emailul de deviz direct din fișă (cu PDF atașat).')}</div>
                    <button onClick={disconnectOutlook} className="btn btn-secondary flex-shrink-0">{t('Deconectează')}</button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12.5px] text-[var(--fg-soft)]">{t('Conectează un cont Microsoft (firmă pe domeniu sau outlook.com) ca să trimiți emailuri direct din aplicație.')}</div>
                    <a href="/api/outlook/connect" className="btn btn-pine flex-shrink-0">{t('Conectează Outlook')}</a>
                  </div>
                )}
                <Toast />
              </div>
            </div>
          )}

          {/* ────────────── IMPORT DATE ────────────── */}
          {active === 'import' && (
            <div className="panel">
              <h2 className="panel__title"><Icon name="upload" size={18} />{t('Import date din pâlnia veche')}</h2>
              {/* Import date din pâlnia veche — în contul TĂU (nu „pentru toți"); potrivire pe id_lucrare */}
              <a href="/admin/import" className="card max-w-xl flex items-center gap-3 p-4 hover:border-[var(--accent)] transition-colors no-underline">
                <span className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center flex-shrink-0 font-bold">⤓</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[14px] text-[var(--text)]">{t('Import date din pâlnia veche (spreadsheet)')}</span>
                  <span className="block text-[12px] text-[var(--fg-soft)]">{t('Aduce strategiile + statusul tale din spreadsheet în contul TĂU (pe id_lucrare). Doar clienții tăi — nu afectează alți agenți.')}</span>
                </span>
                <span className="text-[var(--text-muted)]">›</span>
              </a>
            </div>
          )}

          {/* ────────────── LIMBĂ ────────────── */}
          {active === 'limba' && (
            <div className="panel">
              <h2 className="panel__title"><Icon name="globe" size={18} />{t('Limbă')}</h2>
              <div className="card p-4 max-w-xl">
                <div className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">{t('Limbă interfață')}</div>
                <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--border-strong)] overflow-hidden text-[12px] font-semibold">
                  <button onClick={() => setLang('ro')} className={'px-3 py-1.5 ' + (lang === 'ro' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>{t('Română')}</button>
                  <button onClick={() => setLang('en')} className={'px-3 py-1.5 border-l border-[var(--border-strong)] ' + (lang === 'en' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>{t('English')}</button>
                </div>
                <p className="text-[var(--fg-soft)] text-[12px] mt-3">{t('Româna e ~15–20% mai lungă decât engleza — interfața lasă spațiu pentru butoane.')}</p>
              </div>
            </div>
          )}

          {/* ────────────── ASPECT & AFIȘARE (link unic către /aspect) ────────────── */}
          {active === 'aspect' && (
            <div className="panel">
              <h2 className="panel__title"><Icon name="palette" size={18} />{t('Aspect & temă')}</h2>
              {/* Link unic către /aspect — teme prestabilite, culoare accent, temă, fundal, densitate, colțuri, mărime text.
                  NU duplicăm aici „Mărime & densitate": tot ce ține de aspect se reglează într-un singur loc (Aspect aplicație). */}
              <a href="/aspect" className="card max-w-xl flex items-center gap-3 p-4 hover:border-[var(--accent)] transition-colors no-underline">
                <span className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center flex-shrink-0">
                  <Icon name="palette" size={18} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[14px] text-[var(--text)]">{t('Aspect & temă')}</span>
                  <span className="block text-[12px] text-[var(--fg-soft)]">{t('Teme prestabilite, culoare accent, light/dark, fundal, densitate, colțuri, mărime text')}</span>
                </span>
                <span className="text-[var(--text-muted)]">›</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
