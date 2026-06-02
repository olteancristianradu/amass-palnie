# AMASS Energy Console — Plan de produs real (2026-06-02)

Scris onest, după o sesiune lungă în aplicație. Ce e, ce face, ce merge, ce NU merge încă, și unde trebuie dusă ca să fie **mai bună și mai ușoară decât spreadsheet-ul**.

---

## 1. La ce servește, de fapt (o singură propoziție)
**Cockpit-ul zilnic al agentului**: lucrezi fiecare lead prin pâlnie (Intrare→T1→Schiță→Pre-ofertat→Ofertat→Contractat), îi faci fișa de strategie cu ROI calculat automat, și TOTUL e conectat live la CRM-ul gestcom — fără copy-paste manual.

**De ce ar fi mai bună ca spreadsheet-ul** (când e gata):
- Steluțe / observații / remindere **se scriu înapoi în gestcom automat** (în spreadsheet le bați de mână).
- Fișa de strategie cu **calcul ROI/amortizare automat** per categorie (în sheet e formulă fragilă).
- **3 vizualizări** pe aceleași date (Carduri / Tabel-ca-Excel / Kanban) — alegi cum lucrezi.
- **Vedere pe echipă** (managerul vede pâlnia fiecărui agent, recursiv) — în sheet-uri separate e haos.
- Căutare/filtre instant pe 800+ clienți; fără formule care se strică.

**Unde NU e încă mai bună:** densitatea/intuiția spreadsheet-ului (la asta lucrăm — promptul de design). Sheet-ul rămâne sursa pe care o știi; aplicația trebuie să o egaleze la viteză + s-o depășească la automatizare.

## 2. Modelul de date + fluxul unui client
`Client` (lead) ──> stadiu (funnel) ──> `fișă strategie` (V1 casă-construcție / V2 casă-construită; ROI auto) ──> închidere (Contractat/Anulat + motiv).
Câmpuri cheie: nume, localitate, suprafață, ID lucrare, **stadiu**, **nevoia**, **stea prioritate**, **reminder** (următoarea acțiune), observații. Toate ↔ gestcom.
- **Sursa de adevăr = gestcom.** Aplicația + spreadsheet-ul citesc AMBELE din gestcom (separat). De-asta „live" = la fiecare sync.

## 3. Fluxul de lucru pe rol
- **Agent**: deschide Pâlnie → vede lead-urile lui (doar ale lui) → setează prioritate (steluță→CRM), marchează etape (schiță/ofertă), pune reminder, deschide fișa, calculează ROI, închide cu motiv. Vede: Pâlnie · Dashboard · Setări.
- **Manager/Admin**: vede pâlnia întregii echipe (subtree), Dashboard agregat, Rapoarte, Jurnal, Echipă. „Administrare" separat.

## 4. Starea REALĂ acum (onest)
**Ce e solid:**
- 814 clienți reali, live din gestcom. Sync-ul **funcționează acum** (am reparat un bug în care clienții activi NU se reîmprospătau niciodată — `NULL NOT IN` — de-asta „datele păreau vechi"; acum 331 activi se refreshează corect).
- Steluțe/observații/remindere merg **live** în gestcom (verificat). Motive anulare (453), Nevoia (811), schiță din atașamente (148), remindere expirate reprogramate (113) — toate populate.
- Editare inline + calendar real pe date + Tabel exact ca Excel + meniu pe rol + RO/EN + temă funcțională.

**Ce am reparat din cele 29 de constatări de audit** (8 critice): sync care ștergea stadiul; editări care eșuau tăcut; clienți activi nereîmprospătați; închidere fără motiv (acum modal); drag în Ofertat; accent/temă inerte; rute CRM pe cont greșit; cookie corupt; 2 găuri de securitate (cheie + rapoarte PII). **Build curat.**

**Ce e ÎNCĂ slab (onest):**
- **Design/intuiție** — încă nu e la nivelul spreadsheet-ului ca densitate/claritate. → promptul `PROMPT_CLAUDE_DESIGN.md` + iterații.
- **Arhivă** — concept greșit (listă plată de snapshot-uri). → de mutat istoricul în fișa clientului.
- **Nightly spreadsheet** — blocat de PROTECȚIILE foii (nu de cod) → 1 click: Recovery „Repară protecții Pâlnie".
- Câteva minore + înăsprire securitate tunel.

## 5. Arhivă — ce e și cum o reparăm
**Ce e:** de fiecare dată când salvezi fișa unui client, se face un snapshot (versiune). Bogdan Zirbo apare „de 2 ori" = 2 salvări (29 + 30 mai) — corect ca date, **greșit ca prezentare** (listă plată, fără click, fără diff).
**Fix:** scot lista globală din meniu (deja e doar admin); mut **„Versiuni anterioare"** ÎN fișa clientului (click pe o versiune → o vezi/compari). Important pentru tine: **fiecare strategie SE salvează** — asta rămâne garantat; doar nu mai e o pagină separată confuză.

## 6. Roadmap concret (ordinea pe care o propun)
1. **Design holistic** (prin promptul Claude Design): comutator vizualizări persistent, remindere vizibile în toate view-urile, stele distincte, data-intrare de-emfazată, toolbar curat. → aplic ce iese.
2. **Fișă = centrul** — istoric versiuni în fișă (rezolvă Arhiva); ghidaj per stadiu; pasul următor pe card.
3. **Sync „cât mai live"** — cadență mai agresivă + indicator clar de prospețime; tu rulezi o dată repararea protecțiilor (nightly spreadsheet).
4. **Restul auditului** (minore + securitate tunel) + lock sync (făcut).
5. **Paritate Francisca** (cod prin scriptId-ul ei + date prin login-ul ei CRM).

---
**Concluzie onestă:** logica din spate E coerentă (lead → funnel → fișă/ROI → închidere, sincronizat cu gestcom), iar sync-ul + datele funcționează acum. Ce a lipsit până acum e **finisajul de UX/design** și câteva bug-uri de proces — exact ce atacăm acum cu designul + auditul. Nu, nu e „tot ce pot" — e baza solidă peste care punem acum stratul de produs care o face să bată spreadsheet-ul la viteză și automatizare.
