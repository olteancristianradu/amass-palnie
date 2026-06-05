/**
 * Email Redactare — generator HTML business pentru cererea fișă ISO + DEVIZ.
 * Bold pe câmpuri manuale + headere; normal pe valori auto din strategie.
 * Plus reminder schițe + dovezi primire la final.
 */

import { fieldValueToText } from '@/lib/fisa-template';

export interface EmailInput {
  nume: string;
  localitate: string;
  categorie: string;       // "1", "2", "3 DT"
  isDT?: boolean;
  judet?: string;
  telefon?: string;
  email?: string;
  sursa?: string;
  agentName?: string;
  v: Record<string, any>;  // valori strategie
  f: Record<string, any>;  // formule calculate
}

const TO_LIST = 'backoffice@amass.ro; Tehnic Amass <tehnic@amass.ro>; AMASS <administrativ@amass.ro>';
const CC_LIST = 'Dana Rulea <danarulea@amass.ro>';

/** FIX #1: elimină CR/LF din valori folosite în subiect/headere — previne email header injection */
function stripHeaders(s: unknown): string {
  return String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
}
/** FIX #2: escape entități HTML pentru câmpuri interpolate în corpul HTML al emailului */
function esc(s: unknown): string {
  // fieldValueToText normalizează multiselect (array în blob) → text cu virgule; pe non-array e identitate
  return fieldValueToText(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function v_(x: unknown, suffix = ''): string {
  // pentru multiselect: array gol e truthy în JS → folosim textul normalizat ca test de "are valoare"
  const text = fieldValueToText(x);
  return text ? esc(x) + suffix : '<b>_____________</b>';
}
function m_(label: string): string { return '<b>' + esc(label) + '</b>'; }
/** FIX #3: test explicit null/undefined/'' — valoarea 0 (numeric) e validă și trebuie afișată ca "0" */
function numStr(x: unknown, suffix: string): string {
  return (x !== null && x !== undefined && x !== '') ? String(x) + suffix : '';
}
function h_(text: string): string { return '<b style="text-transform:uppercase;letter-spacing:0.5px">' + esc(text) + '</b>'; }

export function buildEmail(input: EmailInput): { subject: string; to: string; cc: string; body: string } {
  const d = input;
  const v = d.v || {};
  const f = d.f || {};
  const agentName = d.agentName || 'Radu-Cristian Oltean';
  const catParen = '(' + d.categorie + ')';
  const titluLucrare = esc(d.nume) + ' - ' + esc(d.localitate) + ' ' + catParen;
  // FIX #1: stripHeaders pe valorile derivate din client — previne header injection prin CR/LF
  const subject = 'Redactare fisa ISO + DEVIZ - ' + stripHeaders(d.nume) + ' - ' + stripHeaders(d.localitate) + ' ' + catParen;
  const BR = '\n';

  const reminderSchite =
BR + BR + '<b>ATENTIE — DE ATASAT OBLIGATORIU:</b>' + BR +
'• <b>Schitele tehnice ale lucrarii</b>' + BR +
'• <b>Dovada de primire schite</b> (semnatura / email confirmare arhitect sau client)' + BR + BR;

  // DIFERENTIERE V1 vs V2 — categoria 1 = CONSTRUCTIE noua, restul (2 / 3 DT) = CASA LOCUITA.
  // Folosim primul caracter al categoriei deja primite (ex. "1", "2", "3 DT").
  const isV1 = String(d.categorie).trim().charAt(0) === '1';
  // FIX 2026-06-03 (#10 email V1): valori VARIANT-AWARE. V1 (construcție) ține sistemul/costul actual pe
  // cheile CASEI ACTUALE (ca_sursa_caldura / ca_distributie / ca_cost_lunar); V2 pe cheile curente
  // (sursa_caldura / distributie / suma). Înainte emailul citea doar cheile V2 → câmpuri GOALE la V1.
  const sursaCaldura = isV1 ? (v.ca_sursa_caldura ?? v.ca_sistem) : (v.sursa_caldura ?? v.sistem_actual);
  const distributie = isV1 ? v.ca_distributie : v.distributie;
  const pompaTip = isV1 ? v.ca_sursa_caldura_pompa_tip : v.sursa_caldura_pompa_tip;
  const costActual = isV1 ? (v.ca_cost_lunar ?? v.suma) : v.suma;
  const unitateConsum = isV1 ? 'lei/luna' : (v.consum_unitate || 'lei/luna');
  // Construcție din câmpurile structurate noi (material / izolație / grosime / niveluri), fallback la cheile vechi.
  const constructieParts = [v.material, v.izolatie_tip, v.izolatie_cm, fieldValueToText(v.niveluri)]
    .map(fieldValueToText).map(s => s.trim()).filter(Boolean);
  const constructieText = constructieParts.length
    ? constructieParts.join(', ')
    : fieldValueToText(v.constructie ?? v.constructie_izolatie ?? v.constructie_raw);
  // Paragraf de context specific, accentuat, relevant fiecarei categorii.
  const accentCategorie = isV1
    ? h_('Specific constructie (V1)') + BR +
      'Lucrarea este pe o <b>constructie noua / in santier</b>: dimensionarea se face dupa proiect, ' +
      'nu dupa consum istoric. Va rog corelati componentele cu <b>planurile / schitele de proiectare</b> ' +
      'si tineti cont de <b>etapizarea pe santier</b> (turnare sapa, finisaje) la stabilirea termenului de executie. ' +
      'Branșamentul si eventualul PFTV se prevad din faza de proiect.' + BR + BR
    : h_('Specific casa locuita (V2)') + BR +
      'Lucrarea este pe o <b>casa deja locuita</b>: este esential sa pornim de la <b>consumul actual real</b> ' +
      'si de la <b>sistemul de incalzire existent</b> pentru a calcula economia si amortizarea. ' +
      'Va rog tineti cont de <b>interventia in spatiu locuit</b> (acces, mobilier, durata fara caldura) ' +
      'si de comparatia clara intre costul actual si cel cu sistemul AMASS, pe care clientul o asteapta.' + BR + BR;

  // V2 (categoria 2 / 3 DT) — replica codului Apps Script
  const body =
'<b>Nume lucrare CRM:</b> <b>' + titluLucrare + '</b>' + BR + BR +
'Buna ziua,' + BR + BR +
'Rog Redactare fisa ISO + DEVIZ pentru domnul/doamna ' + esc(d.nume) + ' - ' + esc(d.localitate) + ' ' + catParen + '.' + BR +
'Proiectarea este facuta de doamna Rulea si planurile ' + m_('[le aduc personal / trimise de arhitect / urmeaza]') + '.' + BR + BR +
'Deviz pe materiale: ' + m_('[Premium / Premium si Economic]') + BR + BR +
accentCategorie +
h_('Proiectarea') + BR +
m_('[componente pe zone / nivele - se completeaza manual]') + BR + BR +
h_('Termen de executie') + '  ' + m_('[ora / finalul zilei]') + BR + BR +
h_('Date client') + BR +
'Nume lucrare CRM: <b>' + titluLucrare + '</b>' + BR +
'Zona / judet: ' + esc(d.localitate) + (d.judet ? ', ' + esc(d.judet) : '') + BR +
'Nume client: ' + esc(d.nume) + BR +
'Telefon: ' + (d.telefon ? esc(d.telefon) : m_('[telefon]')) + BR +
'Email: ' + (d.email ? esc(d.email) : m_('[email]')) + BR +
'Sursa: ' + (d.sursa ? esc(d.sursa) : m_('[site / recomandare]')) + BR +
'Bransament: ' + v_(v.bransament) + BR +
'PFTV: ' + (v.putere_pftv ? esc(v.putere_pftv) + ' kW' : m_('nu are / urmeaza')) + BR + BR +
h_(isV1 ? 'Situatia actuala (constructie noua)' : 'Situatia actuala (casa locuita)') + BR +
(isV1 ? 'Stadiu constructie: ' + v_(v.stadiu_constructie) + BR + 'Doreste PFTV: ' + v_(v.doreste_pftv) + BR : '') +
'Constructie / izolatie / etaje: ' + v_(constructieText) + BR +
(isV1 ? 'Sistem actual (casa actuala): ' : 'Sistem actual incalzire: ') + v_(sursaCaldura) + (fieldValueToText(pompaTip).trim() ? ' (' + esc(pompaTip) + ')' : '') + BR +
'Distributie / emisie: ' + v_(distributie) + BR +
'Consum actual: ' + v_(costActual) + (fieldValueToText(costActual).trim() ? ' ' + esc(unitateConsum) : '') + BR +
'Suprafata totala utila incalzita: ' + (v.suprafata ? esc(v.suprafata) + ' mp' : '<b>_____________</b>') + BR +
'Detalii dictate suprafete: ' + m_('[schita / pe plan]') + BR + BR +
'Observatii situatie actuala: ' + v_(v.obs_situatie) + BR + BR +
h_('Cu sistemul AMASS') + BR +
'Cost investitie AMASS: ' + v_(numStr(f.cost_investitie_eur, ' EUR')) + BR +
'Cost esalonare lunara AMASS: ' + v_(f.cost_esalonare_range ?? '') + BR + BR +
h_('Reactii financiare') + BR +
'Reactie la limita de buget estimat: ' + v_(numStr(f.cost_investitie_economic_eur, ' EUR')) + BR +
'Reactie la plata integrala + Promo: ' + v_(numStr(f.cost_promo_eur, ' EUR')) + BR +
'Tip plata preferat: ' + v_(v.tip_plata) + BR +
'Interval buget / esalonare acceptabil: ' + v_(v.interval_buget) + BR + BR +
h_('Diferente & concluzii') + BR +
'Diferenta consum (cost/luna): ' + v_(numStr(f.diferenta_consum_lei, ' lei')) + BR +
'Profit anual estimat: ' + v_(numStr(f.profit_anual_lei, ' lei')) + BR +
'Diferenta PFTV: ' + v_(numStr(f.diferenta_pftv_kw, ' kW')) + BR +
'Amortizare investitie: ' + v_(numStr(f.amortizare_ani, ' ani')) + BR + BR +
h_('Strategie & nevoi identificate') + BR +
v_(v.strategie_nevoi) +
reminderSchite +
'Cu stima,' + BR +
esc(agentName);

  return { subject, to: TO_LIST, cc: CC_LIST, body };
}
