# Prompt pentru Claude Design — AMASS Energy Console (rework UI navigare + carduri)

Copiază tot textul de mai jos în Claude Design.

---

Ești designer de produs. Reproiectează **navigarea, comutatorul de vizualizări și cardul/rândul de client** pentru un **tool intern de CRM** numit **„AMASS Energy Console"**, folosit zilnic de agenți de vânzări și manageri la o firmă care vinde sisteme de încălzire economică (pompe de căldură, panouri solar-termice PFTV). NU e site de marketing — e un **instrument dens de date, operațional**. Estetică deja stabilită: **scandinav-curat, aerisit, accent ROȘU AMASS `#CC0000`**, fonturi **Montserrat** (titluri/cifre) + **Inter** (UI) + **JetBrains Mono** (ID-uri/cifre). Suprafețe albe, sidebar luminos, temă light/dark. Stack: Next.js 14 + Tailwind + CSS variables.

## Contextul aplicației
- O singură entitate: **clientul** (lead-ul), parcurge o pâlnie: **Intrare → T1 → Schiță → Pre-ofertat → Ofertat → Contractat** (+ Amânat / Finalizat / Anulat).
- Aceleași date se văd în **3 vizualizări**: **Carduri** (listă aerisită), **Tabel** (dens, exact ca un spreadsheet Excel cu coloane: Client, Suprafață, Data Intrare, T1, Nevoia, Schiță, Pre-Ofertat, Ofertat, Status, Reminder, Observații Manager + rând „Total/etapă"), **Kanban** (coloane = stadii, drag&drop).
- Date per client: nume, localitate, suprafață (mp), ID lucrare, sistem, **stadiu**, **nevoia** (Acoperită/Tentativă/Nu îl putem ajuta/Nevoie viitoare), **stea de prioritate**, **reminder** (următoarea acțiune + dată), data intrării, valoare estimată €.

## Probleme de rezolvat (gândește inteligent soluțiile)
1. **Comutatorul de vizualizări (Carduri / Tabel / Kanban) NU trebuie să dispară niciodată.** Acum, când apăs Kanban (altă pagină), comutatorul dispare și nu mai am cum să mă întorc ușor. Vreau comutatorul **mereu vizibil, în același loc, în TOATE cele 3 vizualizări** (sticky, persistent), cu starea curentă evidentă. Propune un control segmentat clar (iconițe + etichete) care rămâne fix.
2. **Reminderele trebuie MULT mai vizibile, în orice vizualizare.** Follow-up-ul e cea mai importantă informație operațională. Acum sunt mici/ascunse. Vreau ca în Carduri, Tabel ȘI Kanban reminderul (data + tipul + textul scurt) să sară în ochi — și mai ales **reminderele restante/azi** să fie evidențiate (culoare/badge). Propune cum arată un reminder „urgent" vs „viitor".
3. **Stelele de prioritate trebuie să se distingă FOARTE clar între ele.** Avem o scală termică (rece→fierbinte): gri (nesetat) · verde · chihlimbar/portocaliu · roșu (urgent). Acum greu le deosebesc. Vreau ca fiecare nivel să fie **instant recognoscibil** — nu doar prin nuanță apropiată, ci prin culoare + eventual formă/etichetă/intensitate. Propune un sistem de prioritate lizibil dintr-o privire (inclusiv pe fundal alb și în temă dark).
4. **Data intrării clientului NU trebuie să domine cardul.** Acum apare mare/roșie în față — nu mă interesează atât de tare. Coboar-o în ierarhia vizuală (meta secundar), și folosește roșul DOAR pentru ce e cu adevărat urgent (reminder restant, prioritate maximă).
5. **Aranjarea butoanelor și a toolbar-ului** — acum sunt înghesuite și se mută la wrap. Propune un toolbar curat, intenționat: titlu + comutator vizualizări (stânga), căutare + filtre + acțiuni de sync (dreapta), totul stabil.
6. **Meniu pe rol + un singur „Setări".** Agentul vede puțin (Pâlnie, Dashboard, Setări). Adminul/managerul vede în plus, grupat sub „Administrare" (Echipă, Rapoarte, Jurnal, Arhivă). „Setări" = UN singur loc cu tab-uri (Cont CRM · Aspect/temă · Parolă · Outlook). Comutator limbă **RO/EN sus-dreapta**.

## Livrabil
Pentru fiecare: layout (mockup), ierarhie vizuală, stări (hover/activ/urgent), tokens (culori/spacing/typography pe variabilele existente `--accent`, `--text`, `--border`, `--surface`, scala termică `--heat-0..5`), și comportament (sticky, drag&drop, editare inline). Dă-mi cod recreabil în Next.js 14 + Tailwind, pixel-perfect, fără estetică generică de AI. Concentrează-te pe **claritate operațională** (e folosit ore întregi/zi), nu pe efecte spectaculoase.
