'use client';
import { useEffect, useState, Fragment } from 'react';
import { Layout } from '@/components/Layout';
import { useT } from '@/lib/i18n';

interface ArhivaEntry {
  id: string;
  clientId: string;
  versiune: string;
  dataSnapshot: string;
  obsExtra: string | null;
  createdAt: string;
  client?: { nume: string; localitate: string | null; idLucrare: string };
}

export default function ArhivaPage() {
  const { t } = useT();
  const [entries, setEntries] = useState<ArhivaEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null); // rândul cu conținutul snapshot-ului extins

  // Sumar lizibil al conținutului snapshot-ului (ce era în sesiune/strategie la momentul salvării).
  function snapSummary(e: ArhivaEntry): { label: string; value: string }[] {
    try {
      const snap: any = JSON.parse(e.dataSnapshot);
      const out: { label: string; value: string }[] = [];
      const push = (label: string, v: any) => {
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) return;
        out.push({ label, value: Array.isArray(v) ? v.join(', ') : String(v) });
      };
      push(t('Suprafață'), snap.suprafata != null ? snap.suprafata + ' mp' : null);
      push(t('Nevoia'), snap.nevoia);
      push(t('Stadiu'), snap.stadiu);
      push(t('Observații situație'), snap.obsSituatie);
      push(t('Strategie / nevoi'), snap.strategieNevoi);
      const blobStr = e.versiune === 'V1' ? snap.strategieV1 : snap.strategieV2;
      if (blobStr) {
        try {
          const blob = JSON.parse(blobStr);
          for (const [k, v] of Object.entries(blob)) {
            if (/^obs_/.test(k)) continue; // observațiile lungi le sărim din sumar
            push(k.replace(/_/g, ' '), v);
          }
        } catch {}
      }
      return out;
    } catch { return []; }
  }

  function loadEntries() {
    fetch('/api/arhiva').then(r => r.json()).then(j => {
      if (j.ok) setEntries(j.entries);
      setLoading(false);
    });
  }

  useEffect(() => { loadEntries(); }, []);

  async function restaureaza(e: ArhivaEntry) {
    const nume = e.client?.nume || t('acest client');
    if (!confirm(`${t('Restaurezi strategia pentru')} „${nume}" ${t('din snapshotul de la')} ${new Date(e.createdAt).toLocaleString('ro-RO')}?\n\n${t('Starea curentă se salvează automat ca „pre-restore" și e reversibilă.')}`)) return;
    setRestoringId(e.id);
    try {
      const r = await fetch('/api/arhiva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: e.id })
      });
      const j = await r.json();
      if (j.ok) {
        alert(t('Versiune restaurată cu succes.'));
        loadEntries();
      } else {
        alert(t('Nu am putut restaura: ') + (j.error || t('eroare necunoscută')));
      }
    } catch {
      alert(t('Nu am putut restaura: eroare de rețea.'));
    } finally {
      setRestoringId(null);
    }
  }

  const filtered = entries.filter(e => !filter ||
    ((e.client?.nume || '') + ' ' + (e.client?.localitate || '') + ' ' + (e.client?.idLucrare || ''))
      .toLowerCase().includes(filter.toLowerCase())
  );

  const topbar = (
    <div className="topbar__tools" style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
      <input className="input" style={{ minHeight: 34, width: 220 }} placeholder={t('Caută client…')} value={filter} onChange={e => setFilter(e.target.value)} />
    </div>
  );

  return (
    <Layout topbar={topbar}>
      <p className="muted rise" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-5)' }}>
        {filtered.length} {t('din')} {entries.length} {t('snapshots salvate · se creează automat la salvarea unei fișe.')}
      </p>
      {loading ? <div className="card card--pad text-center text-[var(--fg-soft)]" style={{ padding: 40 }}>{t('Se încarcă arhiva…')}</div> :
      <div className="card overflow-hidden rise rise-1"><div className="overflow-x-auto scroll-area">
        <table className="tbl">
          <thead><tr>
            <th>{t('Client')}</th><th>{t('Versiune')}</th><th>{t('Data snapshot')}</th><th>{t('Obs extra')}</th><th>{t('Acțiuni')}</th>
          </tr></thead>
          <tbody>
            {filtered.map(e => (
              <Fragment key={e.id}>
              <tr>
                <td className="font-semibold">{e.client?.nume}{e.client?.localitate ? ' · ' + e.client.localitate : ''}</td>
                <td><span className="pill pill-lucru">{e.versiune}</span></td>
                <td className="tabular text-[var(--fg-soft)]">{new Date(e.createdAt).toLocaleString('ro-RO')}</td>
                <td className="text-[11.5px] whitespace-pre-wrap max-w-md text-[var(--fg-soft)]">{e.obsExtra ?? '—'}</td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-xs whitespace-nowrap" onClick={() => setOpenId(openId === e.id ? null : e.id)}>
                    {openId === e.id ? t('▲ Ascunde conținutul') : t('👁 Vezi conținutul')}
                  </button>
                  <button className="btn btn-secondary btn-xs whitespace-nowrap" disabled={restoringId === e.id} onClick={() => restaureaza(e)}>
                    {restoringId === e.id ? t('Se restaurează…') : t('↺ Restaurează această versiune')}
                  </button>
                </td>
              </tr>
              {openId === e.id && (() => { const rows = snapSummary(e); return (
                <tr>
                  <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '12px 16px' }}>
                    {rows.length === 0 ? <span className="text-[var(--fg-soft)]">{t('(snapshot gol sau necitibil)')}</span> : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 18px' }}>
                        {rows.map((r, i) => (
                          <div key={i} style={{ fontSize: '12.5px', lineHeight: 1.4 }}>
                            <span className="text-[var(--fg-soft)]" style={{ textTransform: 'capitalize' }}>{r.label}:</span>{' '}
                            <b style={{ overflowWrap: 'anywhere' }}>{r.value}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ); })()}
              </Fragment>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-[var(--fg-soft)] py-12">{t('Niciun snapshot încă — se creează automat la salvarea unei fișe.')}</td></tr>}
          </tbody>
        </table>
      </div></div>}
    </Layout>
  );
}
