'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';

interface AuditEntry {
  id: string;
  createdAt: string;
  func: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  fields: string | null;
  diff: string | null;
  user: { email: string } | null;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');
  useEffect(() => {
    fetch('/api/audit').then(r => r.json()).then(j => { if (j.ok) setEntries(j.entries); });
  }, []);
  const filtered = entries.filter(e => !filter ||
    (e.func + ' ' + e.action + ' ' + (e.entity ?? '') + ' ' + (e.fields ?? '')).toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <Layout>
      <div className="flex justify-between items-end mb-5 rise">
        <div>
          <h1 className="text-[26px]">Jurnal acțiuni</h1>
          <p className="text-[var(--fg-soft)] text-[13px] mt-0.5">Fiecare scriere CRM, sync și editare e înregistrată aici.</p>
        </div>
        <input className="field w-52" placeholder="Filtrează…" value={filter} onChange={e => setFilter(e.target.value)} />
      </div>
      <div className="card overflow-hidden rise rise-1"><div className="overflow-x-auto scroll-area">
        <table className="tbl">
          <thead><tr>
            <th>Timestamp</th><th>User</th><th>Funcție</th><th>Acțiune</th><th>Entitate</th><th>Câmpuri</th><th>Diff</th>
          </tr></thead>
          <tbody>
            {filtered.map(e => {
              const a = e.action.includes('FAIL') ? 'pill-anulat' : e.action.includes('WRITE') || e.action.includes('SYNC') ? 'pill-contractat' : 'pill-lucru';
              return (
              <tr key={e.id}>
                <td className="tabular whitespace-nowrap text-[var(--fg-soft)] text-[11.5px]">{new Date(e.createdAt).toLocaleString('ro-RO')}</td>
                <td className="text-[11.5px]">{e.user?.email ?? '—'}</td>
                <td className="font-mono text-[11px]">{e.func}</td>
                <td><span className={'pill ' + a}>{e.action}</span></td>
                <td className="text-[11.5px]">{e.entity ?? '—'}{e.entityId ? ` ${e.entityId.slice(0, 8)}` : ''}</td>
                <td className="text-[11px] max-w-xs text-[var(--fg-soft)]">{e.fields ?? '—'}</td>
                <td className="text-[11px] max-w-md text-[var(--fg-soft)]">{e.diff ?? '—'}</td>
              </tr>
            );})}
            {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-[var(--fg-soft)] py-12">Nicio acțiune înregistrată.</td></tr>}
          </tbody>
        </table>
      </div></div>
    </Layout>
  );
}
