# AMASS Sales Webapp

Replicare web app a spreadsheet-ului AMASS Sales CRM Pâlnie, conectat direct la gestcom.ro/amass.

## Stack
- Next.js 14 App Router + TypeScript
- Prisma + SQLite (file `prisma/dev.db`)
- NextAuth credentials (email + parolă)
- AES-256-GCM pentru parole CRM stocate

## Pornire (dev)
```bash
npm install
npx prisma db push
npm run dev
# → http://localhost:3000
```

## Primul setup (crearea admin)
După ce dev server e pornit:
```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"tu@firma.ro","password":"parola","name":"Numele"}'
```
*Doar primul user — endpoint blocat după.*

## Variabile env (`.env.local`)
- `NEXTAUTH_URL`=http://localhost:3000
- `NEXTAUTH_SECRET` — secret rotabil (openssl rand -base64 32)
- `CRYPTO_KEY` — cheie AES-256 base64 pentru parolele CRM stocate

## Funcționalitate (replicat 1:1 din Sheets)
- **/palnie**: lista clienților cu sort/filter/search
- **/strategie/[id]**: fișa V1/V2 cu auto-calc + Email Redactare HTML business
- **/arhiva**: snapshots strategie istorice
- **/dashboard**: KPI conv funnel
- **/audit**: LOG_Audit complet
- **/settings**: credentiale CRM per-user, criptate

## API endpoints
- `POST /api/setup` — creare admin (one-time)
- `POST /api/crm/credentials` — salvare credentiale CRM criptate
- `POST /api/crm/test` — test login CRM
- `POST /api/crm/sync-clienti` — sync clienți noi DIN CRM
- `POST /api/crm/sync-detalii` — refresh detalii (suprafata, audio, stadiu, reminder)
- `POST /api/crm/sync-remindere` — refresh col Reminder
- `GET /api/clienti` — listă clienți DB
- `GET/PATCH /api/clienti/[id]` — strategie load/save (+ snapshot arhivă auto)
- `GET /api/arhiva` — istoric snapshots
- `GET /api/audit` — log audit
- `GET /api/dashboard` — KPI

## Diferențe față de Sheets (avantaje)
- **Fără limit 6 min execuție** — sync 800 clienți într-o singură run
- **Fără quota fetch 20K/zi** — fetches limitate doar de CRM gestcom
- **Concurrency proper** — mai mulți useri editează simultan fără race
- **Mobile-friendly** — UI responsive
- **Audit imutabil** — DB log nu se poate corupe accidental
- **Snapshots automate** la fiecare save strategie (recovery facil)

## Replicat din spreadsheet
- Format afișare Pâlnie identic (col A: HYPERLINK CRM + emoji stea + audio warn)
- Formule strategie (suprafata × X, F10, C17, C18, C29, F29, C30, F30)
- Email Redactare HTML cu bold/non-bold (manual vs auto) + reminder schițe
- Mapping CRM situatie → stadiu (ANULATA→Anulat, etc.)
- Cookie cache 24h (vs 25 min Sheets)
- Audit log la fiecare acțiune critică
