'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { setError('Email sau parolă incorecte.'); return; }
    router.push('/palnie');
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="sidebar hidden md:flex flex-col justify-between w-[42%] p-12 text-white">
        <div className="font-display text-2xl font-semibold tracking-tight">AMASS</div>
        <div>
          <div className="font-display text-[40px] leading-[1.05] font-semibold text-white max-w-sm">
            Pâlnia ta de clienți, conectată la CRM.
          </div>
          <p className="text-[var(--on-ink-soft)] mt-4 max-w-sm text-sm leading-relaxed">
            Sincronizezi clienții, completezi fișa de strategie cu calcul automat și împingi totul în gestcom — dintr-un singur loc.
          </p>
          <div className="flex gap-2 mt-6">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--ember)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--pine)]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)]" />
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-[.22em] text-[var(--on-ink-soft)]">Energy Console</div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm rise">
          <h1 className="font-display text-2xl mb-1">Bine ai revenit</h1>
          <p className="text-[var(--fg-soft)] text-sm mb-7">Loghează-te cu emailul de firmă.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="kpi-label block mb-1.5">Email firmă</label>
              <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="kpi-label block mb-1.5">Parolă</label>
              <input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div className="toast toast-err">{error}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5">
              {loading ? 'Se autentifică…' : 'Intră în consolă'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
