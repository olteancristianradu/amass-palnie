import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { calculate } from '@/lib/strategie-calc';
import { fieldValueToText } from '@/lib/fisa-template';
import { getScope, canAccessClient } from '@/lib/scope';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 });
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || !(await canAccessClient(scope, c.ownerId))) return NextResponse.json({ ok: false }, { status: 404 });
  const stored = c.categorie === 1 ? c.strategieV1 : c.strategieV2;
  let v: any = {};
  try { v = stored ? JSON.parse(stored) : {}; } catch { v = {}; }
  v.suprafata = c.suprafata;
  const f = calculate(v);

  const par = (label: string, value: any, unit = '') => {
    // normalizează valorile multiselect (array în blob) → text cu virgule, nu '[object Object]'
    const norm = fieldValueToText(value);
    return new Paragraph({
      children: [
        new TextRun({ text: label + ': ', bold: false, color: '475569' }),
        new TextRun({ text: norm !== '' ? norm + (unit ? ' ' + unit : '') : '—', bold: true })
      ]
    });
  };
  const heading = (text: string) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: '1E2A3A' })]
  });
  const blank = () => new Paragraph({ text: '' });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: `Strategie Client — ${c.nume}${c.localitate ? ' - ' + c.localitate : ''} (${c.categorie}${c.isDT ? ' DT' : ''})`, bold: true })]
        }),
        new Paragraph({ children: [new TextRun({ text: `id_lucrare = ${c.idLucrare} · ${c.judet || ''} · ${c.telefon || ''} · ${c.email || ''}`, color: '666666', size: 18 })] }),
        blank(),
        heading('01 Situația actuală'),
        par('Suprafață', v.suprafata, 'mp'),
        par('Branșament', v.bransament),
        par('Putere PFTV existentă', v.putere_pftv, 'kW'),
        par('Construcție / izolație / etaje', v.constructie),
        blank(),
        heading('→ Cu sistemul AMASS'),
        par('Putere necesară', f.putere_necesara_kw, 'kW'),
        par('Consum anual', f.consum_anual_kwh, 'kWh'),
        par('Necesar PFTV AMASS', f.necesar_pftv_amass_kw, 'kW'),
        par('Cost investiție AMASS', f.cost_investitie_eur, 'EUR'),
        par('Cost eșalonare lunară', f.cost_esalonare_range, ''),
        blank(),
        // ── Zona 02: câmpuri diferite per variantă ──
        // V1 (categorie 1, construcție): câmpuri prefixate ca_ (info casă actuală)
        // V2 (categorie 2, casă locuită): sursa_caldura / distributie / consum_unitate / suma
        ...(c.categorie === 1
          ? [
              heading('02 Info casă actuală'),
              par('Sursă de căldură (actuală)', v.ca_sursa_caldura),
              par('Distribuție / emisie', v.ca_distributie),
              par('Cost lunar actual', v.ca_cost_lunar, 'lei'),
              par('Cost sezon actual', v.ca_cost_sezon, 'lei'),
              par('Observații situație actuală', v.obs_situatie),
            ]
          : [
              heading('02 Sistemul actual & observații'),
              par('Sursă de căldură', v.sursa_caldura),
              par('Distribuție / emisie', v.distributie),
              par('Unitate consum', v.consum_unitate),
              par('Suma (cost actual / lună)', v.suma, 'lei'),
              par('Observații situație actuală', v.obs_situatie),
            ]
        ),
        blank(),
        heading('03 Reacții financiare'),
        par('Reacție limita buget', f.cost_investitie_economic_eur, 'EUR'),
        par('Reacție plată integrală + Promo', f.cost_promo_eur, 'EUR'),
        par('Tip plată preferat', v.tip_plata),
        par('Interval buget', v.interval_buget),
        blank(),
        heading('04 Cum gândește clientul'),
        par('Motivul principal', v.motiv_principal),
        par('Plată eșalonată', v.plata_esalonata),
        par('Alternative', v.alternativa),
        par('Nivel bani', v.nivel_bani),
        par('Tipologie emoțională', v.tipologie),
        blank(),
        // V2 DOAR: zona 05 „Diferențe & concluzii" (V1 nu are această zonă, ca în spreadsheet)
        ...(c.categorie !== 1
          ? [
              heading('05 Diferențe & concluzii'),
              par('Diferență consum', f.diferenta_consum_lei, 'lei/lună'),
              par('Profit anual', f.profit_anual_lei, 'lei'),
              par('Diferență PFTV', f.diferenta_pftv_kw, 'kW'),
              par('Amortizare investiție', f.amortizare_ani, 'ani'),
              blank(),
            ]
          : [blank()]
        ),
        blank(),
        heading('Strategie & nevoi identificate'),
        new Paragraph({ children: [new TextRun({ text: fieldValueToText(v.strategie_nevoi) || '—' })] })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="strategie-${c.idLucrare}.docx"`
    }
  });
}
