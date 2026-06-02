'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'ro' | 'en';

/* Cheia = textul ROMÂNESC sursă. EN = overlay. t(text) întoarce EN dacă lang=en și
   există în dicționar, altfel textul original (română) — deci stringuri netraduse rămân RO. */
const EN: Record<string, string> = {
  // ----- nav / shell -----
  'Pâlnie (listă)': 'Funnel (list)', 'Pâlnie': 'Funnel', 'Pipeline': 'Pipeline', 'Arhivă': 'Archive',
  'Dashboard': 'Dashboard', 'Rapoarte': 'Reports', 'Jurnal': 'Audit log', 'Echipă': 'Team',
  'Aspect': 'Appearance', 'Setări CRM': 'CRM settings', 'Setări': 'Settings', 'Ieșire': 'Sign out',
  'Administrare': 'Administration', 'Cont': 'Account',
  'Energy': 'Energy', 'Console': 'Console',
  // ----- vizualizări -----
  'Carduri': 'Cards', 'Tabel': 'Table', 'Kanban': 'Kanban',
  // ----- pâlnie -----
  'Pâlnie clienți': 'Client funnel', 'afișați din': 'shown of',
  'Caută client, oraș, #id…': 'Search client, city, #id…', 'Toate stadiile': 'All stages',
  'Sync clienți': 'Sync clients', 'Detalii': 'Details', 'Remindere': 'Reminders',
  'VEZI FIȘA →': 'OPEN FILE →', '👥 Echipa mea': '👥 My team',
  'Se încarcă pâlnia…': 'Loading funnel…',
  // ----- coloane tabel -----
  'Client': 'Client', 'Data intrare': 'Entry date', 'Nevoia': 'Need', 'Schiță': 'Sketch',
  'Pre-ofertat': 'Pre-quoted', 'Ofertat': 'Quoted', 'Status': 'Status', 'Reminder': 'Reminder',
  // ----- stadii / nevoi -----
  'în lucru': 'in progress', 'Anulat': 'Cancelled', 'Contractat': 'Contracted',
  'Amanat': 'Postponed', 'Finalizat': 'Completed',
  'Nevoie Acoperita': 'Need covered', 'Tentativa': 'Attempt',
  'Nu il putem ajuta': 'Cannot help', 'Nevoie viitoare': 'Future need',
  // ----- aspect -----
  'Aspect aplicație': 'Appearance', 'Accent': 'Accent', 'Temă': 'Theme', 'Densitate': 'Density',
  'Colțuri': 'Corners', 'Limbă': 'Language', 'Resetează': 'Reset',
  'Deschisă (light)': 'Light', 'Întunecată (dark)': 'Dark',
  'Confortabilă': 'Comfortable', 'Compactă': 'Compact',
  'Drepte': 'Sharp', 'Normale': 'Normal', 'Rotunjite': 'Round',
};

interface I18n { lang: Lang; setLang: (l: Lang) => void; t: (s: string) => string; }
const Ctx = createContext<I18n>({ lang: 'ro', setLang: () => {}, t: (s) => s });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ro');
  useEffect(() => { const l = localStorage.getItem('amass-lang'); if (l === 'en' || l === 'ro') setLangState(l); }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('amass-lang', l); document.documentElement.setAttribute('lang', l); } catch {}
  };
  const t = (s: string) => (lang === 'en' ? (EN[s] ?? s) : s);
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}
export function useT() { return useContext(Ctx); }
