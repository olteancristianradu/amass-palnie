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

function esc(s: any): string {
  // fieldValueToText normalizează multiselect (array în blob) → text cu virgule; pe non-array e identitate
  return fieldValueToText(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function v_(x: any, suffix = ''): string {
  // pentru multiselect: array gol e truthy în JS → folosim textul normalizat ca test de "are valoare"
  const text = fieldValueToText(x);
  return text ? esc(x) + suffix : '<b>_____________</b>';
}
function m_(label: string): string { return '<b>' + esc(label) + '</b>'; }
function h_(text: string): string { return '<b style="text-transform:uppercase;letter-spacing:0.5px">' + esc(text) + '</b>'; }

export function buildEmail(input: EmailInput): { subject: string; to: string; cc: string; body: string } {
  const d = input;
  const v = d.v || {};
  const f = d.f || {};
  const agentName = d.agentName || 'Radu-Cristian Oltean';
  const catParen = '(' + d.categorie + ')';
  const titluLucrare = esc(d.nume) + ' - ' + esc(d.localitate) + ' ' + catParen;
  const subject = 'Redactare fisa ISO + DEVIZ - ' + d.nume + ' - ' + d.localitate + ' ' + catParen;
  const BR = '\n';

  const reminderSchite =
BR + BR + '<b>ATENTIE — DE ATASAT OBLIGATORIU:</b>' + BR +
'• <b>Schitele tehnice ale lucrarii</b>' + BR +
'• <b>Dovada de primire schite</b> (semnatura / email confirmare arhitect sau client)' + BR + BR;

  // V2 (categoria 2 / 3 DT) — replica codului Apps Script
  const body =
'<b>Nume lucrare CRM:</b> <b>' + titluLucrare + '</b>' + BR + BR +
'Buna ziua,' + BR + BR +
'Rog Redactare fisa ISO + DEVIZ pentru domnul/doamna ' + esc(d.nume) + ' - ' + esc(d.localitate) + ' ' + catParen + '.' + BR +
'Proiectarea este facuta de doamna Rulea si planurile ' + m_('[le aduc personal / trimise de arhitect / urmeaza]') + '.' + BR + BR +
'Deviz pe materiale: ' + m_('[Premium / Premium si Economic]') + BR + BR +
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
h_('Situatia actuala (casa locuita)') + BR +
'Constructie / izolatie / etaje: ' + v_(v.constructie) + BR +
'Sistem actual incalzire: ' + v_(v.sistem_actual) + BR +
'Consum actual: ' + v_(v.suma) + ' ' + v_(v.consum_unitate) + BR +
'Suprafata totala utila incalzita: ' + (v.suprafata ? esc(v.suprafata) + ' mp' : '<b>_____________</b>') + BR +
'Detalii dictate suprafete: ' + m_('[schita / pe plan]') + BR + BR +
'Observatii situatie actuala: ' + v_(v.obs_situatie) + BR + BR +
h_('Cu sistemul AMASS') + BR +
'Cost investitie AMASS: ' + v_(f.cost_investitie_eur ? f.cost_investitie_eur + ' EUR' : '') + BR +
'Cost esalonare lunara AMASS: ' + v_(f.cost_esalonare_range || '') + BR + BR +
h_('Reactii financiare') + BR +
'Reactie la limita de buget estimat: ' + v_(f.cost_investitie_economic_eur ? f.cost_investitie_economic_eur + ' EUR' : '') + BR +
'Reactie la plata integrala + Promo: ' + v_(f.cost_promo_eur ? f.cost_promo_eur + ' EUR' : '') + BR +
'Tip plata preferat: ' + v_(v.tip_plata) + BR +
'Interval buget / esalonare acceptabil: ' + v_(v.interval_buget) + BR + BR +
h_('Diferente & concluzii') + BR +
'Diferenta consum (cost/luna): ' + v_(f.diferenta_consum_lei ? f.diferenta_consum_lei + ' lei' : '') + BR +
'Profit anual estimat: ' + v_(f.profit_anual_lei ? f.profit_anual_lei + ' lei' : '') + BR +
'Diferenta PFTV: ' + v_(f.diferenta_pftv_kw ? f.diferenta_pftv_kw + ' kW' : '') + BR +
'Amortizare investitie: ' + v_(f.amortizare_ani ? f.amortizare_ani + ' ani' : '') + BR + BR +
h_('Strategie & nevoi identificate') + BR +
v_(v.strategie_nevoi) +
reminderSchite +
'Cu stima,' + BR +
esc(agentName);

  return { subject, to: TO_LIST, cc: CC_LIST, body };
}
