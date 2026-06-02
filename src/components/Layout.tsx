'use client';
import { useState, useEffect } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';

// Meniu pe SECȚIUNI. roles pe grup = doar acele roluri văd grupul.
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
  const { t } = useT();
  const [collapsed, setCollapsed] = useState(false);   // meniu desktop pliat (mai mult loc)
  const [mobileOpen, setMobileOpen] = useState(false);  // sertar pe telefon
  useEffect(() => { try { if (localStorage.getItem('amass-nav') === '0') setCollapsed(true); } catch {} }, []);
  const toggleCollapsed = () => setCollapsed(c => { const n = !c; try { localStorage.setItem('amass-nav', n ? '0' : '1'); } catch {} return n; });

  // Conținutul meniului (folosit ȘI în sidebar-ul desktop, ȘI în sertarul mobil).
  const navInner = (onNavigate?: () => void) => (
    <>
      <div className="px-2 mb-7 flex items-center gap-2.5 pr-8">
        <img src="/logo-amass.png" alt="AMASS" className="h-7 w-auto" />
        <div className="leading-tight min-w-0">
          <div className="text-[14px] font-display font-bold text-[var(--text)] truncate">Pâlnie Clienți</div>
          <div className="text-[10.5px] text-[var(--text-muted)] truncate max-w-[150px]">{session?.user?.name || 'Agent'}</div>
        </div>
      </div>
      <nav className="flex flex-col">
        {NAV.filter(g => !g.roles || g.roles.includes(role)).map((g, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
            {g.section && <div className="sidebar__section-label">{t(g.section)}</div>}
            {g.items.map(n => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href} onClick={onNavigate} className={'sidebar-link' + (active ? ' active' : '')}>
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
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="sidebar-link w-full text-[12px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          {t('Ieșire')}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR DESKTOP — în flux, ascuns pe telefon; colapsabil pe desktop */}
      <aside className={'sidebar w-[220px] flex-shrink-0 flex-col px-3.5 py-5 sticky top-0 h-screen relative ' + (collapsed ? 'hidden' : 'hidden md:flex')}>
        <button onClick={toggleCollapsed} title="Ascunde meniul" className="absolute top-3 right-2.5 text-[var(--text-muted)] hover:text-[var(--text)] text-[18px] leading-none">«</button>
        {navInner()}
      </aside>

      {/* SERTAR MOBIL — overlay peste conținut, doar pe telefon */}
      {mobileOpen && <div onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-black/40 z-40 md:hidden" />}
      <aside className={'sidebar w-[78vw] max-w-[300px] flex flex-col px-4 py-5 fixed inset-y-0 left-0 z-50 md:hidden overflow-y-auto transition-transform duration-200 ' + (mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
        <button onClick={() => setMobileOpen(false)} title="Închide" className="absolute top-3 right-3 text-[var(--text-muted)] text-[22px] leading-none">×</button>
        {navInner(() => setMobileOpen(false))}
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        {/* Bară subțire DOAR pe telefon (hamburger + titlu) */}
        <div className="md:hidden sticky top-0 z-40 h-12 flex items-center gap-2 px-3 bg-[var(--bg)] border-b border-[var(--border)]">
          <button onClick={() => setMobileOpen(true)} title="Meniu" aria-label="Meniu"
            className="w-9 h-9 rounded-[var(--r-sm)] grid place-items-center text-[18px] text-[var(--text)] hover:bg-[var(--surface-2)]">☰</button>
          <span className="font-display font-bold text-[14px] text-[var(--text)]">Pâlnie Clienți</span>
        </div>
        {/* Buton de re-deschidere pe DESKTOP când meniul e pliat */}
        {collapsed && (
          <button onClick={toggleCollapsed} title="Arată meniul"
            className="hidden md:grid fixed top-2 left-2 z-40 w-9 h-9 rounded-[var(--r-sm)] bg-[var(--surface)] border border-[var(--border-strong)] shadow place-items-center text-[16px] text-[var(--text)] hover:bg-[var(--surface-2)]">☰</button>
        )}
        <div className="flex-1 min-w-0 px-4 md:px-6 py-4 md:py-6">{children}</div>
      </main>
    </div>
  );
}
