'use client';
import { useState, useEffect, useLayoutEffect } from 'react';
import { Icon } from './Icon';
import { useT } from '@/lib/i18n';

// ── TUR GHIDAT (coachmarks cu spotlight) — port din handoff help.jsx ──
// Adaptat pt Next: turul funcționează CROSS-RUTĂ. Pașii cu `route` declanșează navigarea (nav)
// înainte de măsurare; pașii fără țintă → tooltip centrat.
const TOUR_STEPS: Array<{ sel: string; title: string; body: string[]; place?: string; route?: string }> = [
  { sel: '.sidebar__nav', title: 'Meniul principal', body: ['Dashboard = rapoarte și cifre cheie', 'Pâlnie clienți = lista ta de lucru', 'Numărul = câți clienți ai în pâlnie'], place: 'right' },
  { sel: '.topbar__switch', title: '3 moduri de a vedea pâlnia', body: ['Carduri = răsfoire rapidă cu acțiuni', 'Tabel = totul dens, ca în Excel', 'Kanban = tragi clienții între stadii (drag & drop)'], place: 'bottom', route: '/palnie' },
  { sel: '.topbar__search', title: 'Caută orice client', body: ['Scrie numele, orașul sau ID-ul', 'Lista se filtrează instant', 'Funcționează în toate vizualizările'], place: 'bottom', route: '/palnie' },
  { sel: '.filter-toggle', title: 'Filtre', body: ['Filtrează după stadiu, prioritate, vârstă, agent, CRM sau perioadă', 'Filtrele rămân active în Carduri, Tabel și Kanban', 'Apasă „Curăță" ca să le resetezi'], place: 'bottom', route: '/palnie' },
  { sel: '.tbl-info', title: 'Legenda simbolurilor (ⓘ)', body: ['Explicațiile stau ascunse sub butonul info', 'Punct albastru = T1 completat automat', '⚠ la nume = client fără CRM'], place: 'bottom', route: '/palnie' },
  { sel: '.t1cell', title: 'T1 — automat dar editabil', body: ['Se completează singur din Data intrare', 'Dacă scrii tu o dată → devine „manual"', 'Manual NU se mai suprascrie niciodată'], place: 'bottom', route: '/palnie' },
  { sel: '.help-btn', title: 'Butonul de Ajutor', body: ['Disponibil pe orice pagină', 'Reia turul oricând', 'Explică ce face fiecare buton și setare'], place: 'bottom' },
  { sel: '.userbtn', title: 'Cont & Setări', body: ['Click pe numele tău → meniu', 'Setări: CRM, sincronizare, apoi aspect', 'Comutare temă light/dark'], place: 'top' },
];

export function Tour({ run, onClose, nav }: { run: boolean; onClose: () => void; nav?: (route: string) => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const step = TOUR_STEPS[i];
  useEffect(() => { if (run) setI(0); }, [run]);
  useLayoutEffect(() => {
    if (!run || !step) return;
    let raf: any; let navTimer: any;
    const measure = () => {
      const el = document.querySelector(step.sel) as HTMLElement | null;
      if (el) { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left, width: r.width, height: r.height }); }
      else setRect(null);
    };
    // Pas cu țintă pe altă rută: navighează întâi, apoi măsoară (navigarea Next e async).
    const needNav = !!step.route && (typeof window !== 'undefined') && window.location.pathname !== step.route;
    if (needNav && nav) {
      setRect(null);                 // ascunde spotlight-ul vechi cât navigăm
      nav(step.route as string);
      navTimer = setTimeout(measure, 350);
    } else {
      raf = setTimeout(measure, 80);
    }
    window.addEventListener('resize', measure); window.addEventListener('scroll', measure, true);
    return () => { clearTimeout(raf); clearTimeout(navTimer); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [run, i]); // eslint-disable-line
  if (!run || !step) return null;
  const pad = 6;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  let tip: any = { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  if (hole) {
    const vw = window.innerWidth, vh = window.innerHeight, tw = 320, th = 230;
    const place = step.place || 'bottom';
    if (place === 'bottom' && hole.top + hole.height + th < vh) tip = { top: hole.top + hole.height + 12, left: Math.min(Math.max(hole.left, 12), vw - tw - 12) };
    else if (place === 'top' && hole.top - th > 0) tip = { top: Math.max(hole.top - th - 4, 12), left: Math.min(Math.max(hole.left, 12), vw - tw - 12) };
    else if (place === 'right' && hole.left + hole.width + tw < vw) tip = { top: Math.min(hole.top, vh - th - 12), left: hole.left + hole.width + 12 };
    else tip = { top: Math.min(hole.top + hole.height + 12, vh - th - 12), left: Math.min(Math.max(hole.left, 12), vw - tw - 12) };
  }
  return (
    <div className="tour">
      {hole ? <div className="tour__spot" style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} /> : <div className="tour__dim" />}
      <div className="tour__tip" style={tip}>
        <div className="tour__step">{t('Pasul')} {i + 1} / {TOUR_STEPS.length}</div>
        <h3 className="tour__title">{t(step.title)}</h3>
        <ul className="tour__list">{step.body.map((b, k) => <li key={k}>{t(b)}</li>)}</ul>
        <div className="tour__nav">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('Sari peste')}</button>
          <div className="row" style={{ display: 'flex', gap: 6 }}>
            {i > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setI(i - 1)}><Icon name="chevL" size={14} />{t('Înapoi')}</button>}
            {i < TOUR_STEPS.length - 1
              ? <button className="btn btn-primary btn-sm" onClick={() => setI(i + 1)}>{t('Următorul')}<Icon name="chevR" size={14} /></button>
              : <button className="btn btn-primary btn-sm" onClick={onClose}><Icon name="check" size={14} />{t('Am înțeles')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GLOSAR — ce face fiecare buton/setare ──
const HELP_GLOSSARY: Array<{ sec: string; items: [string, string, string][] }> = [
  { sec: 'Navigare & general', items: [
    ['dashboard', 'Dashboard', 'Rapoarte: câți clienți, cum curge pâlnia, conversii, ce e urgent.'],
    ['funnel', 'Pâlnie clienți', 'Lista ta de lucru cu toți clienții, în 3 moduri de afișare.'],
    ['search', 'Câmp de căutare', 'Scrie nume / oraș / ID — lista se filtrează pe loc.'],
    ['help', 'Ajutor', 'Deschide acest ghid și turul. Disponibil pe orice pagină.'],
    ['user', 'Numele tău (jos)', 'Click → meniu cu Setări, comutare temă și Ieșire.'],
    ['chevL', 'Săgeata de lângă logo', 'Restrânge/extinde meniul din stânga (mai mult spațiu).'],
  ] },
  { sec: 'Pâlnie — moduri de afișare', items: [
    ['cards', 'Carduri', 'Rânduri mari, ușor de citit pe telefon. Acțiuni rapide fără să intri în fișă.'],
    ['table', 'Tabel', 'Toate datele dense, ca în Excel — editabil în celulă.'],
    ['kanban', 'Kanban', 'Coloane pe stadii; tragi cardul dintr-o coloană în alta ca să muți clientul.'],
    ['filter', 'Filtre', 'Restrânge lista după stadiu, prioritate, vârstă, agent, CRM sau perioadă.'],
  ] },
  { sec: 'Indicatori pe client', items: [
    ['star', 'Steluța colorată', 'Prioritatea: roșu=urgent, portocaliu=ridicată, albastru=normală, verde=scăzută, alb=nesetat. La fel pentru toți.'],
    ['clock', 'Vârsta (ex. „12z")', 'De câte zile stă clientul în stadiul curent. Galben/roșu = stă prea mult, sună-l.'],
    ['alert', 'Triunghi de atenție', 'La nume = client fără înregistrare în CRM. Pe vârstă = a depășit timpul normal în stadiu.'],
    ['bell', 'Reminder', 'Data și tipul următoarei acțiuni programate (ex. TELEFON).'],
  ] },
  { sec: 'Fișă strategie', items: [
    ['upload', 'Push CRM', 'Trimite fișa în CRM (gestcom.ro), între markeri — observațiile manuale rămân.'],
    ['mail', 'Email', 'Compune emailul de deviz către client.'],
    ['bell', 'Reminder', 'Programează o reamintire (cu listă de remindere existente).'],
    ['download', 'PDF / Word', 'Exportă fișa ca PDF sau document Word.'],
    ['check', 'Salvare automată', 'Orice modificare se salvează singură („Se salvează… / Salvat").'],
    ['trending', 'Panourile verzi (auto-calc)', 'Se calculează singure din suprafață: putere, consum, investiție, eșalonare, profit, amortizare.'],
  ] },
  { sec: 'Setări', items: [
    ['link', 'Credențiale CRM', 'Conectează și testează legătura cu gestcom.ro.'],
    ['refresh', 'Auto-sync', 'Pornește/oprește sincronizarea automată și alege intervalul.'],
    ['mail', 'Outlook', 'Leagă emailul și calendarul.'],
    ['upload', 'Import date', 'Încarcă un fișier și mapează coloanele.'],
    ['palette', 'Aspect aplicație', 'Temă (light/dark), accent, font și culorile stadiilor — cu previzualizare live.'],
    ['type', 'Mărime & densitate', 'Mărește textul (până la 150%) și spațierea.'],
  ] },
];

export function HelpPanel({ open, onClose, onStartTour }: { open: boolean; onClose: () => void; onStartTour: () => void }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  if (!open) return null;
  const ql = q.trim().toLowerCase();
  const filtered = HELP_GLOSSARY.map(g => ({ ...g, items: g.items.filter(it => !ql || it[1].toLowerCase().includes(ql) || it[2].toLowerCase().includes(ql)) })).filter(g => g.items.length);
  return (
    <>
      <div className="help-backdrop" onClick={onClose} />
      <aside className="help-drawer" role="dialog" aria-label={t('Ajutor')}>
        <header className="help-drawer__head">
          <div className="row" style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Icon name="help" size={20} style={{ color: 'var(--accent)' }} /><h2>{t('Ajutor & ghid')}</h2></div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('Închide')}><Icon name="x" size={18} /></button>
        </header>
        <div className="help-drawer__body scroll-thin">
          <button className="help-tourcta" onClick={onStartTour}>
            <span className="help-tourcta__ic"><Icon name="play" size={18} /></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}><b>{t('Pornește turul ghidat')}</b><small>{t('Plimbare pas-cu-pas prin aplicație (1 minut)')}</small></span>
            <Icon name="chevR" size={18} />
          </button>
          <div className="help-search">
            <Icon name="search" size={15} />
            <input placeholder={t('Caută un buton sau o setare…')} value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {filtered.map(g => (
            <section key={g.sec} className="help-sec">
              <h3 className="help-sec__t">{t(g.sec)}</h3>
              {g.items.map((it, k) => (
                <div key={k} className="help-item">
                  <span className="help-item__ic"><Icon name={it[0]} size={16} /></span>
                  <div><b>{t(it[1])}</b><p>{t(it[2])}</p></div>
                </div>
              ))}
            </section>
          ))}
          {!filtered.length && <p className="muted" style={{ padding: 16 }}>{t('Nimic găsit pentru')} „{q}".</p>}
          <div className="help-tip"><Icon name="lightbulb" size={16} /><span>{t('Sfat: treci cu mouse-ul peste orice buton ca să-i vezi numele.')}</span></div>
        </div>
      </aside>
    </>
  );
}
