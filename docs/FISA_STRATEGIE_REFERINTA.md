# 📐 Fișa Strategie Client — REFERINȚĂ COMPLETĂ (extrasă din spreadsheet AMASS)

> Sursă de adevăr: `amass-script/FisaV1.js`, `FisaV2.js`, `StrategieEngine.js` (hărți + autofill), `Palnie.js` (note umane), `Strategie.js` (parser CRM) — **verificat LIVE pe `_TplStrategieV1`/`_TplStrategieV2`** (layout 2026-06-01).
> Scop: comparație 1:1 cu webapp-ul (`strategie-calc.ts`, `strategie-autofill.ts`, `fisa-template-seed.ts`) — formule și completare, ca să fim siguri că totul e conform.

**Două variante**, alese după sufixul `(N)` din numele clientului: **(1) → V1** (casă în construcție), **(2)–(9) → V2** (casă locuită). Fiecare rând are: coloana STÂNGĂ = input (label A:B, valoare C) și coloana DREAPTĂ = calcul AMASS (label D:E, valoare F).

Legendă completare: **MANUAL** = scrii · **DROPDOWN** = alegi din listă · **CHIP** = selecție multiplă · **AUTOFILL CRM** = se completează din Observații CRM (doar dacă e gol — nu suprascrie) · **FORMULĂ** = read-only, calculat (nu se stochează).

---

## Constante de calcul (din `_Config` + cod)
| Constantă | Valoare | Folosită la |
|---|---|---|
| Putere/m² | **0.1 kW/m²** | Putere necesară |
| Ore eficiente/zi | **2** | Consum zilnic |
| Zile/lună | **30** | Consum lunar |
| Luni sezon | **6** | Consum anual + V1 cost sezon |
| Acoperire PFTV | **0.25** (25%) | Necesar PFTV AMASS |
| Preț investiție | **50 €/m²** | Cost investiție AMASS |
| Reacție „buget estimat" | **55 €/m²** | C18 |
| Reacție „integral+promo" | **40 €/m²** | C19 |
| Eșalonare | `MROUND(cost×1.5/60, 5) ± 20` €/lună | Cost eșalonare + reacție |
| Reacție eșalonare | interval eșalonare **+10%**, `CEILING(...,5)` | C20 |
| ORE_PFTV_PE_ZI | **4** | Producție estimată PFTV = `PFTV×4×365` |
| Preț energie | **1.1 lei/kWh** | Diferență consum |
| PROFIT_KWH_LEI | **0.6** lei/kWh | Profit anual |
| Divizor amortizare | **5** | Amortizare (ani) |

---

## 🟩 V2 — Casă locuită (categorii 2–9)  · blob `strategieV2`

### 01 · Situația actuală  →  Cu sistemul AMASS
| R | STÂNGA (input) | cheie blob | completare | DREAPTA (formulă AMASS) | celulă | formulă |
|---|---|---|---|---|---|---|
| 4 | Suprafața (mp) | `suprafata` | MANUAL / AUTOFILL CRM (câmp SUPRAFATA) | Suprafața de încălzit (m²) | F4 | `=C4` |
| 5 | Branșament | `bransament` | DROPDOWN (Monofazic/Trifazic/Nedecis) + AUTOFILL CRM (inline „monofazic/trifazic") | Putere necesară (kW) | F5 | `=F4×0.1` |
| 6 | Putere PFTV existentă (kW) | `putere_pftv` | MANUAL / AUTOFILL CRM (cifră kW inline) | Consum zilnic (kWh) | F6 | `=F5×2` |
| 7 | Producție anuală PFTV declarată | `prod_aplicatie` | MANUAL | Consum lunar (kWh) | F7 | `=F6×30` |
| 8 | Consum anual PFTV (Aplicație) | `consum_pftv_aplicatie` | MANUAL *(nou 2026-06-01; nu intră în formule)* | — | — | — |
| 9 | Producție anuală estimată PFTV (4h/zi) | *(formulă)* | FORMULĂ | Consum ANUAL (kWh) | F9 | `=F6×30×6` |
| — | C9 = | — | `=IF(C6>0; C6×4×365; "")` | Necesar PFTV AMASS (kW) | F10 | `=F5×0.25` |
| 10 | Construcție / izolație / etaje | `constructie` | CHIP (multi) | Cost investiție AMASS | F11 | `=F4×50` (EUR) |

### 02 · Sistemul actual & observații
| R | STÂNGA | cheie | completare | DREAPTA | celulă | formulă |
|---|---|---|---|---|---|---|
| 12 | Sistemul actual | `sistem_actual` | DROPDOWN + AUTOFILL CRM („Ce sistem de încălzire aveți acum?") | Cost eșalonare lunară AMASS | F13 | `=MROUND(F11×1.5/60,5)−20 … +20 EUR/luna` |
| 13 | Consumul actual (unitate) | `consum_unitate` | DROPDOWN (lei/luna…); auto „lei/luna" dacă există Suma | | | |
| 14 | Suma (cost lunar actual) | `suma` | MANUAL / AUTOFILL CRM („Cât plătiți pe lună? RON") | | | |
| 15–16 | 💬 Observații Situație Actuală | `obs_situatie` | MANUAL (textarea merged C15:F16) | | | |

### 03 · Reacții financiare  |  💬 Observații Cuvânt-cu-cuvânt (dreapta)
| R | STÂNGA | cheie | completare | obs cheie (D) |
|---|---|---|---|---|
| 18 | Reacție la limita de buget estimat | *(formulă)* C18 `=C4×55 EUR` | FORMULĂ | `obs_r17` (D18) |
| 19 | Reacția la buget integral + Promo | *(formulă)* C19 `=C4×40 EUR` | FORMULĂ | `obs_r18` (D19) |
| 20 | Reacție la exemplu eșalonare | *(formulă)* C20 `=CEILING((MROUND(F11×1.5/60,5)−20)×1.1,5) … +20 ×1.1 EUR/luna` | FORMULĂ | `obs_r19` (D20) |
| 21 | Tip plată preferat | `tip_plata` | DROPDOWN (Integral/Eșalonat/Mixt/Credit/Nehotărât) | `obs_r20` (D21) |
| 22 | Interval Buget / Eșalonare acceptabil | `interval_buget` | MANUAL | `obs_r21` (D22) |

### 04 · Cum gândește clientul  |  💬 Observații Despre Cum Gândește (dreapta)
| R | STÂNGA | cheie | completare | obs cheie (D) |
|---|---|---|---|---|
| 24 | Motivul principal („Doriți să…?") | `motiv_principal` | DROPDOWN | `obs_g23` (D24) |
| 25 | Plata eșalonată (din formular) | `plata_esalonata` | AUTOFILL CRM („Cât doriți să plătiți pe lună pentru achiziție? RON") | `obs_g24` (D25) |
| 26 | Alternative de care e interesat | `alternativa` | CHIP (multi) + AUTOFILL CRM („Pe care din sistemele…analizați?") | `obs_g25` (D26) |
| 27 | Preventie (sistem / brand) | `preventie` | DROPDOWN (Sistem/Brand) *(nou)* | `obs_preventie` (D27) |
| 28 | Nivel bani | `nivel_bani` | DROPDOWN (Necumpătat/Cumpătat/Smart/Lux) | `obs_g26` (D28) |
| 29 | Tipologie emoțională | `tipologie` | DROPDOWN (Logic/Emoțional/Vânător de preț/…) | `obs_g27` (D29) |

### 05 · Diferențe & concluzii (DOAR V2)
| R | STÂNGA | celulă | formulă | DREAPTA | celulă | formulă |
|---|---|---|---|---|---|---|
| 31 | Diferență consum (cost/lună) | C31 | `=ROUND(C14 − F7×1.1)` lei | Profit anual estimat | F31 | `=ROUND((MAX(C7;C9) − F9)×0.6)` lei |
| 32 | Diferență PFTV (kW) | C32 | `=ROUND(C6 − F10; 2)` kW | Amortizare investiție | F32 | `=F11 / ((MAX(C7;C9)−F9)×0.6 + C14) / 5` ani |

### 06 · Strategie & Rezistențe & Nevoi Identificate
| R | câmp | cheie | completare |
|---|---|---|---|
| 34–47 | zonă liberă (text) | `strategie_nevoi` | MANUAL (textarea full-width) |

---

## 🟦 V1 — Casă în construcție (categoria 1)  · blob `strategieV1`

> Diferă de V2: secțiunea 02 = **„Info casa actuală"** (sistemul vechi al clientului) în loc de „Sistemul actual"; **NU are** secțiunea „Diferențe & concluzii"; în schimb are perechea **cost lunar ↔ cost sezon (×6)**. Cheile obs sunt decalate cu **+1** față de V2 (din inserția rândului „Dorește PFTV").

### 01 · Situația actuală  →  Cu sistemul AMASS
| R | STÂNGA | cheie | completare | DREAPTA | celulă | formulă |
|---|---|---|---|---|---|---|
| 4 | Suprafața (mp) | `suprafata` | MANUAL / CRM | Suprafața de încălzit | F4 | `=C4` |
| 5 | Stadiu actual construcție | `stadiu_constructie` | DROPDOWN (La proiect/Fundație/La roșu/La gri/Finisaje/…) | Putere necesară (kW) | F5 | `=F4×0.1` |
| 6 | Când intră electricianul | `cand_electrician` | DROPDOWN (interval) | Consum zilnic | F6 | `=F5×2` |
| 7 | Când toarnă șapele | `cand_sape` | DROPDOWN | Consum lunar | F7 | `=F6×30` |
| 8 | Când estimează mutarea | `cand_mutare` | DROPDOWN | Consum ANUAL | F8 | `=F6×30×6` |
| 9 | Branșament | `bransament` | DROPDOWN + CRM | Necesar PFTV AMASS | F9 | `=F5×0.25` |
| 10 | Construcție / izolație / etaje | `constructie_izolatie` | CHIP (multi) | Cost investiție AMASS (50€/m²) | F10 | `=F4×50` |
| 11 | Dorește PFTV | `doreste_pftv` | DROPDOWN (Da/Nu/Nehotărât/De evaluat) + CRM | Cost eșalonare lunară AMASS | F11 | `=MROUND(F10×1.5/60,5)−20 … +20` |

### 02 · Info casă actuală (obișnuința clientului)  |  Observații (dreapta D12:F16 = `obs_situatie`)
| R | STÂNGA | cheie | completare |
|---|---|---|---|
| 13 | Ce suprafață (mp) | `ca_suprafata` | MANUAL |
| 14 | Ce sistem de încălzire | `ca_sistem` | DROPDOWN (Centrala gaz/lemne/peleți/electrică, Pompă căldură, Calorifere electrice, AC, Sobă) + AUTOFILL CRM |
| 15 | Ce cost lunar actual (lei) | `ca_cost_lunar` | MANUAL / CRM — **reciproc**: dacă completezi C15 → C16 = C15×6 |
| 16 | Cost sezon actual (lei) | `ca_cost_sezon` | MANUAL — reciproc: dacă completezi C16 → C15 = C16/6 |

### 03 · Reacții financiare  |  obs (dreapta)
C18 `=C4×55`, C19 `=C4×40`, C20 eșalonare+10% (identic V2). | Tip plată `tip_plata` (R21), Interval `interval_buget` (R22). obs: `obs_r18`(D18)…`obs_r22`(D22).

### 04 · Cum gândește clientul  |  obs (dreapta)
`motiv_principal`(R24), `plata_esalonata`(R25, CRM), `alternativa`(R26, CRM), `preventie`(R27), `nivel_bani`(R28), `tipologie`(R29). obs: `obs_g24`(D24)…`obs_g28`(D29), `obs_preventie`(D27).

### 05 · Strategie & Rezistențe & Nevoi Identificate
`strategie_nevoi` (R31, textarea).

---

## 🔌 Autofill din Observații CRM — întrebare → câmp
| Întrebare în formularul CRM (gestcom) | Câmp fișă | parser |
|---|---|---|
| „Ce sistem de încălzire aveți acum?" | `sistem_actual` / `ca_sistem` | mapSistemActual **V2** vs **V1** (liste de dropdown DIFERITE!) |
| „Cât plătiți acum pe lună pentru încălzire? (RON)" | `suma` / `ca_cost_lunar` | `extractSuma` (format RO 1.000,50 vs US) |
| „Cât doriți să plătiți pe lună pentru achiziție? (RON)" | `plata_esalonata` | `extractSuma` |
| „Pe care din sistemele…fotovoltaice…analizați?" | `alternativa` | multi-bullet → concat „; " |
| inline „monofazic/trifazic" | `bransament` | STRICT (Trifazic/Monofazic/null) |
| inline „PFTV … N kW" | `putere_pftv` | cifră kW |
| „Doriți panouri fotovoltaice?" | `doreste_pftv` (V1) | STRICT (Da/Nu/Are deja/În viitor) |

Regula de autofill: **FILL-ONLY-EMPTY** — completează doar câmpurile goale, nu suprascrie ce a pus agentul.

---

## ⚠️ Puncte de atenție la comparația cu webapp-ul
1. **Maparea sistemului V1 vs V2 are liste DIFERITE** (V1: „Centrala gaz"/„Pompa de caldura"; V2: „CT gaz"/„Pompa caldura"). În webapp, `mapSistemActualV1` există în `strategie-autofill.ts`, dar **calea de SYNC `sync-engine.ts:53` încă folosește `parsed.sistem_actual` (V2)** pentru `ca_sistem` la clienții V1 → de schimbat în `parsed.sistem_actual_v1`.
2. **Cheile obs diferă V1↔V2** (decalaj +1): V2 `obs_r17–21`/`obs_g23–27`; V1 `obs_r18–22`/`obs_g24–28`. La migrarea categoriei trebuie redenumite (webapp: `ALIAS_V1_TO_V2` în `clienti/[id]/route.ts`).
3. **V1 nu are secțiunea „Diferențe & concluzii"** (C31/F31/C32/F32) — webapp folosește UN singur motor `calculate()` care le produce și pentru V1 (afișează în plus, nu greșit).
4. **Rotunjirea**: spreadsheet-ul păstrează precizie completă în lanțul F5→F6→F7 (rotunjește doar la afișare prin format); webapp-ul rotunjește intermediar (round1/round2). Diferențe neglijabile (sub-leu), dar de știut.
5. Formulele „cu virgulă vs punct-virgulă": pe locale RO spreadsheet-ul folosește `;` ca separator — webapp-ul nu are problema (JS pur).
