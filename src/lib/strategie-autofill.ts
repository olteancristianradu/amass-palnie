/**
 * strategie-autofill.ts — parser PUR pentru autocompletarea fișei Strategie din
 * câmpul OBSERVATII al CRM-ului.
 *
 * Portat 1:1 din Apps Script:
 *   - amass-script/Strategie.js  (_parseObservatiiForm_, _normalizeRo_, findAnswerAfter,
 *                                 findInlineMatch, findAnswersBulletsAfter, _extractSuma_)
 *   - amass-script/StrategieEngine.js  (_mapSistemActualV2_ — cele 10 sisteme)
 *
 * Diferență față de Apps Script: în webapp `client.observatii` SOSEȘTE DEJA decodificat
 * (decHtml din crm-client.ts a transformat &icirc;/&br; etc. în diacritice reale + newline).
 * Deci sărim peste extragerea celulei <td class="hilite2"> și peste decodarea entităților
 * HTML — pornim direct de la textul brut OBSERVATII. Restul logicii (normalizare diacritice
 * Unicode, split pe linii, matching line-based) este identic cu sursa.
 *
 * Funcție pură: primește textul observații → întoarce un obiect cu câmpurile de autofill.
 * NU atinge strategie-calc.ts.
 */

export interface AutofillResult {
  /** Sistem actual de încălzire, mapat la valoarea din dropdown V2 (SISTEM_OPTS). '' dacă necunoscut. */
  sistem_actual: string;
  /** Sistem actual mapat la dropdown-ul V1 (ca_sistem) — etichete diferite de V2. '' dacă necunoscut. */
  sistem_actual_v1: string;
  /** Cost lunar actual (lei), număr rotunjit format RO, sau null. */
  costLunar: number | null;
  /** Buget achiziție (text brut sau sumă), sau null. */
  bugetAchizitie: number | string | null;
  /** Alternative de încălzire analizate (text concatenat cu ; ), sau null. */
  alternativa: string | null;
  /** Branșament: 'Trifazic' | 'Monofazic' | null (strict). */
  bransament: 'Trifazic' | 'Monofazic' | null;
  /** Dorește PFTV: 'Da' | 'Nu' | 'Are deja' | 'În viitor' | null (strict). */
  doresteOftv: 'Da' | 'Nu' | 'Are deja' | 'În viitor' | null;
  /** Putere PFTV existentă (kW) ca număr, sau null. */
  puterePftv: number | null;
}

// Normalizeaza diacriticele romanesti pentru matching robust (ă/â→a, î→i, ț→t, ș→s).
export function normalizeRo(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/[ăâ]/g, 'a')   // ă, â
    .replace(/[î]/g, 'i')         // î
    .replace(/[ţț]/g, 't')   // ţ, ț
    .replace(/[şș]/g, 's');  // ş, ș
}

// FIX BUG CRITIC 2026-05-25 (v12): extractSuma format RO.
// "1.000,50 RON" → 1001 (rotunjit). Detectează RO (. mii, , zecimale) vs US (, mii, . zecimale).
export function extractSuma(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/(\d[\d\s.,]*)/);
  if (!m) return null;
  const s = m[1].replace(/\s/g, ''); // sterge spatii
  const hasC = s.indexOf(',') >= 0;
  const hasD = s.indexOf('.') >= 0;
  let num: string;
  if (hasC && hasD) {
    // Ambele prezente — ultimul caracter decide rolul
    const lastC = s.lastIndexOf(',');
    const lastD = s.lastIndexOf('.');
    if (lastC > lastD) {
      // format RO: 1.000,50 — . separator mii, , zecimale
      num = s.replace(/\./g, '').replace(',', '.');
    } else {
      // format US: 1,000.50 — , separator mii, . zecimale
      num = s.replace(/,/g, '');
    }
  } else if (hasC) {
    // Doar virgulă. Ambiguu: zecimale (1,50) sau mii (1,000).
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      num = s.replace(',', ''); // "1,500" → 1500 (mii)
    } else {
      num = s.replace(',', '.'); // "1,50" → 1.50 (zecimale)
    }
  } else if (hasD) {
    // Doar punct. 1.000 vs 1.50
    const partsD = s.split('.');
    if (partsD.length === 2 && partsD[1].length === 3 && partsD[0].length <= 3) {
      num = s.replace('.', '');
    } else {
      num = s;
    }
  } else {
    num = s;
  }
  const n = parseFloat(num);
  return isNaN(n) ? null : Math.round(n);
}

/**
 * Mapeaza textul liber "sistem de incalzire" la o valoare din dropdown-ul V2.
 * Portat 1:1 din StrategieEngine.js::_mapSistemActualV2_ (cele 10 sisteme).
 * Valorile întoarse sunt RECONCILIATE cu SISTEM_OPTS din page.tsx
 * (['CT gaz','CT lemne','CT peleti','CT electrica','Pompa caldura','Calorifere electrice',
 *   'Aer conditionat','Soba','Nu are sistem']) ca autofill-ul să cadă pe o opțiune validă a select-ului.
 */
export function mapSistemActualV2(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = normalizeRo(String(raw)).toLowerCase();
  // ordinea verificărilor = identică cu Apps Script (specific → generic)
  if (/pompa\s*(de\s*)?caldura/.test(s)) return 'Pompa caldura';
  if (/peleti/.test(s)) return 'CT peleti';                                  // AS: 'Centrala peleti'
  if (/centrala?\s*(pe\s*)?(gaz|gazoasa)/.test(s) || /\bgaz\b/.test(s)) return 'CT gaz';
  if (/centrala?\s*(pe\s*)?(lemne|lemn)/.test(s) || /lemne/.test(s)) return 'CT lemne';
  if (/centrala?\s*(pe\s*)?electric/.test(s)) return 'CT electrica';
  if (/sobe|\bsoba\b/.test(s)) return 'Soba';                                // AS: 'Sobe'
  if (/radiator.*ulei|\bulei\b/.test(s)) return 'Calorifere electrice';      // AS: 'Radiatoare ulei' (cea mai apropiată opțiune din dropdown)
  if (/aer\s*conditionat|\bac\b/.test(s)) return 'Aer conditionat';          // AS: 'AC'
  if (/plasm|infraros/.test(s)) return 'Calorifere electrice';              // AS: 'Plasme infrarosu'
  if (/\biep\b|pardoseal/.test(s)) return 'Calorifere electrice';           // AS: 'IEP'
  return ''; // necunoscut -> lasam gol, completeaza agentul
}

/**
 * Variantă V1 (construcție) — port _mapSistemActualV1_. Dropdown-ul ca_sistem din V1 are ALTE etichete
 * decât V2 (ex. 'Centrala gaz'/'Pompa de caldura' vs 'CT gaz'/'Pompa caldura'). Fără asta, clienții V1
 * primeau valori V2 care nu existau în dropdown-ul lor (apăreau invalide/goale). Vezi SEED_V1 (z02 ca_sistem).
 */
export function mapSistemActualV1(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = normalizeRo(String(raw)).toLowerCase();
  if (/pompa\s*(de\s*)?caldura/.test(s)) return 'Pompa de caldura';
  if (/peleti/.test(s)) return 'Centrala peleti';
  if (/centrala?\s*(pe\s*)?(gaz|gazoasa)/.test(s) || /\bgaz\b/.test(s)) return 'Centrala gaz';
  if (/centrala?\s*(pe\s*)?(lemne|lemn)/.test(s) || /lemne/.test(s)) return 'Centrala lemne';
  if (/centrala?\s*(pe\s*)?electric/.test(s)) return 'Centrala electrica';
  if (/sobe|\bsoba\b/.test(s)) return 'Soba';
  if (/radiator.*ulei|\bulei\b/.test(s)) return 'Calorifere electrice';
  if (/aer\s*conditionat|\bac\b/.test(s)) return 'Aer conditionat';
  if (/plasm|infraros/.test(s)) return 'Calorifere electrice';
  if (/\biep\b|pardoseal/.test(s)) return 'Calorifere electrice';
  return '';
}

/**
 * Parser principal — portat 1:1 din Strategie.js::_parseObservatiiForm_ (logica line-based).
 * Primește textul OBSERVATII (deja decodificat în webapp) → întoarce câmpurile de autofill.
 * @param obsText textul brut OBSERVATII (plain text, cu newline-uri)
 */
export function parseObservatii(obsText: string | null | undefined): AutofillResult {
  const empty: AutofillResult = {
    sistem_actual: '', sistem_actual_v1: '', costLunar: null, bugetAchizitie: null, alternativa: null,
    bransament: null, doresteOftv: null, puterePftv: null
  };
  if (!obsText) return empty;

  // Normalizeaza diacriticele (Unicode → ascii), apoi split pe linii.
  const norm = normalizeRo(String(obsText));
  const lines = norm.split(/\n+/).map(l => l.trim()).filter(l => l);

  function findAnswerAfter(re: RegExp, opts?: { preferSuma?: boolean }): string | null {
    opts = opts || {};
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        let firstValid: string | null = null;
        // Preferam un candidat care "arata" ca tipul de raspuns asteptat
        for (let j = i + 1; j < lines.length && j <= i + 6; j++) {
          const candidate = (lines[j] || '').trim();
          if (!candidate || /^[\-=_\.,;:\s]*$/.test(candidate)) continue;
          // Pentru sume: preferam linii cu RON/lei/EUR si cifra robusta (>=2 cifre)
          if (opts.preferSuma) {
            if (/\b(ron|lei|eur)\b/i.test(candidate) && /\d{2,}/.test(candidate)) return candidate;
          }
          if (firstValid === null) firstValid = candidate;
        }
        return firstValid;
      }
    }
    return null;
  }

  // FIX v17: extrage valoare de pe ACEEAȘI linie cu eticheta (notițe agent inline).
  // Ex: "BRANSAMENT TRIFAZIC" → match label + value pe aceeași linie → return "TRIFAZIC".
  function findInlineMatch(labelRe: RegExp, valueRe: RegExp): string | null {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (labelRe.test(line)) {
        const m = line.match(valueRe);
        if (m) return m[0];
      }
    }
    return null;
  }

  // FIX v16: capturează toate bullet-urile (* / • / -) după o întrebare,
  // pana la prima linie ne-bullet (de obicei = următoarea întrebare).
  function findAnswersBulletsAfter(re: RegExp): string | null {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const bullets: string[] = [];
        for (let j = i + 1; j < lines.length && j <= i + 10; j++) {
          const candidate = (lines[j] || '').trim();
          if (!candidate) continue;
          // Linie bullet: începe cu * / • / -
          if (/^[\*•\-]\s+/.test(candidate)) {
            bullets.push(candidate.replace(/^[\*•\-\s]+/, '').trim());
          } else if (bullets.length > 0) {
            // Am avut bullet-uri, acum vine ne-bullet — probabil următoarea întrebare. STOP.
            break;
          } else {
            // Nu am avut bullet-uri și asta nu e bullet — nu e o întrebare multi-bullet. STOP.
            break;
          }
        }
        if (bullets.length === 1) return bullets[0];
        if (bullets.length > 1) return bullets.join('; '); // concatenate cu ;
      }
    }
    return null;
  }

  // Pattern-uri tolerante (.*? lazy match), super-permisive pentru diacritice via normalizeRo.
  const tipIncalzire = findAnswerAfter(/ce sistem de .*?incalzire.*?aveti/i);
  const costLunarRaw = findAnswerAfter(/cat platiti.*?pe luna/i, { preferSuma: true });
  const bugetRaw = findAnswerAfter(/cat doriti.*?platiti.*?achizi/i, { preferSuma: true });

  // Alternative: forma NOUĂ "Pe care din sistemele ... conectabile la panourile fotovoltaice
  // doriti sa le analizati?" cu MULTIPLE bullet-uri. Capturăm TOATE bullet-urile concatenate.
  let alternativa =
    findAnswersBulletsAfter(/(?:pe\s+)?care din sistemele.*?(?:fotovoltaic|alternativ).*?analiz/i)
    || findAnswersBulletsAfter(/care din sistemele.*?analiz/i)
    || findAnswerAfter(/care din sistemele.*?analiz/i);

  // FIX v17: bransament/PFTV apar INLINE in notițe libere agent.
  // PRIMA prioritate: inline match pe aceeași linie. FALLBACK: linia următoare (formular standard).
  let bransament: string | null =
    findInlineMatch(/bransament/i, /\b(monofazic|trifazic)\b/i)
    || findAnswerAfter(/(?:branșament|bransament|tip\s+curent).*?(?:monofazic|trifazic|amperaj)/i)
    || findAnswerAfter(/curent.*?electric/i);

  // PFTV: răspunsuri "DA"/"NU"/"DORESTE"/"ARE DEJA"/"VREAU IN VIITOR"
  let doresteOftv: string | null =
    findInlineMatch(/\bpftv\b|panouri\s+fotovoltaic/i, /\b(doreste|are\s+deja|am\s+deja|vreau|nu\s+doreste|nu\s+vrea|in\s+viitor|da|nu)\b/i)
    || findAnswerAfter(/dorit.*?panouri.*?(?:fotovoltaic|pftv)/i)
    || findAnswerAfter(/are.*?panouri.*?fotovoltaic/i)
    || findAnswerAfter(/conectare.*?panouri.*?fotovoltaic/i);

  // PFTV kw: extrage cifra inline din "PFTV 6 KW" sau "6 kw PFTV"
  let puterePftvRaw: string | null =
    findInlineMatch(/\bpftv\b/i, /\b\d+(?:[.,]\d+)?\s*kw/i)
    || findInlineMatch(/panouri\s+fotovoltaic/i, /\b\d+(?:[.,]\d+)?\s*kw/i)
    || findAnswerAfter(/cati\s+kw.*?(?:are|aveti).*?(?:pftv|fotovoltaic)/i)
    || findAnswerAfter(/putere.*?(?:pftv|panouri)/i);

  // curata bullet-ul de la inceputul alternativei ("* Pompa de caldura" -> "Pompa de caldura")
  if (alternativa) {
    alternativa = alternativa.replace(/^[\*•\-\s]+/, '').trim();
  }

  // FIX v17: normalizare STRICTĂ - null dacă nu se potrivește lista.
  let bransamentOut: 'Trifazic' | 'Monofazic' | null = null;
  if (bransament) {
    const bs = normalizeRo(bransament).toLowerCase();
    if (/trifazic/.test(bs)) bransamentOut = 'Trifazic';
    else if (/monofazic/.test(bs)) bransamentOut = 'Monofazic';
    else bransamentOut = null; // STRICT: nimic altceva acceptat
  }

  let doresteOut: 'Da' | 'Nu' | 'Are deja' | 'În viitor' | null = null;
  if (doresteOftv) {
    const ds = normalizeRo(doresteOftv).toLowerCase();
    if (/are\s+deja|am\s+deja/.test(ds)) doresteOut = 'Are deja';
    else if (/viitor|peste|anul/.test(ds)) doresteOut = 'În viitor';
    else if (/doreste|vreau|\bda\b/.test(ds)) doresteOut = 'Da';
    else if (/nu\s+doreste|nu\s+vrea|\bnu\b/.test(ds)) doresteOut = 'Nu';
    else doresteOut = null; // STRICT
  }

  // FIX v17: puterePftv — extrage doar valoarea numerică
  let puterePftvOut: number | null = null;
  if (puterePftvRaw) {
    const pm = String(puterePftvRaw).match(/(\d+(?:[.,]\d+)?)\s*kw/i);
    puterePftvOut = pm ? parseFloat(pm[1].replace(',', '.')) : null;
  }

  // costLunar → sumă RO; bugetAchizitie → sumă RO sau text brut (ca în arhivaV2AutofillDinCrm_).
  const costLunar = extractSuma(costLunarRaw);
  const bugetSuma = extractSuma(bugetRaw);
  const bugetAchizitie: number | string | null =
    bugetSuma != null ? bugetSuma : (bugetRaw ? bugetRaw.toString().trim() : null);

  return {
    sistem_actual: mapSistemActualV2(tipIncalzire),
    sistem_actual_v1: mapSistemActualV1(tipIncalzire),
    costLunar,
    bugetAchizitie,
    alternativa: alternativa || null,
    bransament: bransamentOut,
    doresteOftv: doresteOut,
    puterePftv: puterePftvOut
  };
}
