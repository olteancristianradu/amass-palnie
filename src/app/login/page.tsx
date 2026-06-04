'use client';
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import './login.css';

// Lozinci care se rotesc (slideshow) sub titlu.
const TAGLINES = [
  'Pâlnia ta de clienți, conectată la CRM.',
  'Fișă de strategie cu calcul automat AMASS.',
  'Sincronizare live cu gestcom — dintr-un singur loc.',
  'Carduri · Tabel · Kanban — cum îți place.',
];

// Traseul cablului de încălzire în pardoseală — serpentină (boustrophedon), exact cum se montează:
// rânduri paralele cu bucle U la capete. Se desenează singur (animație stroke-dashoffset).
const CABLE = (() => {
  const x0 = 150, x1 = 1050, yTop = 170, gap = 58, rows = 9, r = gap / 2;
  let d = `M ${x0} ${yTop}`;
  for (let i = 0; i < rows; i++) {
    const y = yTop + i * gap;
    if (i % 2 === 0) { d += ` L ${x1} ${y}`; if (i < rows - 1) d += ` A ${r} ${r} 0 0 1 ${x1} ${y + gap}`; }
    else { d += ` L ${x0} ${y}`; if (i < rows - 1) d += ` A ${r} ${r} 0 0 0 ${x0} ${y + gap}`; }
  }
  return d;
})();

export default function LoginPage() {
  const router = useRouter();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tag, setTag] = useState(0);

  // Slideshow lozinci (la 3.6s), cu fade prin re-montare (key).
  useEffect(() => {
    const id = setInterval(() => setTag(x => (x + 1) % TAGLINES.length), 3600);
    return () => clearInterval(id);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { setError('Email sau parolă incorecte.'); return; }
    router.push('/palnie');
  }

  return (
    <div className="aml">
      {/* fundal tematic: cablu de încălzire în pardoseală care se montează singur + podeaua se încălzește */}
      <div className="aml__scene" aria-hidden="true">
        <svg className="aml__floor" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="amlcab" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFC061" /><stop offset="0.5" stopColor="#FF6A2B" /><stop offset="1" stopColor="#CC0000" />
            </linearGradient>
            <radialGradient id="amlheat" cx="50%" cy="52%" r="60%">
              <stop offset="0" stopColor="#FF6A2B" stopOpacity="0.55" /><stop offset="0.6" stopColor="#CC0000" stopOpacity="0.18" /><stop offset="1" stopColor="#CC0000" stopOpacity="0" />
            </radialGradient>
            <pattern id="amltile" width="75" height="75" patternUnits="userSpaceOnUse">
              <path d="M75 0H0V75" fill="none" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
            </pattern>
            <filter id="amlglow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* podeaua camerei + plăci */}
          <rect x="80" y="100" width="1040" height="620" rx="14" fill="rgba(255,255,255,0.018)" stroke="rgba(255,255,255,0.10)" strokeWidth="1.5" />
          <rect x="80" y="100" width="1040" height="620" rx="14" fill="url(#amltile)" />
          {/* bloom de căldură (apare cand cablul e gata) */}
          <rect className="aml__bloom" x="80" y="100" width="1040" height="620" rx="14" fill="url(#amlheat)" />
          {/* cablul care se „monteaza" singur */}
          <path className="aml__cable" d={CABLE} pathLength={1} fill="none" stroke="url(#amlcab)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" filter="url(#amlglow)" />
        </svg>
      </div>

      <div className="aml__card">
        <div className="aml__brand">
          <svg width="40" height="40" viewBox="0 0 100 100" aria-hidden="true" className="aml__mark">
            <defs><clipPath id="amlclip"><rect x="7" y="7" width="86" height="86" rx="17" /></clipPath></defs>
            <g clipPath="url(#amlclip)">{[-64, -32, 0, 32, 64].map((o, i) => <line key={i} x1={o} y1="100" x2={o + 100} y2="0" stroke="currentColor" strokeWidth="9" />)}</g>
            <rect x="7" y="7" width="86" height="86" rx="17" fill="none" stroke="currentColor" strokeWidth="9" />
          </svg>
          <span className="aml__word">AMASS<sup>®</sup></span>
        </div>

        <h1 className="aml__title">{t('Pâlnie de vânzări')}</h1>
        {/* lozinca rotativă (slideshow) */}
        <p className="aml__tag" key={tag}>{t(TAGLINES[tag])}</p>

        <form onSubmit={onSubmit} className="aml__form">
          <label className="aml__lbl">{t('Email firmă')}</label>
          <input className="aml__in" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="username" placeholder="nume@amass.ro" />
          <label className="aml__lbl">{t('Parolă')}</label>
          <input className="aml__in" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
          {error && <div className="aml__err">{t(error)}</div>}
          <button type="submit" disabled={loading} className="aml__btn">
            <span>{loading ? t('Se autentifică…') : t('Intră în consolă')}</span>
          </button>
        </form>

        <div className="aml__foot">{t('Acces intern AMASS · conectat la gestcom')}</div>
      </div>
    </div>
  );
}
