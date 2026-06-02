'use client';
import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { PriorityStars } from '@/components/ui';

// Cheile = valorile scrise în data-accent (trebuie să corespundă selectorilor
// [data-accent="…"] din globals.css). Swatch-urile reflectă culoarea --accent reală.
// 'amass' = roșul implicit (nu are selector dedicat → cade pe :root). Vechile chei
// (ember/brick/blue/violet/gold) rămân pentru compat cu localStorage existent, fiindcă
// globals.css le mapează încă; le păstrăm ca alias-uri ascunse mai jos.
const ACCENTS: Record<string, [string, string]> = {
  amass:  ['#CC0000', 'Roșu AMASS (implicit)'],
  pine:   ['#2F6B5E', 'Pine'],
  cobalt: ['#2456C4', 'Cobalt']
};
// Alias-uri vechi încă recunoscute de globals.css — afișate doar dacă sunt deja selectate.
const LEGACY_ACCENTS: Record<string, [string, string]> = {
  ember:  ['#CC0000', 'Ember (compat)'],
  brick:  ['#CC0000', 'Cărămidă (compat)'],
  blue:   ['#2456C4', 'Albastru (compat)'],
  violet: ['#6D28D9', 'Mov (compat)'],
  gold:   ['#B7791F', 'Auriu (compat)']
};
interface Style { accent: string; theme: string; density: string; radius: string; }
const DEFAULT: Style = { accent: 'amass', theme: 'light', density: 'comfortable', radius: 'normal' };

// Aplică preferințele EXACT ca boot-script-ul din layout.tsx: doar atribute pe <html>.
// CSS-ul ([data-theme]/[data-density]/[data-accent]/[data-radius]) reacționează la ele.
function apply(s: Style) {
  const d = document.documentElement;
  d.setAttribute('data-theme', s.theme === 'dark' ? 'dark' : 'light');
  d.setAttribute('data-density', s.density || 'comfortable');
  d.setAttribute('data-accent', s.accent || 'amass');
  // 'normal'/'sharp'/'round' au selectori în globals.css ([data-radius="normal"]/["sharp"]/["round"]).
  d.setAttribute('data-radius', s.radius || 'normal');
}

export default function AspectPage() {
  const [s, setS] = useState<Style>(DEFAULT);

  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem('amass-style') || '{}'); setS({ ...DEFAULT, ...saved }); } catch {}
  }, []);

  function set<K extends keyof Style>(k: K, v: Style[K]) {
    const next = { ...s, [k]: v };
    setS(next);
    apply(next);
    try { localStorage.setItem('amass-style', JSON.stringify(next)); } catch {}
  }
  function reset() { setS(DEFAULT); apply(DEFAULT); try { localStorage.removeItem('amass-style'); } catch {} }

  // Lista de accenți afișați: noii (amass/pine/cobalt) + accentul vechi salvat
  // (ex. ember/blue), ca selecția existentă a userului să rămână vizibilă și marcată.
  const accentChoices: Record<string, [string, string]> =
    !ACCENTS[s.accent] && LEGACY_ACCENTS[s.accent]
      ? { ...ACCENTS, [s.accent]: LEGACY_ACCENTS[s.accent] }
      : ACCENTS;

  const Opt = ({ active, onClick, children, swatch }: any) => (
    <button onClick={onClick}
      className={'px-3.5 py-2 rounded-[var(--radius-sm)] text-[13px] font-semibold border transition-all flex items-center gap-2 '
        + (active ? 'border-[var(--ember)] text-[var(--ember-deep)] bg-[var(--ember-soft)]' : 'border-[var(--line-2)] text-[var(--fg-soft)] hover:border-[var(--fg-faint)]')}>
      {swatch && <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ background: swatch }} />}
      {children}
    </button>
  );

  return (
    <Layout>
      <div className="flex items-end justify-between mb-5 rise flex-wrap gap-3">
        <div>
          <h1 className="text-[26px]">Aspect</h1>
          <p className="text-[var(--fg-soft)] text-[13px] mt-0.5">Personalizează tema. Se aplică instant și se ține minte pe acest dispozitiv.</p>
        </div>
        <button onClick={reset} className="btn btn-secondary">Resetează la implicit</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          <div className="card p-5 rise rise-1">
            <div className="panel-head"><span className="dot" />Culoare accent</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(accentChoices).map(([k, v]) => (
                <Opt key={k} active={s.accent === k} onClick={() => set('accent', k)} swatch={v[0]}>{v[1]}</Opt>
              ))}
            </div>
          </div>
          <div className="card p-5 rise rise-2">
            <div className="panel-head"><span className="dot" />Temă</div>
            <div className="flex flex-wrap gap-2">
              <Opt active={s.theme === 'light'} onClick={() => set('theme', 'light')} swatch="#f5f2ea">Luminos (warm)</Opt>
              <Opt active={s.theme === 'dark'} onClick={() => set('theme', 'dark')} swatch="#14191c">Întunecat</Opt>
            </div>
          </div>
          <div className="card p-5 rise rise-3">
            <div className="panel-head"><span className="dot" />Densitate</div>
            <div className="flex flex-wrap gap-2">
              <Opt active={s.density === 'comfortable'} onClick={() => set('density', 'comfortable')}>Confortabil</Opt>
              <Opt active={s.density === 'compact'} onClick={() => set('density', 'compact')}>Compact</Opt>
            </div>
          </div>
          <div className="card p-5 rise rise-4">
            <div className="panel-head"><span className="dot" />Colțuri</div>
            <div className="flex flex-wrap gap-2">
              <Opt active={s.radius === 'sharp'} onClick={() => set('radius', 'sharp')}>Drepte</Opt>
              <Opt active={s.radius === 'normal'} onClick={() => set('radius', 'normal')}>Normale</Opt>
              <Opt active={s.radius === 'round'} onClick={() => set('radius', 'round')}>Rotunjite</Opt>
            </div>
          </div>
        </div>

        {/* Previzualizare live */}
        <div className="card p-5 rise rise-2 self-start">
          <div className="panel-head"><span className="dot" />Previzualizare</div>
          <div className="client-card mb-3" style={{ cursor: 'default' }}>
            <div className="font-display font-semibold text-[15px]">Popescu Andrei <span className="text-[var(--fg-soft)] font-normal text-[13px]">· Brașov</span></div>
            <div className="text-[11px] text-[var(--fg-faint)] font-mono mt-0.5">(2) #12402 · 245 mp</div>
            <div className="flex items-center gap-2 mt-2">
              <PriorityStars value={3} readOnly size={15} />
              <span className="pill pill-contractat">Contractat</span>
            </div>
          </div>
          <div className="flex gap-2 mb-3">
            <button className="btn btn-primary">Buton primar</button>
            <button className="btn btn-fisa">VEZI FIȘA →</button>
          </div>
          <input className="field" placeholder="Câmp de text…" readOnly />
          <div className="toast toast-ok mt-3">Exemplu de mesaj de succes.</div>
        </div>
      </div>
    </Layout>
  );
}
