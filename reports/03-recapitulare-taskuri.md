# Recapitulare onestă — ce s-a făcut, ce nu, ce a rămas

Stare la zi. ✅ = făcut + verificat · ⚠️ = nuanță/limitare · ⏳ = rămas.

## Aplicația web (amass-webapp)

- ✅ **Ierarhie organizațională (subtree):** un manager vede pâlnia lui + a tuturor celor de sub el (recursiv), nu lateral, nu deasupra. Testat 8/8 + verificat live în browser.
- ✅ **Sync per-cont:** fiecare cont are propriile credențiale CRM (criptate); fiecare pâlnie ↔ propriul cont CRM.
- ✅ **Redesign UI** (pâlnie carduri-rând, stea SVG reală pe scală termică, funnel real cu drop-off, badge sync). Verificat live (30 carduri reale).
- ✅ **Fix-uri sync (cod):** `setSteluta` + `addReminder` nu mai raportează succes fals pe sesiune expirată; `fetchList` re-aplică filtrul complet; cache cookie 24h→6h.
- ⚠️ Redesign-ul a fost verificat pe **30 clienți temporari** (cont de test), nu pe baza ta de 814 (deși codul e identic). Tu vezi cei 814 doar logat ca **admin** (`cristian.raduoltean@gmail.com`).
- ⚠️ Fix-urile de scriere sync sunt corecte la cod (typecheck/build), dar ramura de retry pe sesiune real-expirată nu a fost rulată end-to-end.
- ⏳ Câmpurile noi **Preventie** + **Consum PFTV** — adăugate în spreadsheet; în web adăugate la cerere (vezi raport fișă).

## Spreadsheet „Palnie Radu" (Apps Script)

- ✅ **Rând Preventie** (dropdown Sistem/Brand) sub Alternative în V1 + V2.
- ✅ **Rând Consum PFTV (Aplicație)** în V2.
- ✅ Toate formulele + maparea arhivei + tooltipuri + text CRM + email re-referențiate; verificat static (0 coliziuni) + echivalență matematică.
- ✅ 2 fix-uri vechi (throttle CRM_Sync, retry lock StrategieEngine) — acum deployate.
- ⚠️ **NU pot rula Apps Script local** → testul funcțional final îl rulezi tu (meniu: Reconstruiește Șablon V1/V2 → Autotest V1/V2). Obligatoriu înainte de a deschide vreun client.

## Audit clienți (livrabil mare)

- ✅ **`reports/01-audit-inchidere.md`** — 329 clienți valabili analizați de 47 agenți: 0 HOT confirmați, 127 WARM (cu motiv + următorul pas fiecare), 22 DEAD de marcat Anulat. Top 12 dosare avansate cu ofertă deja pe masă.

## Rămase / opționale (NU promise ca gata)

- ⏳ Curățarea conturilor de test (`manager@amass.ro`, `agent2@amass.ro`).
- ⏳ Feature-uri din roadmap (StageEvent, Kanban, forecast) — doar idei, neimplementate.
- ⏳ Auto-sync / webhook real-time — neimplementat.

## Unde sunt rapoartele

Toate în folderul `reports/` din aplicația web ȘI vizibile în pagina **„Rapoarte"** din meniul aplicației.
