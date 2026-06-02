# Instalare rapidă la client — prin Docker (ca la proști)

**Model:** UN container Docker = UN client. Datele (baza SQLite) stau într-un **volum local** (`amass-data`) → **independente și salvate local**, NU la comun cu alt client. Fiecare user/agent din instanță își vede DOAR clienții lui (+ subordonații, dacă e manager); arhiva fișelor se salvează per client/owner.

## Ce-ți trebuie pe server (o singură dată)
- **Pe Linux** (recomandat pt producție — server ieftin, standard):
  ```
  curl -fsSL https://get.docker.com | sh
  ```
- **Pe Windows** (PC sau Windows Server): comanda de mai sus NU merge (e doar Linux; în PowerShell nu există `sh`).
  Instalezi **Docker Desktop pentru Windows** de la https://www.docker.com/products/docker-desktop/ →
  rulezi installer-ul (lași bifat WSL 2) → restart → deschizi Docker Desktop și aștepți „Engine running".
  Ai nevoie și de **Git pentru Windows** (https://git-scm.com/download/win). Vezi mai jos secțiunea „Windows / PowerShell".

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

## ⭐ Windows 10 (PC ca server) — calea SIMPLĂ, recomandată

**O singură dată (instalări de bază, manual):**
1. **Docker Desktop**: descarcă de la https://www.docker.com/products/docker-desktop/ → instalează (lasă bifat WSL 2) → restart → deschide Docker Desktop, așteaptă „Engine running" (verde, jos-stânga).
   - În Docker Desktop → ⚙ Settings → General → bifează **„Start Docker Desktop when you sign in"**.
2. **Git pentru Windows**: https://git-scm.com/download/win (Next, Next, default).
3. **Pornire automată la restart**: `Win+R` → `netplwiz` → debifează „Users must enter a user name and password" → pune parola. (Așa, după un restart, Windows se loghează singur → Docker pornește → aplicația revine.)

**Instalarea aplicației (2 pași — fără comenzi de tastat):**
1. Deschide **PowerShell** și ia codul:
   ```powershell
   git clone https://github.com/olteancristianradu/amass-palnie.git
   cd amass-palnie
   ```
2. Deschide folderul `amass-palnie` în File Explorer și **dublu-click pe `install.bat`**.
   - Generează singur cele 2 chei, pornește aplicația și te întreabă emailul/parola pentru contul admin. Gata.
   - Deschide `http://localhost:3000` și te loghezi cu adminul creat.

**Dacă `install.bat` se închide cu o eroare**, fă-mi o poză/copiază textul — îți spun exact ce lipsește (de regulă: Docker Desktop nu e pornit, sau Git nu e instalat).

> De ce un `.bat`, nu comenzi în PowerShell? În PowerShell `curl` e alias (nu curl real) și `sh`/`openssl`/`cp` nu există → comenzile „de Linux" dau erori. `install.bat` ocolește tot asta.

**Mentenanță (tot dublu-click):** `update.bat` = ia ultima versiune + repornește (datele rămân); `backup.bat` = salvează datele în `backup-amass.tgz`.

**Actualizare AUTOMATĂ (recomandat — serverul trage singur modificările):** dublu-click **o singură dată** pe **`setup-autoupdate.bat`**. De atunci, serverul verifică GitHub la fiecare 2 ore și, dacă apare o versiune nouă, o trage și repornește singur (fără tine, fără downtime când nu e nimic nou). Istoric în `auto-update.log`. Oprești cu: `schtasks /Delete /TN "AMASS-Palnie-AutoUpdate" /F`.
