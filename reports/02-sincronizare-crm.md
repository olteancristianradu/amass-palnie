# Sincronizarea cu CRM — cum funcționează de fapt

## ACTUALIZARE 2026-06-01: AUTO-SYNC PORNIT (web)

Aplicația web are acum **auto-sincronizare automată** (cadență „Echilibrat"):
- **Clienți noi: verificare la ~90 secunde** (poll ușor — login + listă; ieftin dacă nu-s clienți noi).
- **Detalii (suprafață, stadiu, steluțe, remindere): lot rotativ de 40 clienți la ~10 min** → acoperire completă în ~90 min, fără să suprasolicite contul.
- **Scrieri instant** (la acțiune): steluțe, observații, remindere — ȘI etapele de pâlnie (Schiță/Pre-of/Ofertat/Nevoia) + Stadiu se împing automat în **Observații CRM** (bloc „STATUS PALNIE").
- **Pâlnia se reîmprospătează singură** în ecran la ~30s.
- Pornit/oprit din **Setări CRM**. La erori, dă automat înapoi 5 min (protejează contul gestcom).

⚠️ Tot polling, nu „push" instant (gestcom n-are webhook) — dar senzația e de aproape-live. Spreadsheet-ul „Palnie Radu" rămâne pe modelul manual (mai jos).

---

## Modelul de bază (valabil mai ales pentru spreadsheet)

Există **3 sisteme separate**, toate legate de același CRM gestcom, dar **NU legate între ele**:

1. **CRM gestcom.ro/amass** = sursa de adevăr pentru clienți.
2. **Aplicația web (amass-webapp)** = aplicație separată, cu baza ei de date proprie (SQLite).
3. **Spreadsheet-ul „Palnie Radu" (Google Sheets + Apps Script)** = aplicație separată, cu arhivele ei proprii (sheet-urile Arhiva_Strategie_V1/V2).

> ⚠️ **Important:** Aplicația web și Spreadsheet-ul NU comunică între ele. O strategie completată în web NU apare în spreadsheet și invers. Amândouă vorbesc doar cu CRM-ul, fiecare separat.

---

## Ce merge LIVE și ce e MANUAL

| Acțiune | Web | Spreadsheet | Live? |
|---|---|---|---|
| ⭐ Steluță (prioritate) → CRM | da | da | **LIVE** (instant la click) |
| 📝 Push observații din fișă → CRM | buton „Push CRM" | buton „Info CRM" | **LIVE** (instant) |
| ⏰ Reminder nou → CRM | buton Reminder | meniu Adaugă reminder | **LIVE** (instant) |
| Listă clienți / detalii / remindere ← CRM | buton „Sync" | meniu „Sincronizează" | **MANUAL** (batch, când apeși) |
| Salvarea fișei de strategie | în DB web | în Arhiva (sheet) | **LOCAL** (nu pleacă automat la CRM) |
| Toggle Schiță / Pre-ofertat / Ofertat, Nevoia, Stadiu | local web | local sheet | **LOCAL** (nu există câmpuri native în CRM) |

## Aplicația de strategie e live cu CRM?

**Parțial.** Fișa de strategie (web sau spreadsheet) se **salvează local**. Ce ajunge în CRM din fișă este doar **textul de observații**, și doar când apeși butonul **„Push CRM" / „Info CRM"** — atunci da, merge instant (live). Restul datelor din fișă rămân în aplicația respectivă.

## Spreadsheet-ul se sincronizează live?

**Același model ca web-ul:** citirile din CRM sunt **manuale** (meniul „Sincronizează clienți / detalii / remindere"), iar scrierile (steluțe, observații prin „Info CRM", remindere) sunt **live la acțiune**. Datele fișei stau în sheet-urile Arhiva, nu se trimit automat la CRM.

## Nu există auto-sync / webhook

Nici web-ul, nici spreadsheet-ul nu „ascultă" CRM-ul în timp real. Dacă cineva schimbă ceva direct în gestcom, afli abia după ce apeși Sync. Asta NU a fost cerută/promisă; dacă o vrei, e un proiect separat (cron / webhook).
