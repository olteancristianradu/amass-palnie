'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Segmented } from '@/components/indicators';
import { useT } from '@/lib/i18n';

interface U { id: string; email: string; name: string | null; role: string; active?: boolean; managerId: string | null; position?: string | null; department?: { id: string; name: string } | null; createdAt: string; _count: { clienti: number; reports: number }; crmCreds: { crmUser: string } | null; }
interface Dept { id: string; name: string; createdAt: string; _count: { users: number }; }

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
  const { t } = useT();
  const { u, children } = node;
  const has = children.length > 0;
  return (
    <li className="amass-org-li">
      <div className="amass-org-card">
        <div className="amass-org-name" title={u.email}>{u.name || u.email}</div>
        {u.position && <div className="amass-org-sub" style={{ fontWeight: 600, marginTop: 2 }}>{u.position}</div>}
        {u.department && <div className="amass-org-sub" style={{ marginTop: 1 }}>{u.department.name}</div>}
        <div className="amass-org-meta">
          <span className="pill pill-lucru">{t(ROLE_LABEL[u.role] ?? u.role)}</span>
          {u._count.reports > 0 && <span className="amass-org-sub">{u._count.reports} {t('în echipă')}</span>}
          <span className="amass-org-sub">{u._count.clienti} {t('clienți')}</span>
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
  const { t } = useT();
  const forest = buildForest(users);
  if (forest.length === 0) return <div className="p-10 text-center text-[var(--fg-soft)]">{t('Niciun cont încă.')}</div>;
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
  const { t } = useT();
  const [users, setUsers] = useState<U[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [msg, setMsg] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [f, setF] = useState({ email: '', password: '', name: '', role: 'agent' });
  const [view, setView] = useState<'arbore' | 'organigrama'>('arbore');
  const [reassignFor, setReassignFor] = useState<U | null>(null);
  const [reassignTo, setReassignTo] = useState('');
  // Departamente (admin): nume nou + redenumire inline.
  const [newDept, setNewDept] = useState('');
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  // Funcție (position) editată local înainte de salvare la blur, per user.
  const [posDraft, setPosDraft] = useState<Record<string, string>>({});

  async function load() {
    const r = await fetch('/api/users');
    if (r.status === 403) { setForbidden(true); return; }
    const j = await r.json();
    if (j.ok) setUsers(j.users);
  }
  async function loadDepts() {
    const r = await fetch('/api/admin/departamente');
    if (r.status === 403) return;
    const j = await r.json();
    if (j.ok) setDepts(j.departments);
  }
  useEffect(() => { load(); loadDepts(); }, []);

  // --- Departamente ---
  async function createDept(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const name = newDept.trim();
    if (!name) return;
    const r = await fetch('/api/admin/departamente', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const j = await r.json();
    if (j.ok) { setMsg('✅ ' + t('Departament creat: ') + name); setNewDept(''); await loadDepts(); }
    else setMsg('❌ ' + j.error);
  }
  async function renameDept(id: string) {
    setMsg('');
    const name = editDeptName.trim();
    if (!name) { setEditDeptId(null); return; }
    const r = await fetch('/api/admin/departamente', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, name }) });
    const j = await r.json();
    if (j.ok) { setMsg('✅ ' + t('Departament redenumit: ') + name); setEditDeptId(null); setEditDeptName(''); await loadDepts(); }
    else setMsg('❌ ' + j.error);
  }
  async function removeDept(d: Dept) {
    if (!window.confirm(`${t('Ștergi departamentul')} „${d.name}"?${d._count.users > 0 ? `\n\n${t('Cei')} ${d._count.users} ${t('utilizatori vor rămâne FĂRĂ departament (nu se șterg).')}` : ''}`)) return;
    setMsg('');
    const r = await fetch('/api/admin/departamente', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
    const j = await r.json();
    if (j.ok) { setMsg(`🗑 ${t('Departament șters:')} ${d.name}${j.detachedUsers ? ` (${j.detachedUsers} ${t('useri rămași fără departament')})` : ''}`); await loadDepts(); await load(); }
    else setMsg('❌ ' + j.error);
  }
  // --- Departament + funcție per user ---
  async function changeDepartment(id: string, departmentId: string) {
    setMsg('');
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, departmentId: departmentId || null }) });
    const j = await r.json();
    if (!j.ok) setMsg('❌ ' + j.error);
    await load(); await loadDepts();
  }
  async function savePosition(u: U) {
    const draft = posDraft[u.id];
    if (draft === undefined) return; // nimic schimbat
    const next = draft.trim();
    if ((u.position ?? '') === next) return; // identic, nu salvăm
    setMsg('');
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, position: next }) });
    const j = await r.json();
    if (j.ok) { setMsg('✅ ' + t('Funcție salvată: ') + (u.name || u.email)); await load(); }
    else setMsg('❌ ' + j.error);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const r = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json();
    if (j.ok) { setMsg('✅ ' + t('Cont creat: ') + f.email); setF({ email: '', password: '', name: '', role: 'agent' }); await load(); }
    else setMsg('❌ ' + j.error);
  }
  async function changeRole(id: string, role: string) {
    setMsg('');
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    const j = await r.json().catch(() => ({} as any));
    if (!j.ok) setMsg('❌ ' + (j.error || t('Nu s-a putut schimba rolul')));
    else setMsg('✅ ' + t('Rol actualizat'));
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
    const np = window.prompt(`${t('Parolă nouă pentru')} ${u.name || u.email} ${t('(min 6 caractere):')}`);
    if (np === null) return; // anulat
    if (np.length < 6) { setMsg('❌ ' + t('Parola trebuie să aibă minim 6 caractere')); return; }
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, password: np }) });
    const j = await r.json();
    setMsg(j.ok ? '✅ ' + t('Parolă resetată pentru ') + (u.name || u.email) : '❌ ' + j.error);
  }
  // Freeze/unfreeze: blochează/deblochează login-ul (fără să șteargă date).
  async function toggleActive(u: U) {
    const next = !(u.active !== false);
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, active: next }) });
    const j = await r.json();
    setMsg(j.ok ? (next ? '✅ ' + t('Cont reactivat: ') + (u.name || u.email) : '🔒 ' + t('Cont înghețat (login blocat): ') + (u.name || u.email)) : '❌ ' + j.error);
    await load();
  }
  // Ștergere cont. Dacă are clienți → oferă ștergere FORȚATĂ (pt duplicate) cu a doua confirmare.
  // Totul e DOAR în aplicație — NU atinge gestcom CRM.
  async function removeUser(u: U) {
    if (!window.confirm(`${t('Ștergi contul')} ${u.name || u.email}?`)) return;
    let r = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id }) });
    let j = await r.json();
    if (!j.ok && j.hasClients) {
      const ok = window.confirm(`${t('Contul')} „${u.name || u.email}" ${t('are')} ${j.hasClients} ${t('clienți')}.\n\n${t('Dacă e DUPLICAT și vrei să ștergi contul ȘI cei')} ${j.hasClients} ${t('clienți (IREVERSIBIL în aplicație — NU afectează CRM-ul gestcom), apasă OK.\nAltfel Anulează și folosește „Clienți →" (reasignare) sau „Îngheață".')}`);
      if (!ok) { setMsg(t('Anulat — contul NU a fost șters.')); return; }
      r = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, force: true }) });
      j = await r.json();
    }
    setMsg(j.ok ? `🗑 ${t('Cont șters:')} ${u.name || u.email}${j.deletedClients ? ` (+ ${j.deletedClients} ${t('clienți')})` : ''}` : '❌ ' + j.error);
    await load();
  }
  // Reasignare: mută toți clienții lui `u` către alt agent (DOAR în aplicație, NU în CRM).
  async function doReassign() {
    if (!reassignFor || !reassignTo) return;
    const r = await fetch('/api/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: reassignFor.id, reassignTo }) });
    const j = await r.json();
    const warn = j.ok && j.crmMismatch
      ? ` ⚠ ${t('Conturi CRM diferite')} (${j.srcCrmUser ?? '—'} → ${j.tgtCrmUser ?? '—'}) — ${t('sincronizarea/push-ul în CRM pot eșua sau nimeri greșit.')}`
      : '';
    setMsg(j.ok ? `✅ ${t('Mutați')} ${j.moved} ${t('clienți')}${j.skipped ? ` (${j.skipped} ${t('săriți — existau deja la destinație')})` : ''}. ${t('(doar în aplicație, nu în CRM)')}${warn}` : '❌ ' + j.error);
    setReassignFor(null); setReassignTo('');
    await load();
  }

  if (forbidden) return <Layout><div className="card card--pad text-center text-[var(--fg-soft)]" style={{ padding: 40 }}>{t('Doar administratorul poate gestiona conturile.')}</div></Layout>;

  const tree = buildTree(users);

  return (
    <Layout>
      <p className="text-[var(--fg-soft)] text-[13px] mb-5 rise">
        {t('Vizibilitatea e')} <b>{t('ierarhică')}</b>{t(': fiecare vede pâlnia lui + a')} <b>{t('tuturor celor de sub el')}</b> {t('în organigramă (recursiv, nu lateral). Setează')} <b>{t('managerul')}</b> {t('fiecărui cont pentru a construi arborele.')} <b>{t('Admin')}</b> {t('vede tot.')}
      </p>

      <div className="flex items-center gap-2 mb-3 rise">
        <span className="label">{t('Vizualizare ierarhie')}</span>
        <Segmented
          size="sm"
          value={view}
          onChange={v => setView(v as 'arbore' | 'organigrama')}
          options={[
            { value: 'arbore', label: t('Arbore') },
            { value: 'organigrama', label: t('Organigramă') },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-hidden rise rise-1">
          {view === 'arbore' ? (
          <div className="overflow-x-auto scroll-area">
            <table className="tbl">
              <thead><tr><th>{t('Nume (organigramă)')}</th><th>{t('Rol')}</th><th>{t('Departament')}</th><th>{t('Funcție')}</th><th>{t('Raportează către')}</th><th>{t('Echipă')}</th><th>{t('Clienți')}</th><th>{t('CRM')}</th><th>{t('Acțiuni')}</th></tr></thead>
              <tbody>
                {tree.map(({ u, depth }) => (
                  <tr key={u.id}>
                    <td className="font-semibold whitespace-nowrap">
                      <span style={{ paddingLeft: depth * 18 }} className="inline-flex items-center gap-1.5">
                        {depth > 0 && <span className="text-[var(--fg-soft)] opacity-50">└</span>}
                        {u.name || u.email}
                        {u.active === false && <span className="ml-1 pill pill-anulat !py-0 !px-1.5 !text-[9px]">{t('înghețat')}</span>}
                      </span>
                      <div className="text-[11px] text-[var(--fg-soft)] font-normal" style={{ paddingLeft: depth * 18 + (depth > 0 ? 16 : 0) }}>{u.email}</div>
                    </td>
                    <td>
                      <select className="pill border-0 cursor-pointer pill-lucru" value={u.role} onChange={e => changeRole(u.id, e.target.value)}>
                        {Object.keys(ROLE_LABEL).map(r => <option key={r} value={r}>{t(ROLE_LABEL[r])}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="field !py-1 !text-[12px] max-w-[160px]" value={u.department?.id ?? ''} onChange={e => changeDepartment(u.id, e.target.value)} title={t('Departament (grupare). Nu afectează rolul/vizibilitatea.')}>
                        <option value="">{t('— fără')}</option>
                        {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        className="field !py-1 !text-[12px] max-w-[150px]"
                        placeholder={t('ex. Coordonator Vânzări')}
                        value={posDraft[u.id] ?? u.position ?? ''}
                        onChange={e => setPosDraft({ ...posDraft, [u.id]: e.target.value })}
                        onBlur={() => savePosition(u)}
                        title={t('Funcție / titlu (text liber). Salvat automat când ieși din câmp.')}
                      />
                    </td>
                    <td>
                      <select className="field !py-1 !text-[12px] max-w-[160px]" value={u.managerId ?? ''} onChange={e => changeManager(u.id, e.target.value)}>
                        <option value="">{t('— (rădăcină)')}</option>
                        {users.filter(o => o.id !== u.id).map(o => <option key={o.id} value={o.id}>{o.name || o.email}</option>)}
                      </select>
                    </td>
                    <td className="tabular text-center">{u._count.reports > 0 ? u._count.reports : '—'}</td>
                    <td className="tabular">{u._count.clienti}</td>
                    <td className="text-[11px] text-[var(--fg-soft)]">{u.crmCreds?.crmUser ?? '—'}</td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        <button type="button" onClick={() => resetPassword(u)} className="btn btn-secondary !py-1 !px-2 !text-[11px] whitespace-nowrap">{t('Resetează parola')}</button>
                        <button type="button" onClick={() => toggleActive(u)} className="btn btn-secondary !py-1 !px-2 !text-[11px] whitespace-nowrap" title={t('Blochează/deblochează login-ul (fără să ștergi date)')}>{u.active === false ? t('▶ Reactivează') : t('🔒 Îngheață')}</button>
                        <button type="button" onClick={() => { setReassignFor(u); setReassignTo(''); }} className="btn btn-secondary !py-1 !px-2 !text-[11px] whitespace-nowrap" title={t('Mută clienții acestui cont către alt agent (doar în aplicație, NU în CRM)')}>↪ {t('Clienți')} ({u._count.clienti})</button>
                        <button type="button" onClick={() => removeUser(u)} className="btn btn-secondary !py-1 !px-2 !text-[11px] whitespace-nowrap !text-[var(--danger)]" title={t('Șterge contul (cu opțiune de ștergere forțată pt duplicate)')}>🗑 {t('Șterge')}</button>
                      </div>
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

        <div className="space-y-4 self-start">
        {/* CARD Departamente — grupare gestionată de admin. NU înlocuiește rolurile de permisiuni. */}
        <div className="card card--pad rise rise-2 space-y-3">
          <div className="panel-head"><span className="dot" />{t('Departamente')}</div>
          <p className="text-[11px] text-[var(--fg-soft)] -mt-1">{t('Grupare a echipei (ex. „Vânzări", „Logistică"). Nu afectează rolul de permisiuni sau vizibilitatea — alocarea pe user e în tabelul „Departament".')}</p>
          <form onSubmit={createDept} className="flex gap-2">
            <input className="field flex-1" placeholder={t('Nume departament nou')} value={newDept} onChange={e => setNewDept(e.target.value)} />
            <button className="btn btn-primary whitespace-nowrap" disabled={!newDept.trim()}>{t('Creează')}</button>
          </form>
          {depts.length === 0 ? (
            <div className="text-[12px] text-[var(--fg-soft)] py-1">{t('Niciun departament încă.')}</div>
          ) : (
            <ul className="space-y-1.5">
              {depts.map(d => (
                <li key={d.id} className="flex items-center gap-2">
                  {editDeptId === d.id ? (
                    <>
                      <input
                        className="field !py-1 !text-[12px] flex-1"
                        value={editDeptName}
                        autoFocus
                        onChange={e => setEditDeptName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameDept(d.id); if (e.key === 'Escape') { setEditDeptId(null); setEditDeptName(''); } }}
                      />
                      <button type="button" onClick={() => renameDept(d.id)} className="btn btn-primary !py-1 !px-2 !text-[11px]">{t('Salvează')}</button>
                      <button type="button" onClick={() => { setEditDeptId(null); setEditDeptName(''); }} className="btn btn-secondary !py-1 !px-2 !text-[11px]">{t('Anulează')}</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{d.name}</span>
                      <span className="pill pill-lucru !text-[10px] whitespace-nowrap">{d._count.users} {t('useri')}</span>
                      <button type="button" onClick={() => { setEditDeptId(d.id); setEditDeptName(d.name); }} className="btn btn-secondary !py-1 !px-2 !text-[11px]" title={t('Redenumește')}>{t('Redenumește')}</button>
                      <button type="button" onClick={() => removeDept(d)} className="btn btn-secondary !py-1 !px-2 !text-[11px] !text-[var(--danger)]" title={t('Șterge departamentul (userii rămân fără departament)')}>🗑</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={create} className="card card--pad rise rise-2 space-y-3">
          <div className="panel-head"><span className="dot" />{t('Adaugă cont')}</div>
          <div><label className="label block mb-1">{t('Nume')}</label><input className="field" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div><label className="label block mb-1">{t('Email firmă')}</label><input className="field" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></div>
          <div><label className="label block mb-1">{t('Parolă (min 6)')}</label><input className="field" type="text" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required /></div>
          <div><label className="label block mb-1">{t('Rol')}</label>
            <select className="field" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
              <option value="agent">{t('Agent')}</option>
              <option value="manager">{t('Manager')}</option>
              <option value="admin">{t('Admin — gestionează conturi')}</option>
            </select>
            <p className="text-[11px] text-[var(--fg-soft)] mt-1">{t('Vizibilitatea vine din organigramă (managerul fiecăruia), nu din rol. Setează managerul în tabel după creare.')}</p>
          </div>
          <button className="btn btn-primary w-full justify-center">{t('Creează cont')}</button>
          {msg && <div className={'toast ' + (msg.startsWith('✅') ? 'toast-ok' : 'toast-err')}>{msg}</div>}
        </form>
        </div>
      </div>

      {/* MODAL reasignare clienți — DOAR în aplicație, nu în CRM */}
      {reassignFor && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-6" style={{ background: 'var(--overlay)' }} onClick={() => setReassignFor(null)}>
          <div className="card card--pad !shadow-[var(--shadow-lg)] max-w-md w-full rise" onClick={e => e.stopPropagation()}>
            <h2 className="text-[17px] mb-1">{t('Reasignează clienții lui')} {reassignFor.name || reassignFor.email}</h2>
            <p className="text-[12px] text-[var(--fg-soft)] mb-3">
              {t('Mută cei')} <b>{reassignFor._count.clienti}</b> {t('clienți către alt agent.')} <b className="text-[var(--text)]">{t('Doar în aplicație — NU în gestcom CRM.')}</b> {t('Clienții al căror')} <i>id_lucrare</i> {t('există deja la destinație (duplicate) sunt săriți.')}
            </p>
            <label className="label block mb-1">{t('Mută către')}</label>
            <select className="field w-full mb-4" value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
              <option value="">{t('— alege agentul —')}</option>
              {users.filter(o => o.id !== reassignFor.id).map(o => <option key={o.id} value={o.id}>{o.name || o.email} · {o.role} ({o._count.clienti} {t('clienți')})</option>)}
            </select>
            {(() => {
              if (!reassignTo) return null;
              const dest = users.find(o => o.id === reassignTo);
              if (!dest) return null;
              const srcCrm = reassignFor.crmCreds?.crmUser ?? null;
              const dstCrm = dest.crmCreds?.crmUser ?? null;
              if (srcCrm === dstCrm) return null;
              return (
                <div className="toast toast-err mb-4 !text-left" style={{ whiteSpace: 'normal' }}>
                  ⚠ {reassignFor.name || reassignFor.email} {t('și')} {dest.name || dest.email} {t('au conturi CRM diferite')} ({srcCrm ?? t('— lipsă')} vs {dstCrm ?? t('— lipsă')}).
                  {t('După reasignare, sincronizarea și push-ul în CRM pentru acești clienți pot eșua sau nimeri greșit, fiindcă lucrările rămân în contul gestcom al lui')} {reassignFor.name || reassignFor.email}. {t('Continui?')}
                </div>
              );
            })()}
            <div className="flex justify-end gap-2">
              <button onClick={() => setReassignFor(null)} className="btn btn-secondary">{t('Anulează')}</button>
              <button onClick={doReassign} disabled={!reassignTo} className="btn btn-primary">{t('Mută clienții')}</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
