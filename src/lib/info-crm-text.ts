import type { FisaTemplateData, FisaField } from './fisa-template';
import { asMulti } from './fisa-template';
import type { StrategieCalc } from './strategie-calc';

// Elimină diacriticele — paritate cu textul din fișa-spreadsheet (headere + etichete fără diacritice)
// și ca să nu depindem de cum codează gestcom diacriticele în Observatii.
const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');
function deDia(s: string): string {
  return String(s || '').normalize('NFD').replace(COMBINING, '');
}

// Titlu secțiune: scoate prefixul numeric ("01 "), săgeata ("→ ") și sufixele "(auto)"/"(auto-calc)";
// UPPERCASE + fără diacritice — ca headerele din fișă (SITUATIA ACTUALA, CU SISTEMUL AMASS, REACTII FINANCIARE…).
function sectionTitle(titlu: string): string {
  return deDia(String(titlu || '')
    .replace(/^\s*\d+\s+/, '')
    .replace(/^\s*→\s*/, '')
    .replace(/\s*\((auto|auto-calc)\)\s*$/i, '')
    .trim()).toUpperCase();
}

function fmtNum(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('ro-RO') : '';
}

// Valoarea unui câmp ca text pentru CRM. '' = gol → câmpul se omite (nu poluăm Observatii cu rânduri goale).
function fieldValue(f: FisaField, form: Record<string, any>, calc: StrategieCalc): string {
  if (f.control === 'calc') {
    const v = f.calcKey ? (calc as any)[f.calcKey] : null;
    if (v === null || v === undefined || v === '') return '';
    return typeof v === 'number' ? fmtNum(v) : String(v);
  }
  if (f.control === 'multiselect') {
    const arr = asMulti(form[f.key]);
    return arr.length ? arr.join(', ') : '';
  }
  const raw = form[f.key];
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
}

/**
 * Construiește textul INFO CRM (corpul blocului „STRATEGIE FISA") DIN TEMPLATE.
 * → include TOATE câmpurile completate (nu o listă hardcodată) + valorile auto-calc,
 *   grupate pe secțiuni exact ca în fișa-spreadsheet.
 * Întoarce DOAR corpul; markerii ════ STRATEGIE FISA ════ îi adaugă pushObservatii/replaceObsBlock,
 * care păstrează intacte observațiile manuale ale agentului (din afara markerilor).
 */
export function buildInfoCrmText(
  template: FisaTemplateData,
  form: Record<string, any>,
  calc: StrategieCalc,
  meta: { userName?: string; now?: string } = {}
): string {
  const lines: string[] = [];
  lines.push('Generat: ' + (meta.now || '') + (meta.userName ? ' · ' + meta.userName : ''));

  // Header de secțiune lizibil: „── TITLU ─────────" (lățime fixă ~34) → ușor de scanat în Observatii CRM.
  const sectionHeader = (t: string) => '── ' + t + ' ' + '─'.repeat(Math.max(3, 30 - t.length));

  for (const zone of template.zones) {
    const body: string[] = [];
    for (const f of zone.fields) {
      const val = fieldValue(f, form, calc);
      if (!val) continue;
      const label = deDia(f.label.replace(/:\s*$/, ''));
      const isObs = /^obs/i.test(f.key) || f.control === 'textarea';
      if (isObs) {
        // Observații (text liber) — pe rând propriu, indentate, ca să nu se înghesuie.
        body.push('  • ' + label + ':');
        body.push(...String(val).split('\n').map(l => '      ' + l));
      } else {
        body.push('  ' + label + ': ' + val);   // câmp normal: „  Etichetă: valoare"
      }
    }
    if (body.length === 0) continue; // secțiune fără date completate → o sărim
    lines.push('');
    lines.push(sectionHeader(sectionTitle(zone.titlu)));
    lines.push(...body);
  }
  return lines.join('\n').trim();
}
