'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';

interface U { id: string; email: string; name: string | null; role: string; managerId: string | null; createdAt: string; _count: { clienti: number; reports: number }; crmCreds: { crmUser: string } | null; }

const ROLE_LABEL: Record<string, string> = { agent: 'Agent', manager: 'Manager', admin: 'Admin' };

// Calculează adâncimea fiecărui user în arbore + ordinea de afișare (DFS), pentru indentare vizuală.
function buildTree(users: U[]): Array<{ u: U; depth: number }> {
  const childrenOf = new Map<string | null, U[]>();
  for (const u of users) {
    const k = u.managerId ?? null;
    const arr = childrenOf.get(k) ?? [];
    arr.push(u); childrenOf.set(k, arr);
  }
  // Rădăcini = useri fără manager SAU al căror manager nu există în listă
  const ids = new Set(users.map(u => u.id));
  const roots = users.filter(u => !u.managerId || !ids.has(u.managerId));
  const out: Array<{ u: U; depth: number }> = [];
  const seen = new Set<string>();
  const walk = (u: U, depth: number) => {
    if (seen.has(u.id)) return; seen.add(u.id);
    out.push({ u, depth });
    for (const c of (childrenOf.get(u.id) ?? [])) walk(c, depth + 1);
  };
  roots.forEach(r => walk(r, 0));
  // orice user neatins (ciclu accidental) — adaugă-l la final, depth 0
  users.forEach(u => { if (!seen.has(u.id)) { seen.add(u.id); out.push({ u, depth: 0 }); } });
  return out;
}

// Construiește nodurile arborelui (rădăcini + copii recursiv) pentru organigrama grafică.
interface OrgNode { u: U; children: OrgNode[]; }
function buildForest(users: U[]): OrgNode[] {
  const childrenOf = new Map<string | null, U[]>();
  for (const u of users) {
    const k = u.managerId ?? null;
    const arr = childrenOf.get(k) ?? [];
    arr.push(u); childrenOf.set(k, arr);
  }
  const ids = new Set(users.map(u => u.id));
  const roots = users.filter(u => !u.managerId || !ids.has(u.managerId));
  const seen = new Set<string>();
  const make = (u: U): OrgNode => {
    seen.add(u.id);
    return { u, children: (childrenOf.get(u.id) ?? []).filter(c => !seen.has(c.id)).map(make) };
  };
  const forest = roots.map(make);
  // useri neatinși (ciclu accidental) → noduri rădăcină separate
  users.forEach(u => { if (!seen.has(u.id)) { seen.add(u.id); forest.push({ u, children: [] }); } });
  return forest;
}

// CSS scoped sub prefix amass-org-* (fără librării, fără styled-jsx — doar un <style> simplu).
const ORG_CSS = `
.amass-org-scroll { overflow-x: auto; padding: 24px 16px 8px; }
.amass-org-root, .amass-org-children { list-style: none; margin: 0; padding: 0; display: flex; justify-content: center; }
.amass-org-root { gap: 28px; }
.amass-org-li { position: relative; display: flex; flex-direction: column; align-items: center; padding: 0 10px; }
/* conector vertical de la cutie în jos către rândul de copii */
.amass-org-children { padding-top: 22px; }
.amass-org-children > .amass-org-li::before {
  content: ''; position: absolute; top: 0; left: 50%;
  width: 1.5px; height: 22px; background: var(--border); transform: translateX(-50%);
}
/* linia orizontală care leagă frații */
.amass-org-children > .amass-org-li::after {
  content: ''; position: absolute; top: 0; height: 1.5px; background: var(--border);
  left: -10px; right: -10px;
}
.amass-org-children > .amass-org-li:first-child::after { left: 50%; }
.amass-org-children > .amass-org-li:last-child::after { right: 50%; }
.amass-org-children > .amass-org-li:only-child::after { display: none; }
/* segment vertical de la cutia părinte în jos către linia copiilor */
.amass-org-li:has(> .amass-org-children)::after {
  content: ''; position: absolute; bottom: 0; left: 50%;
  width: 1.5px; height: 22px; background: var(--border); transform: translateX(-50%);
}
.amass-org-card {
  position: relative; z-index: 1;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-sm); padding: 10px 14px; min-width: 150px; max-width: 220px;
  text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.amass-org-name { font-weight: 600; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.amass-org-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; margin-top: 6px; }
.amass-org-sub { font-size: 11px; color: var(--fg-soft); }
`;

// O cutie + (dacă are subordonați) conectori CSS + rândul de copii. Pur CSS, fără librării.
function OrgBox({ node }: { node: OrgNode }) {
  const { u, children } = node;
  const has = children.length > 0;
  return (
    <li className="amass-org-li">
      <div className="amass-org-card">
        <div className="amass-org-name" title={u.email}>{u.name || u.email}</div>
        <div className="amass-org-meta">
          <span className="pill pill-lucru">{ROLE_LABEL[u.role] ?? u.role}</span>
          {u._count.reports > 0 && <span className="amass-org-sub">{u._count.reports} în echipă</span>}
          <span className="amass-org-sub">{u._count.clienti} clienți</span>
        </div>
      </div>
      {has && (
        <ul className="amass-org-children">
          {children.map(c => <OrgBox key={c.u.id} node={c} />)}
        </ul>
      )}
    </li>
  );
}

function OrgChart({ users }: { users: U[] }) {
  const forest = buildForest(users);
  if (forest.length === 0) return <div className="p-10 text-center text-[var(--fg-soft)]">Niciun cont încă.</div>;
  return (
    <div className="amass-org-scroll scroll-area">
      <style dangerouslySetInnerHTML={{ __html: ORG_CSS }} />
      <ul className="amass-org-root">
        {forest.map(n => <OrgBox key={n.u.id} node={n} />)}
      </ul>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [msg, setMsg] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [f, setF] = useState({ email: '', password: '', name: '', role: 'agent' });
  const [view, setView] = useState<'arbore' | 'organigrama'>('arbore');

  async function load() {
    const r = await fetch('/api/users');
    if (r.status === 403) { setForbidden(true); return; }
    const j = await r.json();
    if (j.ok) setUsers(j.users);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json();
    if (j.ok) { setMsg('✅ Cont creat: ' + f.email); setF({ email: '', password: '', name: '', role: 'agent' }); await load(); }
    else setMsg('❌ ' + j.error);
  }
  async function changeRole(id: string, role: string) {
    await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    await load();
  }
  async function changeManager(id: string, managerId: string) {
    setMsg('');
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, managerId: managerId || null }) });
    const j = await r.json();
    if (!j.ok) setMsg('❌ ' + j.error);
    await load();
  }
  async function resetPassword(u: U) {
    setMsg('');
    const np = window.prompt(`Parolă nouă pentru ${u.name || u.email} (min 6 caractere):`);
    if (np === null) return; // anulat
    if (np.length < 6) { setMsg('❌ Parola trebuie să aibă minim 6 caractere'); return; }
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, password: np }) });
    const j = await r.json();
    setMsg(j.ok ? '✅ Parolă resetată pentru ' + (u.name || u.email) : '❌ ' + j.error);
  }

  if (forbidden) return <Layout><div className="card p-10 text-center text-[var(--fg-soft)]">Doar administratorul poate gestiona conturile.</div></Layout>;

  const tree = buildTree(users);

  return (
    <Layout>
      <h1 className="text-[26px] mb-1 rise">Echipă & roluri</h1>
      <p className="text-[var(--fg-soft)] text-[13px] mb-5 rise">
        Vizibilitatea e <b>ierarhică</b>: fiecare vede pâlnia lui + a <b>tuturor celor de sub el</b> în organigramă (recursiv, nu lateral). Setează <b>managerul</b> fiecărui cont pentru a construi arborele. <b>Admin</b> vede tot.
      </p>

      <div className="flex items-center gap-2 mb-3 rise">
        <span className="kpi-label">Vizualizare ierarhie:</span>
        <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--border)] overflow-hidden">
          <button type="button" onClick={() => setView('arbore')}
            className={'px-3 py-1 text-[12px] font-semibold transition-colors ' + (view === 'arbore' ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg-soft)] hover:text-[var(--text)]')}>
            Arbore
          </button>
          <button type="button" onClick={() => setView('organigrama')}
            className={'px-3 py-1 text-[12px] font-semibold transition-colors border-l border-[var(--border)] ' + (view === 'organigrama' ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg-soft)] hover:text-[var(--text)]')}>
            Organigramă
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-hidden rise rise-1">
          {view === 'arbore' ? (
          <div className="overflow-x-auto scroll-area">
            <table className="tbl">
              <thead><tr><th>Nume (organigramă)</th><th>Rol</th><th>Raportează către</th><th>Echipă</th><th>Clienți</th><th>CRM</th><th>Acțiuni</th></tr></thead>
              <tbody>
                {tree.map(({ u, depth }) => (
                  <tr key={u.id}>
                    <td className="font-semibold whitespace-nowrap">
                      <span style={{ paddingLeft: depth * 18 }} className="inline-flex items-center gap-1.5">
                        {depth > 0 && <span className="text-[var(--fg-soft)] opacity-50">└</span>}
                        {u.name || u.email}
                      </span>
                      <div className="text-[11px] text-[var(--fg-soft)] font-normal" style={{ paddingLeft: depth * 18 + (depth > 0 ? 16 : 0) }}>{u.email}</div>
                    </td>
                    <td>
                      <select className="pill border-0 cursor-pointer pill-lucru" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                        {Object.keys(ROLE_LABEL).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="field !py-1 !text-[12px] max-w-[160px]" value={u.managerId ?? ''} onChange={e => changeManager(u.id, e.target.value)}>
                        <option value="">— (rădăcină)</option>
                        {users.filter(o => o.id !== u.id).map(o => <option key={o.id} value={o.id}>{o.name || o.email}</option>)}
                      </select>
                    </td>
                    <td className="tabular text-center">{u._count.reports > 0 ? u._count.reports : '—'}</td>
                    <td className="tabular">{u._count.clienti}</td>
                    <td className="text-[11px] text-[var(--fg-soft)]">{u.crmCreds?.crmUser ?? '—'}</td>
                    <td>
                      <button type="button" onClick={() => resetPassword(u)} className="btn btn-secondary !py-1 !px-2 !text-[11px] whitespace-nowrap">
                        Resetează parola
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
            <OrgChart users={users} />
          )}
        </div>

        <form onSubmit={create} className="card p-5 rise rise-2 space-y-3 self-start">
          <div className="panel-head"><span className="dot" />Adaugă cont</div>
          <div><label className="kpi-label block mb-1">Nume</label><input className="field" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="kpi-label block mb-1">Email firmă</label><input className="field" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></div>
          <div><label className="kpi-label block mb-1">Parolă (min 6)</label><input className="field" type="text" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></div>
          <div><label className="kpi-label block mb-1">Rol</label>
            <select className="field" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin — gestionează conturi</option>
            </select>
            <p className="text-[11px] text-[var(--fg-soft)] mt-1">Vizibilitatea vine din organigramă (managerul fiecăruia), nu din rol. Setează managerul în tabel după creare.</p>
          </div>
          <button className="btn btn-primary w-full justify-center">Creează cont</button>
          {msg && <div className={'toast ' + (msg.startsWith('✅') ? 'toast-ok' : 'toast-err')}>{msg}</div>}
        </form>
      </div>
    </Layout>
  );
}
