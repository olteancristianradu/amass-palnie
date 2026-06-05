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

// Scenă în PERSPECTIVĂ (cameră), exact ca montajul real AMASS: podea care se vede spre peretele din fund,
// PLASĂ de armătură, CABLU roșu în serpentină prins cu CLEME albe, care se „montează" singur.
const SCENE = (() => {
  // Proiecție perspectivă: u 0..1 (stânga→dreapta), v 0..1 (față→fund). Față = lat+jos, fund = îngust+sus.
  const P = (u: number, v: number): [number, number] => {
    const yF = 790, yB = 340, hF = 640, hB = 250, cx = 600;
    const y = yF + (yB - yF) * v;
    const h = hF + (hB - hF) * v;
    return [cx + (u - 0.5) * 2 * h, y];
  };
  const f = (n: number) => n.toFixed(1);
  // PLASĂ de armătură (grilă în perspectivă) — linii verticale + orizontale
  let mesh = '';
  const VL = 18, HL = 12;
  for (let i = 0; i <= VL; i++) { const a = P(i / VL, 0), b = P(i / VL, 1); mesh += `M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])} `; }
  for (let j = 0; j <= HL; j++) { const a = P(0, j / HL), b = P(1, j / HL); mesh += `M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])} `; }
  // CABLU roșu serpentină + CLEME albe la intervale (mai mici spre fund)
  const rows = 10; let cable = ''; const clips: [number, number, number][] = []; let pv = 0;
  for (let i = 0; i < rows; i++) {
    const v = 0.06 + 0.88 * (i / (rows - 1));
    const uL = i % 2 === 0 ? 0.09 : 0.91, uR = i % 2 === 0 ? 0.91 : 0.09;
    const A = P(uL, v), B = P(uR, v);
    if (i === 0) cable = `M ${f(A[0])} ${f(A[1])}`;
    else { const C = P(i % 2 === 0 ? -0.05 : 1.05, (pv + v) / 2); cable += ` Q ${f(C[0])} ${f(C[1])} ${f(A[0])} ${f(A[1])}`; }
    cable += ` L ${f(B[0])} ${f(B[1])}`;
    for (const cu of [0.2, 0.38, 0.56, 0.74]) { const p = P(cu, v); clips.push([+f(p[0]), +f(p[1]), +(1.8 + 2.6 * (1 - v)).toFixed(1)]); }
    pv = v;
  }
  const c00 = P(0, 0), c10 = P(1, 0), c11 = P(1, 1), c01 = P(0, 1);
  const floor = `M ${f(c00[0])} ${f(c00[1])} L ${f(c10[0])} ${f(c10[1])} L ${f(c11[0])} ${f(c11[1])} L ${f(c01[0])} ${f(c01[1])} Z`;

  // PEREȚI 3D: cresc vertical din muchiile podelei spre un tavan virtual.
  // Muchia din fund a podelei: c01 (stânga, x=350) → c11 (dreapta, x=850) la y=340.
  // Muchiile din față: c00 (stânga, x=-40) → c10 (dreapta, x=1240) la y=790.
  // Înălțimea peretelui scade cu adâncimea (perspectivă): față înalt, fund scund.
  const wallH = (v: number) => 690 - 470 * v; // înălțimea „aparentă" a peretelui în px la adâncimea v
  // Colțurile sus ale pereților (proiecția punctelor de pe muchiile podelei, ridicate cu wallH).
  const t00: [number, number] = [c00[0], c00[1] - wallH(0)]; // sus față-stânga  -> (-40, 100)
  const t10: [number, number] = [c10[0], c10[1] - wallH(0)]; // sus față-dreapta -> (1240, 100)
  const t11: [number, number] = [c11[0], c11[1] - wallH(1)]; // sus fund-dreapta -> (850, 120)
  const t01: [number, number] = [c01[0], c01[1] - wallH(1)]; // sus fund-stânga  -> (350, 120)
  // Perete din fund = dreptunghi între cele două colțuri de fund (jos c01→c11, sus t01→t11).
  const wallBack = `M ${f(c01[0])} ${f(c01[1])} L ${f(c11[0])} ${f(c11[1])} L ${f(t11[0])} ${f(t11[1])} L ${f(t01[0])} ${f(t01[1])} Z`;
  // Perete stânga = patrulater (jos c00→c01 muchia stângă a podelei, sus t01→t00).
  const wallLeft = `M ${f(c00[0])} ${f(c00[1])} L ${f(c01[0])} ${f(c01[1])} L ${f(t01[0])} ${f(t01[1])} L ${f(t00[0])} ${f(t00[1])} Z`;
  // Perete dreapta = oglinda peretelui stâng (jos c10→c11, sus t11→t10).
  const wallRight = `M ${f(c10[0])} ${f(c10[1])} L ${f(c11[0])} ${f(c11[1])} L ${f(t11[0])} ${f(t11[1])} L ${f(t10[0])} ${f(t10[1])} Z`;
  // Linii de fugă pe pereți (rosturi orizontale care converg spre fundul camerei) — senzație 3D.
  // Pe peretele stâng: linii la fracțiuni de înălțime, de la muchia frontală (v=0) la muchia de fund (v=1).
  let wallLines = '';
  for (let k = 1; k <= 4; k++) {
    const fr = k / 5; // fracțiune din înălțime (0=jos, 1=sus)
    // stânga
    const aL: [number, number] = [c00[0], c00[1] - wallH(0) * fr];
    const bL: [number, number] = [c01[0], c01[1] - wallH(1) * fr];
    wallLines += `M ${f(aL[0])} ${f(aL[1])} L ${f(bL[0])} ${f(bL[1])} `;
    // dreapta
    const aR: [number, number] = [c10[0], c10[1] - wallH(0) * fr];
    const bR: [number, number] = [c11[0], c11[1] - wallH(1) * fr];
    wallLines += `M ${f(aR[0])} ${f(aR[1])} L ${f(bR[0])} ${f(bR[1])} `;
    // fund (orizontal, leagă cele două laterale)
    wallLines += `M ${f(bL[0])} ${f(bL[1])} L ${f(bR[0])} ${f(bR[1])} `;
  }
  // Plintă / colț unde pereții întâlnesc podeaua (liniile muchiilor de jos, accentuate).
  const skirting = `M ${f(c00[0])} ${f(c00[1])} L ${f(c01[0])} ${f(c01[1])} L ${f(c11[0])} ${f(c11[1])} L ${f(c10[0])} ${f(c10[1])}`;
  return { mesh, cable, clips, floor, wallBack, wallLeft, wallRight, wallLines, skirting };
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
        <svg className="aml__floor" viewBox="0 0 1200 820" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="amlcab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF6B6B" /><stop offset="0.5" stopColor="#E11D2A" /><stop offset="1" stopColor="#B00010" />
            </linearGradient>
            <linearGradient id="amlfloorg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a2f37" /><stop offset="1" stopColor="#14171c" />
            </linearGradient>
            <linearGradient id="amlwallg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1c2026" /><stop offset="1" stopColor="#2b313a" />
            </linearGradient>
            {/* perete stânga: lumină dinspre fund→față (mai întunecat spre margine) */}
            <linearGradient id="amlwallL" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="#262c34" /><stop offset="1" stopColor="#10131a" />
            </linearGradient>
            {/* perete dreapta: oglindă */}
            <linearGradient id="amlwallR" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#262c34" /><stop offset="1" stopColor="#10131a" />
            </linearGradient>
            {/* lumină ambientală caldă care „cade" în cameră dinspre tavanul din fund */}
            <radialGradient id="amlamb" cx="50%" cy="20%" r="70%">
              <stop offset="0" stopColor="#3a414c" stopOpacity="0.55" /><stop offset="0.6" stopColor="#1a1e25" stopOpacity="0.2" /><stop offset="1" stopColor="#0c0e12" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="amlheat" cx="50%" cy="64%" r="55%">
              <stop offset="0" stopColor="#FF6A2B" stopOpacity="0.5" /><stop offset="0.55" stopColor="#CC0000" stopOpacity="0.15" /><stop offset="1" stopColor="#CC0000" stopOpacity="0" />
            </radialGradient>
            <filter id="amlglow" x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* ===== CAMERĂ 3D: pereți în perspectivă, în SPATELE podelei/cablului ===== */}
          <g className="aml__walls">
            {/* zona de deasupra pereților (tavan/penumbră) ca să nu rămână fundalul gol */}
            <rect x="0" y="0" width="1200" height="200" fill="url(#amlwallg)" />
            {/* perete din fund */}
            <path d={SCENE.wallBack} fill="url(#amlwallg)" />
            {/* pereți laterali (converg spre punctul de fugă) */}
            <path d={SCENE.wallLeft} fill="url(#amlwallL)" />
            <path d={SCENE.wallRight} fill="url(#amlwallR)" />
            {/* linii de fugă subtile pe pereți (rosturi) */}
            <path d={SCENE.wallLines} fill="none" stroke="#7a828d" strokeOpacity="0.14" strokeWidth="1" />
            {/* lumină ambientală caldă dinspre fundul camerei */}
            <rect x="0" y="0" width="1200" height="820" fill="url(#amlamb)" />
          </g>
          {/* podeaua (trapez în perspectivă) */}
          <path d={SCENE.floor} fill="url(#amlfloorg)" />
          {/* plintă / colț perete-podea */}
          <path d={SCENE.skirting} fill="none" stroke="#3a414c" strokeOpacity="0.6" strokeWidth="1.4" />
          {/* plasa de armătură (grilă perspectivă) */}
          <path d={SCENE.mesh} fill="none" stroke="#7a828d" strokeOpacity="0.22" strokeWidth="1.1" />
          {/* bloom de căldură — podeaua se încălzește când cablul e gata */}
          <path className="aml__bloom" d={SCENE.floor} fill="url(#amlheat)" />
          {/* cablul roșu care se „montează" singur (serpentină) */}
          <path className="aml__cable" d={SCENE.cable} pathLength={1} fill="none" stroke="url(#amlcab)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" filter="url(#amlglow)" />
          {/* cleme albe de prindere */}
          <g className="aml__clips">{SCENE.clips.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={c[2]} fill="#e9edf3" />)}</g>
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
