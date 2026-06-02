# Modificări fișă V1 + V2 (Preventie + Consum PFTV) — 2026-06-01

## Ce s-a adăugat
- **V1 + V2:** rând nou **„Preventie"** sub „Alternative" — dropdown `Sistem`/`Brand` + observații în dreapta.
- **V2:** rând nou **„Consum anual PFTV (Aplicație)"** (input) după „Producție PFTV (Aplicație)".

## De ce a fost delicat
Layout-ul fișei e pe celule fixe, iar formulele financiare (profit, amortizare) folosesc adrese absolute. Inserarea de rânduri a mutat zeci de celule. S-au actualizat **6 fișiere** (builder, mape arhivă, repară-formule, text CRM, email, tooltipuri), nu doar layout-ul.

## Verificare făcută
- Static: 0 coliziuni de celule, fiecare câmp → celulă input reală, formulă/input disjuncte.
- Echivalență matematică (hand-trace): rezultatele 6000 / 8760 / 6600 / 208 / 2664 / 3 / ~0.33 ani — identice pe adresele noi.
- Sintaxă OK pe toate fișierele. Commit git (reversibil). `clasp push` reușit.

## ⚠️ Pași obligatorii înainte de a folosi (cod nou + template vechi = date greșite)
1. Reîncarcă tab-ul spreadsheet (apare meniul nou).
2. **🎯 Pâlnie Tools → 🔧 Utilitare → 🧩 Șablon — Reconstruiește V1**
3. **🧩 Șablon — Reconstruiește V2**
4. **🧪 Autotest — Fișă V1** + **🧪 Autotest — Fișă V2** (toate ✅).

Reversibil: `git revert 11a39cb && clasp push`.

## Paritate cu aplicația web
Aceleași 2 câmpuri (Preventie + Consum PFTV) au fost adăugate și în forma de strategie din aplicația web, ca să fie la fel ca în spreadsheet.
