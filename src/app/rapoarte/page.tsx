'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';

interface Rep { file: string; title: string; }

export default function RapoartePage() {
  const [reports, setReports] = useState<Rep[]>([]);
  const [active, setActive] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/rapoarte').then(r => r.json()).then(j => {
      if (j.ok) { setReports(j.reports); if (j.reports[0]) open(j.reports[0].file); }
    });
  }, []);

  async function open(file: string) {
    setActive(file); setLoading(true);
    const r = await fetch('/api/rapoarte?file=' + encodeURIComponent(file));
    const j = await r.json();
    setContent(j.ok ? j.content : '⚠️ ' + (j.error || 'eroare'));
    setLoading(false);
  }

  return (
    <Layout>
      <h1 className="text-[26px] mb-1 rise">Rapoarte</h1>
      <p className="text-[var(--fg-soft)] text-[13px] mb-5 rise">
        Toate analizele și livrabilele într-un singur loc — audit clienți, stare sincronizare, recapitulare, modificări fișă.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-4">
        <div className="card p-2 rise rise-1 self-start">
          {reports.length === 0 && <div className="p-3 text-[12.5px] text-[var(--fg-faint)]">Niciun raport.</div>}
          {reports.map(r => (
            <button key={r.file} onClick={() => open(r.file)}
              className={'w-full text-left px-3 py-2.5 rounded-[var(--radius-sm)] text-[13px] transition-colors '
                + (active === r.file ? 'bg-[var(--ember-soft)] text-[var(--ember-deep)] font-semibold' : 'hover:bg-[var(--paper)] text-[var(--fg-soft)]')}>
              {r.title}
            </button>
          ))}
        </div>
        <div className="card p-6 rise rise-2 overflow-x-auto scroll-area">
          {loading ? <div className="text-[var(--fg-soft)]">Se încarcă…</div> : <Markdown src={content} />}
        </div>
      </div>
    </Layout>
  );
}

// Renderer markdown compact: titluri, bold, tabele, hr, citate, liste, paragrafe.
function Markdown({ src }: { src: string }) {
  const inline = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
     .replace(/`([^`]+)`/g, '<code class="font-mono text-[12px] bg-[var(--paper)] px-1 py-0.5 rounded">$1</code>');

  const lines = src.split('\n');
  const out: React.ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // tabel
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const head = line.split('|').slice(1, -1).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      out.push(
        <div key={key++} className="overflow-x-auto my-3">
          <table className="w-full border-collapse text-[12.5px]">
            <thead><tr>{head.map((h, j) => <th key={j} className="text-left font-semibold p-2 border-b-2 border-[var(--line-2)] bg-[var(--paper)]" dangerouslySetInnerHTML={{ __html: inline(h) }} />)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="p-2 border-b border-[var(--line)] align-top" dangerouslySetInnerHTML={{ __html: inline(c) }} />)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^### /.test(line)) { out.push(<h3 key={key++} className="font-display text-[16px] font-semibold mt-4 mb-1.5" dangerouslySetInnerHTML={{ __html: inline(line.slice(4)) }} />); i++; continue; }
    if (/^## /.test(line)) { out.push(<h2 key={key++} className="font-display text-[20px] font-semibold mt-5 mb-2 pb-1 border-b border-[var(--line)]" dangerouslySetInnerHTML={{ __html: inline(line.slice(3)) }} />); i++; continue; }
    if (/^# /.test(line)) { out.push(<h1 key={key++} className="font-display text-[24px] font-semibold mt-2 mb-2" dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push(<hr key={key++} className="my-4 border-[var(--line)]" />); i++; continue; }
    if (/^>\s?/.test(line)) { out.push(<blockquote key={key++} className="border-l-4 border-[var(--ember)] pl-3 my-2 text-[var(--fg-soft)] italic" dangerouslySetInnerHTML={{ __html: inline(line.replace(/^>\s?/, '')) }} />); i++; continue; }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      out.push(<ul key={key++} className="list-disc pl-5 my-2 space-y-1 text-[13px]">{items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: inline(it) }} />)}</ul>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    out.push(<p key={key++} className="my-2 text-[13px] leading-relaxed" dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    i++;
  }
  return <div>{out}</div>;
}
