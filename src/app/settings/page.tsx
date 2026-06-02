'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';

export default function SettingsPage() {
  const [crmUser, setCrmUser] = useState('');
  const [crmPass, setCrmPass] = useState('');
  const [hasCreds, setHasCreds] = useState(false);
  const [currentCrmUser, setCurrentCrmUser] = useState('');
  const [utilizatorId, setUtilizatorId] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (o === 'ok') setMsg('✅ Outlook conectat: ' + (sp.get('acct') || ''));
    else if (o === 'notconfigured') setMsg('⚠️ Outlook nu e configurat pe server (lipsesc AZURE_CLIENT_ID/SECRET).');
    else if (o === 'err') setMsg('❌ Outlook: ' + (sp.get('msg') || 'eroare'));
    if (o) window.history.replaceState({}, '', '/settings');
  }, []);

  async function disconnectOutlook() {
    await fetch('/api/outlook/status', { method: 'DELETE' });
    setMsg('ℹ️ Outlook deconectat'); load();
  }

  async function toggleAuto() {
    const next = !autoSync;
    setAutoSync(next); // optimist
    const r = await fetch('/api/crm/credentials', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autoSync: next }) });
    const j = await r.json();
    if (!j.ok) { setAutoSync(!next); setMsg('❌ ' + j.error); }
    else setMsg(next ? '✅ Auto-sync PORNIT (verificare la ~90s, detalii la ~10min)' : 'ℹ️ Auto-sync oprit');
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
      setMsg('✅ Credentiale salvate. Parola este criptată AES-256.');
      setCrmPass('');
      await load();
    } else {
      setMsg('❌ ' + j.error);
    }
  }

  async function testLogin() {
    setLoading(true); setMsg('Test login CRM...');
    const r = await fetch('/api/crm/test', { method: 'POST' });
    const j = await r.json();
    setLoading(false);
    setMsg(j.ok ? `✅ Login OK. utilizator_id=${j.utilizatorId ?? '?'}` : '❌ ' + j.error);
    await load();
  }

  return (
    <Layout>
      <h1 className="text-[26px] mb-1 rise">Setări</h1>
      <p className="text-[var(--fg-soft)] text-[13px] mb-4 rise">Cont CRM, aspect/temă și Outlook — toate într-un singur loc. Credențialele gestcom sunt criptate AES-256. Parola contului se gestionează de administrator (pagina Echipă).</p>
      <a href="/aspect" className="card max-w-xl rise flex items-center gap-3 p-4 mb-5 hover:border-[var(--accent)] transition-colors no-underline">
        <span className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--accent-soft)] text-[var(--accent)] grid place-items-center flex-shrink-0">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 100 20 2 2 0 002-2 1.9 1.9 0 00-.5-1.3 2 2 0 01-.5-1.3 2 2 0 012-2H17a5 5 0 005-5c0-4.9-4.5-8.4-10-8.4z"/></svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-[14px] text-[var(--text)]">Aspect & temă</span>
          <span className="block text-[12px] text-[var(--fg-soft)]">Culoare accent, temă light/dark, densitate, colțuri, limbă</span>
        </span>
        <span className="text-[var(--text-muted)]">›</span>
      </a>
      <div className="card p-6 max-w-xl rise rise-1">
        {hasCreds && (
          <div className="toast toast-ok mb-5">
            Conectat ca <b>{currentCrmUser}</b>{utilizatorId && <> · utilizator_id <b>{utilizatorId}</b></>}
          </div>
        )}
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="kpi-label block mb-1.5">User CRM (gestcom.ro)</label>
            <input className="field" value={crmUser} onChange={e => setCrmUser(e.target.value)} placeholder={hasCreds ? currentCrmUser : 'amass.user@…'} required />
          </div>
          <div>
            <label className="kpi-label block mb-1.5">Parolă CRM</label>
            <input type="password" className="field" value={crmPass} onChange={e => setCrmPass(e.target.value)} placeholder={hasCreds ? '(păstrată — completează doar dacă schimbi)' : ''} required />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn btn-primary">{loading ? '…' : 'Salvează criptat'}</button>
            {hasCreds && <button type="button" onClick={testLogin} disabled={loading} className="btn btn-pine">Test login CRM</button>}
          </div>
          {msg && <div className={'toast ' + (msg.startsWith('✅') ? 'toast-ok' : msg.startsWith('❌') ? 'toast-err' : 'toast-info')}>{msg}</div>}
        </form>
      </div>

      {hasCreds && (
        <div className="card p-6 max-w-xl rise rise-2 mt-4">
          <div className="panel-head"><span className="dot" />Auto-sincronizare cu CRM</div>
          <div className="flex items-start justify-between gap-4">
            <div className="text-[12.5px] text-[var(--fg-soft)] leading-relaxed">
              Sincronizare automată în fundal: <b>clienți noi la ~90s</b>, <b>detalii (lot rotativ) la ~10min</b>.
              Scrierile (steluțe, observații, etape pâlnie) merg <b>instant</b> în CRM. Pâlnia se reîmprospătează singură.
              <div className="text-[var(--fg-faint)] text-[11.5px] mt-1.5">gestcom nu are notificări push — deci e polling rapid, nu instant. Dacă apar erori, dă automat înapoi 5 min ca să nu-ți blocheze contul.</div>
            </div>
            <button onClick={toggleAuto}
              className={'btn flex-shrink-0 ' + (autoSync ? 'btn-pine' : 'btn-secondary')}>
              {autoSync ? '● Pornit' : '○ Oprit'}
            </button>
          </div>
        </div>
      )}

      <div className="card p-6 max-w-xl rise rise-2 mt-4">
        <div className="panel-head"><span className="dot" />Outlook — trimitere email deviz</div>
        {!outlook ? <div className="text-[12.5px] text-[var(--fg-faint)]">Se verifică…</div> : !outlook.configured ? (
          <div className="text-[12.5px] text-[var(--fg-soft)]">
            ⚠️ Integrarea Outlook nu e configurată pe server. Trebuie înregistrată o aplicație în Azure/Microsoft 365 și setate
            <code className="font-mono"> AZURE_CLIENT_ID</code> + <code className="font-mono">AZURE_CLIENT_SECRET</code>. Vezi raportul „Outlook setup" din pagina Rapoarte.
          </div>
        ) : outlook.connected ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12.5px] text-[var(--fg-soft)]">Conectat ca <b>{outlook.account}</b>. Poți trimite emailul de deviz direct din fișă (cu PDF atașat).</div>
            <button onClick={disconnectOutlook} className="btn btn-secondary flex-shrink-0">Deconectează</button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="text-[12.5px] text-[var(--fg-soft)]">Conectează un cont Microsoft (firmă pe domeniu sau outlook.com) ca să trimiți emailuri direct din aplicație.</div>
            <a href="/api/outlook/connect" className="btn btn-pine flex-shrink-0">Conectează Outlook</a>
          </div>
        )}
      </div>

    </Layout>
  );
}
