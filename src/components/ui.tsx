'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n';

// ── Stea de prioritate = CULOARE-etichetă din gestcom (NU scală de urgență) ───
// categorie_favorit: 0=fără · 1=🔴 Roșu · 2=🟠 Portocaliu · 3=🔵 Albastru · 4=🟢 Verde
// (sursa de adevăr: Apps Script Palnie.js STEA_CAT_TO_EMOJI). O SINGURĂ stea colorată per client.
export const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
export const STEA_COLORS = ['var(--star-stroke)', '#C62828', '#E07A1F', '#1565C0', '#2E7D32']; // 0..4
export const STAR_VAR = STEA_COLORS; // compat dashboard
export const STEA_TITLE = ['fără stea', 'Roșu', 'Portocaliu', 'Albastru', 'Verde'];

export function PriorityStars({ value, onSet, size = 16, readOnly = false }: {
  value: number; onSet?: (n: number) => void; size?: number; readOnly?: boolean;
}) {
  const { t } = useT();
  const oneStar = (cat: number, sz: number) => (
    <svg viewBox="0 0 24 24" width={sz} height={sz}
         fill={cat > 0 ? STEA_COLORS[cat] : 'none'}
         stroke={cat > 0 ? STEA_COLORS[cat] : 'var(--star-stroke)'} strokeWidth="1.5" strokeLinejoin="round">
      <path d={STAR_PATH} />
    </svg>
  );
  // Doar afișare: o singură stea de culoarea categoriei.
  if (readOnly || !onSet) return <span title={t(STEA_TITLE[value] || '')} style={{ lineHeight: 0 }}>{oneStar(value, size)}</span>;
  // Editabil: selector cu 5 culori (fără / roșu / portocaliu / albastru / verde) — click pe culoarea dorită.
  return (
    <div className="inline-flex items-center gap-[3px]" onClick={e => e.stopPropagation()} title={t('Setează culoarea steluței (ca în CRM)')}>
      {[0, 1, 2, 3, 4].map(c => (
        <button key={c} type="button" title={t(STEA_TITLE[c])} onClick={() => onSet(c)}
          className="star-btn rounded-full"
          style={c === value ? { boxShadow: '0 0 0 1.5px var(--bg), 0 0 0 3px ' + (c > 0 ? STEA_COLORS[c] : 'var(--star-stroke)') } : { opacity: 0.4 }}>
          {oneStar(c, size - 3)}
        </button>
      ))}
    </div>
  );
}

// ── Badge de sync onest (+ auto-sync) ────────────────────────────────────────
export interface SyncInfo { type?: string; status?: string; startedAt?: string; processed?: number; total?: number; }
export interface AutoSyncInfo { enabled?: boolean; lastLightAt?: string | null; lastDetailAt?: string | null; inFlight?: boolean; lastError?: string | null; lightEverySec?: number; detailEverySec?: number; }

function agoText(ageMin: number, iso: string) {
  return ageMin < 1 ? 'chiar acum'
    : ageMin < 60 ? `acum ${Math.round(ageMin)} min`
    : ageMin < 1440 ? `acum ${Math.round(ageMin / 60)} h`
    : new Date(iso).toLocaleDateString('ro-RO');
}

export function SyncBadge({ last, syncing, auto }: { last?: SyncInfo | null; syncing?: boolean; auto?: AutoSyncInfo | null }) {
  const { t } = useT();
  if (syncing || auto?.inFlight) {
    return (
      <span className="sync-badge" title={t('Sincronizare în curs cu CRM')}>
        <span className="sync-dot live" style={{ background: 'var(--ember)' }} />
        {t('Se sincronizează…')}
      </span>
    );
  }
  // Cu auto-sync activ: prospețimea vine din ultimul „light poll" (în-memorie, ~90s).
  if (auto?.enabled) {
    if (auto.lastError) {
      return (
        <span className="sync-badge" title={t('Eroare auto-sync: ') + auto.lastError + t(' (reîncearcă automat)')}>
          <span className="sync-dot" style={{ background: 'var(--sync-old)' }} />
          {t('Auto-sync: eroare, reîncerc…')}
        </span>
      );
    }
    const iso = auto.lastLightAt || last?.startedAt;
    if (!iso) {
      return (
        <span className="sync-badge" title={t('Auto-sync pornit — prima verificare în curând')}>
          <span className="sync-dot live" style={{ background: 'var(--sync-fresh)' }} />
          {t('Auto-sync pornit')}
        </span>
      );
    }
    const ageMin = (Date.now() - new Date(iso).getTime()) / 60000;
    const color = ageMin < 5 ? 'var(--sync-fresh)' : ageMin < 30 ? 'var(--sync-stale)' : 'var(--sync-old)';
    return (
      <span className="sync-badge" title={`${t('Auto-sync activ: verificare la ~')}${auto.lightEverySec ?? 90}${t('s, detalii la ~')}${Math.round((auto.detailEverySec ?? 600) / 60)}min`}>
        <span className="sync-dot live" style={{ background: color }} />
        {t('Auto • ')}{agoText(ageMin, iso)}
      </span>
    );
  }
  // Fără auto-sync: badge clasic pe ultimul sync manual.
  if (!last || !last.startedAt) {
    return (
      <span className="sync-badge" title={t('Nicio sincronizare încă')}><span className="sync-dot" style={{ background: 'var(--fg-faint)' }} />{t('Nesincronizat')}</span>
    );
  }
  const ageMin = (Date.now() - new Date(last.startedAt).getTime()) / 60000;
  const failed = last.status === 'FAILED';
  const color = failed ? 'var(--sync-old)' : ageMin < 30 ? 'var(--sync-fresh)' : ageMin < 180 ? 'var(--sync-stale)' : 'var(--sync-old)';
  return (
    <span className="sync-badge" title={`${t('Ultimul sync: ')}${last.type ?? ''} · ${last.processed ?? 0}/${last.total ?? 0} · ${new Date(last.startedAt).toLocaleString('ro-RO')}`}>
      <span className="sync-dot" style={{ background: color }} />
      {failed ? t('Sync eșuat') : `${t('Sincronizat ')}${agoText(ageMin, last.startedAt)}`}
      {!failed && last.total ? <span className="text-[var(--fg-faint)] font-normal tabular ml-0.5">· {last.processed}/{last.total}</span> : null}
    </span>
  );
}
