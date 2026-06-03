// ── Template-ul fișei de strategie — structură EDITABILĂ de admin, citită de toți agenții ──
// Fișa nu mai e hardcodată în page.tsx: e generată din acest template (stocat în DB, model FisaTemplate).
// Seed-ul inițial (fisa-template-seed.ts) = paritate 1:1 cu fișa din spreadsheet (V1 = cat 1, V2 = restul).

export type FisaControl = 'number' | 'text' | 'dropdown' | 'multiselect' | 'textarea' | 'calc';

export interface FisaField {
  key: string;                 // cheia de stocare în blob-ul strategieV1/V2 — NU se schimbă după creare (ar orfaniza datele)
  label: string;               // eticheta afișată (editabilă de admin)
  control: FisaControl;
  options?: string[];          // pentru dropdown/multiselect
  source?: 'manual' | 'autofill' | 'calc';
  cell?: string;               // referință celulă spreadsheet (informativ, pt paritate)
  calcKey?: string;            // pentru control 'calc': cheia din obiectul `calc` calculat de strategie-calc.ts
  full?: boolean;              // ocupă tot rândul (ex. textarea de observații)
}

export interface FisaZone {
  id: string;
  titlu: string;
  fields: FisaField[];
}

export interface FisaTemplateData {
  variant: 'V1' | 'V2';
  titlu: string;
  zones: FisaZone[];
}

// Adună toate cheile de câmp dintr-un template (folosit pentru protecția anti-orfanizare).
function collectKeys(t: FisaTemplateData): Set<string> {
  const keys = new Set<string>();
  for (const z of t.zones) for (const f of z.fields) if (f.key) keys.add(f.key);
  return keys;
}

// Validare minimă a unui template (folosită la PATCH din editorul de admin).
// `prev` (opțional) = template-ul curent din DB: dacă e dat, RESPINGE dispariția
// oricărei chei existente — schimbarea/eliminarea unui `key` ar orfaniza datele clienților.
// Adăugarea de chei noi rămâne permisă.
export function validateTemplate(t: any, prev?: FisaTemplateData): { ok: boolean; error?: string } {
  if (!t || typeof t !== 'object') return { ok: false, error: 'Template invalid' };
  if (t.variant !== 'V1' && t.variant !== 'V2') return { ok: false, error: 'variant trebuie V1 sau V2' };
  if (!Array.isArray(t.zones)) return { ok: false, error: 'zones trebuie să fie listă' };
  const keys = new Set<string>();
  for (const z of t.zones) {
    if (!z || !Array.isArray(z.fields)) return { ok: false, error: 'zonă fără câmpuri' };
    for (const f of z.fields) {
      if (!f.key || !f.label || !f.control) return { ok: false, error: 'câmp fără key/label/control' };
      if (keys.has(f.key)) return { ok: false, error: 'cheie duplicată: ' + f.key };
      keys.add(f.key);
      if ((f.control === 'dropdown' || f.control === 'multiselect') && (!Array.isArray(f.options) || f.options.length === 0))
        return { ok: false, error: 'dropdown/multiselect fără opțiuni: ' + f.key };
    }
  }
  // Protecție anti-orfanizare: nicio cheie existentă nu poate dispărea (redenumire/ștergere de câmp existent).
  if (prev) {
    const missing: string[] = [];
    for (const oldKey of collectKeys(prev)) if (!keys.has(oldKey)) missing.push(oldKey);
    if (missing.length > 0) {
      return {
        ok: false,
        error: 'Cheia câmpului nu se poate schimba sau elimina după creare (ar orfaniza datele clienților): '
          + missing.join(', '),
      };
    }
  }
  return { ok: true };
}

// Normalizează o valoare multiselect (poate fi array, string cu ';'/',' sau gol) → string[] pentru UI/stocare.
export function asMulti(v: any): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) return v.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  return [];
}

// Reprezentare text a unei valori (multiselect → join) pentru PDF/Word/email/push CRM.
export function fieldValueToText(v: any): string {
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  return v == null ? '' : String(v);
}
