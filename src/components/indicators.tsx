'use client';
import { Icon } from './Icon';
import { PRIORITY_MAP, STAGE_MAP, rotLevel } from '@/lib/aspect-meta';
import { useT } from '@/lib/i18n';

// 1) PRIORITATE — steluță pe CULOARE (5 fixe). Niciodată doar culoare: + etichetă opțională.
export function PriorityStar({ value, size = 16, withLabel, onClick }: { value: string; size?: number; withLabel?: boolean; onClick?: (e: any) => void }) {
  const { t } = useT();
  const p = PRIORITY_MAP[value] || PRIORITY_MAP.alb;
  const star = (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.3l1.2-6.6L2.5 9.5l6.6-.9z" fill={p.color}
        stroke={p.outline ? 'var(--text-faint)' : 'rgba(0,0,0,.22)'} strokeWidth={p.outline ? 1.5 : 1} strokeLinejoin="round" />
    </svg>
  );
  if (onClick) return (
    <button className="prio-star" title={t('Prioritate: ') + p.label} onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, cursor: 'pointer', padding: 2 }}>
      {star}{withLabel && <span className="prio-lbl">{p.label}</span>}
    </button>
  );
  return <span title={t('Prioritate: ') + p.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{star}{withLabel && <span className="prio-lbl">{p.label}</span>}</span>;
}

// 2) STADIU — pill cu culoarea din token --st-* (editabilă în Aspect).
export function StagePill({ stage, size }: { stage: string; size?: 'sm' }) {
  const s = STAGE_MAP[stage]; if (!s) return null;
  const c = 'var(--st-' + stage + ')';
  return (
    <span className={'stage-pill' + (size === 'sm' ? ' stage-pill--sm' : '')}
      style={{ color: c, background: 'color-mix(in oklab, ' + c + ', var(--surface) 86%)', borderColor: 'color-mix(in oklab, ' + c + ', var(--surface) 60%)' }}>
      <span className="stage-pill__dot" style={{ background: c }} />{s.label}
    </span>
  );
}

// 3) VÂRSTĂ / ROTTING — canal SEPARAT (prag per stadiu).
export function RotText({ stage, days, showIcon = true }: { stage: string; days: number; showIcon?: boolean }) {
  const { t } = useT();
  const lvl = rotLevel(stage, days);
  return (
    <span className={'rot rot--' + lvl} title={t('Vârstă în stadiu: ') + days + t(' zile')}>
      {showIcon && lvl === 'late' && <Icon name="alert" size={11} />}
      {showIcon && lvl === 'warn' && <Icon name="clock" size={11} />}
      <span className="mono">{days}z</span>
    </span>
  );
}

// Segmented (switcher vizualizări).
export function Segmented({ value, options, onChange, size }: { value: string; options: { value: string; label: string; icon?: string }[]; onChange: (v: string) => void; size?: 'sm' }) {
  const { t } = useT();
  return (
    <div className={'segmented' + (size === 'sm' ? ' segmented--sm' : '')} role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={'segmented__btn' + (o.value === value ? ' is-on' : '')} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} size={15} />}{t(o.label)}
        </button>
      ))}
    </div>
  );
}
