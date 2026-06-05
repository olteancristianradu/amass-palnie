'use client';
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { PRIORITY_MAP, PRIORITIES, STAGE_MAP, rotLevel } from '@/lib/aspect-meta';
import { useT } from '@/lib/i18n';

// 1) PRIORITATE — steluță pe CULOARE (5 fixe). Niciodată doar culoare: + etichetă opțională.
export function PriorityStar({ value, size = 16, withLabel, onClick }: { value: string; size?: number; withLabel?: boolean; onClick?: (e: any) => void }) {
  const { t } = useT();
  const p = PRIORITY_MAP[value] || PRIORITY_MAP.alb;
  const star = (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 18.6 6.1 21.3l1.2-6.6L2.5 9.5l6.6-.9z" fill={p.color}
        stroke={p.outline ? 'var(--text-faint)' : 'color-mix(in oklab, ' + p.color + ', #000 18%)'} strokeWidth={p.outline ? 1.5 : 1} strokeLinejoin="round" />
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
      style={{ '--sc': c, color: c, background: 'color-mix(in oklab, ' + c + ', var(--surface) 86%)', borderColor: 'color-mix(in oklab, ' + c + ', var(--surface) 60%)' } as React.CSSProperties}>
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

// Segmented (switcher vizualizări). Acceptă opțiuni ca string-uri sau obiecte {value, label, icon}.
export type SegmentedOption = string | { value: string; label: string; icon?: string };
export function Segmented({ value, options, onChange, size }: { value: string; options: SegmentedOption[]; onChange: (v: string) => void; size?: 'sm' }) {
  const { t } = useT();
  return (
    <div className={'segmented' + (size === 'sm' ? ' segmented--sm' : '')} role="tablist">
      {options.map(o => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const ic = typeof o === 'object' ? o.icon : undefined;
        return (
          <button key={val} role="tab" aria-selected={val === value}
            className={'segmented__btn' + (val === value ? ' is-on' : '')} onClick={() => onChange(val)}>
            {ic && <Icon name={ic} size={15} />}{t(lbl)}
          </button>
        );
      })}
    </div>
  );
}

// Popover de alegere prioritate (5 culori) — port 1:1 din handoff ui.jsx PriorityPicker.
export function PriorityPicker({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]); // FIX 2026-06-05: onClose în deps — evită stale closure pe callback-ul de închidere
  return (
    <div className="prio-pop" ref={ref}>
      <div className="label" style={{ marginBottom: 6 }}>{t('Prioritate')}</div>
      {PRIORITIES.map(p => (
        <button key={p.key} className={'prio-opt' + (p.key === value ? ' is-on' : '')} onClick={() => { onChange(p.key); onClose(); }}>
          <span className="prio-dot" style={{ background: p.color, borderColor: p.outline ? 'var(--border-strong)' : 'transparent' }} />
          <span>{p.label}</span>
          {p.key === value && <Icon name="check" size={14} style={{ marginLeft: 'auto', color: 'var(--accent)' }} />}
        </button>
      ))}
    </div>
  );
}
