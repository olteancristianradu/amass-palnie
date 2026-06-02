# Outlook (Microsoft Graph) — pași de configurare Azure

Integrarea de trimitere email e construită în aplicație. Ca să meargă, trebuie înregistrată **o singură dată** o aplicație în Azure/Microsoft Entra (tu sau IT-ul firmei). Funcționează atât pentru **cont de domeniu (M365)** cât și pentru **outlook.com personal**.

## Pași în portalul Azure (entra.microsoft.com → App registrations)
1. **New registration**:
   - Name: `AMASS Sales`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (asta permite și domeniu, și outlook.com).
   - Redirect URI: tip **Web**, valoare = `URL-ul aplicației` + `/api/outlook/callback`
     (ex. `https://optimum-rocks-bride-seat.trycloudflare.com/api/outlook/callback`, sau domeniul tău final).
2. Din aplicația creată, notează **Application (client) ID**.
3. **Certificates & secrets → New client secret** → notează **valoarea** secretului (apare o singură dată).
4. **API permissions → Add → Microsoft Graph → Delegated** → adaugă: `Mail.Send`, `offline_access`, `User.Read`, `openid`, `email`, `profile`. (Nu e nevoie de admin consent pentru delegated Mail.Send pe contul propriu.)

## Pe server (fișierul `.env.local`)
```
AZURE_CLIENT_ID=<Application (client) ID>
AZURE_CLIENT_SECRET=<valoarea secretului>
# opțional, dacă URL-ul diferă de NEXTAUTH_URL:
AZURE_REDIRECT_URI=https://domeniul-tau/api/outlook/callback
```
Apoi repornește aplicația.

## Cum se folosește (după configurare)
1. **Setări CRM → Outlook → „Conectează Outlook"** → te loghezi cu contul Microsoft (firmă sau personal), accepți permisiunile. Token-urile se salvează criptate (AES-256).
2. În fișa de strategie → **Email** → butonul **„✈ Trimite prin Outlook (+PDF)"** trimite emailul direct, cu **PDF-ul fișei atașat automat**.
3. Token-ul se reîmprospătează singur (refresh_token); reconectezi doar dacă revoci accesul.

## Note
- Fără AZURE_CLIENT_ID/SECRET, butonul „Conectează Outlook" afișează „nu e configurat" — restul aplicației merge normal, iar „Deschide în Outlook" (deep-link) funcționează oricum.
- Trimiterea e pe contul fiecărui user (delegated) — fiecare agent își conectează propriul Outlook.
