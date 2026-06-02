# Instalare rapidă la client — prin Docker (ca la proști)

**Model:** UN container Docker = UN client. Datele (baza SQLite) stau într-un **volum local** (`amass-data`) → **independente și salvate local**, NU la comun cu alt client. Fiecare user/agent din instanță își vede DOAR clienții lui (+ subordonații, dacă e manager); arhiva fișelor se salvează per client/owner.

## Ce-ți trebuie pe server (o singură dată)
- **Docker** + **Docker Compose**:
  ```
  curl -fsSL https://get.docker.com | sh
  ```

## Instalare (3 pași)
1. **Ia codul** (ultima versiune de pe GitHub):
   ```
   git clone https://github.com/olteancristianradu/amass-energy-console.git
   cd amass-energy-console
   ```
   *(Update ulterior la ultima versiune: `git pull` apoi `docker compose up -d --build`.)*
2. **Secretele** — copiază exemplul și pune valori:
   ```
   cp .env.example .env
   # generează 2 chei:
   openssl rand -base64 32   # → pune la NEXTAUTH_SECRET
   openssl rand -base64 32   # → pune la CRYPTO_KEY
   # editează .env (nano .env): NEXTAUTH_URL = adresa publică (ex. https://palnie.client.ro)
   ```
3. **Pornește:**
   ```
   docker compose up -d --build
   ```
   Gata — aplicația rulează pe `http://IP-server:3000`. Logs: `docker compose logs -f`.

## Primul login + folosire
- Aplicația pornește cu baza **goală** (date independente pentru acest client).
- Creează primul **admin**: rulează o dată (înlocuiește emailul/parola):
  ```
  docker compose exec amass node_modules/.bin/tsx prisma/seed.ts
  ```
  *(sau, dacă există un script de creare admin — vezi README; altfel adminul se creează prin /api/setup la prima pornire.)*
- Intri în aplicație → **Echipă**: adminul creează agenții + le dă parole.
- Fiecare agent → **Setări**: introduce userul + parola lui de **gestcom** (se criptează AES-256) → apasă „Sync clienți" → își importă pâlnia lui.
- De acolo: lucrează pâlnia (Carduri/Tabel/Kanban), fișa de strategie, steluțe/observații/remindere merg live în gestcom.

## Actualizare la o versiune nouă (constant de pe GitHub)
```
git pull
docker compose up -d --build
```
Datele rămân (sunt în volumul `amass-data`, nu în imagine).

## Backup-ul datelor (volumul local)
```
docker run --rm -v amass-energy-console_amass-data:/d -v $PWD:/b alpine tar czf /b/backup-amass.tgz -C /d .
```

## Izolare per client (mai mulți clienți pe același server)
Pentru un al doilea client: clonează în alt folder, schimbă portul (ex. `3001:3000`) și numele containerului/volumului în `docker-compose.yml` → a doua instanță, complet **separată** (altă bază, alte date).
