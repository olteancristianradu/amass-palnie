// Metadate „Aspect" (oglindă a public/aspect.js) — folosibile în componente fără window.
// Culorile efective vin din tokenii --st-* (setați de motorul Aspect, editabili în /aspect).
// deriveStage: delegat la stage-rules (sursa unică de adevăr) — nu duplica logica.

export interface StageMeta { key: string; label: string; warn: number; late: number; }
export const STAGES: StageMeta[] = [
  { key: 'intrare', label: 'Intrare', warn: 2, late: 4 },
  { key: 't1', label: 'T1', warn: 3, late: 7 },
  { key: 'schita', label: 'Schiță', warn: 5, late: 10 },
  { key: 'preofertat', label: 'Pre-ofertat', warn: 6, late: 12 },
  { key: 'ofertat', label: 'Ofertat', warn: 10, late: 20 },
  { key: 'contractat', label: 'Contractat', warn: 14, late: 28 },
];
export const TERMINAL: StageMeta[] = [
  { key: 'amanat', label: 'Amânat', warn: 30, late: 60 },
  { key: 'finalizat', label: 'Finalizat', warn: 999, late: 999 },
  { key: 'anulat', label: 'Anulat', warn: 999, late: 999 },
];
export const ALL_STAGES = [...STAGES, ...TERMINAL];
export const STAGE_MAP: Record<string, StageMeta> = Object.fromEntries(ALL_STAGES.map(s => [s.key, s]));

export interface PrioMeta { key: string; label: string; color: string; rank: number; outline?: boolean; }
// 5 culori FIXE, universale (nepersonalizabile) — limbaj comun în toată echipa.
export const PRIORITIES: PrioMeta[] = [
  { key: 'rosu', label: 'Urgent', color: '#E11D2A', rank: 4 },
  { key: 'portocaliu', label: 'Ridicată', color: '#F97316', rank: 3 },
  { key: 'albastru', label: 'Normală', color: '#2563EB', rank: 2 },
  { key: 'verde', label: 'Scăzută', color: '#16A34A', rank: 1 },
  { key: 'alb', label: 'Nesetat', color: '#FFFFFF', rank: 0, outline: true },
];
export const PRIORITY_MAP: Record<string, PrioMeta> = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));

export function rotLevel(stageKey: string, days: number): 'fresh' | 'warn' | 'late' {
  const s = STAGE_MAP[stageKey]; if (!s) return 'fresh';
  if (days >= s.late) return 'late';
  if (days >= s.warn) return 'warn';
  return 'fresh';
}

// RECONCILIERE INDICATOR PRIORITATE: steluța gestcom (categoria_favorit 0..5, câmpul `stelutaCat`)
// → cheia de prioritate din design. gestcom: cat 1 = roșu/urgent … cat 4 = verde (fișa AMASS). 0 = nesetat.
export function stelutaToPrio(cat: number | null | undefined): string {
  switch (Number(cat)) {
    case 1: return 'rosu';
    case 2: return 'portocaliu';
    case 3: return 'albastru';
    case 4: return 'verde';
    case 5: return 'verde';
    default: return 'alb';
  }
}
export function prioToSteluta(key: string): number {
  switch (key) { case 'rosu': return 1; case 'portocaliu': return 2; case 'albastru': return 3; case 'verde': return 4; default: return 0; }
}

// Stadiul funnel derivat din câmpurile clientului — delegat la stage-rules (sursa unică de adevăr).
export { deriveStage } from '@/lib/stage-rules';

// Zile „în stadiu" — aproximat din dataIntrare (appul nu ține ageInStage explicit).
export function daysSince(iso?: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}
