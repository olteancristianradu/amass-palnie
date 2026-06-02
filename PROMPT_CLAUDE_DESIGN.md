# BRIEF DE DESIGN — „AMASS Pâlnie Clienți"
### Pentru Claude Design · webapp CRM intern AMASS

---

## 0. Cum citești acest brief

Acest document este auto-conținut. Conține tot ce-ți trebuie ca să generezi designul. Te rog:
- Generează **variante** (minim 2-3) pentru fiecare ecran cheie, nu o singură soluție.
- Respectă exact specificațiile de ierarhie și format de mai jos (sunt date concrete, nu sugestii).
- Tot ce ține de culoare/spațiere/font trebuie construit pe **design tokens** (variabile CSS semantice), pentru că aplicația are un panou unde utilizatorul reglează aproape totul (vezi secțiunea 4).
- Livrabilele finale sunt enumerate în secțiunea 8.

---

## 1. Ce este aplicația, cine o folosește, tonul vizual

**Aplicația.** „AMASS Pâlnie Clienți" este un CRM intern web (Next.js 14 + Tailwind) conectat la CRM-ul gestcom.ro. AMASS este o firmă din România care vinde **sisteme de încălzire economică / pompe de căldură / panouri PFTV** către clienți finali (case în construcție sau case deja locuite). Aplicația urmărește fiecare client (deal) printr-o **pâlnie de vânzare** de la primul contact până la contractare.

**Utilizatori și roluri** (vizibilitatea datelor diferă, designul rămâne același):
- **Agent** — vede doar clienții lui. Folosește aplicația zilnic, mult pe telefon, în deplasare.
- **Manager** — vede echipa lui în jos (subtree). Compară agenți, urmărește pâlnia echipei.
- **Admin** — vede tot. Configurează template-ul fișei de strategie, credențiale, import, sync.

**Limbă.** Interfață în **română**, cu toggle **RO/EN** (textele trebuie să încapă în ambele limbi — RO e ~15-20% mai lung; nu strânge butoanele).

**Dispozitive.** Trebuie să fie **excelent pe telefon ȘI pe desktop**. Agentul lucrează des de pe telefon (pe teren); managerul/adminul de pe desktop.

**Tonul vizual dorit.** Profesionist, calm, „scandinav" — suprafețe deschise, mult spațiu alb, ordine, fără zgomot. Accentul roșu AMASS dă energie și marchează acțiunea/urgența, dar nu inundă ecranul. Senzația trebuie să fie de **instrument de lucru clar și rapid**, nu de dashboard corporativ încărcat. Important: roșul este o resursă rară — dacă tot e roșu, nimic nu mai iese în evidență (mai ales semnalul de „deal care îmbătrânește").

---

## 2. Direcția de design (pornind de la „scandinav roșu" actual)

Aplicația are deja o direcție: **„scandinav roșu"**. Păstreaz-o ca punct de plecare, dar ai voie — ba chiar te rog — să o rafinezi și să propui îmbunătățiri argumentate.

### Paletă (light mode = implicit)
- **Accent / brand (primar):** roșu AMASS `#CC0000`. Folosit pentru: butonul de acțiune principal, link-uri active, indicator de tab activ, focus ring. **NU** pentru fundaluri mari.
- **Fundal aplicație:** alb cald / off-white foarte deschis (suprafață de bază, „scandinavă").
- **Suprafețe (card, panou, rând tabel):** alb pur sau cu o nuanță infinitezimal diferită de fundal, ca să se citească ca unități separate.
- **Text:** aproape-negru pentru primar, gri mediu pentru secundar/muted.
- **Borduri / separatoare:** gri foarte deschis, 1px.
- **Semantic (status):** verde = succes/finalizat, galben/chihlimbar = atenție/în urmărire, albastru = info/nou, roșu = pericol/întârziere. Atenție: roșul semantic de „pericol" trebuie să fie distinct perceptual de roșul de brand, ca să nu se confunde un buton cu o alertă (vezi secțiunea 3, „vârstă").

### Mod light + dark
- Tratează **dark mode ca context de prim rang**, cu valori proprii — nu o simplă inversare. Accentul roșu are nevoie de o variantă proprie de dark (mai deschisă/mai saturată) ca să-și păstreze „greutatea" perceptuală pe fundal închis.
- Construiește pe perechi **suprafață + foreground** (token de suprafață + culoarea textului care stă pe ea), ca textul să rămână lizibil indiferent de fundal.

### Tipografie
- **Display / titluri:** Montserrat.
- **UI / text curent:** Inter.
- **Cifre / date / sume / mp:** JetBrains Mono (mono, **cifre tabulare**) — esențial ca numerele să se alinieze vertical în tabel și carduri (ex. „1.111 mp" să nu pară mai scurt decât „999 mp").

### Spațiere & formă
- Spațiere generoasă, ritm consistent (scală 4/8px). „Aerisit" la carduri, „dens dar respirabil" la tabel.
- **Colțuri (radius):** rotunjire moderată, reglabilă de utilizator (vezi secțiunea 4). Derivă întreaga scală de radius dintr-un singur token.
- Ierarhie din **mărime + greutate + culoare**, NU din umbre grele și borduri groase. Umbre subtile, nu „card flotant".

---

## 3. CELE 3 VIZUALIZĂRI ALE PÂLNIEI (inima aplicației)

Aceasta este **pagina cheie**. Este o listă de clienți care se poate afișa în 3 moduri comutabile printr-un **segmented control vizibil sus** (`Carduri | Tabel | Kanban`), cu iconițe + etichetă. Comutarea păstrează filtrele și sortarea active. Problema actuală: cele 3 vizualizări sunt funcționale dar nu „evidente". **Obiectivul tău: să se citească pâlnia dintr-o privire.**

### 3.0. Date disponibile per client (vocabularul comun celor 3 vizualizări)
- **Nume** client
- **Localitate**
- **Suprafață** (mp)
- **Steluță = prioritate pe CULOARE** — NU rating 1-2-3. Valori: **alb / roșu / portocaliu / albastru / verde**. Este un cod intern AMASS. Trateaz-o ca etichetă de prioritate/temperatură.
- **Nevoia** (text scurt — ce vrea clientul: pompă de căldură, PFTV etc.)
- **Schiță / Pre-ofertat / Ofertat** — date de etapă (când s-a întâmplat fiecare)
- **Stadiu** — poziția în pâlnie: `Intrare → T1 → Schiță → Pre-ofertat → Ofertat → Contractat`, plus stările laterale `Amânat / Finalizat / Anulat`
- **Ultimul Reminder** — data/textul ultimului follow-up programat
- **Audio** — are / nu are înregistrare audio atașată (flag boolean → iconiță)
- **Observații** — text liber
- **Vârstă în stadiu** — de câte zile stă dealul în stadiul curent fără mișcare (deal care „îmbătrânește" / rotting)

### 3.0.1. Reguli transversale pentru cei 3 indicatori vizuali (aplică-le identic în toate vizualizările)

1. **Steluța-culoare (prioritate):** un pastil/punct colorat **+ etichetă text** (ex. „Roșu", „Verde") sau iconiță distinctă per culoare. NICIODATĂ doar culoare — gândește daltonism + screen reader. Oferă și un mod color-blind (formă/iconiță suplimentară). Culoarea „alb" trebuie să rămână vizibilă (contur, nu doar fundal alb pe alb).
2. **Vârstă în stadiu (rotting):** canal vizual **separat** de prioritate. Propunere: chenar/accent pe marginea cardului-rând + **text explicit „X zile în stadiu"**. Pragul de „îmbătrânit" este **per-stadiu, nu global** (tolerezi 10 zile în „Ofertat" dar semnalezi după 2-3 zile în „Intrare"). Trei trepte: proaspăt (neutru) → atenție (chihlimbar) → întârziat (roșu semantic + iconiță, ex. clopoțel). Calculează vârsta din ultima mișcare reală, nu din data creării.
3. **Audio & Reminder:** iconițe mici cu stare (audio prezent = iconiță plină; reminder = iconiță cu data; reminder depășit = badge de atenție). Mereu cu tooltip/etichetă, nu doar iconiță mută.

> Regulă de aur transversală: **prioritatea (steluța-culoare)**, **stadiul** și **vârsta** sunt trei sisteme separate care NU trebuie să folosească același canal vizual. Dacă le amesteci, semnalul de urgență se pierde.

---

### 3.A. VIZUALIZAREA „CARDURI" (listă de card-rânduri aerisite)

**Obiectiv.** Răsfoire confortabilă, în special pe telefon. Agentul parcurge clienții lui de sus în jos și judecă instant „cine e fierbinte / ce urmează" fără să deschidă fișa.

**Ce pui în față (maxim 4-5 informații pe fața cardului — restricție deliberată):**
- **Linia 1 (cea mai mare/bold):** Numele clientului.
- **Colț dreapta-sus:** badge **Stadiu** (culoare de stadiu + etichetă) ȘI pastil **prioritate** (steluța-culoare). Distincte vizual.
- **Linia 2 (secundar):** Localitate · Suprafață (mp) · Nevoia (scurtată).
- **Linia 3 (muted):** „Ultimul reminder: 28 mai" SAU „Următoarea acțiune" + iconiță audio dacă există.
- **Semnal de vârstă:** bandă/accent pe muchia stângă a cardului + text „X zile în stadiu" (devine roșu+iconiță când e întârziat).

**Layout propus „mai intuitiv":**
- Card cu **fundal palid, umbră minimă, text aliniat la stânga, padding uniform și generos**. Gruparea ca unitate clicabilă (principiul „common regions").
- **Întreg cardul este tappable** → deschide fișa clientului (țintă mare, Fitts's Law).
- **Footer cu acțiuni rapide separate printr-un divider:** `Sună · Email · Notă · Mută stadiu`, fiecare buton ≥44-48px.
- Indicatorul de prioritate **scalează cu urgența**: un „roșu" (hot) e mai vizibil decât un „verde".

**Ierarhie vizuală (exemplu concret de card — folosește-l ca referință):**
```
┌─────────────────────────────────────────────┐
│ ▎ Ionescu Vasile              [Ofertat] ●Roșu │  ← nume bold + badge stadiu + pastil prioritate
│ ▎ Cluj-Napoca · 145 mp · Pompă căldură        │  ← secundar
│ ▎ Reminder: 28 mai · 🎧 audio                 │  ← muted + iconiță audio
│ ▎ ⚠ 12 zile în stadiu                          │  ← bandă stângă roșie = îmbătrânit (rotting)
│ ───────────────────────────────────────────  │
│   📞 Sună   ✉ Email   📝 Notă   ⇄ Mută         │  ← footer acțiuni, butoane ≥44px
└─────────────────────────────────────────────┘
   ▎ = banda colorată de vârstă pe muchia stângă
```

**Mobil.** Stivă verticală single-column. **Swipe** pentru acțiuni rapide (swipe stânga → Sună/Email; swipe dreapta → Mută stadiu / Arhivă). Țintele tactile minim 44×44, ~8px între ele. Doar info esențială vizibilă, restul prin tap pe card.

**Variante cerute:** (a) card „aerisit complet" cu footer de acțiuni mereu vizibil; (b) card „compact" cu acțiuni la hover (desktop) / swipe (mobil); (c) variantă cu mini-timeline a stadiilor în josul cardului.

---

### 3.B. VIZUALIZAREA „TABEL" (dens, ca-n spreadsheet, editabil inline)

**Obiectiv.** Putere și viteză pentru desktop. Managerul/adminul scanează și editează zeci de clienți rapid, ca într-un spreadsheet. **11 coloane.**

**Coloane (ordine propusă):**
1. **Nume** (sticky stânga) · 2. Localitate · 3. Suprafață (mp) · 4. **Prioritate** (steluța-culoare) · 5. Nevoia · 6. Schiță (dată) · 7. Pre-ofertat (dată) · 8. Ofertat (dată) · 9. **Stadiu** · 10. Ultimul Reminder · 11. **Vârstă în stadiu** (+ flag audio/observații ca iconițe).

**Layout propus „mai intuitiv" (aplică toate punctele):**
- **Prima coloană (Nume) sticky stânga** + **header sticky** la scroll. Fundal solid pe coloana înghețată ca să nu „dispară" ancora rândului.
- **Editare inline la nivel de celulă:** click pe celulă → editezi direct, fără pierdere de context. Hover schimbă cursorul/fundalul ca să semnaleze că e editabilă. **Confirmare pe Enter**, Esc anulează, checkmark/stare „salvat" vizibilă; eroare de validare = border roșu + mesaj inline pe celulă. Pentru câmpuri cu risc (schimbare stadiu, ștergere) → friction intenționat (popover de confirmare).
- **Separatoare de rând 1px gri-deschis**, NU zebra striping (tabelul are multe stări: hover, selectat, în editare — zebra ar crea haos).
- **Aliniere:** text la stânga; **numere/date/mp la dreapta cu cifre tabulare** (JetBrains Mono).
- **Stadiu = pill colorat** (fundal deschis + bordură + text contrast mare + iconiță), nu doar text. Prioritatea la fel (pastil + etichetă).
- **Vârstă în stadiu** = text „12 zile" care devine roșu + iconiță când depășește pragul per-stadiu.
- **Sortare din header** cu chevron clar + indicator vizibil al coloanei active. Default: „necesită acțiune / cel mai vechi în stadiu" sus.
- **Filtre sus**, iar filtrele active afișate ca **chips** care se scot individual.
- **Densitate reglabilă** (3 preset-uri: Condensat ~40px / Normal ~48px / Confortabil ~56px), salvată per utilizator.
- **Management coloane:** ascunde / reordonează / redimensionează (drag-handle la hover pe separator) + persistă preferințele + buton „Resetează la implicit".
- **Acțiuni:** checkbox-uri și butoane per-rând apar la hover; la selecție multiplă apare o **bară bulk** (Schimbă stadiu, Atribuie owner, Export, Șterge) ca footer sticky.
- **Navigare la tastatură** ca-n spreadsheet: săgeți între celule, Enter = editează, Esc = anulează (power-users).
- Expand rând → drawer lateral cu fișa completă a clientului.

**Exemplu de rând (referință de format):**
```
│ Ionescu Vasile │ Cluj-Napoca │   145 mp │ ●Roșu │ Pompă căldură │ 12.05 │ 19.05 │ 26.05 │ [Ofertat] │ 28.05 │ ⚠ 12 zile  🎧 📝 │
   (sticky, bold)    stânga       dreapta   pastil   stânga          dr.     dr.     dr.    pill        dr.     roșu+icon  flags
```

**Mobil.** **NU** replica tabelul cu scroll orizontal pe 11 coloane (frustrant, cost cognitiv mare). Regula: peste ~7 coloane unde comparația nu e scopul → pe mobil tabelul **degradează automat în carduri** (vezi 3.A). Dacă totuși oferi scroll orizontal undeva (ex. tabletă), păstrează prima coloană înghețată + indicatori clari de „mai sunt coloane" (margini tăiate/săgeți, nu puncte).

**Variante cerute:** (a) tabel Normal cu pills colorate; (b) variantă Condensat „spreadsheet pur"; (c) starea de editare inline a unei celule (cum arată celula în focus + salvare).

---

### 3.C. VIZUALIZAREA „KANBAN" (drag & drop pe stadii)

**Obiectiv.** Vedere de proces: unde se aglomerează pâlnia, ce e blocat, ce trebuie mișcat. Coloane = stadii.

**Coloane (fixe, puține, orientate pe proces):**
`Intrare → T1 → Schiță → Pre-ofertat → Ofertat → Contractat`
Stările laterale `Amânat / Finalizat / Anulat` — propune o zonă separată (ex. coloane „colapsate" la capăt sau o secțiune de jos), NU amestecate în fluxul principal.

**Layout propus „mai intuitiv":**
- **Header de coloană = mini-raport:** `Nume stadiu · N clienți · Σ suprafață(mp)` (sau Σ valoare dacă există). Asta transformă coloana într-un indicator scanabil de aglomerare. Dacă există praguri de tip „prea mulți blocați", afișează `curent/limită` și colorează headerul când se depășește (WIP-limit).
- **Culoarea de stadiu doar ca bară de accent** (top-ul coloanei / muchia cardului), NU inunda tot cardul — altfel semnalul roșu de „îmbătrânit" se pierde. Contrast WCAG, mod color-blind cu iconițe.
- **Sortare în interiorul coloanei inteligentă:** sus = „fierbinte sau în pericol" (vârstă mare / reminder depășit), apoi cele fără acțiune planificată, apoi restul. NU pur cronologic.

**Ce pui pe cardul de Kanban (compact, 4-5 info):**
- **Nume client** (titlu)
- **Prioritate** (pastil steluță-culoare) — distinctă de stadiu
- **Localitate · mp** (secundar)
- **Următoarea acțiune / ultimul reminder + dată**, cu badge `întârziat / azi / viitor`
- **Vârstă:** chenar/accent + „X zile" când îmbătrânește (rotting per-stadiu, dublu canal: culoare + text + iconiță)
- iconiță audio dacă există

**Card Kanban (referință):**
```
┌───────────────────────┐
│ Ionescu Vasile   ●Roșu │  ← nume + prioritate
│ Cluj · 145 mp          │  ← secundar
│ ⏰ Reminder 28.05 (azi)│  ← următoarea acțiune + badge
│ ⚠ 12 zile · 🎧         │  ← vârstă (rotting) + audio
└───────────────────────┘
  (muchie sus = culoarea stadiului)
```

**Drag & drop:**
- Microstări clare: idle → hover → grab → move → drop, cu **indicator de drop** (highlight pe coloana/poziția țintă, snap).
- **Obligatoriu alternativă fără mouse:** fiecare card are meniu **„Mută în stadiu…"** (pentru tastatură și touch). Pick-up cu Space/Enter, navigare cu săgeți, drop cu Space, cu anunț de confirmare (accesibilitate).

**Mobil.** Scroll orizontal pe coloane + **drag-handle dedicat mărit** (NU hold pe tot cardul — declanșează scroll accidental). Oferă **comutare board ↔ listă** și pe ecran mic fă **lista (carduri) default** când boardul devine ilizibil. Acțiunea „Mută în stadiu" prin meniu rămâne calea principală pe telefon.

**Variante cerute:** (a) Kanban desktop cu headere-raport + bare de accent de stadiu; (b) tratarea stărilor laterale Amânat/Finalizat/Anulat (zonă separată vs. coloane colapsate); (c) starea de drag activ (cum arată cardul ridicat + indicatorul de drop); (d) varianta mobilă cu handle de drag.

---

## 4. PANOUL „ASPECT APLICAȚIE" (personalizare în Setări)

**Obiectiv.** Un loc unde utilizatorul (mai ales adminul) reglează **aproape orice** din aspect, cu **previzualizare live** și fără să-și poată strica lizibilitatea. Construit pe **design tokens semantice** (variabile CSS), nu culori hardcodate — componentele consumă DOAR tokenii.

**Principiu de implementare pentru tine, designerul:** nu expune toți tokenii (utilizatorul se pierde). Expune câteva **controale „macro"** din care se derivă restul automat.

### Structura panoului „Aspect" (3 secțiuni)

**A. CULOARE**
- **Mod:** toggle `Light / Dark / System`.
- **Preset-uri brand:** 4-6 teme gata făcute (ex. „AMASS Implicit (roșu)", „Albastru corporativ", „Neutru cald", „Dark high-contrast"). Majoritatea userilor aleg un preset, nu picker liber.
- **Accent / brand:** UN color picker → din el derivi automat `accent-foreground`, hover, focus-ring și shade-uri. **Validare contrast WCAG live**: dacă alegerea pică sub 4.5:1 pe fundalul ei, **avertizezi / blochezi / autocorectezi** (nu lăsa userul să-și strice contrastul).
- **„Avansat" (pliabil):** culoare **buton secundar** (`secondary` / `secondary-foreground`) și **fundal/suprafață** (sau alegere light / neutru / cald). Textul de regulă NU e liber editabil — se derivă din fundal cu contrast garantat.

**B. FORMĂ**
- **Radius (rotunjire colțuri):** slider cu **5 trepte** (0 → 0.25 → 0.5 → 0.75 → 1rem). Un singur token din care derivi scala sm/md/lg/xl.
- **Densitate:** segmented `Compact / Normal / Confortabil` (afectează spacing + înălțimea rândului din tabel).

**C. TEXT** (vezi secțiunea 5 pentru detalii)
- **Mărime text:** segmented cu **5 trepte vizibile**.

### Controale expuse — tabel de referință
| Control în UI | Token(i) afectați | Tip input |
|---|---|---|
| Mod culoare | `.dark` / `:root` / auto | toggle Light/Dark/System |
| Accent/brand | `--accent` (+ auto `-foreground`, `--ring`, hover) | color picker + validare WCAG |
| Buton secundar | `--secondary` / `--secondary-foreground` | color picker (în „Avansat") |
| Fundal/suprafață | `--bg`, `--surface`/`--card` (derivat) | picker sau preset light/neutru/cald |
| Text | `--text`, `--muted` (derivat, contrast garantat) | de regulă derivat, NU liber |
| Borduri | `--border` | derivat din fundal |
| Radius | `--radius` (→ sm/md/lg/xl prin calc) | slider 5 trepte |
| Densitate | scala spacing + `--row-height` | segmented 3 opțiuni |
| Mărime text | multiplicator pe root font-size | segmented 5 trepte |

### Cerințe UX ale panoului
- **Previzualizare LIVE**: lângă controale, un panou-mostră care arată instant un card, un buton primar/secundar, un rând de tabel și un pill de stadiu — ca userul să vadă efectul fără să iasă din Setări.
- **Preset-uri + „Resetează la implicit"** mereu prezent.
- Persistă alegerile (per-cont sau localStorage) și aplică-le **înainte de prima vopsire** (fără flash de temă greșită / FOUC).
- Folosește **OKLCH** pentru valorile generate (derivare predictibilă de shade-uri + verificare contrast).

**Variante cerute:** (a) panoul „Aspect" pe desktop (controale stânga + previzualizare live dreapta); (b) același pe mobil (secțiuni colapsabile + previzualizare sticky sus); (c) starea de avertizare „contrast prea mic" pe color picker.

---

## 5. MĂRIMEA TEXTULUI care CHIAR SE VEDE

**Problema actuală:** „nu se întâmplă nimic special" când schimbi mărimea. Trebuie să fie un efect **evident** pe toată interfața.

**Cum trebuie să arate și să se comporte:**
- **Segmented control cu 5 trepte discrete și etichete clare** (NU slider liber): `Mic (0.875) · Normal (1.0) · Mare (1.125) · Foarte mare (1.25) · Maxim (1.5)`. Treptele 1.0→1.5+ acoperă cerința WCAG de mărire la 200%.
- Mecanismul: un **multiplicator pe root font-size** (`html { font-size: calc(100% * var(--ui-scale)) }`), iar TOATĂ interfața în `rem` → tot UI-ul (text, padding, înălțimi de rând, butoane) scalează proporțional și **vizibil** dintr-o singură manetă.
- **Previzualizare instantă**: la schimbarea treptei, mostra din panou (și aplicația din spate) crește/scade pe loc, ca utilizatorul să simtă diferența imediat.
- Treptele să fie suficient de distanțate ca saltul să fie perceptibil între ele (Normal → Mare trebuie să se VADĂ, nu doar 1px).
- Persistă alegerea și aplic-o inline la load (fără reflow vizibil).

**Reguli ca să nu se rupă layout-ul** (transmite-le în spec, contează la mockup):
- Containere flexibile (`min-height`, nu `height` fix); butoanele și rândurile cresc; fără `overflow:hidden` pe text.
- Media query-urile gândite în `em`, nu `px`, ca breakpoint-urile să reacționeze la mărirea fontului.
- NU schimba font-size pe breakpoint-uri de viewport.

> **Densitate + Mărime text** sunt cele două manete care „se văd" cel mai mult într-un webapp cu rânduri dense — arată-le clar și fă-le să conteze.

---

## 6. STRUCTURA SETĂRILOR (information architecture)

Setările trebuie **foarte bine grupate**, cu navigare laterală (desktop) / listă-acordeon (mobil). Grupuri, în această ordine:

1. **Aspect** — tot ce e în secțiunea 4 (Culoare / Formă / Text) + previzualizare live. *Cel mai vizibil grup, primul.*
2. **Credențiale CRM** — conectare la gestcom.ro (user/parolă/token), stare conexiune (verde „conectat" / roșu „eroare"), buton „Testează conexiunea".
3. **Limbă** — toggle RO / EN (+ eventual format dată/numere).
4. **Mărime** — dacă vrei, poate fi sub „Aspect → Text"; dar Radu a cerut-o explicit ca grup vizibil, deci expune-o clar (fie ca subsecțiune evidentă în Aspect, fie ca intrare separată „Mărime & densitate").
5. **Outlook** — integrare email/calendar (conectare cont, sync reminder-e/întâlniri).
6. **Import date** — încărcare din fișier/CRM (mapare coloane, preview, raport de import: câte rânduri OK / cu erori).
7. **Auto-sync** — sincronizare automată cu gestcom.ro: interval, on/off, „ultima sincronizare la HH:MM", buton „Sincronizează acum", jurnal scurt.

**Cerințe IA:**
- Fiecare grup = un titlu clar + descriere de o linie sub el.
- Stările de conexiune (CRM, Outlook, Auto-sync) afișate consistent: punct colorat + text + dată ultimei acțiuni.
- Acțiunile distructive/sensibile (deconectare CRM, import care suprascrie) cu confirmare.

**Variante cerute:** (a) Setări pe desktop (nav lateral stânga + conținut dreapta); (b) Setări pe mobil (listă de grupuri → ecran de detaliu per grup); (c) ecranul „Import date" cu pasul de mapare coloane + raport.

---

## 7. Reguli mobile + desktop

**Mobil (telefon) — agentul pe teren:**
- Default pe pagina Pâlnie = **Carduri** (lista). Kanbanul comută în listă când devine ilizibil; tabelul degradează în carduri.
- Ținte tactile ≥44×44px, ~8px spațiere; drag-handle dedicat (nu hold pe tot cardul).
- Acțiuni rapide prin **swipe** pe card (Sună / Email / Mută).
- Navigare jos sau hamburger; segmented `Carduri|Tabel|Kanban` accesibil cu degetul.
- Filtre/sortare într-un sheet de jos (bottom sheet), nu într-o bară strâmtă.

**Desktop — managerul/adminul:**
- Sidebar deschis (light), navigare clară între Dashboard / Pâlnie / Setări.
- Tabelul își arată toată puterea (editare inline, navigare tastatură, bulk, management coloane).
- Kanban cu drag & drop complet + headere-raport.
- Densitate „Normal/Condensat" utilă pe ecrane mari.

**Comun:** comutarea Carduri/Tabel/Kanban păstrează filtrele; preferințele (densitate, coloane, mărime text, temă) persistă per utilizator și pe ambele platforme.

---

## 8. DASHBOARD (context, pentru coerență vizuală)

Nu e focusul principal, dar generează-l coerent cu restul:
- **KPI-uri** sus (carduri-cifre cu JetBrains Mono): total clienți, rata de conversie, deal-uri active etc.
- **Pâlnie cu drop-off** vizualizată (funnel chart) — câți clienți pe fiecare stadiu + procent care „cade" între stadii.
- **Rata de conversie** între stadii.
- **„Steluțe roșii"** — listă/contor de clienți cu prioritate roșie (hot).
- **Carduri de urgență** — deal-uri îmbătrânite / reminder-e depășite, cu același limbaj vizual de „rotting" ca în pâlnie.

---

## 9. LIVRABILE CONCRETE cerute de la Claude Design

Te rog generează:

1. **Sistemul de design / tokens:** paletă light + dark (cu valorile accent, fundal, suprafață, text, muted, border, semantic status, culorile de stadiu, cele 5 culori de prioritate), scală tipografică (Montserrat/Inter/JetBrains Mono), scală de spacing, scală de radius. Toate ca **variabile CSS semantice**.
2. **Pagina Pâlnie — VIZUALIZAREA CARDURI:** 2-3 variante (desktop + mobil), cu exemplul de ierarhie din 3.A.
3. **Pagina Pâlnie — VIZUALIZAREA TABEL:** 2-3 variante (Normal / Condensat / stare de editare inline a unei celule), desktop; + cum degradează în carduri pe mobil.
4. **Pagina Pâlnie — VIZUALIZAREA KANBAN:** 2-3 variante (desktop cu headere-raport, tratarea stărilor laterale, starea de drag activ) + varianta mobilă cu handle.
5. **Bara de comutare a vizualizărilor + bara de filtre/sortare** (cu chips de filtre active), desktop + mobil.
6. **Panoul „Aspect Aplicație":** desktop (controale + previzualizare live) + mobil + starea de avertizare contrast.
7. **Demonstrația mărimii textului:** același ecran (ex. lista de carduri) la treptele Normal / Mare / Maxim, ca să se vadă efectul.
8. **Structura Setărilor:** ecranul-shell cu cele 7 grupuri (desktop nav lateral + mobil listă), + ecranul „Import date".
9. **Dashboard:** o variantă coerentă cu sistemul.
10. **Cei 3 indicatori transversali** prezentați izolat ca mini-spec vizual: pastil prioritate (5 culori + etichetă + mod color-blind), badge stadiu (toate stadiile), indicator vârstă/rotting (proaspăt/atenție/întârziat), iconițe audio + reminder (cu stările lor).

**Pentru fiecare ecran:** versiune light ȘI dark, desktop ȘI mobil. Respectă regulile de accesibilitate (contrast WCAG 4.5:1 text / 3:1 elemente non-text; niciun status doar pe culoare; ținte tactile 44px). Arată-mi variantele una lângă alta ca să pot alege.
