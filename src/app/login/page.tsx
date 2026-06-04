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
      {/* fundal animat (aurora) */}
      <div className="aml__aurora" aria-hidden="true"><span /><span /><span /></div>
      <div className="aml__grid" aria-hidden="true" />

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
