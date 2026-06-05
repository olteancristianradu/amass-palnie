'use client';
import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { toast } from '@/components/ui';
import { useT } from '@/lib/i18n';

// Motorul de teme e încărcat global (public/aspect.js → window.Aspect, beforeInteractive).
// Interfață minimă pentru starea returnată de Aspect.get() — câmpurile citite de AspectPanel.
interface AspectState {
  theme: string; mode: string; accent: string; preset: string;
  fontDisplay: string; fontUi: string; radius: number; density: string;
  textSize: number; stages: Record<string, string | undefined>; background: string; bgImage: string;
  layoutSide: string;
}
const A = () => (typeof window !== 'undefined' ? (window as any).Aspect : null);

// Subset de iconuri din handoff (icons2.jsx).
const IP: Record<string, string> = {
  palette: 'M12 22a10 10 0 1 1 0-20c5.5 0 10 3.6 10 8 0 3-2.5 4-4 4h-2a2 2 0 0 0-1 3.7A2 2 0 0 1 12 22zM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM16.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  contrast: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 2v20',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  type: 'M4 7V5h16v2M9 19h6M12 5v14',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  kanban: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  check: 'M20 6L9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7v5l3.5 2',
  x: 'M18 6L6 18M6 6l12 12',
};
function Icon({ name, size = 16, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const d = IP[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}
    </svg>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string; icon?: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={'segmented__btn' + (o.value === value ? ' is-on' : '')} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}{o.label}
        </button>
      ))}
    </div>
  );
}
function StepSlider({ label, value, labels, onChange }: { label: string; value: number; labels: string[]; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="label">{label}</span>
      <input type="range" className="step-range" min={0} max={labels.length - 1} step={1} value={value} onChange={e => onChange(+e.target.value)} />
      <div className="step-ticks">{labels.map((l, i) => <button key={i} className={'step-tick' + (i === value ? ' is-on' : '')} onClick={() => onChange(i)}>{l}</button>)}</div>
    </div>
  );
}
function Section({ title, icon, children, highlight }: { title: string; icon: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section className={'aset' + (highlight ? ' aset--hl' : '')}>
      <h3 className="aset__title"><Icon name={icon} size={15} />{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function PriorityStar({ value, size = 14, withLabel }: { value: string; size?: number; withLabel?: boolean }) {
  const a = A(); if (!a) return null;
  const p = a.PRIORITY_MAP[value] || a.PRIORITY_MAP.alb;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.3l1.2-6.6L2.5 9.5l6.6-.9z" fill={p.color}
          stroke={p.outline ? 'var(--text-faint)' : 'rgba(0,0,0,.25)'} strokeWidth={p.outline ? 1.5 : 1} strokeLinejoin="round" />
      </svg>{withLabel && <span className="prio-lbl">{p.label}</span>}
    </span>
  );
}
function StagePill({ stage, size }: { stage: string; size?: string }) {
  const a = A(); if (!a) return null;
  const st = a.STAGE_MAP[stage]; if (!st) return null;
  const c = 'var(--st-' + stage + ')';
  return (
    <span className={'stage-pill' + (size === 'sm' ? ' stage-pill--sm' : '')}
      style={{ color: c, background: 'color-mix(in oklab, ' + c + ', var(--surface) 86%)', borderColor: 'color-mix(in oklab, ' + c + ', var(--surface) 60%)' }}>
      <span className="stage-pill__dot" style={{ background: c }}></span>{st.label}
    </span>
  );
}

function LivePreview() {
  const { t } = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm">{t('Buton primar')}</button>
        <button className="btn btn-secondary btn-sm">{t('Secundar')}</button>
      </div>
      <div className="lp-card card card--pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <b style={{ fontFamily: 'var(--font-display)' }}>Popa Nicoleta</b>
          <StagePill stage="ofertat" size="sm" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: '.8125rem', color: 'var(--text-muted)', alignItems: 'center' }}>
          <PriorityStar value="rosu" withLabel size={14} />
          <span className="mono">145 mp</span>
          <span className="rot rot--warn"><Icon name="clock" size={11} /><span className="mono">12z</span></span>
        </div>
        <a href="#" onClick={e => e.preventDefault()}>{t('Link activ accent')}</a>
      </div>
      <div className="lp-row">
        <span className="lp-row__cell">{t('Rând tabel')}</span>
        <span className="lp-row__cell mono">240</span>
        <span className="lp-row__cell"><StagePill stage="schita" size="sm" /></span>
      </div>
      <input className="input field" placeholder={t('Câmp de input…')} />
    </div>
  );
}

export default function AspectPage() {
  return <AspectPanel />;
}

function AspectPanel({ focusText }: { focusText?: boolean } = {}) {
  const { t } = useT();
  const [s, setS] = useState<AspectState | null>(null);
  useEffect(() => {
    const a = A(); if (!a) return;
    setS(a.get() as AspectState);
    const off = a.subscribe((st: AspectState) => setS({ ...st, stages: { ...st.stages } }));
    return off;
  }, []);

  const a = A();
  if (!s || !a) return <Layout><div className="card p-10 text-center text-[var(--fg-soft)]">{t('Se încarcă „Aspect"…')}</div></Layout>;
  const set = (patch: Partial<AspectState>) => a.set(patch);
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
  const ratioSurface = a.contrast(s.accent, surface);
  const ratioOn = a.contrast(s.accent, a.onColor(s.accent));
  const rateSurface = a.rate(ratioSurface);

  return (
    <Layout>
      <h1 className="text-[24px] mb-1">{t('Aspect aplicație')}</h1>
      <p className="text-[13px] text-[var(--fg-soft)] mb-5 max-w-2xl">
        {t('Culoare, formă, fonturi, mărime text și culorile de stadiu — cu previzualizare live. Steluța de prioritate are 5 culori fixe (limbaj comun, nepersonalizabile). Preferințele se salvează pe acest dispozitiv.')}
      </p>
      <div className="aspect">
        <div className="aspect__main">
          {!focusText && <>
          <Section title={t('Teme prestabilite')} icon="palette">
            <p className="aspect__hint" style={{ marginTop: 0, marginBottom: 10 }}>{t('Un click setează tot aspectul (culoare, font, formă, densitate). Apoi poți ajusta orice mai jos.')}</p>
            <div className="theme-cards">
              {(a.THEMES || []).map((th: { id: string; sw: string[]; name: string; tag: string; desc: string }) => (
                <button key={th.id} className={'theme-card' + (s.theme === th.id ? ' is-on' : '')} onClick={() => a.setTheme(th.id)}>
                  <span className="theme-card__sw">{th.sw.map((c: string, i: number) => <span key={i} style={{ background: c }}></span>)}</span>
                  <span className="theme-card__name">{th.name}</span>
                  <span className="theme-card__tag">{th.tag}</span>
                  <span className="theme-card__desc">{th.desc}</span>
                  {s.theme === th.id && <span className="theme-card__on"><Icon name="check" size={13} /></span>}
                </button>
              ))}
            </div>
          </Section>

          <Section title={t('Mod culoare')} icon="contrast">
            <Segmented value={s.mode} onChange={v => set({ mode: v })}
              options={[{ value: 'light', label: t('Light'), icon: 'sun' }, { value: 'dark', label: t('Dark'), icon: 'moon' }, { value: 'system', label: t('Sistem'), icon: 'monitor' }]} />
          </Section>

          <Section title={t('Accent / brand')} icon="palette">
            <div className="preset-row">
              {a.PRESETS.map((p: { id: string; name: string; accent: string }) => (
                <button key={p.id} className={'preset' + (s.preset === p.id ? ' is-on' : '')} onClick={() => set({ accent: p.accent, preset: p.id })} title={p.name}>
                  <span className="preset__sw" style={{ background: p.accent }}></span>{p.name}
                </button>
              ))}
            </div>
            <div className="accent-pick">
              <label className="accent-pick__color">
                <input type="color" value={s.accent} onChange={e => set({ accent: e.target.value, preset: 'custom' })} />
                <span className="accent-pick__chip" style={{ background: s.accent }}></span>
              </label>
              <input className="input field mono" style={{ width: 120 }} value={String(s.accent).toUpperCase()}
                onChange={e => { const v = e.target.value; if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) set({ accent: v.startsWith('#') ? v : '#' + v, preset: 'custom' }); }} />
              <span className={'wcag wcag--' + (rateSurface === 'slab' ? 'bad' : rateSurface === 'AA mare' ? 'warn' : 'ok')}>
                {rateSurface === 'slab'
                  ? <><Icon name="alert" size={13} />{t('Contrast slab')} ({ratioSurface.toFixed(1)}:1)</>
                  : <><Icon name="check" size={13} />{t('Contrast')} {rateSurface} ({ratioSurface.toFixed(1)}:1)</>}
              </span>
            </div>
            <p className="aspect__hint">{t('Din accent se derivă automat hover, focus ring și suprafețele soft (OKLCH). Textul pe accent: contrast')} {ratioOn.toFixed(1)}:1.</p>
          </Section>

          <Section title={t('Font')} icon="type">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}><span className="label">{t('Titluri')}</span>
                <select className="select field" value={s.fontDisplay} onChange={e => set({ fontDisplay: e.target.value })}>
                  {Object.keys(a.FONTS.display).map((f: string) => <option key={f}>{f}</option>)}
                </select></label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}><span className="label">{t('Interfață')}</span>
                <select className="select field" value={s.fontUi} onChange={e => set({ fontUi: e.target.value })}>
                  {Object.keys(a.FONTS.ui).map((f: string) => <option key={f}>{f}</option>)}
                </select></label>
            </div>
          </Section>

          <Section title={t('Formă')} icon="sliders">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StepSlider label={t('Colțuri (radius)')} value={s.radius} labels={a.RADIUS_LABELS} onChange={v => set({ radius: v })} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="label">{t('Densitate')}</span>
                <Segmented value={s.density} onChange={v => set({ density: v })}
                  options={[{ value: 'compact', label: t('Compact') }, { value: 'normal', label: t('Normal') }, { value: 'comfortable', label: t('Confortabil') }]} />
              </div>
            </div>
          </Section>
          </>}

          <Section title={t('Mărime text')} icon="type" highlight={focusText}>
            <StepSlider label={t('Scală:') + ' ' + a.TEXT_LABELS[s.textSize] + ' (' + Math.round(a.TEXT_STEPS[s.textSize] * 100) + '%)'}
              value={s.textSize} labels={a.TEXT_LABELS} onChange={v => set({ textSize: v })} />
            <p className="aspect__hint">{t('Scalează toată interfața. Vezi previzualizarea live →')}</p>
          </Section>

          <Section title={t('Culori stadii')} icon="kanban">
            <p className="aspect__hint" style={{ marginTop: 0 }}>{t('Personalizează fiecare stadiu — apare instant în Kanban, Tabel, Carduri și Dashboard.')}</p>
            <div className="stage-colors">
              {a.ALL_STAGES.map((st: { key: string; label: string }) => (
                <label key={st.key} className="stage-color">
                  <input type="color" value={a.stageColor(st.key)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => a.setStage(st.key, e.target.value)} />
                  <span className="stage-color__chip" style={{ background: 'var(--st-' + st.key + ')' }}></span>
                  <span>{st.label}</span>
                  {s.stages[st.key] && <button className="stage-color__reset" title={t('Implicit')} onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.preventDefault(); a.resetStage(st.key); }}><Icon name="reset" size={12} /></button>}
                </label>
              ))}
            </div>
          </Section>

          <Section title={t('Poziție meniu & unelte')} icon="sliders">
            <p className="aspect__hint" style={{ marginTop: 0 }}>{t('Mută meniul din stânga, comutatorul de vizualizări, filtrul și Ajutorul pe partea preferată.')}</p>
            <Segmented value={s.layoutSide || 'left'} onChange={v => set({ layoutSide: v })}
              options={[{ value: 'left', label: t('Stânga') }, { value: 'right', label: t('Dreapta') }]} />
          </Section>

          <Section title={t('Fundal personalizat')} icon="palette">
            <p className="aspect__hint" style={{ marginTop: 0, marginBottom: 8 }}>{t('Temele de sus setează deja un fundal — aici îl poți schimba sau încărca propria poză.')}</p>
            <div className="bg-row">
              {(a.BACKGROUNDS || []).map((b: { id: string; name: string }) => (
                <button key={b.id} className={'bg-opt' + ((s.background || 'none') === b.id && !s.bgImage ? ' is-on' : '')} onClick={() => { a.setBgImage(''); set({ background: b.id }); }}>
                  <span className="bg-opt__prev" data-bg={b.id}></span>{t(b.name)}
                </button>
              ))}
              <label className={'bg-opt bg-opt--upload' + (s.bgImage ? ' is-on' : '')}>
                <span className="bg-opt__prev bg-opt__prev--img" style={s.bgImage ? { backgroundImage: 'url(' + s.bgImage + ')' } : {}}>
                  {!s.bgImage && <Icon name="upload" size={16} />}
                </span>
                {s.bgImage ? t('Poza mea') : t('Încarcă poză')}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const rd = new FileReader();
                  rd.onerror = () => toast(t('Nu am putut citi fișierul'), 'error');
                  rd.onload = () => {
                    const img = new Image();
                    img.onerror = () => toast(t('Imagine invalidă'), 'error');
                    img.onload = () => {
                      const max = 1600, sc = Math.min(1, max / Math.max(img.width, img.height));
                      const cv = document.createElement('canvas');
                      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
                      const ctx = cv.getContext('2d');
                      if (!ctx) { toast(t('Imagine invalidă'), 'error'); return; }
                      ctx.drawImage(img, 0, 0, cv.width, cv.height);
                      try {
                        const url = cv.toDataURL('image/jpeg', 0.82);
                        a.setBgImage(url); toast(t('Fundal personalizat aplicat'), 'success');
                      } catch { toast(t('Imagine prea mare'), 'error'); }
                    };
                    img.src = String(rd.result);
                  };
                  rd.readAsDataURL(f); e.target.value = '';
                }} />
              </label>
            </div>
            {s.bgImage && (
              <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { a.setBgImage(''); toast(t('Poza eliminată'), 'info'); }}><Icon name="x" size={14} />{t('Elimină poza')}</button>
                <span className="aspect__hint" style={{ margin: 0 }}>{t('Peste poză se aplică un voal automat ca textul să rămână lizibil.')}</span>
              </div>
            )}
          </Section>

          <Section title={t('Prioritate (fix — limbaj comun)')} icon="alert">
            <p className="aspect__hint" style={{ marginTop: 0 }}>{t('Cele 5 culori ale steluței NU se personalizează (sens universal în toată echipa).')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {a.PRIORITIES.map((p: { key: string }) => <PriorityStar key={p.key} value={p.key} withLabel size={16} />)}
            </div>
          </Section>

          <Section title={t('Profilul meu de aspect')} icon="user">
            <p className="aspect__hint" style={{ marginTop: 0 }}>{t('Setările de aspect sunt salvate doar pe contul tău')} ({a.currentUser() === 'default' ? 'M. Ionescu' : a.currentUser()}) — {t('nu afectează ceilalți agenți. Le poți exporta și trimite altcuiva.')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const blob = new Blob([a.exportJSON()], { type: 'application/json' });
                const url = URL.createObjectURL(blob); const el = document.createElement('a');
                el.href = url; el.download = 'aspect-amass.json'; el.click(); URL.revokeObjectURL(url);
                toast(t('Aspect exportat'), 'success');
              }}><Icon name="download" size={14} />{t('Exportă aspectul meu')}</button>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Icon name="upload" size={14} />{t('Importă aspect')}
                <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return; const r = new FileReader();
                  r.onerror = () => toast(t('Nu am putut citi fișierul'), 'error');
                  r.onload = () => { a.importJSON(String(r.result)) ? toast(t('Aspect importat'), 'success') : toast(t('Fișier invalid'), 'error'); };
                  r.readAsText(f); e.target.value = '';
                }} />
              </label>
            </div>
          </Section>

          <div className="gamecard">
            <div className="gamecard__ic"><Icon name="target" size={20} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <b>{t('🏆 Concursul „Cea mai mișto pâlnie"')}</b>
              <span style={{ fontSize: '.8125rem', color: 'var(--text-muted)' }}>{t('Exportă-ți aspectul și intră în clasamentul lunar al agenților — cea mai personalizată și mai productivă pâlnie câștigă premii. Fundalul propriu contează la „stil".')}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { a.reset(); toast(t('Aspect resetat la implicit'), 'info'); }}><Icon name="reset" size={14} />{t('Resetează tot')}</button>
          </div>
        </div>

        <aside className="aspect__preview">
          <div className="label" style={{ marginBottom: 10 }}>{t('Previzualizare live')}</div>
          <LivePreview />
        </aside>
      </div>
    </Layout>
  );
}
