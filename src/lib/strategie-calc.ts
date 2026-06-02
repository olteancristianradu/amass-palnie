/**
 * Formule calculator strategie AMASS — EXACTE, copiate 1:1 din Apps Script FisaV2.js/FisaV1.js.
 * Ambele fișe (V1 + V2) folosesc același calc engine pe baza suprafeței (C4).
 *
 * Lanț formule (din FisaV2.js liniile 216-351):
 *   F4 = C4 (suprafata)
 *   F5 (Putere necesara kW)   = F4 * 0.1
 *   F6 (Consum zilnic kWh)    = F5 * 2
 *   F7 (Consum lunar kWh)     = F6 * 30
 *   F8 (Consum ANUAL kWh)     = F6 * 30 * 6
 *   F9 (Necesar PFTV AMASS)   = F5 * 0.25
 *   F10 (Cost investitie EUR) = F4 * 50
 *   F11 (Esalonare lunara)    = MROUND(F10*1.5/60, 5) ± 20  → RANGE "x - y EUR/luna"
 *   C8 (Productie estimata)   = C6 * 4 * 365   (C6 = putere_pftv existenta)
 *   C17 (Reactie limita buget)= C4 * 55
 *   C18 (Plata integrala+Promo)= C4 * 40
 *   C19 (Reactie esalonare)   = CEILING((MROUND(F10*1.5/60,5)∓20)*1.1, 5) → RANGE
 *   C29 (Diferenta consum lei)= ROUND(C13 - F7*1.1)    (C13 = suma = cost lunar actual)
 *   F29 (Profit anual lei)    = ROUND((MAX(C7,C8) - F8) * 0.6)   (C7 = prod_aplicatie)
 *   C30 (Diferenta PFTV kW)   = ROUND(C6 - F9, 2)
 *
 *   F30 (Amortizare ANI) — RECTIFICAT 2026-06-01 (metodologia Radu: investiție / economie anuală).
 *     Vechea formulă din sheet `F10 / ((MAX(C7,C8)-F8)*0.6 + C13) / 5` era incoerentă dimensional
 *     (aduna profit ANUAL lei cu cost LUNAR lei, împărțea EUR la lei, apoi /5). Înlocuită cu:
 *       investiție_lei   = F10(EUR) × CURS_EUR_LEI
 *       economie_anuală  = C29(economie lunară vs sistem actual) × 6 luni-sezon  +  F29(profit anual PFTV)
 *       amortizare_ani   = investiție_lei / economie_anuală
 *     Termenul F29 încodează implicit categoria: cu PFTV → scurtează amortizarea; fără PFTV → 0.
 *     (Modelul de CONSUM — F7 = supraf×6 kWh/lună — rămâne 1:1 cu spreadsheet-ul; vezi nota din raport.)
 */

export interface StrategieInput {
  suprafata?: number;       // C4
  putere_pftv?: number;     // C6 — putere PFTV existenta
  prod_aplicatie?: number;  // C7 — productie anuala PFTV (aplicatie, daca o stie)
  suma?: number;            // C13 — cost lunar actual (lei)
  consum_unitate?: string;
  sistem_actual?: string;
  bransament?: string;
}

export interface StrategieCalc {
  putere_necesara_kw: number | null;        // F5
  consum_zilnic_kwh: number | null;         // F6
  consum_lunar_kwh: number | null;          // F7
  consum_anual_kwh: number | null;          // F8
  necesar_pftv_amass_kw: number | null;     // F9
  productie_estimata: number | null;        // C8
  cost_investitie_eur: number | null;       // F10
  cost_esalonare_range: string | null;      // F11 (range "x - y EUR/luna")
  cost_investitie_economic_eur: number | null; // C17
  cost_promo_eur: number | null;            // C18
  reactie_esalonare_range: string | null;   // C19 (range)
  diferenta_consum_lei: number | null;      // C29
  profit_anual_lei: number | null;          // F29
  diferenta_pftv_kw: number | null;         // C30
  amortizare_ani: number | null;            // F30
}

function mround(x: number, m: number): number { return Math.round(x / m) * m; }
function ceilTo(x: number, m: number): number { return Math.ceil(x / m) * m; }

export function calculate(input: StrategieInput): StrategieCalc {
  const C4 = toNum(input.suprafata);
  const C6 = toNum(input.putere_pftv);
  const C7 = toNum(input.prod_aplicatie);
  const C13 = toNum(input.suma);

  const hasSupr = C4 !== null && C4 > 0;
  const F4 = hasSupr ? C4! : null;
  const F5 = F4 !== null ? round2(F4 * 0.1) : null;
  const F6 = F5 !== null ? round1(F5 * 2) : null;
  const F7 = F6 !== null ? round1(F6 * 30) : null;
  const F8 = F6 !== null ? round1(F6 * 30 * 6) : null;
  const F9 = F5 !== null ? round2(F5 * 0.25) : null;
  const F10 = F4 !== null ? Math.round(F4 * 50) : null;

  // F11 esalonare: range MROUND(F10*1.5/60, 5) ± 20 EUR/luna
  let cost_esalonare_range: string | null = null;
  if (F10 !== null) {
    const base = mround(F10 * 1.5 / 60, 5);
    cost_esalonare_range = `${base - 20} - ${base + 20} EUR/luna`;
  }

  // C8 productie estimata = C6*4*365
  const C8 = (C6 !== null && C6 > 0) ? Math.round(C6 * 4 * 365) : null;

  const C17 = F4 !== null ? Math.round(C4! * 55) : null;
  const C18 = F4 !== null ? Math.round(C4! * 40) : null;

  // C19 reactie esalonare: CEILING((MROUND(F10*1.5/60,5)∓20)*1.1, 5)
  let reactie_esalonare_range: string | null = null;
  if (F10 !== null) {
    const base = mround(F10 * 1.5 / 60, 5);
    reactie_esalonare_range = `${ceilTo((base - 20) * 1.1, 5)} - ${ceilTo((base + 20) * 1.1, 5)} EUR/luna`;
  }

  // C29 diferenta consum = ROUND(C13 - F7*1.1)
  const C29 = (C13 !== null && F7 !== null) ? Math.round(C13 - F7 * 1.1) : null;

  // F29 profit anual = ROUND((MAX(C7,C8) - F8) * 0.6)
  const maxProd = Math.max(C7 ?? 0, C8 ?? 0);
  const F29 = (F8 !== null && maxProd > 0) ? Math.round((maxProd - F8) * 0.6) : null;

  // C30 diferenta PFTV = ROUND(C6 - F9, 2)
  const C30 = (C6 !== null && F9 !== null) ? round2(C6 - F9) : null;

  // F30 amortizare (ANI) — RECTIFICAT: investiție / economie anuală (vezi nota din header).
  // economie anuală = economie lunară din consum (C29) pe sezonul de încălzire (6 luni)
  //                 + profit anual din surplus PFTV vândut (F29, =0 dacă nu există PFTV).
  const CURS_EUR_LEI = 5; // curs aproximativ EUR→lei, folosit DOAR pentru amortizare în ani
  let F30: number | null = null;
  if (F10 !== null) {
    const economieAnuala = (C29 ?? 0) * 6 + (F29 ?? 0);
    if (economieAnuala > 0) F30 = round1((F10 * CURS_EUR_LEI) / economieAnuala);
  }

  return {
    putere_necesara_kw: F5,
    consum_zilnic_kwh: F6,
    consum_lunar_kwh: F7,
    consum_anual_kwh: F8,
    necesar_pftv_amass_kw: F9,
    productie_estimata: C8,
    cost_investitie_eur: F10,
    cost_esalonare_range,
    cost_investitie_economic_eur: C17,
    cost_promo_eur: C18,
    reactie_esalonare_range,
    diferenta_consum_lei: C29,
    profit_anual_lei: F29,
    diferenta_pftv_kw: C30,
    amortizare_ani: F30
  };
}

function toNum(x: any): number | null {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
  return isNaN(n) ? null : n;
}
function round1(x: number): number { return Math.round(x * 10) / 10; }
function round2(x: number): number { return Math.round(x * 100) / 100; }
