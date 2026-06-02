import './globals.css';
import type { Metadata } from 'next';
import { Montserrat, Inter, JetBrains_Mono } from 'next/font/google';
import { SessionProvider } from '@/components/SessionProvider';
import { LangProvider } from '@/lib/i18n';

// Display (titluri, KPI, numere mari, nume carduri) — Montserrat
const montserrat = Montserrat({
  subsets: ['latin'], weight: ['500', '600', '700', '800'],
  variable: '--font-display', display: 'swap'
});
// UI dens (text de tabel, label-uri) — Inter
const inter = Inter({
  subsets: ['latin'], weight: ['400', '500', '600', '700'],
  variable: '--font-ui', display: 'swap'
});
// Mono pentru ID-uri + cifre tabulare — JetBrains Mono
const mono = JetBrains_Mono({
  subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap'
});

export const metadata: Metadata = {
  title: 'AMASS Energy Console',
  description: 'AMASS Sales — pâlnie clienți & strategie, conectat la CRM'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Aplică preferințele de stil ÎNAINTE de paint (fără flash), din localStorage.
  // Noul sistem: doar setăm atribute pe <html>; CSS-ul ([data-accent], [data-radius]...) face restul.
  const themeScript = `(function(){try{
    var s=JSON.parse(localStorage.getItem('amass-style')||'{}');var d=document.documentElement;
    d.setAttribute('data-theme', s.theme==='dark'?'dark':'light');
    d.setAttribute('data-density', s.density||'comfortable');
    d.setAttribute('data-accent', s.accent||'amass');
    d.setAttribute('data-radius', s.radius||'default');
    var lang=localStorage.getItem('amass-lang'); if(lang==='en'||lang==='ro') d.setAttribute('lang', lang);
  }catch(e){}})();`;
  return (
    <html lang="ro" className={`${montserrat.variable} ${inter.variable} ${mono.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <SessionProvider><LangProvider>{children}</LangProvider></SessionProvider>
      </body>
    </html>
  );
}
