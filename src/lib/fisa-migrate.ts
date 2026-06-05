// Migrare ADITIVĂ a blob-ului de strategie din cheile VECHI în cheile NOI (redesign B).
// REGULI 0-RISC: nu șterge nimic; completează DOAR cheile noi GOALE (fill-only-empty);
// păstrează valorile vechi + adaugă `*_raw` ca fallback. Idempotentă (rulabilă de oricâte ori).
import { mapSistemActualV2 } from './strategie-autofill';

// vechiul multiselect `constructie` (un singur câmp amestecat) → 4 câmpuri noi.
const MATERIAL_MAP: Record<string, string> = {
  'Caramida': 'Cărămidă', 'Cărămidă': 'Cărămidă', 'BCA': 'BCA', 'Lemn': 'Lemn',
  'Panou sandwich': 'Panou sandwich', 'Beton': 'Beton',
  'Structura metalica': 'Structură metalică', 'Structură metalică': 'Structură metalică',
};
const IZOL_MAP: Record<string, string> = {
  'Polistiren': 'Polistiren', 'PIR': 'PIR', 'Neizolat': 'Neizolat',
  'Vata minerala': 'Vată', 'Vata bazaltica': 'Vată', 'Vată minerală': 'Vată', 'Vată bazaltică': 'Vată', 'Vata de sticla': 'Vată',
};
const NIV_MAP: Record<string, string> = {
  'Parter': 'Parter', '1 etaj': '+1 etaj', '2 etaje': '+2 etaje', 'Mansarda': 'Mansardă', 'Mansardă': 'Mansardă',
};

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

/** Întoarce { blob: noul obiect, changed: bool }. NU mutează inputul. */
export function migrateFisaBlob(raw: Record<string, any> | null | undefined, variant: 'V1' | 'V2'): { blob: Record<string, any>; changed: boolean } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { blob: raw || {}, changed: false };
  const b: Record<string, any> = { ...raw };
  let changed = false;
  const set = (k: string, v: any) => { if (!isEmpty(v)) { b[k] = v; changed = true; } };

  // Sursă de căldură (lista nouă unificată „CT gaz…" pt ambele variante).
  if (variant === 'V2') {
    if (isEmpty(b.sursa_caldura) && !isEmpty(b.sistem_actual)) { set('sursa_caldura', mapSistemActualV2(b.sistem_actual)); if (isEmpty(b.sistem_actual_raw)) set('sistem_actual_raw', b.sistem_actual); }
  } else {
    if (isEmpty(b.ca_sursa_caldura) && !isEmpty(b.ca_sistem)) { set('ca_sursa_caldura', mapSistemActualV2(b.ca_sistem)); if (isEmpty(b.ca_sistem_raw)) set('ca_sistem_raw', b.ca_sistem); }
  }

  // Construcție: multiselect vechi → material / izolatie_tip / izolatie_cm / niveluri / tip_locuinta.
  const con = b.constructie;
  const arr: string[] = Array.isArray(con) ? con : (typeof con === 'string' && con.trim() ? con.split(/[;,]/).map((s: string) => s.trim()) : []);
  if (arr.length) {
    if (isEmpty(b.constructie_raw)) set('constructie_raw', con);
    for (const tok of arr) {
      if (isEmpty(b.material) && MATERIAL_MAP[tok]) set('material', MATERIAL_MAP[tok]);
      if (isEmpty(b.izolatie_tip) && IZOL_MAP[tok]) set('izolatie_tip', IZOL_MAP[tok]);
      if (isEmpty(b.izolatie_cm) && /^\d+\s*cm$/i.test(tok)) set('izolatie_cm', tok.replace(/\s+/g, ' '));
    }
    const nivs = arr.map(t => NIV_MAP[t]).filter(Boolean);
    if (nivs.length) { if (isEmpty(b.tip_locuinta)) set('tip_locuinta', 'Casă'); if (isEmpty(b.niveluri)) set('niveluri', nivs); }
  }
  return { blob: b, changed };
}
