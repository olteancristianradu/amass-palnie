'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';

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
  const [entries, setEntries] = useState<ArhivaEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/arhiva').then(r => r.json()).then(j => {
      if (j.ok) setEntries(j.entries);
      setLoading(false);
    });
  }, []);

  const filtered = entries.filter(e => !filter ||
    ((e.client?.nume || '') + ' ' + (e.client?.localitate || '') + ' ' + (e.client?.idLucrare || ''))
      .toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex items-end justify-between mb-5 rise">
        <div>
          <h1 className="text-[26px]">Arhivă strategie</h1>
          <p className="text-[var(--fg-soft)] text-[13px] mt-0.5">{filtered.length} din {entries.length} snapshots salvate</p>
        </div>
        <input className="field w-52" placeholder="Caută client…" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      {loading ? <div className="card p-10 text-center text-[var(--fg-soft)]">Se încarcă arhiva…</div> :
      <div className="card overflow-hidden rise rise-1"><div className="overflow-x-auto scroll-area">
        <table className="tbl">
          <thead><tr>
            <th>Client</th><th>Versiune</th><th>Data snapshot</th><th>Obs extra</th>
          </tr></thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id}>
                <td className="font-semibold">{e.client?.nume}{e.client?.localitate ? ' · ' + e.client.localitate : ''}</td>
                <td><span className="pill pill-lucru">{e.versiune}</span></td>
                <td className="tabular text-[var(--fg-soft)]">{new Date(e.createdAt).toLocaleString('ro-RO')}</td>
                <td className="text-[11.5px] whitespace-pre-wrap max-w-md text-[var(--fg-soft)]">{e.obsExtra ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="text-center text-[var(--fg-soft)] py-12">Niciun snapshot încă — se creează automat la salvarea unei fișe.</td></tr>}
          </tbody>
        </table>
      </div></div>}
    </Layout>
  );
}
