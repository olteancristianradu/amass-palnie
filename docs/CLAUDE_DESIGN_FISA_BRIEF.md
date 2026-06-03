# 🎨 Brief Claude Design — Fișa Strategie Client (webapp)

> Context: portăm fișa din spreadsheet (vezi `docs/FISA_STRATEGIE_REFERINTA.md`) într-un webapp Next.js. **Formulele rămân IDENTICE** (sunt argumentul de vânzare — banii arătați clientului). Designul are voie să RESTRUCTUREZE layoutul, controalele și UX-ul, fiindcă în webapp nu mai suntem prinși în grila de celule a Google Sheets.

## Principii
1. **Formulele sunt sacre** — orice câmp „calc" afișează exact valoarea din referință (vezi tabelul de constante). Designul nu schimbă matematica, doar prezentarea.
2. **Date structurate, nu text liber** — orice câmp care azi e „chip cu de toate" se sparge în sub-câmpuri tipizate (queryable → filtre/rapoarte).
3. **Două coloane = două intenții**: stânga = ce AFLI de la client (input), dreapta = ce ÎI ARĂȚI (rezultate AMASS). Păstrează contrastul vizual input vs auto-calc.
4. **V1 (construcție) vs V2 (locuită)** = aceeași fișă, secțiunea 02 + 05 diferă (vezi referința). Un singur motor de calcul.

---

## Structura propusă pe zone (V2; V1 = la fel, cu diferențele notate)

### Zona 1 — Situația actuală (split stânga input / dreapta „Cu AMASS")
**Input (stânga):** Suprafață (mp, number) · Branșament (select) · Putere PFTV existentă (kW) · Producție anuală PFTV declarată · Consum anual PFTV declarat · **Construcție** *(vezi mai jos — SPART)*.
**Auto-calc (dreapta, read-only, badge „auto"):** Putere necesară `S×0.1` · Consum zilnic `×2` · Consum lunar `×30` · Consum anual `×30×6` · Necesar PFTV `Pn×0.25` · Producție estimată `PFTV×4×365` · **Cost investiție `S×50 €`** (evidențiat).

### 🔑 Îmbunătățirea cheie — „Construcție / izolație / etaje" spart în 4 câmpuri
Azi e UN câmp chip care amestecă material + izolație + grosime + niveluri (ex: „Cărămidă, Polistiren, 10 cm, 1 etaj"). Propunere:

| Câmp nou | Control | Opțiuni |
|---|---|---|
| **Material pereți** | select / chip-single | Cărămidă · BCA · Lemn · Panou sandwich · Beton · Structură metalică |
| **Tip izolație** | select | Polistiren · Vată minerală · Vată bazaltică · PIR · Neizolat |
| **Grosime izolație** | select / slider | 5 · 10 · 15 · 20 · 25 · 30 cm |
| **Niveluri** | listă / stepper | Parter · +1 etaj · +2 etaje · Mansardă *(ca listă de bife, nu un singur chip)* |

→ avantaj webapp: filtrezi clienții după material/izolație, rapoarte pe tip construcție, prefill inteligent. Stocare: sub-chei în blob (`material`, `izolatie_tip`, `izolatie_cm`, `niveluri[]`) — migrabil din vechiul `constructie` (păstrează și textul brut ca fallback).

### Zona 2 — Sistemul actual (V2) / Info casă actuală (V1)
**V2:** Sistem actual (select + badge „auto din CRM") · Unitate consum (select) · Suma lunară (number) · 💬 Observații situație (textarea). Dreapta: Cost eșalonare lunară `MROUND(Inv×1.5/60,5)±20 €/lună`.
**V1:** perechea **Cost lunar ↔ Cost sezon** ca un control LEGAT (editezi unul, celălalt se recalculează `×6` / `/6`) — arată-le ca un singur rând cu două câmpuri sincronizate.

### Zona 3 — Reacții financiare (value + citat, side-by-side)
Fiecare reacție = **rând cu 2 coloane**: stânga valoarea calculată (read-only), dreapta „ce a zis clientul cuvânt-cu-cuvânt" (textarea mică). 
- Limita buget `S×55 €` · Integral+Promo `S×40 €` · Exemplu eșalonare `eșalonare ×1.1, CEILING(…,5)` · Tip plată (select) · Interval buget (text).

### Zona 4 — Cum gândește clientul (value + citat)
Motivul principal (select) · Plata eșalonată (auto CRM) · Alternative (chip multi, auto CRM) · **Preventie** Sistem/Brand (select) · Nivel bani (select) · Tipologie emoțională (select). Fiecare cu un citat alături.

### Zona 5 — Diferențe & concluzii (DOAR V2) — „cardul de argument"
Propunere: un **panou proeminent (hero)** cu cele 4 numere de vânzare, mari și colorate (verde = câștig):
- 💰 **Diferență consum**: `ROUND(Suma − ConsumLunar×1.1)` lei/lună
- 📈 **Profit anual estimat**: `ROUND((MAX(prodApl,prodEst) − ConsumAnual)×0.6)` lei
- ⚡ **Diferență PFTV**: `ROUND(PFTV − NecesarAMASS, 2)` kW
- ⏱ **Amortizare**: `Inv / ((MAX(prodApl,prodEst)−ConsumAnual)×0.6 + Suma) / 5` ani

### Zona 6 — Strategie & nevoi (textarea full-width, generos)

---

## Idei de îmbunătățire UX (permise de webapp)
- **Badge sursă pe fiecare câmp**: „✍ manual" / „🔽 listă" / „🤖 auto din CRM" / „∑ calculat" — clientul/agentul vede instant ce e completat automat.
- **Tooltip de formulă** pe câmpurile calc (ⓘ): preia notele umane din referință (ex. „Cost investiție = suprafață × 50 €/m²"). Ai deja sistemul de info-popover (`tabel ⓘ`).
- **Progressive disclosure**: zona 5 (concluzii) se „aprinde" doar când ai suprafață + suma + PFTV completate → ghidează agentul.
- **Unități ca sufix-chip** (kW, kWh, lei, €, ani, mp) lângă valoare, nu în text.
- **Checklist de completitudine** pe stadiu (ai deja `stage-rules.ts` cu `exitCriteria`) — arată „ce-ți mai trebuie ca să avansezi".
- **Mod „prezentare client"**: ascunde inputurile, arată doar cardul de argument + economiile (read-only, frumos).
- **Mobile**: zonele devin acordeon; cardul de argument rămâne sticky sus.
- **Autofill diff**: când CRM-ul aduce o valoare nouă peste una goală, marchează-o subtil („nou din CRM") ca agentul s-o confirme.

## Reguli de date (NU le încălca — anti-pierdere)
- Autofill = **doar pe gol** (FILL-ONLY-EMPTY); niciodată suprascrie ce a pus agentul.
- Salvarea fișei = **merge** (nu suprascrie blob bogat cu unul sărac) + snapshot `ArhivaEntry`.
- La schimbarea categoriei (1↔≥2): migrare chei cu alias `ca_sistem↔sistem_actual`, `ca_cost_lunar↔suma`, obs decalate +1 (vezi `clienti/[id]/route.ts`).

## Tabel formule (copy-paste pentru implementare)
```
F4  = suprafata
F5  = F4 * 0.1                 // Putere necesară kW
F6  = F5 * 2                   // Consum zilnic kWh
F7  = F6 * 30                  // Consum lunar kWh
F9  = F6 * 30 * 6              // Consum ANUAL kWh
F10 = F5 * 0.25               // Necesar PFTV AMASS kW
F11 = F4 * 50                 // Cost investiție EUR
F13 = MROUND(F11*1.5/60,5)-20 " - " +20 " EUR/luna"
C9  = putere_pftv * 4 * 365   // Producție estimată kWh
C18 = suprafata * 55          // Reacție limită buget EUR
C19 = suprafata * 40          // Integral + Promo EUR
C20 = CEILING((MROUND(F11*1.5/60,5)-20)*1.1,5) " - " +20*1.1 " EUR/luna"
C31 = ROUND(suma - F7*1.1)              // Diferență consum lei
F31 = ROUND((MAX(prod_apl,C9) - F9)*0.6) // Profit anual lei
C32 = ROUND(putere_pftv - F10, 2)        // Diferență PFTV kW
F32 = F11 / ((MAX(prod_apl,C9)-F9)*0.6 + suma) / 5  // Amortizare ani
// V1 only: ca_cost_sezon = ca_cost_lunar * 6  (bidirecțional)
```
