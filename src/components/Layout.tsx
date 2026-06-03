'use client';
import { useState, useEffect, useRef } from 'react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n';
import { Icon } from './Icon';

// Meniu pe SECȚIUNI. roles pe grup = doar acele roluri văd grupul.
type NavGroup = { section?: string; roles?: string[]; items: { href: string; label: string; icon: string }[] };
const NAV: NavGroup[] = [
  { items: [
    { href: '/palnie', label: 'Pâlnie clienți', icon: 'funnel' },
    { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  ] },
  { section: 'Administrare', roles: ['admin', 'manager'], items: [
    { href: '/users', label: 'Echipă', icon: 'users' },
    { href: '/audit', label: 'Jurnal', icon: 'list' },
    { href: '/arhiva', label: 'Arhivă', icon: 'archive' },
  ] },
  { section: 'Configurare', roles: ['admin'], items: [
    { href: '/admin/fisa', label: 'Format fișă', icon: 'sheet' },
  ] },
  { section: 'Cont', items: [
    { href: '/settings', label: 'Setări', icon: 'settings' },
    { href: '/aspect', label: 'Aspect', icon: 'palette' },
  ] },
];

const TITLES: Record<string, string> = {
  '/palnie': 'Pâlnie clienți', '/dashboard': 'Dashboard', '/users': 'Echipă', '/audit': 'Jurnal',
  '/arhiva': 'Arhivă', '/admin/fisa': 'Format fișă', '/admin/import': 'Import date',
  '/settings': 'Setări', '/aspect': 'Aspect aplicație', '/rapoarte': 'Rapoarte',
};

export function Layout({ children, title, topbar, contentMod }: {
  children: React.ReactNode; title?: string; topbar?: React.ReactNode; contentMod?: string;
}) {
  const { data: session } = useSession();
  const pathname = usePathname() || '';
  const role = ((session?.user as any)?.role as string) || 'agent';
  const { t } = useT();
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => { try { if (localStorage.getItem('amass-nav') === '0') setCollapsed(true); } catch {} }, []);
  useEffect(() => { setNavOpen(false); }, [pathname]); // închide sertarul la navigare
  const toggleCollapsed = () => setCollapsed(c => { const n = !c; try { localStorage.setItem('amass-nav', n ? '0' : '1'); } catch {} return n; });

  const name = session?.user?.name || 'Agent';
  const initial = (name.trim().charAt(0) || 'A').toUpperCase();
  let pageTitle = title || TITLES[pathname] || '';
  if (!pageTitle) { for (const k of Object.keys(TITLES)) if (pathname.startsWith(k + '/')) { pageTitle = TITLES[k]; break; } }

  return (
    <div className={'app' + (collapsed ? ' is-collapsed' : '')}>
      <aside ref={sidebarRef} className={'sidebar' + (navOpen ? ' is-open' : '')}>
        <div className="sidebar__brand">
          {/* Emblema AMASS — roșu FIX (--brand-red), nu urmează accentul (regulă de brand). */}
          <span className="brand-lock">
            <svg className="amass-mark" width={32} height={32} viewBox="0 0 100 100" aria-hidden="true" style={{ color: 'var(--brand-red,#CC0000)' }}>
              <defs><clipPath id="amclip"><rect x="7" y="7" width="86" height="86" rx="17" /></clipPath></defs>
              <g clipPath="url(#amclip)">{[-64, -32, 0, 32, 64].map((o, i) => <line key={i} x1={o} y1="100" x2={o + 100} y2="0" stroke="currentColor" strokeWidth="9" />)}</g>
              <rect x="7" y="7" width="86" height="86" rx="17" fill="none" stroke="currentColor" strokeWidth="9" />
            </svg>
            <span className="brand-text navitem__lbl">
              <span className="brand-word">AMASS<sup>®</sup></span>
              <span className="brand-sub">Pâlnie de vânzări</span>
            </span>
          </span>
          <button className="sidebar__collapse btn btn-ghost btn-icon btn-sm" title={collapsed ? 'Extinde meniul' : 'Restrânge meniul'} onClick={toggleCollapsed}><Icon name={collapsed ? 'chevR' : 'chevL'} size={16} /></button>
          <button className="sidebar__close btn btn-ghost btn-icon btn-sm" onClick={() => setNavOpen(false)}><Icon name="x" size={18} /></button>
        </div>
        <nav className="sidebar__nav scroll-thin">
          {NAV.filter(g => !g.roles || g.roles.includes(role)).map((g, gi) => (
            <div key={gi}>
              {g.section && <div className="sidebar__lbl navitem__lbl">{t(g.section)}</div>}
              {g.items.map(n => {
                const active = pathname === n.href || pathname.startsWith(n.href + '/');
                return (
                  <Link key={n.href} href={n.href} className={'navitem' + (active ? ' is-on' : '')} title={t(n.label)}>
                    <Icon name={n.icon} size={18} /><span className="navitem__lbl">{t(n.label)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="avatar">{initial}</div>
          <div className="navitem__lbl" style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
            <b style={{ fontSize: '.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</b>
            <small className="muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session?.user?.email}</small>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm navitem__lbl" title="Ieșire" onClick={() => signOut({ callbackUrl: '/login' })}><Icon name="logout" size={17} /></button>
        </div>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="topbar__menu btn btn-ghost btn-icon" onClick={() => setNavOpen(true)} aria-label="Meniu"><Icon name="menu" size={20} /></button>
          {pageTitle && <h1 className="topbar__title">{pageTitle}</h1>}
          {topbar}
        </header>
        <div className={'content' + (contentMod ? ' ' + contentMod : '')}>{children}</div>
      </main>
    </div>
  );
}
