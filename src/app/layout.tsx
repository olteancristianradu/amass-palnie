import './globals.css';
import './amass-pa.css';
import './amass-pa2.css';
import './amass-pa3.css';
import type { Metadata } from 'next';
import { Montserrat, Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
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
  title: 'Pâlnie Clienți — AMASS',
  description: 'AMASS Sales — pâlnie clienți & strategie, conectat la CRM'
};

// Scalare corectă pe telefon/tabletă (responsive).
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 5 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Aplică preferințele de stil ÎNAINTE de paint (fără flash), din localStorage.
  // Noul sistem: doar setăm atribute pe <html>; CSS-ul ([data-accent], [data-radius]...) face restul.
  // Limba (RO/EN) o aplicăm înainte de paint; restul aspectului (temă, accent, fonturi, mărime text,
  // formă, culori stadii) e gestionat de motorul „Aspect" (public/aspect.js → window.Aspect, beforeInteractive).
  const langScript = `(function(){try{var l=localStorage.getItem('amass-lang');if(l==='en'||l==='ro')document.documentElement.setAttribute('lang',l);}catch(e){}})();`;
  return (
    <html lang="ro" className={`${montserrat.variable} ${inter.variable} ${mono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Fonturi suplimentare pentru selectorul „Aspect" (Montserrat/Inter/JetBrains vin din next/font). */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: langScript }} />
      </head>
      <body>
        {/* Motorul Aspect — aplică tokens pe <html> înainte de hidratare (fără FOUC). */}
        <Script src="/aspect.js" strategy="beforeInteractive" />
        <SessionProvider><LangProvider>{children}</LangProvider></SessionProvider>
      </body>
    </html>
  );
}
