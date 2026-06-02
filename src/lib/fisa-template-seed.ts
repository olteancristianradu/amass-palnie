import type { FisaTemplateData } from './fisa-template';

// ── SEED 1:1 cu fișa din spreadsheet (sursa de adevăr inițială) ──
// V1 = categoria 1 (casă în construcție) — FisaV1.js / FISA_V1_MAP
// V2 = categoria 2+ (casă locuită)       — FisaV2.js / FISA_V2_MAP
// `calc` = read-only, valoarea vine din strategie-calc.ts (prin calcKey). Adminul poate edita
// label/ordine/opțiuni/ce câmpuri apar, dar NU formulele calc. `key` e cheia de stocare (nu se schimbă).

export const SEED_V1: FisaTemplateData = {
  variant: 'V1',
  titlu: 'Strategie Client — (categoria 1, construcție)',
  zones: [
    {
      id: 'z01', titlu: '01 Situația actuală (construcție)',
      fields: [
        { key: 'suprafata', label: 'Suprafața (mp):', control: 'number', source: 'autofill', cell: 'C4' },
        { key: 'stadiu_constructie', label: 'Stadiu actual construcție:', control: 'dropdown', source: 'manual', cell: 'C5', options: ['La proiect', 'Fundatie', 'La rosu', 'La gri', 'Finisaje', 'Aproape gata', 'Locuit recent'] },
        { key: 'cand_electrician', label: 'Când intră electricianul (proiect):', control: 'dropdown', source: 'manual', cell: 'C6', options: ['Deja realizat', 'In lucru', 'Sub 1 luna', '1-3 luni', '3-6 luni', 'Peste 6 luni', 'Nedeterminat'] },
        { key: 'cand_sape', label: 'Când toarnă șapele:', control: 'dropdown', source: 'manual', cell: 'C7', options: ['Deja realizat', 'In lucru', 'Sub 1 luna', '1-3 luni', '3-6 luni', 'Peste 6 luni', 'Nedeterminat'] },
        { key: 'cand_mutare', label: 'Când estimează mutarea:', control: 'dropdown', source: 'manual', cell: 'C8', options: ['Deja realizat', 'In lucru', 'Sub 1 luna', '1-3 luni', '3-6 luni', 'Peste 6 luni', 'Nedeterminat'] },
        { key: 'bransament', label: 'Branșament:', control: 'dropdown', source: 'autofill', cell: 'C9', options: ['Monofazic', 'Trifazic', 'Nedecis'] },
        { key: 'constructie_izolatie', label: 'Construcție / izolație / etaje:', control: 'multiselect', source: 'manual', cell: 'C10', options: ['Caramida', 'BCA', 'Lemn', 'Panou sandwich', 'Beton', 'Structura metalica', 'Polistiren', 'Vata minerala', 'Vata bazaltica', 'PIR', 'Neizolat', 'Parter', '1 etaj', '2 etaje', 'Mansarda', '5 cm', '10 cm', '15 cm', '20 cm', '25 cm', '30 cm'] },
        { key: 'doreste_pftv', label: 'Dorește PFTV:', control: 'dropdown', source: 'autofill', cell: 'C11', options: ['Da', 'Nu', 'Nehotarat', 'De evaluat'] },
      ],
    },
    {
      id: 'zamass', titlu: '→ Cu sistemul AMASS (auto-calc)',
      fields: [
        { key: '_c_putere', label: 'Putere necesară (kW):', control: 'calc', calcKey: 'putere_necesara_kw' },
        { key: '_c_zilnic', label: 'Consum zilnic (kWh):', control: 'calc', calcKey: 'consum_zilnic_kwh' },
        { key: '_c_lunar', label: 'Consum lunar (kWh):', control: 'calc', calcKey: 'consum_lunar_kwh' },
        { key: '_c_anual', label: 'Consum ANUAL (kWh):', control: 'calc', calcKey: 'consum_anual_kwh' },
        { key: '_c_pftv', label: 'Necesar PFTV AMASS (kW):', control: 'calc', calcKey: 'necesar_pftv_amass_kw' },
        { key: '_c_invest', label: 'Cost investiție AMASS (F10):', control: 'calc', calcKey: 'cost_investitie_eur' },
        { key: '_c_esal', label: 'Cost eșalonare lunară (F11):', control: 'calc', calcKey: 'cost_esalonare_range' },
      ],
    },
    {
      id: 'z02', titlu: '02 Info casă actuală (obișnuința clientului)',
      fields: [
        { key: 'ca_suprafata', label: 'Ce suprafață (mp):', control: 'number', source: 'manual', cell: 'C13' },
        { key: 'ca_sistem', label: 'Ce sistem de încălzire:', control: 'dropdown', source: 'autofill', cell: 'C14', options: ['Centrala gaz', 'Centrala lemne', 'Centrala peleti', 'Centrala electrica', 'Pompa de caldura', 'Calorifere electrice', 'Aer conditionat', 'Soba', 'Nu are sistem'] },
        { key: 'ca_cost_lunar', label: 'Ce cost lunar actual (lei):', control: 'number', source: 'autofill', cell: 'C15' },
        { key: 'ca_cost_sezon', label: 'Cost sezon actual (lei, ≈ lunar×6):', control: 'number', source: 'manual', cell: 'C16' },
        { key: 'obs_situatie', label: 'Observații situație actuală:', control: 'textarea', source: 'manual', cell: 'D13', full: true },
      ],
    },
    {
      id: 'z03', titlu: '03 Reacții financiare (auto)',
      fields: [
        { key: '_c_buget', label: 'Reacție la limita de buget (C18):', control: 'calc', calcKey: 'cost_investitie_economic_eur' },
        { key: '_c_promo', label: 'Plată integrală + Promo (C19):', control: 'calc', calcKey: 'cost_promo_eur' },
        { key: '_c_reac_esal', label: 'Reacție eșalonare (C20):', control: 'calc', calcKey: 'reactie_esalonare_range' },
        { key: 'tip_plata', label: 'Tip plată preferat:', control: 'dropdown', source: 'manual', cell: 'C21', options: ['Integral', 'Esalonat', 'Mixt', 'Credit bancar', 'Nehotarat'] },
        { key: 'interval_buget', label: 'Interval buget / eșalonare acceptabil:', control: 'text', source: 'manual', cell: 'C22' },
        { key: 'obs_r18', label: 'Obs. cuvânt-cu-cuvânt (limită buget):', control: 'textarea', source: 'manual', cell: 'D18', full: true },
        { key: 'obs_r19', label: 'Obs. cuvânt-cu-cuvânt (plată integrală + promo):', control: 'textarea', source: 'manual', cell: 'D19', full: true },
        { key: 'obs_r20', label: 'Obs. cuvânt-cu-cuvânt (eșalonare):', control: 'textarea', source: 'manual', cell: 'D20', full: true },
      ],
    },
    {
      id: 'z04', titlu: '04 Cum gândește clientul',
      fields: [
        { key: 'motiv_principal', label: 'Motivul principal ("Doriți să...?"):', control: 'dropdown', source: 'manual', cell: 'C24', options: ['Efort scazut', 'Confort termic', 'Economie financiara', 'Independenta energetica', 'Sanatate', 'Valoare imobil', 'Eco / mediu', 'Siguranta'] },
        { key: 'plata_esalonata', label: 'Plată eșalonată (din formular):', control: 'text', source: 'autofill', cell: 'C25' },
        { key: 'alternativa', label: 'Alternative de care este interesat:', control: 'text', source: 'autofill', cell: 'C26' },
        { key: 'preventie', label: 'Preventie (sistem / brand):', control: 'dropdown', source: 'manual', cell: 'C27', options: ['Sistem', 'Brand'] },
        { key: 'obs_preventie', label: 'Detalii preventie (ce sistem / brand):', control: 'text', source: 'manual', cell: 'D27' },
        { key: 'nivel_bani', label: 'Nivel bani:', control: 'dropdown', source: 'manual', cell: 'C28', options: ['Necumpatat', 'Cumpatat', 'Smart', 'Lux'] },
        { key: 'tipologie', label: 'Tipologie emoțională:', control: 'dropdown', source: 'manual', cell: 'C29', options: ['Logic', 'Emotional', 'Vanator de pret', 'Nehotarat', 'Grabit', 'Increzator', 'Sceptic'] },
        { key: 'obs_g24', label: 'Obs. cum gândește (motiv principal):', control: 'textarea', source: 'manual', cell: 'D24', full: true },
        { key: 'obs_g26', label: 'Obs. cum gândește (alternative):', control: 'textarea', source: 'manual', cell: 'D26', full: true },
      ],
    },
    {
      id: 'z05', titlu: '05 Diferențe & concluzii (auto)',
      fields: [
        { key: '_c_dif_consum', label: 'Diferență consum (C29):', control: 'calc', calcKey: 'diferenta_consum_lei' },
        { key: '_c_dif_pftv', label: 'Diferență PFTV (C30):', control: 'calc', calcKey: 'diferenta_pftv_kw' },
      ],
    },
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
        { key: 'suprafata', label: 'Suprafața (mp):', control: 'number', source: 'autofill', cell: 'C4' },
        { key: 'bransament', label: 'Branșament:', control: 'dropdown', source: 'autofill', cell: 'C5', options: ['Monofazic', 'Trifazic', 'Nedecis'] },
        { key: 'putere_pftv', label: 'Putere PFTV existentă (kW):', control: 'number', source: 'autofill', cell: 'C6' },
        { key: 'prod_aplicatie', label: 'Producție anuală PFTV (Aplicație) — dacă o știe:', control: 'number', source: 'manual', cell: 'C7' },
        { key: 'consum_pftv_aplicatie', label: 'Consum anual PFTV (Aplicație) — dacă îl știe:', control: 'number', source: 'manual', cell: 'C8' },
        { key: 'constructie', label: 'Construcție / izolație / etaje:', control: 'multiselect', source: 'manual', cell: 'C10', options: ['Caramida', 'BCA', 'Lemn', 'Panou sandwich', 'Beton', 'Structura metalica', 'Polistiren', 'Vata minerala', 'Vata bazaltica', 'PIR', 'Neizolat', 'Parter', '1 etaj', '2 etaje', 'Mansarda', '5 cm', '10 cm', '15 cm', '20 cm', '25 cm', '30 cm'] },
      ],
    },
    {
      id: 'zamass', titlu: '→ Cu sistemul AMASS (auto-calc)',
      fields: [
        { key: '_c_putere', label: 'Putere necesară (kW):', control: 'calc', calcKey: 'putere_necesara_kw' },
        { key: '_c_zilnic', label: 'Consum zilnic (kWh):', control: 'calc', calcKey: 'consum_zilnic_kwh' },
        { key: '_c_lunar', label: 'Consum lunar (kWh):', control: 'calc', calcKey: 'consum_lunar_kwh' },
        { key: '_c_anual', label: 'Consum ANUAL (kWh):', control: 'calc', calcKey: 'consum_anual_kwh' },
        { key: '_c_pftv', label: 'Necesar PFTV AMASS (kW):', control: 'calc', calcKey: 'necesar_pftv_amass_kw' },
        { key: '_c_invest', label: 'Cost investiție AMASS (F10):', control: 'calc', calcKey: 'cost_investitie_eur' },
        { key: '_c_esal', label: 'Cost eșalonare lunară (F11):', control: 'calc', calcKey: 'cost_esalonare_range' },
      ],
    },
    {
      id: 'z02', titlu: '02 Sistemul actual & observații',
      fields: [
        { key: 'sistem_actual', label: 'Sistemul actual:', control: 'dropdown', source: 'autofill', cell: 'C12', options: ['CT gaz', 'CT lemne', 'CT peleti', 'CT electrica', 'Pompa caldura', 'Calorifere electrice', 'Aer conditionat', 'Soba', 'Nu are sistem'] },
        { key: 'consum_unitate', label: 'Consumul actual (unitate):', control: 'dropdown', source: 'autofill', cell: 'C13', options: ['lei/luna', 'lei/sezon', 'kWh/luna', 'litri/luna', 'mc/luna'] },
        { key: 'suma', label: 'Suma:', control: 'number', source: 'autofill', cell: 'C14' },
        { key: 'obs_situatie', label: 'Observații situație actuală:', control: 'textarea', source: 'manual', cell: 'C15', full: true },
      ],
    },
    {
      id: 'z03', titlu: '03 Reacții financiare (auto)',
      fields: [
        { key: '_c_buget', label: 'Reacție la limita de buget (C18):', control: 'calc', calcKey: 'cost_investitie_economic_eur' },
        { key: '_c_promo', label: 'Plată integrală + Promo (C19):', control: 'calc', calcKey: 'cost_promo_eur' },
        { key: '_c_reac_esal', label: 'Reacție eșalonare (C20):', control: 'calc', calcKey: 'reactie_esalonare_range' },
        { key: 'tip_plata', label: 'Tip plată preferat:', control: 'dropdown', source: 'manual', cell: 'C21', options: ['Integral', 'Esalonat', 'Mixt', 'Credit bancar', 'Nehotarat'] },
        { key: 'interval_buget', label: 'Interval buget / eșalonare acceptabil:', control: 'text', source: 'manual', cell: 'C22' },
        { key: 'obs_r17', label: 'Obs. cuvânt-cu-cuvânt (limită buget):', control: 'textarea', source: 'manual', cell: 'D18', full: true },
        { key: 'obs_r18', label: 'Obs. cuvânt-cu-cuvânt (plată integrală + promo):', control: 'textarea', source: 'manual', cell: 'D19', full: true },
        { key: 'obs_r19', label: 'Obs. cuvânt-cu-cuvânt (eșalonare):', control: 'textarea', source: 'manual', cell: 'D20', full: true },
      ],
    },
    {
      id: 'z04', titlu: '04 Cum gândește clientul',
      fields: [
        { key: 'motiv_principal', label: 'Motivul principal ("Doriți să...?"):', control: 'dropdown', source: 'manual', cell: 'C24', options: ['Efort scazut', 'Confort termic', 'Economie financiara', 'Independenta energetica', 'Sanatate', 'Valoare imobil', 'Eco / mediu', 'Siguranta'] },
        { key: 'plata_esalonata', label: 'Plată eșalonată (din formular):', control: 'text', source: 'autofill', cell: 'C25' },
        { key: 'alternativa', label: 'Alternative de care este interesat:', control: 'multiselect', source: 'autofill', cell: 'C26', options: ['Pompa de caldura (medie 2 ore/zi consum)', 'Incalzire cu radiatoare cu roca vulcanica (medie 2 ore/zi consum)', 'Incalzire electrica in pardoseala (medie 2 ore/zi consum)', 'Plasme infrarosu (medie 6 ore/zi consum)', 'Centrala electrica (medie 8 ore/zi consum)'] },
        { key: 'preventie', label: 'Preventie (sistem / brand):', control: 'dropdown', source: 'manual', cell: 'C27', options: ['Sistem', 'Brand'] },
        { key: 'obs_preventie', label: 'Detalii preventie (ce sistem / brand):', control: 'text', source: 'manual', cell: 'D27' },
        { key: 'nivel_bani', label: 'Nivel bani:', control: 'dropdown', source: 'manual', cell: 'C28', options: ['Necumpatat', 'Cumpatat', 'Smart', 'Lux'] },
        { key: 'tipologie', label: 'Tipologie emoțională:', control: 'dropdown', source: 'manual', cell: 'C29', options: ['Logic', 'Emotional', 'Vanator de pret', 'Nehotarat', 'Grabit', 'Increzator', 'Sceptic'] },
        { key: 'obs_g23', label: 'Obs. cum gândește (motiv principal):', control: 'textarea', source: 'manual', cell: 'D24', full: true },
        { key: 'obs_g25', label: 'Obs. cum gândește (alternative):', control: 'textarea', source: 'manual', cell: 'D26', full: true },
      ],
    },
    {
      id: 'z05', titlu: '05 Diferențe & concluzii (auto)',
      fields: [
        { key: '_c_dif_consum', label: 'Diferență consum (C29):', control: 'calc', calcKey: 'diferenta_consum_lei' },
        { key: '_c_dif_pftv', label: 'Diferență PFTV (C30):', control: 'calc', calcKey: 'diferenta_pftv_kw' },
        { key: '_c_profit', label: 'Profit anual estimat (F29):', control: 'calc', calcKey: 'profit_anual_lei' },
        { key: '_c_amortizare', label: 'Amortizare investiție (F30):', control: 'calc', calcKey: 'amortizare_ani' },
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
