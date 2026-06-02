'use client';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

// Meniu pe SECȚIUNI. roles pe grup = doar acele roluri văd grupul.
// „Administrare" (admin/manager) ține uneltele de gestiune; agentul vede doar Lucru + Cont.
type NavGroup = { section?: string; roles?: string[]; items: { href: string; label: string; icon: string }[] };
const NAV: NavGroup[] = [
  { items: [
    { href: '/palnie', label: 'Pâlnie', icon: 'funnel' },
    { href: '/dashboard', label: 'Dashboard', icon: 'chart' }
  ] },
  { section: 'Administrare', roles: ['admin', 'manager'], items: [
    { href: '/users', label: 'Echipă', icon: 'team' },
    { href: '/audit', label: 'Jurnal', icon: 'list' },
    { href: '/arhiva', label: 'Arhivă', icon: 'archive' }
  ] },
  // Grup doar-admin: configurarea formatului fișei de strategie.
  { section: 'Configurare', roles: ['admin'], items: [
    { href: '/admin/fisa', label: 'Format fișă', icon: 'sheet' }
  ] },
  { section: 'Cont', items: [
    { href: '/settings', label: 'Setări', icon: 'gear' }
  ] }
];

function Icon({ name }: { name: string }) {
  const p: Record<string, React.ReactNode> = {
    funnel: <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />,
    sheet: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M9 12h6" /></>,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M20 20H3" />,
    report: <><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M14 3v5h5M9 13h6M9 17h6M9 9h2" /></>,
    palette: <><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2a10 10 0 100 20 2 2 0 002-2 1.9 1.9 0 00-.5-1.3 2 2 0 01-.5-1.3 2 2 0 012-2H17a5 5 0 005-5c0-4.9-4.5-8.4-10-8.4z" /></>,
    kanban: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M16 7a3 3 0 010 6M21 20a6 6 0 00-5-5.9" /></>
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname() || '';
  const role = ((session?.user as any)?.role as string) || 'agent';
  const { lang, setLang, t } = useT();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sidebar w-[220px] flex-shrink-0 flex flex-col px-3.5 py-5 sticky top-0 h-screen">
        <div className="px-2 mb-7 flex items-center gap-2.5">
          <img src="/logo-amass.png" alt="AMASS" className="h-7 w-auto" />
          <div className="text-[10px] uppercase tracking-[.18em] text-[var(--text-muted)] font-semibold leading-tight">Energy<br/>Console</div>
        </div>
        <nav className="flex flex-col">
          {NAV.filter(g => !g.roles || g.roles.includes(role)).map((g, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {g.section && <div className="sidebar__section-label">{t(g.section)}</div>}
              {g.items.map(n => {
                const active = pathname === n.href || pathname.startsWith(n.href + '/');
                return (
                  <Link key={n.href} href={n.href} className={'sidebar-link' + (active ? ' active' : '')}>
                    <Icon name={n.icon} />{t(n.label)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto pt-4 border-t border-[var(--border)]">
          <div className="px-2 mb-2 flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] grid place-items-center font-display font-bold text-[13px] flex-shrink-0">
              {(session?.user?.name || 'A').trim().charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-[var(--text)] font-medium truncate">{session?.user?.name || 'Agent'}</div>
              <div className="text-[10px] text-[var(--text-muted)] truncate">{session?.user?.email}</div>
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="sidebar-link w-full text-[12px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            {t('Ieșire')}
          </button>
        </div>
      </aside>

      {/* Workspace — min-w-0 permite copiilor să se micșoreze; scroll-ul orizontal e DOAR în tabele */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Bară de sus: comutator limbă RO/EN în dreapta (app-wide) */}
        <div className="h-11 border-b border-[var(--border)] flex items-center justify-end gap-3 px-6 sticky top-0 z-30 bg-[var(--bg)]">
          <div className="inline-flex rounded-[var(--r-sm)] border border-[var(--border-strong)] overflow-hidden text-[11px] font-semibold">
            <button onClick={() => setLang('ro')} title="Română" className={'px-2.5 py-1 ' + (lang === 'ro' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>RO</button>
            <button onClick={() => setLang('en')} title="English" className={'px-2.5 py-1 border-l border-[var(--border-strong)] ' + (lang === 'en' ? 'bg-[var(--accent)] text-[var(--on-accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]')}>EN</button>
          </div>
        </div>
        <div className="flex-1 min-w-0 px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
