/**
 * Stage-rules — SURSA UNICĂ DE ADEVĂR pentru stadiul de pâlnie AMASS.
 * Pipeline-ul lui Radu: Intrare → T1 → Schiță → Pre-ofertat → Ofertat → Contractat
 * (+ stări laterale: Amânat, Finalizat, Anulat).
 * Pur (fără Prisma/DB) → importabil ȘI pe client (pipeline) ȘI pe server (PATCH validări).
 */

export interface StageClient {
  t1?: string | null; schitaStatus?: string | null; preOfertat?: string | null;
  ofertat?: string | null; stadiu?: string | null; suprafata?: number | null;
  nextStepDue?: any; closureReason?: string | null;
}

const nz = (v: any) => v != null && String(v).trim() !== '';

/** Stadiul curent (stările finale au prioritate, apoi cel mai avansat punct de etapă). */
export function deriveStage(c: StageClient): string {
  if (c.stadiu === 'Finalizat') return 'finalizat';
  if (c.stadiu === 'Contractat') return 'contractat';
  if (c.stadiu === 'Anulat') return 'anulat';
  if (c.stadiu === 'Amanat') return 'amanat';
  if (nz(c.ofertat)) return 'ofertat';
  if (nz(c.preOfertat)) return 'preofertat';
  if (nz(c.schitaStatus)) return 'schita';
  if (nz(c.t1)) return 't1';
  return 'intrare';
}

// Rang în pâlnia liniară (pt detectarea mutărilor înapoi). Amânat ~ unde era; close = mare.
export const STAGE_RANK: Record<string, number> = {
  intrare: 0, t1: 1, schita: 2, preofertat: 3, ofertat: 4, amanat: 4, contractat: 5, finalizat: 6, anulat: 5
};

// Probabilitate implicită de câștig per stadiu (pt forecast ponderat — pasul următor).
export const STAGE_PROBABILITY: Record<string, number> = {
  intrare: 5, t1: 10, schita: 20, preofertat: 35, ofertat: 60, amanat: 25, contractat: 95, finalizat: 100, anulat: 0
};
export function stageProbability(stageKey: string): number { return STAGE_PROBABILITY[stageKey] ?? 0; }

// Cerințe BLOCANTE per stadiu-țintă (la avansare). Mutarea înapoi NU e validată.
const STAGE_REQUIREMENTS: Record<string, { suprafata?: boolean; nextStep?: boolean; closureReason?: boolean }> = {
  schita:     { suprafata: true },
  preofertat: { suprafata: true },
  ofertat:    { suprafata: true, nextStep: true },
  contractat: { closureReason: true },
  anulat:     { closureReason: true }
};

// Ghidaj contextual per stadiu (pentru breadcrumb/checklist pe fișă — pasul următor).
export const STAGE_GUIDANCE: Record<string, { title: string; tips: string[]; exitCriteria: string[] }> = {
  intrare:    { title: 'Lead nou (Intrare)', tips: ['Sună rapid — primele 5 minute contează.'], exitCriteria: ['Primul contact realizat → T1'] },
  t1:         { title: 'T1 — primul contact', tips: ['Calificați nevoia + bugetul.'], exitCriteria: ['Cere/trimite schița → Schiță'] },
  schita:     { title: 'Schiță', tips: ['Confirmă suprafața reală.'], exitCriteria: ['Suprafață măsurată', 'Pregătește pre-oferta'] },
  preofertat: { title: 'Pre-ofertat', tips: ['Aliniază așteptările de preț.'], exitCriteria: ['Trimite oferta fermă → Ofertat'] },
  ofertat:    { title: 'Ofertat', tips: ['Setează un follow-up clar.'], exitCriteria: ['Pas următor + dată setate', 'Împinge spre semnare'] },
  amanat:     { title: 'Amânat', tips: ['Notează data de re-contact.'], exitCriteria: ['Reia când revine în atenție'] },
  contractat: { title: 'Contractat (câștigat)', tips: ['Programează montajul.'], exitCriteria: ['Motiv câștig notat'] },
  finalizat:  { title: 'Finalizat (livrat)', tips: ['Cere recomandare.'], exitCriteria: [] },
  anulat:     { title: 'Anulat (pierdut)', tips: ['Notează de ce — date pentru coaching.'], exitCriteria: ['Motiv pierdere notat'] }
};

/**
 * Validează o tranziție de stadiu. `merged` = starea clientului DUPĂ patch.
 * Mutările înapoi pe pâlnie sunt permise fără validare; închiderea (Contractat/Anulat) cere mereu motiv.
 */
export function checkStageTransition(before: StageClient, merged: StageClient): { ok: boolean; errors: string[] } {
  const from = deriveStage(before);
  const to = deriveStage(merged);
  if (from === to) return { ok: true, errors: [] };
  const isClose = to === 'contractat' || to === 'anulat';
  const backward = (STAGE_RANK[to] ?? 0) < (STAGE_RANK[from] ?? 0);
  if (backward && !isClose) return { ok: true, errors: [] };

  const req = STAGE_REQUIREMENTS[to] || {};
  const errors: string[] = [];
  if (req.suprafata && !((Number(merged.suprafata) || 0) > 0)) errors.push('Completează suprafața (mp) înainte de „' + label(to) + '".');
  if (req.nextStep && !nz(merged.nextStepDue)) errors.push('Setează Pasul Următor + data înainte de „Ofertat".');
  if (req.closureReason && !nz(merged.closureReason)) errors.push('Alege motivul (Câștigat/Pierdut) la închidere.');
  return { ok: errors.length === 0, errors };
}

export function label(stageKey: string): string {
  return ({ intrare: 'Lead', t1: 'T1', schita: 'Schiță', preofertat: 'Pre-ofertat', ofertat: 'Ofertat',
    amanat: 'Amânat', contractat: 'Contractat', finalizat: 'Finalizat', anulat: 'Anulat' } as Record<string, string>)[stageKey] || stageKey;
}
