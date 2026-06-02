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
   git clone https://github.com/olteancristianradu/amass-palnie.git
   cd amass-palnie
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
- Aplicația pornește cu baza **goală** (date independente pentru acest client). La prima pornire
  containerul creează automat tabelele (`prisma db push` din entrypoint) — nu faci nimic manual.
- Creează primul **admin** (o singură dată) — un simplu apel HTTP către `/api/setup`
  (înlocuiește emailul/parola; după ce există un user, apelul e refuzat automat):
  ```
  curl -X POST http://localhost:3000/api/setup \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@firma.ro","password":"ParolăTare123","name":"Admin"}'
  ```
  *(De pe alt calculator înlocuiește `localhost` cu IP-ul/adresa serverului.)*
- Intri în aplicație (`/login`) cu adminul creat → **Echipă**: adminul creează agenții + le dă parole.
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
docker run --rm -v amass-palnie_amass-data:/d -v $PWD:/b alpine tar czf /b/backup-amass.tgz -C /d .
```

## Izolare per client (mai mulți clienți pe același server)
Pentru un al doilea client: clonează în alt folder, schimbă portul (ex. `3001:3000`) și numele containerului/volumului în `docker-compose.yml` → a doua instanță, complet **separată** (altă bază, alte date).
