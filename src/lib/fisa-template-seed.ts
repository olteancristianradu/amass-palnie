import type { FisaTemplateData } from './fisa-template';

// ── SEED redesign (template-driven, opțiunea B) — sursa de adevăr inițială a fișei de strategie ──
// V1 = categoria 1 (casă în construcție) — FisaV1.js / FISA_V1_MAP
// V2 = categoria 2+ (casă locuită)       — FisaV2.js / FISA_V2_MAP
//
// Structurat după FISA_REDESIGN_BRIEF.md (§2 field-by-field, §3 culori) + referința pa-fisa.jsx.
// `calc` = read-only, valoarea vine din strategie-calc.ts (prin calcKey — NESCHIMBAT). Adminul poate edita
// label/ordine/opțiuni/ce câmpuri apar, dar NU formulele calc. `key` e cheia de stocare (nu se schimbă).
//
// REGULI respectate (anti-pierdere):
//  - Formulele AMASS rămân IDENTICE → calcKey-urile sunt EXACT cele din StrategieCalc.
//  - Câmpurile vechi cu date reale (suprafata, bransament, putere_pftv, prod_aplicatie,
//    consum_pftv_aplicatie, consum_unitate, suma, obs_situatie, tip_plata, interval_buget,
//    motiv_principal, plata_esalonata, alternativa, preventie, obs_preventie, nivel_bani, tipologie,
//    strategie_nevoi, stadiu_constructie, doreste_pftv, obs_r*/obs_g*) își PĂSTREAZĂ cheia.
//  - Câmpurile NOI (sursa_caldura, distributie, material, izolatie_*, tip_locuinta, niveluri[],
//    apartament_*, *_altele, ca_sursa_caldura, ca_distributie) au chei noi — adăugare, nu redenumire.
//  - Cascade prin `cond` (progressive disclosure); culori prin `fam`; tooltip formulă prin `formula`/`note`.

// ── Liste partajate (din brief §2 + pa-fisa.jsx) ──
const BRANSAMENT = ['Monofazic', 'Trifazic', 'Nedecis'];
// 2.1 — sursă de căldură (split din „sistem actual"), + 'Nu știu' (brief)
const SURSA_CALDURA = [
  'CT gaz', 'CT lemne', 'CT peleți', 'CT electrică', 'CT combustibil solid (mixt)',
  'Pompă de căldură', 'Sobă', 'Semineu', 'Convectoare electrice',
  'Incalzire electrica in pardoseala', 'Nu are / construcție nouă', 'Nu știu',
];
const POMPA_TIP = ['aer-apă', 'aer-aer', 'sol-apă (geotermal)', 'apă-apă'];
const DISTRIBUTIE = ['Radiatoare (apă)', 'Încălzire în pardoseală (apă)', 'Mixt (radiatoare + pardoseală)', 'HVAC', 'Nu are'];
// 2.2 — construcție (4 câmpuri): material fără Porotherm + 'Altele'
const MATERIAL = ['Cărămidă', 'BCA', 'Beton', 'Lemn', 'Panou sandwich', 'Structură metalică', 'Chirpici / pământ', 'Piatră', 'Altele'];
// izolație fără EPS/XPS, Polistiren primul
const IZOLATIE = ['Polistiren', 'Vată', 'PIR', 'Lână de lemn', 'Spumă poliuretanică', 'Altele', 'Neizolat'];
// grosime cu 'Fără / 0' + 8 cm
const GROSIME = ['Fără / 0', '5 cm', '8 cm', '10 cm', '15 cm', '20 cm', '25 cm', '30 cm'];
const TIP_LOCUINTA = ['Casă', 'Apartament', 'Duplex', 'Altele'];
const NIVELURI = ['Subsol', 'Demisol', 'Parter', '+1 etaj', '+2 etaje', '3+ etaje', 'Mansardă', 'Pod'];
const APT_POZITIE = ['Parter', 'Intermediar', 'Ultimul etaj'];
// 2.3 — consum (unitate)
const CONSUM_UNIT = ['lei/lună', 'lei/sezon', 'kWh/lună'];
// 2.4 — tip plată: fără 'Credit bancar' (brief)
const TIP_PLATA = ['Integral', 'Eșalonat', 'Mixt', 'Nehotărât'];
const MOTIV = ['Efort scăzut', 'Confort termic', 'Economie financiară', 'Independență energetică', 'Sănătate', 'Valoare imobil', 'Eco / mediu', 'Siguranță'];
// 2.8 — Preventie: NU se schimbă opțiunile (Sistem / Brand)
const PREVENTIE = ['Sistem', 'Brand'];
// 2.6 — Nivel bani (neschimbat)
const NIVEL_BANI = ['Necumpătat', 'Cumpătat', 'Smart', 'Lux'];
// 2.7 — Tipologie: ordine FIXĂ, Sceptic ultimul
const TIPOLOGIE = ['Logic', 'Emoțional', 'Vânător de preț', 'Nehotărât', 'Grăbit', 'Sceptic'];
const ALTERNATIVE = ['Pompă de căldură', 'Radiatoare rocă vulcanică', 'Încălzire electrică pardoseală', 'Plasme infraroșu', 'Centrală electrică', 'Panouri fotovoltaice'];
const STADIU_CONSTR = ['La proiect', 'Fundație', 'La roșu', 'La gri', 'Finisaje', 'Aproape gata', 'Locuit recent'];
const DORESTE_PFTV = ['Da', 'Nu', 'Nehotărât', 'De evaluat'];

export const SEED_V1: FisaTemplateData = {
  variant: 'V1',
  titlu: 'Strategie Client — (categoria 1, construcție)',
  zones: [
    {
      id: 'z01', titlu: '01 Situația actuală',
      fields: [
        { key: 'suprafata', label: 'Suprafața:', control: 'number', source: 'autofill', cell: 'C4', unit: 'mp' },
        { key: 'stadiu_constructie', label: 'Stadiu actual construcție:', control: 'dropdown', source: 'manual', cell: 'C5', options: STADIU_CONSTR },
        { key: 'bransament', label: 'Branșament:', control: 'dropdown', source: 'autofill', cell: 'C9', options: BRANSAMENT },
        { key: 'putere_pftv', label: 'Putere PFTV existentă:', control: 'number', source: 'autofill', cell: 'C6', unit: 'kW' },
        { key: 'prod_aplicatie', label: 'Producție anuală PFTV declarată:', control: 'number', source: 'manual', cell: 'C7', unit: 'kWh' },
        { key: 'consum_pftv_aplicatie', label: 'Consum anual PFTV (aplicație):', control: 'number', source: 'manual', cell: 'C8', unit: 'kWh' },
        { key: 'doreste_pftv', label: 'Dorește PFTV:', control: 'dropdown', source: 'autofill', cell: 'C11', options: DORESTE_PFTV },
        // ── BLOC CONSTRUCȚIE (4 câmpuri tipizate + progressive disclosure) ──
        { key: 'material', label: 'Material pereți:', control: 'dropdown', source: 'manual', cell: 'C10', fam: 'coral', options: MATERIAL },
        { key: 'material_altele', label: 'Din ce e construită?', control: 'text', source: 'manual', cond: { key: 'material', in: ['Altele'] } },
        { key: 'izolatie_tip', label: 'Tip izolație:', control: 'dropdown', source: 'manual', fam: 'teal', options: IZOLATIE },
        { key: 'izolatie_tip_altele', label: 'Ce izolație?', control: 'text', source: 'manual', cond: { key: 'izolatie_tip', in: ['Altele'] } },
        { key: 'izolatie_cm', label: 'Grosime izolație:', control: 'pills', source: 'manual', fam: 'gri', options: GROSIME },
        { key: 'tip_locuinta', label: 'Tip locuință:', control: 'pills', source: 'manual', fam: 'roz', options: TIP_LOCUINTA },
        { key: 'niveluri', label: 'Niveluri:', control: 'chips', source: 'manual', fam: 'roz', options: NIVELURI, cond: { key: 'tip_locuinta', in: ['Casă'] } },
        { key: 'apartament_etaj', label: 'Etaj:', control: 'number', source: 'manual', cond: { key: 'tip_locuinta', in: ['Apartament'] } },
        { key: 'apartament_din', label: 'din (câte etaje):', control: 'number', source: 'manual', cond: { key: 'tip_locuinta', in: ['Apartament'] } },
        { key: 'apartament_pozitie', label: 'Poziție:', control: 'dropdown', source: 'manual', options: APT_POZITIE, cond: { key: 'tip_locuinta', in: ['Apartament'] } },
        { key: 'tip_locuinta_altele', label: 'Ce tip de locuință?', control: 'text', source: 'manual', cond: { key: 'tip_locuinta', in: ['Altele'] } },
      ],
    },
    {
      // V1: zona 02 = „Info casă actuală (obișnuința clientului)".
      id: 'z02', titlu: '02 Info casă actuală',
      fields: [
        // REINTRODUS 2026-06-05: „Ce suprafață" (suprafața casei actuale) — scos accidental la un redesign
        // (3a5517e) fără migrare. Cheia `ca_suprafata` readuce datele orfanizate ale clienților V1.
        { key: 'ca_suprafata', label: 'Ce suprafață (mp):', control: 'number', source: 'manual', cell: 'C13', unit: 'mp' },
        { key: 'ca_sursa_caldura', label: 'Ce sursă de căldură:', control: 'dropdown', source: 'autofill', cell: 'C14', fam: 'ambra', options: SURSA_CALDURA },
        { key: 'ca_sursa_caldura_pompa_tip', label: 'Tip pompă:', control: 'pills', source: 'manual', fam: 'ambra', options: POMPA_TIP, cond: { key: 'ca_sursa_caldura', in: ['Pompă de căldură'] } },
        { key: 'ca_distributie', label: 'Distribuție / emisie:', control: 'pills', source: 'manual', fam: 'albastru', options: DISTRIBUTIE },
        { key: 'ca_cost_lunar', label: 'Cost lunar actual:', control: 'number', source: 'autofill', cell: 'C15', unit: 'lei' },
        { key: 'ca_cost_sezon', label: 'Cost sezon actual (≈ lunar × 6):', control: 'number', source: 'manual', cell: 'C16', unit: 'lei' },
        { key: 'obs_situatie', label: 'Observații situație actuală:', control: 'textarea', source: 'manual', cell: 'D13', full: true },
      ],
    },
    {
      id: 'zamass', titlu: '→ Cu sistemul AMASS (auto-calc)',
      fields: [
        { key: '_c_putere', label: 'Putere necesară:', control: 'calc', calcKey: 'putere_necesara_kw', fam: 'verde', formula: '= Suprafață × 0.1 kW/m²', note: 'Puterea termică instalată necesară, raportată la suprafață.' },
        { key: '_c_zilnic', label: 'Consum zilnic:', control: 'calc', calcKey: 'consum_zilnic_kwh', fam: 'verde', formula: '= Putere necesară × 2 ore/zi', note: 'Consum mediu zilnic estimat (2 ore funcționare echivalentă/zi).' },
        { key: '_c_lunar', label: 'Consum lunar:', control: 'calc', calcKey: 'consum_lunar_kwh', fam: 'verde', formula: '= Consum zilnic × 30 zile', note: 'Consum lunar estimat în sezonul de încălzire.' },
        { key: '_c_anual', label: 'Consum ANUAL:', control: 'calc', calcKey: 'consum_anual_kwh', fam: 'verde', formula: '= Consum zilnic × 30 × 6 luni sezon', note: 'Consum pe întreg sezonul rece (6 luni).' },
        { key: '_c_pftv', label: 'Necesar PFTV AMASS:', control: 'calc', calcKey: 'necesar_pftv_amass_kw', fam: 'verde', formula: '= Putere necesară × 0.25 (25%)', note: 'Putere fotovoltaică recomandată pentru acoperirea necesarului.' },
        { key: '_c_prod', label: 'Producție estimată PFTV:', control: 'calc', calcKey: 'productie_estimata', fam: 'verde', formula: '= Putere PFTV existentă × 4 ore/zi × 365', note: 'Producția anuală estimată din panourile existente.' },
        { key: '_c_invest', label: 'Cost investiție AMASS:', control: 'calc', calcKey: 'cost_investitie_eur', fam: 'verde', formula: '= Suprafață × 50 €/m²', note: 'Valoarea de referință a investiției AMASS.' },
        { key: '_c_esal', label: 'Cost eșalonare lunară:', control: 'calc', calcKey: 'cost_esalonare_range', fam: 'verde', formula: '= MROUND(investiție × 1.5 / 60, 5) − 20 … + 20', note: 'Rata lunară estimată la eșalonare (interval €/lună).' },
      ],
    },
    {
      id: 'z03', titlu: '03 Reacții financiare',
      fields: [
        { key: '_c_buget', label: 'Reacție la limita de buget:', control: 'calc', calcKey: 'cost_investitie_economic_eur', formula: '= Suprafață × 55 €/m²', note: 'Pragul de buget estimat (variantă economică).' },
        { key: '_c_promo', label: 'Plată integrală + Promo:', control: 'calc', calcKey: 'cost_promo_eur', formula: '= Suprafață × 40 €/m²', note: 'Preț la plată integrală cu promoția.' },
        { key: '_c_reac_esal', label: 'Reacție eșalonare:', control: 'calc', calcKey: 'reactie_esalonare_range', formula: '= eșalonare +10%, CEILING(…, 5)', note: 'Rata lunară de prezentat la eșalonare (interval €/lună).' },
        { key: 'tip_plata', label: 'Tip plată preferat:', control: 'pills', source: 'manual', cell: 'C21', fam: 'violet', options: TIP_PLATA },
        { key: 'interval_buget', label: 'Interval buget / eșalonare acceptabil:', control: 'text', source: 'manual', cell: 'C22' },
        { key: 'obs_r18', label: 'Obs. cuvânt-cu-cuvânt (limită buget):', control: 'textarea', source: 'manual', cell: 'D18', full: true },
        { key: 'obs_r19', label: 'Obs. cuvânt-cu-cuvânt (plată integrală + promo):', control: 'textarea', source: 'manual', cell: 'D19', full: true },
        { key: 'obs_r20', label: 'Obs. cuvânt-cu-cuvânt (eșalonare):', control: 'textarea', source: 'manual', cell: 'D20', full: true },
      ],
    },
    {
      id: 'z04', titlu: '04 Cum gândește clientul',
      fields: [
        { key: 'motiv_principal', label: 'Motivul principal ("Doriți să...?"):', control: 'pills', source: 'manual', cell: 'C24', fam: 'violet', options: MOTIV },
        { key: 'plata_esalonata', label: 'Plată eșalonată (din formular):', control: 'text', source: 'autofill', cell: 'C25' },
        { key: 'alternativa', label: 'Alternative de care este interesat:', control: 'chips', source: 'autofill', cell: 'C26', options: ALTERNATIVE },
        { key: 'preventie', label: 'Preventie (sistem / brand):', control: 'chips', source: 'autofill', cell: 'C27', options: PREVENTIE },
        { key: 'obs_preventie', label: 'Detalii preventie (ce sistem / brand):', control: 'text', source: 'manual', cell: 'D27' },
        { key: 'nivel_bani', label: 'Nivel bani:', control: 'pills', source: 'manual', cell: 'C28', fam: 'violet', options: NIVEL_BANI },
        { key: 'tipologie', label: 'Tipologie emoțională:', control: 'pills', source: 'manual', cell: 'C29', fam: 'violet', options: TIPOLOGIE },
        { key: 'obs_g24', label: 'Obs. cum gândește (motiv principal):', control: 'textarea', source: 'manual', cell: 'D24', full: true },
        { key: 'obs_g26', label: 'Obs. cum gândește (alternative):', control: 'textarea', source: 'manual', cell: 'D26', full: true },
      ],
    },
    // (V1 NU are zona 05 „Diferențe & concluzii" — exact ca în spreadsheet.)
    {
      id: 'z06', titlu: 'Strategie & nevoi identificate / note diverse',
      fields: [
        { key: 'strategie_nevoi', label: 'Strategie & rezistențe & nevoi identificate:', control: 'textarea', source: 'manual', cell: 'A31', full: true },
      ],
    },
  ],
};

export const SEED_V2: FisaTemplateData = {
  variant: 'V2',
  titlu: 'Strategie Client — (categoria 2, casă locuită)',
  zones: [
    {
      id: 'z01', titlu: '01 Situația actuală',
      fields: [
        { key: 'suprafata', label: 'Suprafața:', control: 'number', source: 'autofill', cell: 'C4', unit: 'mp' },
        { key: 'bransament', label: 'Branșament:', control: 'dropdown', source: 'autofill', cell: 'C5', options: BRANSAMENT },
        { key: 'putere_pftv', label: 'Putere PFTV existentă:', control: 'number', source: 'autofill', cell: 'C6', unit: 'kW' },
        { key: 'prod_aplicatie', label: 'Producție anuală PFTV (aplicație):', control: 'number', source: 'manual', cell: 'C7', unit: 'kWh' },
        { key: 'consum_pftv_aplicatie', label: 'Consum anual PFTV (aplicație):', control: 'number', source: 'manual', cell: 'C8', unit: 'kWh' },
        // ── BLOC CONSTRUCȚIE (4 câmpuri tipizate + progressive disclosure) ──
        { key: 'material', label: 'Material pereți:', control: 'dropdown', source: 'manual', cell: 'C10', fam: 'coral', options: MATERIAL },
        { key: 'material_altele', label: 'Din ce e construită?', control: 'text', source: 'manual', cond: { key: 'material', in: ['Altele'] } },
        { key: 'izolatie_tip', label: 'Tip izolație:', control: 'dropdown', source: 'manual', fam: 'teal', options: IZOLATIE },
        { key: 'izolatie_tip_altele', label: 'Ce izolație?', control: 'text', source: 'manual', cond: { key: 'izolatie_tip', in: ['Altele'] } },
        { key: 'izolatie_cm', label: 'Grosime izolație:', control: 'pills', source: 'manual', fam: 'gri', options: GROSIME },
        { key: 'tip_locuinta', label: 'Tip locuință:', control: 'pills', source: 'manual', fam: 'roz', options: TIP_LOCUINTA },
        { key: 'niveluri', label: 'Niveluri:', control: 'chips', source: 'manual', fam: 'roz', options: NIVELURI, cond: { key: 'tip_locuinta', in: ['Casă'] } },
        { key: 'apartament_etaj', label: 'Etaj:', control: 'number', source: 'manual', cond: { key: 'tip_locuinta', in: ['Apartament'] } },
        { key: 'apartament_din', label: 'din (câte etaje):', control: 'number', source: 'manual', cond: { key: 'tip_locuinta', in: ['Apartament'] } },
        { key: 'apartament_pozitie', label: 'Poziție:', control: 'dropdown', source: 'manual', options: APT_POZITIE, cond: { key: 'tip_locuinta', in: ['Apartament'] } },
        { key: 'tip_locuinta_altele', label: 'Ce tip de locuință?', control: 'text', source: 'manual', cond: { key: 'tip_locuinta', in: ['Altele'] } },
      ],
    },
    {
      // V2: zona 02 = „Sistemul actual & observații".
      id: 'z02', titlu: '02 Sistemul actual & observații',
      fields: [
        { key: 'sursa_caldura', label: 'Sursă de căldură:', control: 'dropdown', source: 'autofill', cell: 'C12', fam: 'ambra', options: SURSA_CALDURA },
        { key: 'sursa_caldura_pompa_tip', label: 'Tip pompă:', control: 'pills', source: 'manual', fam: 'ambra', options: POMPA_TIP, cond: { key: 'sursa_caldura', in: ['Pompă de căldură'] } },
        { key: 'distributie', label: 'Distribuție / emisie:', control: 'pills', source: 'manual', fam: 'albastru', options: DISTRIBUTIE },
        { key: 'consum_unitate', label: 'Consumul actual (unitate):', control: 'dropdown', source: 'autofill', cell: 'C13', options: CONSUM_UNIT },
        { key: 'suma', label: 'Suma (cost actual / lună):', control: 'number', source: 'autofill', cell: 'C14', unit: 'lei' },
        { key: 'obs_situatie', label: 'Observații situație actuală:', control: 'textarea', source: 'manual', cell: 'C15', full: true },
      ],
    },
    {
      id: 'zamass', titlu: '→ Cu sistemul AMASS (auto-calc)',
      fields: [
        { key: '_c_putere', label: 'Putere necesară:', control: 'calc', calcKey: 'putere_necesara_kw', fam: 'verde', formula: '= Suprafață × 0.1 kW/m²', note: 'Puterea termică instalată necesară, raportată la suprafață.' },
        { key: '_c_zilnic', label: 'Consum zilnic:', control: 'calc', calcKey: 'consum_zilnic_kwh', fam: 'verde', formula: '= Putere necesară × 2 ore/zi', note: 'Consum mediu zilnic estimat (2 ore funcționare echivalentă/zi).' },
        { key: '_c_lunar', label: 'Consum lunar:', control: 'calc', calcKey: 'consum_lunar_kwh', fam: 'verde', formula: '= Consum zilnic × 30 zile', note: 'Consum lunar estimat în sezonul de încălzire.' },
        { key: '_c_anual', label: 'Consum ANUAL:', control: 'calc', calcKey: 'consum_anual_kwh', fam: 'verde', formula: '= Consum zilnic × 30 × 6 luni sezon', note: 'Consum pe întreg sezonul rece (6 luni).' },
        { key: '_c_pftv', label: 'Necesar PFTV AMASS:', control: 'calc', calcKey: 'necesar_pftv_amass_kw', fam: 'verde', formula: '= Putere necesară × 0.25 (25%)', note: 'Putere fotovoltaică recomandată pentru acoperirea necesarului.' },
        { key: '_c_prod', label: 'Producție estimată PFTV:', control: 'calc', calcKey: 'productie_estimata', fam: 'verde', formula: '= Putere PFTV existentă × 4 ore/zi × 365', note: 'Producția anuală estimată din panourile existente.' },
        { key: '_c_invest', label: 'Cost investiție AMASS:', control: 'calc', calcKey: 'cost_investitie_eur', fam: 'verde', formula: '= Suprafață × 50 €/m²', note: 'Valoarea de referință a investiției AMASS.' },
        { key: '_c_esal', label: 'Cost eșalonare lunară:', control: 'calc', calcKey: 'cost_esalonare_range', fam: 'verde', formula: '= MROUND(investiție × 1.5 / 60, 5) − 20 … + 20', note: 'Rata lunară estimată la eșalonare (interval €/lună).' },
      ],
    },
    {
      id: 'z03', titlu: '03 Reacții financiare',
      fields: [
        { key: '_c_buget', label: 'Reacție la limita de buget:', control: 'calc', calcKey: 'cost_investitie_economic_eur', formula: '= Suprafață × 55 €/m²', note: 'Pragul de buget estimat (variantă economică).' },
        { key: '_c_promo', label: 'Plată integrală + Promo:', control: 'calc', calcKey: 'cost_promo_eur', formula: '= Suprafață × 40 €/m²', note: 'Preț la plată integrală cu promoția.' },
        { key: '_c_reac_esal', label: 'Reacție eșalonare:', control: 'calc', calcKey: 'reactie_esalonare_range', formula: '= eșalonare +10%, CEILING(…, 5)', note: 'Rata lunară de prezentat la eșalonare (interval €/lună).' },
        { key: 'tip_plata', label: 'Tip plată preferat:', control: 'pills', source: 'manual', cell: 'C21', fam: 'violet', options: TIP_PLATA },
        { key: 'interval_buget', label: 'Interval buget / eșalonare acceptabil:', control: 'text', source: 'manual', cell: 'C22' },
        { key: 'obs_r17', label: 'Obs. cuvânt-cu-cuvânt (limită buget):', control: 'textarea', source: 'manual', cell: 'D18', full: true },
        { key: 'obs_r18', label: 'Obs. cuvânt-cu-cuvânt (plată integrală + promo):', control: 'textarea', source: 'manual', cell: 'D19', full: true },
        { key: 'obs_r19', label: 'Obs. cuvânt-cu-cuvânt (eșalonare):', control: 'textarea', source: 'manual', cell: 'D20', full: true },
      ],
    },
    {
      id: 'z04', titlu: '04 Cum gândește clientul',
      fields: [
        { key: 'motiv_principal', label: 'Motivul principal ("Doriți să...?"):', control: 'pills', source: 'manual', cell: 'C24', fam: 'violet', options: MOTIV },
        { key: 'plata_esalonata', label: 'Plată eșalonată (din formular):', control: 'text', source: 'autofill', cell: 'C25' },
        { key: 'alternativa', label: 'Alternative de care este interesat:', control: 'chips', source: 'autofill', cell: 'C26', options: ALTERNATIVE },
        { key: 'preventie', label: 'Preventie (sistem / brand):', control: 'chips', source: 'autofill', cell: 'C27', options: PREVENTIE },
        { key: 'obs_preventie', label: 'Detalii preventie (ce sistem / brand):', control: 'text', source: 'manual', cell: 'D27' },
        { key: 'nivel_bani', label: 'Nivel bani:', control: 'pills', source: 'manual', cell: 'C28', fam: 'violet', options: NIVEL_BANI },
        { key: 'tipologie', label: 'Tipologie emoțională:', control: 'pills', source: 'manual', cell: 'C29', fam: 'violet', options: TIPOLOGIE },
        { key: 'obs_g23', label: 'Obs. cum gândește (motiv principal):', control: 'textarea', source: 'manual', cell: 'D24', full: true },
        { key: 'obs_g25', label: 'Obs. cum gândește (alternative):', control: 'textarea', source: 'manual', cell: 'D26', full: true },
      ],
    },
    {
      // V2 DOAR: „Diferențe & concluzii" (calc) — formule/note din pa-fisa.jsx.
      id: 'z05', titlu: '05 Diferențe & concluzii (auto)',
      fields: [
        { key: '_c_dif_consum', label: 'Diferență consum (cost/lună):', control: 'calc', calcKey: 'diferenta_consum_lei', fam: 'verde', formula: 'C31 = ROUND( Suma − Consum lunar × 1.1 )', note: 'Cât plătește acum (Suma) minus costul lunar cu AMASS (consum lunar × 1.1 lei/kWh). Pozitiv = economie.' },
        { key: '_c_profit', label: 'Profit anual estimat:', control: 'calc', calcKey: 'profit_anual_lei', fam: 'verde', formula: 'F31 = ROUND( (MAX(prod. declarată; prod. estimată) − Consum anual) × 0.6 )', note: 'Surplusul de producție PFTV față de consum, înmulțit cu 0.6 lei/kWh.' },
        { key: '_c_dif_pftv', label: 'Diferență PFTV:', control: 'calc', calcKey: 'diferenta_pftv_kw', fam: 'verde', formula: 'C32 = ROUND( Putere PFTV existentă − Necesar PFTV AMASS ; 2 )', note: 'Cât îi lipsește (sau prisosește) la panouri față de necesarul AMASS (25% din puterea necesară).' },
        { key: '_c_amortizare', label: 'Amortizare investiție:', control: 'calc', calcKey: 'amortizare_ani', fam: 'verde', formula: 'F32 = Investiție / ( (MAX(prod. declarată; estimată) − Consum anual) × 0.6 + Suma ) / 5', note: 'În câți ani se recuperează investiția din economia lunară + profitul din producție.' },
      ],
    },
    {
      id: 'z06', titlu: 'Strategie & nevoi identificate / note diverse',
      fields: [
        { key: 'strategie_nevoi', label: 'Strategie & rezistențe & nevoi identificate:', control: 'textarea', source: 'manual', cell: 'A34', full: true },
      ],
    },
  ],
};

export const SEED_TEMPLATES: FisaTemplateData[] = [SEED_V1, SEED_V2];

// Mapă zona → cheia câmpului de observații al ei (textarea „obs_*"), per variantă.
// Observațiile situației/sistemului actual stau în câmpul comun `obs_situatie`, acum în zona `z02`.
// Consumatorul poate folosi această mapă SAU poate căuta singur textarea-ul „obs" din câmpurile unei zone.
export const ZONE_OBS_KEY: Record<'V1' | 'V2', Record<string, string>> = {
  V1: { z02: 'obs_situatie' },
  V2: { z02: 'obs_situatie' },
};
