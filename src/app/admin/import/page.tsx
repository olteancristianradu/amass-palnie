'use client';
import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useT } from '@/lib/i18n';

// Import date din spreadsheet (strategii + status + arhivă) în contul propriu, match pe id_lucrare.
export default function ImportPage() {
  const { t } = useT();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState<any>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { setRaw(String(reader.result || '')); setMsg(`${t('Fișier încărcat:')} ${f.name} (${Math.round(f.size / 1024)} KB)`); };
    reader.readAsText(f);
  }

  async function doImport() {
    setBusy(true); setMsg(''); setResult(null);
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { setMsg(t('❌ JSON invalid — verifică fișierul/textul.')); setBusy(false); return; }
    const body = Array.isArray(parsed) ? { clients: parsed } : parsed;
    try {
      const r = await fetch('/api/admin/import-date', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({} as any));
      if (r.status === 401) { setMsg(t('❌ Sesiune expirată — reautentifică-te și încearcă din nou.')); }
      else if (j.ok) { setResult(j); setMsg(`✅ ${t('Gata:')} ${j.updated} ${t('actualizați,')} ${j.notFound} ${t('negăsiți,')} ${j.skipped} ${t('săriți (din')} ${j.total}).`); }
      else { setMsg('❌ ' + (j.error || `${t('Eroare')} (${r.status})`)); }
    } catch (e: any) { setMsg('❌ ' + e.message); }
    setBusy(false);
  }

  return (
    <Layout>
      <p className="text-[13px] text-[var(--fg-soft)] mb-5 max-w-2xl rise">
        {t('Aduce în contul tău')} <b>{t('strategiile')}</b>, <b>{t('statusul')}</b> {t('și')} <b>{t('etapele')}</b> {t('pe care le-ai făcut deja în spreadsheet.')}
        {' '}{t('Se potrivește pe')} <b>id_lucrare</b> {t('și actualizează DOAR clienții care există deja (importă întâi clienții din CRM cu „Sync"). Nu pierzi date — blob-ul de strategie se completează, nu se șterge.')}
      </p>

      <div className="card card--pad max-w-2xl space-y-4 rise rise-1">
        <div>
          <label className="label block mb-1.5">{t('1. Încarcă fișierul exportat din spreadsheet (.json)')}</label>
          <input type="file" accept=".json,application/json" onChange={onFile} className="block text-[13px]" />
        </div>
        <div>
          <label className="label block mb-1.5">{t('…sau lipește JSON-ul aici')}</label>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
            placeholder='{"clients":[{"idLucrare":"12345","strategieV2":{...},"stadiu":"Contractat","nevoia":"Nevoie Acoperita"}]}'
            className="input w-full font-mono text-[11px]" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={doImport} disabled={busy || !raw.trim()} className="btn btn-primary">{busy ? t('⏳ Import…') : t('Importă în contul meu')}</button>
          {msg && <span className={'text-[13px] ' + (msg.startsWith('✅') ? 'text-[var(--success)]' : msg.startsWith('❌') ? 'text-[var(--danger)]' : 'text-[var(--fg-soft)]')}>{msg}</span>}
        </div>
        {result && (
          <div className="text-[12px] text-[var(--fg-soft)] border-t border-[var(--border)] pt-3">
            <div><b className="text-[var(--text)]">{result.updated}</b> {t('clienți actualizați')} · <b>{result.notFound}</b> {t('negăsiți')} · <b>{result.skipped}</b> {t('săriți (din')} {result.total})</div>
            {result.notFound > 0 && result.notFoundSample?.length > 0 && (
              <div className="mt-1 text-[var(--fg-faint)]">{t('id_lucrare negăsite (primele):')} {result.notFoundSample.join(', ')} {t('— rulează „Sync clienți" întâi ca să existe în pâlnie.')}</div>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-[var(--fg-faint)] mt-4 max-w-2xl">
        {t('Fișierul .json îl generezi din spreadsheet: meniul AMASS → „📤 Export pentru webapp" (funcția')} <code>exportPentruWebapp</code>{t('). Descarci fișierul din Drive și-l încarci aici.')}
      </p>
    </Layout>
  );
}
