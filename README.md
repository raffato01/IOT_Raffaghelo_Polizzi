# Smart Home IoT System

## Descrizione del progetto
Questo progetto è stato realizzato come parte del corso di **Internet of Things (IoT)** della **Laurea Magistrale in Computer Science - Università di Genova (UniGe)**.  
Il lavoro è stato svolto in gruppo da **Lucrezia Polizzi** e **Tommaso Raffaghello**.

Il sistema simula e gestisce un ambiente domestico intelligente, monitorando sensori, dispositivi e lo stato dell’utente attraverso Node-RED e un simulatore MQTT scritto in JavaScript.  
L’obiettivo è creare un ecosistema integrato che permetta di:
- Gestire automaticamente scenari di vita quotidiana (Relax, Studio, Notte, Film);
- Monitorare lo stato di stress e benessere dell’utente tramite dati simulati da un wearable;
- Controllare lo stato di porte, finestre e dispositivi;
- Visualizzare in tempo reale i dati su dashboard interattive.

---

## Componenti principali

### 1. Node-RED Flows (`flows_raffaghello_polizzi.json`)
Contiene la logica principale dell’automazione:
- Ricezione dei dati dai sensori (MQTT);
- Gestione di scenari e stati (Notte, Studio, Film, Relax);
- Calcolo dello stato di stress basato su parametri fisiologici simulati;
- Visualizzazione tramite dashboard con testi, gauge e grafici.

### 2. Simulatore MQTT (`SetupCreator.js`)
Script Node.js che:
- Simula sensori ambientali (temperatura, umidità, pressione, PIR, porte);
- Genera dati di salute (battito, stress, sonno, passi);
- Riproduce scenari quotidiani automatizzati;
- Comunica con Node-RED tramite MQTT;
- Fornisce un’interfaccia web locale per controllare la simulazione.

---

## Come eseguire il progetto

### Requisiti
- **Node.js** ≥ 18  
- **npm**  
- **Node-RED**  
- **Broker MQTT** (es. Mosquitto o `mqtt://localhost:1883`)

### Installazione
1. Clona o scarica il progetto:
   ```bash
   git clone https://github.com/tuo-repo/smarthome-iot.git
   cd smarthome-iot
   ```
2. Installa le dipendenze del simulatore:
   ```bash
   npm install
   ```
3. Avvia Node-RED e importa il file `flows_raffaghello_polizzi.json`.

4. Esegui il simulatore:
   ```bash
   node SetupCreator.js
   ```

5. Apri il browser su:
   ```
   http://localhost:3001
   ```
   per accedere al pannello di controllo del simulatore.

---

## Funzionalità principali
- **Scenari automatici**: gestione intelligente di luci, TV e musica in base al contesto.  
- **Monitoraggio benessere**: analisi del livello di stress con calcolo RMSSD e indicatori visivi.  
- **Controllo ambientale**: gestione automatica di temperatura e umidità per ogni stanza.  
- **Dashboard interattiva**: visualizzazione in tempo reale di tutti i sensori e degli scenari attivi.  

---

## Autori
- **Lucrezia Polizzi**  
- **Tommaso Raffaghello**

---

## Università
**Università degli Studi di Genova (UniGe)**  
Corso di Laurea Magistrale in **Computer Science**  
Insegnamento: **Internet of Things (IoT)**  
Anno Accademico: **2024 / 2025**
