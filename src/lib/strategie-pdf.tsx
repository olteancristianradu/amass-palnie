/**
 * Generator PDF fișă strategie — partajat de /api/export/pdf ȘI atașamentul Outlook.
 */
import { calculate } from '@/lib/strategie-calc';
import { fieldValueToText } from '@/lib/fisa-template';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import React from 'react';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  h1: { fontSize: 14, fontWeight: 700, color: '#1E2A3A', marginBottom: 6 },
  sub: { fontSize: 9, color: '#666', marginBottom: 12 },
  zone: { marginTop: 10, borderBottomWidth: 0.5, borderBottomColor: '#1E2A3A', paddingBottom: 2, fontWeight: 700, color: '#1E2A3A', fontSize: 10, textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginTop: 2 },
  label: { width: 200, color: '#475569', fontSize: 9 },
  value: { color: '#0F172A', fontWeight: 700, fontSize: 9, flex: 1 },
  obs: { fontSize: 9, marginTop: 4 }
});

function row(label: string, value: any, unit = '') {
  // normalizează valorile multiselect (array în blob) → text cu virgule, nu '[object Object]'
  const norm = fieldValueToText(value);
  const text = norm !== '' ? norm + (unit ? ' ' + unit : '') : '—';
  return React.createElement(View, { style: styles.row, key: label },
    React.createElement(Text, { style: styles.label }, label + ':'),
    React.createElement(Text, { style: styles.value }, ' ' + text)
  );
}

/** Construiește buffer-ul PDF pentru un client (cu strategia stocată). */
export async function renderStrategiePdf(c: any): Promise<Buffer> {
  const stored = c.categorie === 1 ? c.strategieV1 : c.strategieV2;
  let v: any = {};
  try { v = stored ? JSON.parse(stored) : {}; } catch { v = {}; }
  v.suprafata = c.suprafata;
  const f = calculate(v);
  const docEl = React.createElement(Document, {},
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.h1 }, `Strategie Client — ${c.nume}${c.localitate ? ' - ' + c.localitate : ''} (${c.categorie}${c.isDT ? ' DT' : ''})`),
      React.createElement(Text, { style: styles.sub }, `id_lucrare = ${c.idLucrare} · ${c.judet || ''} · ${c.telefon || ''} · ${c.email || ''}`),
      React.createElement(Text, { style: styles.zone }, '01 Situația actuală'),
      row('Suprafață', v.suprafata, 'mp'),
      row('Branșament', v.bransament),
      row('Putere PFTV existentă', v.putere_pftv, 'kW'),
      row('Producție anuală PFTV', v.prod_aplicatie),
      row('Consum anual PFTV (Aplicație)', v.consum_pftv_aplicatie),
      row('Construcție / izolație / etaje', v.constructie),
      React.createElement(Text, { style: styles.zone }, '→ Cu sistemul AMASS (auto-calc)'),
      row('Putere necesară', f.putere_necesara_kw, 'kW'),
      row('Consum lunar', f.consum_lunar_kwh, 'kWh'),
      row('Consum anual', f.consum_anual_kwh, 'kWh'),
      row('Necesar PFTV AMASS', f.necesar_pftv_amass_kw, 'kW'),
      row('Cost investiție AMASS', f.cost_investitie_eur, 'EUR'),
      row('Cost eșalonare lunară', f.cost_esalonare_range, ''),
      // ── Zona 02: câmpuri diferite per variantă ──
      // V1 (categorie 1, construcție): câmpuri prefixate ca_ (info casă actuală)
      // V2 (categorie 2, casă locuită): sursa_caldura / distributie / consum_unitate / suma
      ...(c.categorie === 1
        ? [
            React.createElement(Text, { style: styles.zone, key: 'z02v1' }, '02 Info casă actuală'),
            row('Sursă de căldură (actuală)', v.ca_sursa_caldura),
            row('Distribuție / emisie', v.ca_distributie),
            row('Cost lunar actual', v.ca_cost_lunar, 'lei'),
            row('Cost sezon actual', v.ca_cost_sezon, 'lei'),
            row('Observații situație actuală', v.obs_situatie),
          ]
        : [
            React.createElement(Text, { style: styles.zone, key: 'z02v2' }, '02 Sistemul actual & observații'),
            row('Sursă de căldură', v.sursa_caldura),
            row('Distribuție / emisie', v.distributie),
            row('Unitate consum', v.consum_unitate),
            row('Suma (cost actual / lună)', v.suma, 'lei'),
            row('Observații situație actuală', v.obs_situatie),
          ]
      ),
      React.createElement(Text, { style: styles.zone }, '03 Reacții financiare'),
      row('Reacție limita buget', f.cost_investitie_economic_eur, 'EUR'),
      row('Reacție plată + Promo', f.cost_promo_eur, 'EUR'),
      row('Tip plată preferat', v.tip_plata),
      row('Interval buget', v.interval_buget),
      React.createElement(Text, { style: styles.zone }, '04 Cum gândește clientul'),
      row('Motivul principal', v.motiv_principal),
      row('Plată eșalonată', v.plata_esalonata),
      row('Alternative', v.alternativa),
      row('Preventie (sistem/brand)', v.preventie),
      row('Nivel bani', v.nivel_bani),
      row('Tipologie emoțională', v.tipologie),
      // V2 DOAR: zona 05 „Diferențe & concluzii" (V1 nu are această zonă, ca în spreadsheet)
      ...(c.categorie !== 1
        ? [
            React.createElement(Text, { style: styles.zone, key: 'z05v2' }, '05 Diferențe & concluzii'),
            row('Diferență consum', f.diferenta_consum_lei, 'lei/lună'),
            row('Profit anual', f.profit_anual_lei, 'lei'),
            row('Diferență PFTV', f.diferenta_pftv_kw, 'kW'),
            row('Amortizare', f.amortizare_ani, 'ani'),
          ]
        : []
      ),
      React.createElement(Text, { style: styles.zone }, 'Strategie & nevoi identificate'),
      React.createElement(Text, { style: styles.obs }, fieldValueToText(v.strategie_nevoi) || '—')
    )
  );
  return await renderToBuffer(docEl as any);
}
