# AMASS Energy Console — Deployment pe server + Predare către client (pas cu pas)

Ghid „ca la proști". Aplicația = Next.js 14 + Prisma/SQLite + NextAuth, cu un proces de auto-sync care rulează în fundal. **IMPORTANT:** are nevoie de UN SINGUR proces Node persistent (din cauza auto-sync-ului) → se pune pe un **VPS / server Linux**, NU pe Vercel/serverless.

---

## PARTEA 1 — Ce-ți trebuie (instalezi pe server)
Un server Linux (Ubuntu 22+ e cel mai simplu) — la firmă sau un VPS (Hetzner/DigitalOcean ~5€/lună). Pe el:
1. **Node.js 20 LTS** + npm:
   ```
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
2. **git**: `sudo apt-get install -y git`
3. **pm2** (ține aplicația pornită + repornire automată la reboot): `sudo npm install -g pm2`
4. (opțional, pentru domeniu+HTTPS) **nginx**: `sudo apt-get install -y nginx`

## PARTEA 2 — Pune codul pe GitHub (de pe mașina ta actuală)
1. Cont GitHub → creează un **repo PRIVAT** (ex. `amass-palnie`). NU public (conține logică de business).
2. Pe mașina ta, în `/Users/radu-server/amass-webapp`:
   ```
   git init
   git add .
   git commit -m "AMASS Energy Console"
   git branch -M main
   git remote add origin https://github.com/<user>/amass-palnie.git
   git push -u origin main
   ```
   *(`.env.local` și `node_modules` NU se urcă — sunt în .gitignore; secretele le dai separat — vezi Partea 6.)*

## PARTEA 3 — Adu codul pe server
```
git clone https://github.com/<user>/amass-palnie.git
cd amass-palnie
npm install
```

## PARTEA 4 — Configurează (fișierul de secrete `.env.local`)
Creează `.env.local` în folderul aplicației, cu:
```
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="https://palnie.firma.ro"        # domeniul tău (sau http://IP:3000)
NEXTAUTH_SECRET="<un string lung random — generează cu: openssl rand -base64 32>"
CRYPTO_KEY="<CHEIA EXACTĂ de pe mașina veche — vezi mai jos, OBLIGATORIU aceeași>"
# Opțional Outlook (devize prin email):
AZURE_CLIENT_ID="..."
AZURE_CLIENT_SECRET="..."
```
⚠️ **`CRYPTO_KEY` trebuie să fie EXACT cea de pe mașina actuală** — cu ea sunt criptate parolele CRM din baza de date. Dacă o schimbi, fiecare user trebuie să-și reintroducă parola gestcom din Setări.

## PARTEA 5 — Baza de date + build + pornire
1. Aplică schema + (transferă datele — vezi Partea 6):
   ```
   npx prisma db push
   ```
2. Build + pornire persistentă cu pm2:
   ```
   npm run build
   pm2 start "npm run start" --name amass
   pm2 save
   pm2 startup        # urmează comanda afișată → pornește singură la reboot
   ```
   Aplicația rulează acum pe `http://IP:3000`.

## PARTEA 6 — Ce SECRETE/date transferi separat (NU prin GitHub)
| Ce | De ce | Cum |
|---|---|---|
| `CRYPTO_KEY` (din `.env.local` vechi) | decriptează parolele CRM | copiezi valoarea în `.env.local` nou |
| `NEXTAUTH_SECRET` | sesiunile de login | generezi una nouă (sau o copiezi) |
| `prisma/dev.db` (baza cu 814 clienți + conturi) | datele + utilizatorii | copiezi fișierul pe server (scp), SAU pornești gol și faci „Sync clienți" din CRM |
| Credențiale Azure (Outlook) | trimitere devize | le pui în `.env.local` |
*(Cheia Google service-account NU e necesară aplicației — a fost doar unealta mea de sync spreadsheet.)*

## PARTEA 7 — Domeniu + HTTPS (ca să nu mai folosești linkul temporar trycloudflare)
**Varianta A (recomandată) — nginx + domeniu:** pui un subdomeniu `palnie.firma.ro` → IP-ul serverului (DNS A record), apoi nginx reverse-proxy spre :3000 + HTTPS gratuit cu certbot:
```
sudo certbot --nginx -d palnie.firma.ro
```
**Varianta B — cloudflared named tunnel** (dacă nu vrei să expui serverul): `cloudflared tunnel create amass` + rută spre localhost:3000 + un domeniu în Cloudflare → URL STABIL (nu se mai schimbă ca cel temporar).

## PARTEA 8 — Predarea efectivă către client
1. **Repo GitHub** → adaugi clientul ca *collaborator* (Settings → Collaborators) SAU *Transfer ownership* către contul lui (Settings → Danger Zone → Transfer).
2. **Secretele** (`CRYPTO_KEY`, `.env.local`, eventual `dev.db`) → le dai prin canal sigur (NU pe GitHub, NU pe email simplu — folosește un password manager / mesaj criptat).
3. **Conturile**: din aplicație, „Echipă" → admin creează userii echipei + le resetează parolele.
4. **Conectare CRM**: fiecare user intră în Setări → introduce userul + parola lui de gestcom (se criptează).
5. **Documente**: dă-i `PLAN_PRODUS.md` + `PROMPT_CLAUDE_DESIGN.md` + acest fișier.

## Verificare finală (checklist)
- [ ] `pm2 list` arată `amass` online
- [ ] Domeniul deschide pagina de login (HTTPS)
- [ ] Login cu adminul merge → vezi cei 814 clienți
- [ ] „Sync clienți" / „Detalii" funcționează (auto-sync pornește la boot — vezi log: `pm2 logs amass`)
- [ ] Steluțe/observații/remindere se scriu în gestcom
