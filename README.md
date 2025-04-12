# Calendar Agenți - Sistem de Programări

## Descriere
Aplicație web pentru gestionarea programărilor agenților unei companii. Permite agenților să vizualizeze și să rezerve intervale orare pentru întâlniri, organizat pe echipe.

## Funcționalități
- Autentificare cu nume de agent și parolă
- Calendar cu 3 săptămâni (săptămâna curentă + 2 următoare)
- Intervale orare de 30 minute (9:30 - 16:00)
- Rezervări color-codate în funcție de agent
- Vizualizare doar a calendarului echipei proprii (excepție: utilizatorul Alin poate vedea toate calendarele)
- Actualizări în timp real folosind Firebase
- Afișare statistici pentru ziua următoare

## Cerințe tehnice
- Node.js (v14 sau mai recent)
- npm sau yarn
- Cont Firebase

## Configurare Firebase
1. Creează un proiect nou în [Firebase Console](https://console.firebase.google.com/)
2. Activează Firestore Database
3. Configurează regulile de securitate pentru Firestore
4. În setările proiectului, găsește configurația Web și înlocuiește datele din `src/firebase.js`

## Instalare
```bash
# Clonează repository-ul
git clone <repository-url>

# Intră în directorul proiectului
cd calendar-agenti

# Instalează dependențele
npm install

# Pornește serverul de dezvoltare
npm start
```

## Utilizare
1. Accesează aplicația în browser (implicit la `http://localhost:3000`)
2. Autentifică-te cu un nume de agent și parola corespunzătoare
3. Vizualizează calendarul și fă rezervări prin click pe sloturile disponibile
4. Anulează propriile rezervări prin click pe slot și confirmă în popup

## Date de autentificare
Fiecare agent are propriul nume și parolă, conform listei din `src/context/AuthContext.js`.

## Hostare
Pentru hostare permanentă, se poate folosi:
1. Firebase Hosting (recomandat întrucât deja folosim Firebase)
2. Glitch.com cu opțiune de "Always on" pentru a menține aplicația activă

## Licență
Acest proiect este proprietar și confidențial. 