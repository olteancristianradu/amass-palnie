// ── Template-ul fișei de strategie — structură EDITABILĂ de admin, citită de toți agenții ──
// Fișa nu mai e hardcodată în page.tsx: e generată din acest template (stocat în DB, model FisaTemplate).
// Seed-ul inițial (fisa-template-seed.ts) = paritate 1:1 cu fișa din spreadsheet (V1 = cat 1, V2 = restul).

// Controale UI ale fișei:
//  - 'pills'  = SINGLE-select tip chip colorat, one-tap (stochează un string, ca 'dropdown'); cere `options`.
//  - 'chips'  = MULTI-select chips colorate (stochează string[], ca 'multiselect'); cere `options`.
// Restul rămân neschimbate.
export type FisaControl = 'number' | 'text' | 'dropdown' | 'multiselect' | 'textarea' | 'calc' | 'pills' | 'chips';

// Familia de culoare semantică a unui câmp (brief §3). Coloră DOAR categoriile listate.
// 'verde' e REZERVAT exclusiv calculelor AMASS (banii arătați clientului) — nu-l folosi în altă parte.
export type FisaColorFam = 'coral' | 'teal' | 'gri' | 'roz' | 'ambra' | 'albastru' | 'violet' | 'verde';

export interface FisaField {
  key: string;                 // cheia de stocare în blob-ul strategieV1/V2 — NU se schimbă după creare (ar orfaniza datele)
  label: string;               // eticheta afișată (editabilă de admin)
  control: FisaControl;
  options?: string[];          // pentru dropdown/multiselect/pills/chips
  source?: 'manual' | 'autofill' | 'calc';
  cell?: string;               // referință celulă spreadsheet (informativ, pt paritate)
  calcKey?: string;            // pentru control 'calc': cheia din obiectul `calc` calculat de strategie-calc.ts
  full?: boolean;              // ocupă tot rândul (ex. textarea de observații)
  // ── extensii redesign (progressive disclosure, culoare, calcul, unități) ──
  // Câmpul apare DOAR dacă valoarea din form[cond.key] ∈ cond.in (cascade: tip pompă, niveluri casă, etaj apartament,
  // „Altele" → text liber etc.). Absența lui `cond` = câmp mereu vizibil.
  cond?: { key: string; in: string[] };
  // Familia de culoare a chip-urilor/select-ului (one-tap, vizual pe grup semantic).
  fam?: FisaColorFam;
  // Pentru control 'calc': formula (afișată în tooltip ⓘ) + notă explicativă, copiate din spreadsheet/pa-fisa.jsx.
  formula?: string;
  note?: string;
  // Sufix unitate pentru 'number' (ex. 'mp','kW','kWh','lei','€').
  unit?: string;
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
// `allowRemoveKeys` (opțional) = chei pentru care ștergerea e PERMISĂ explicit (datele au fost deja
// curățate prin /api/admin/fisa-field înainte de PATCH) → excluse din verificarea anti-orfanizare.
export function validateTemplate(
  t: any,
  prev?: FisaTemplateData,
  allowRemoveKeys?: string[]
): { ok: boolean; error?: string } {
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
      // Controalele cu opțiuni: dropdown/multiselect + noile pills (single) / chips (multi).
      const needsOptions = f.control === 'dropdown' || f.control === 'multiselect'
        || f.control === 'pills' || f.control === 'chips';
      if (needsOptions && (!Array.isArray(f.options) || f.options.length === 0))
        return { ok: false, error: 'câmp cu opțiuni fără opțiuni (dropdown/multiselect/pills/chips): ' + f.key };
      // `cond` (progressive disclosure), dacă e dat, trebuie să fie { key, in: string[] } valid.
      if (f.cond !== undefined) {
        if (!f.cond || typeof f.cond.key !== 'string' || !f.cond.key || !Array.isArray(f.cond.in))
          return { ok: false, error: 'cond invalid (cere { key, in: [...] }): ' + f.key };
      }
    }
  }
  // Protecție anti-orfanizare: nicio cheie existentă nu poate dispărea (redenumire/ștergere de câmp existent),
  // CU EXCEPȚIA cheilor din allowRemoveKeys (curățate explicit prin endpoint-ul de ștergere câmp).
  if (prev) {
    const allowed = new Set(allowRemoveKeys ?? []);
    const missing: string[] = [];
    for (const oldKey of collectKeys(prev)) if (!keys.has(oldKey) && !allowed.has(oldKey)) missing.push(oldKey);
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

// ── Helpers ștergere câmp din date reale (folosite de /api/admin/fisa-field) ──
// Toate sunt PURE și DEFENSIVE la JSON corupt: nu aruncă, lucrează pe copii imutabile.

// Parsează în siguranță un blob JSON (string sau deja-obiect) → obiect plat { key: value }.
// Orice intrare invalidă (null, array, JSON corupt) → {} (niciodată throw).
export function safeParseBlob(s: any): Record<string, any> {
  if (s && typeof s === 'object' && !Array.isArray(s)) return { ...s };
  if (typeof s !== 'string' || !s.trim()) return {};
  try {
    const b = JSON.parse(s);
    if (b && typeof b === 'object' && !Array.isArray(b)) return b;
  } catch { /* corupt → gol */ }
  return {};
}

// O valoare e „non-goală" (=> contează drept date completate de un client)?
export function isNonEmptyValue(v: any): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some(x => x !== undefined && x !== null && String(x).trim() !== '');
  if (typeof v === 'number') return true;            // 0 e o valoare validă (ex. suprafață editată)
  return String(v).trim() !== '';
}

// Compune linia de mutat în Observații pentru delete-to-obs: „\n[Eticheta]: valoare".
export function obsLineFor(label: string, value: any): string {
  const clean = (label || '').replace(/:\s*$/, '').trim();
  const txt = fieldValueToText(value).trim();
  return '\n[' + (clean || 'Câmp') + ']: ' + txt;
}

// Aplică pe un blob (string|obiect) o ștergere a unei chei, opțional mutând valoarea într-o
// cheie de observații. Întoarce { changed, blob } unde blob e SERIALIZAT (string) gata de stocare,
// sau null dacă blob-ul a rămas gol (ca să poată fi setat null în DB). `mode`:
//   'hard'    → șterge doar cheia
//   'to-obs'  → mută blob[key] în blob[obsKey] (append cu eticheta) apoi șterge cheia
export function applyFieldDeletionToBlob(
  raw: any,
  key: string,
  opts: { mode: 'hard' | 'to-obs'; label?: string; obsKey?: string }
): { changed: boolean; blob: string | null } {
  const obj = safeParseBlob(raw);
  if (!(key in obj)) {
    // Nimic de șters; păstrăm reprezentarea originală (string netulburat) dacă era string.
    return { changed: false, blob: typeof raw === 'string' ? raw : (Object.keys(obj).length ? JSON.stringify(obj) : null) };
  }
  const value = obj[key];
  if (opts.mode === 'to-obs' && opts.obsKey && isNonEmptyValue(value)) {
    const prevObs = obj[opts.obsKey];
    const prevTxt = (prevObs === undefined || prevObs === null) ? '' : String(prevObs);
    obj[opts.obsKey] = (prevTxt + obsLineFor(opts.label || key, value)).replace(/^\n/, '');
  }
  delete obj[key];
  const keys = Object.keys(obj);
  return { changed: true, blob: keys.length ? JSON.stringify(obj) : null };
}
