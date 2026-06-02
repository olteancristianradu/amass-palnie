# Roadmap de evoluție — AMASS Sales (aplicația web)

Stare la 2026-06-01. Aplicația e funcțională: pâlnie + fișă strategie, sync auto cu CRM, ierarhie pe echipă, rapoarte, teme. Mai jos — ce urmează, prioritizat.

## Acum (fundație) — FĂCUT
- ✅ Pâlnie carduri + stea SVG + funnel real, dashboard, rapoarte, teme (Aspect)
- ✅ Auto-sync CRM (light 90s / detalii 10min) + write-back status în Observații CRM
- ✅ Ierarhie org (manager vede subtree-ul), conturi & roluri
- ✅ Securitate: scope per-client (anti-IDOR), parole criptate, audit log, NEXTAUTH_SECRET persistent
- ✅ Schimbare parolă self-service

## Etapa 1 — Email & cont (următoarea)
1. **Outlook — trimitere automată (Microsoft Graph)**. Acum: „Deschide în Outlook" pre-completează un email (firmă/personal), fără setup. Următorul pas = trimitere direct din aplicație, pe email de domeniu SAU personal:
   - Necesită **înregistrare aplicație în Azure AD** (Microsoft Entra) — pas pe care îl faci tu (sau IT-ul firmei): client ID + secret + redirect URI, permisiune `Mail.Send`.
   - Eu construiesc: OAuth2 (login Microsoft din aplicație) → stocare token criptat → `POST /me/sendMail` prin Graph. Buton „Trimite prin Outlook" în fereastra de email. Suportă cont de domeniu (M365) și outlook.com personal (endpoint `common`).
   - Cu atașament PDF/DOCX (devizul) atașat automat.
2. **Resetare parolă prin email** (depinde de email-ul de mai sus): „Am uitat parola" → link de resetare pe email. Până atunci: admin resetează din pagina Echipă.
3. **Politici parolă**: cerință de schimbare la prima logare, expirare opțională, istoric.

## Etapa 2 — Pipeline „world-class" (din research-ul anterior)
4. **StageEvent** — log de tranziții cu timestamp (fundația pentru velocity/conversie/forecast).
5. **Kanban drag-and-drop** peste pâlnie (coloane = stadii).
6. **Alerte stale-deal / SLA** (deal „uitat" colorat) + „Activitățile mele azi".
7. **Analytics conversie pe stadiu + viteză** (unde pierzi clienții).
8. **Forecast ponderat pe echipă** (pentru manageri).
9. **Lead score AMASS** din ROI (suprafață, amortizare, profit) — sortare automată.

## Etapa 3 — Productivitate & mobil
10. **Win/loss reasons** la închidere (de ce pierzi) → raport.
11. **Bulk actions** în pâlnie (selectezi mulți, acțiune în masă).
12. **Mobil / teren**: carduri compacte, click-to-call, WhatsApp din card.
13. **Digest zilnic** (in-app + email): follow-up-uri + dealuri stale.

## Etapa 4 — Unificare & robustețe
14. **Unificare web ↔ spreadsheet** (acum sunt separate) — o singură sursă, sau sync bidirecțional.
15. **Backup automat** DB + restore din UI.
16. **Hardening** din audit (backlog LOW): AbortController pe fetch-uri, debounce la write-back, observabilitate erori CRM.

## Note de realism
- Outlook „trimitere automată" și „resetare prin email" depind de un **cont Azure/M365** cu drepturi de a înregistra o aplicație. Fără el, rămân la „deschide în Outlook" + resetare de către admin.
- Sync-ul cu gestcom rămâne **polling** (gestcom n-are webhook), deci „aproape live", nu instant.
