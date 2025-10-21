#!/usr/bin/env node

'use strict';


const MQTT_URL  = process.env.MQTT_URL || 'mqtt://localhost:1883';
const HTTP_PORT = Number(process.env.PORT || 3001);
const USER      = process.env.USER_ID || 'user1';

const mqtt = require('mqtt');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const srv = http.createServer(app);
const io  = new Server(srv);

function log(...a){
  const line = a.join(' ');
  console.log(line);
  io.emit('log', line);
}
function pub(client, topic, payload, qos=1){
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, data, { qos }, () => log('[PUB]', topic, data));
}

const client = mqtt.connect(MQTT_URL, { clientId: 'sim-scenari-'+Math.random().toString(16).slice(2) });
client.on('connect', ()=>{
  log('[MQTT] connesso a', MQTT_URL);
  client.subscribe([
    'home/security/state',   
    'home/security/siren_cmd',
    'home/notify'
  ], ()=> log('[MQTT] subscribed: security/state, siren_cmd, notify'));
  bootstrap();
});
client.on('error', e => log('[MQTT] errore:', e.message));
client.on('message', (topic, message) => {
  const m = message.toString();
  if (topic.startsWith('home/security/') || topic === 'home/notify') {
    log('[SUB]', topic, m);
  }
});

const tDoor = {
  living:   `home/${USER}/sensors/door/living-room`,
  studio:   `home/${USER}/sensors/door/studio-door`,
  bedroom:  `home/${USER}/sensors/door/bedroom`,
  kitchen:  `home/${USER}/sensors/door/kitchen`,
  bath:     `home/${USER}/sensors/door/bath-door`
};
const tPir = {
  living:  `home/${USER}/sensors/pir/living-room`,
  kitchen: `home/${USER}/sensors/pir/kitchen`,
  bath:    `home/${USER}/sensors/pir/bath-room`,
  bedroom: `home/${USER}/sensors/pir/bedroom`,
  studio:  `home/${USER}/sensors/pir/studio`,
};
const tTv         = `home/${USER}/devices/tv`;
const tBand       = `home/${USER}/wellness/band`;           
const tUserStress = `home/health/${USER}/stress`;          
const tHealth     = `home/health/user`;                   

const tTemp = {
  living:  `home/${USER}/sensors/temperature/living-room`,
  studio:  `home/${USER}/sensors/temperature/studio`,
  bedroom: `home/${USER}/sensors/temperature/bedroom`,
  kitchen: `home/${USER}/sensors/temperature/kitchen`,
  bath:    `home/${USER}/sensors/temperature/bath-room`
};
const tHum = {
  living:  `home/${USER}/sensors/humidity/living-room`,
  studio:  `home/${USER}/sensors/humidity/studio`,
  bedroom: `home/${USER}/sensors/humidity/bedroom`,
  kitchen: `home/${USER}/sensors/humidity/kitchen`,
  bath:    `home/${USER}/sensors/humidity/bath-room`
};

const tWindow = {
  living:  `home/sensors/windows/living-room`,
  studio:  `home/sensors/windows/studio`,
  bedroom: `home/sensors/windows/bedroom`,
  kitchen: `home/sensors/windows/kitchen`,
  bath:    `home/sensors/windows/bath-room`
};

const tSec = {
  cmd:      'home/security/cmd',      
  state:    'home/security/state',   
  identity: 'home/entry/identity'     
};

const tSpkPower = {
  living:  `home/devices/speakers/living/cmd/power`,
  studio:  `home/devices/speakers/studio/cmd/power`,
  bedroom: `home/devices/speakers/bedroom/cmd/power`,
  kitchen: `home/devices/speakers/kitchen/cmd/power`,
  bath:    `home/devices/speakers/bath/cmd/power`
};

const scenarioTimers = new Set();
function scenarioLater(s, fn){
  const t=setTimeout(()=>{ scenarioTimers.delete(t); fn(); }, s*1000);
  scenarioTimers.add(t);
}
function clearScenarioTimers(){
  for (const t of scenarioTimers){ clearTimeout(t); clearInterval(t); }
  scenarioTimers.clear();
}
let healthStateTimer = null;
function clearHealthTimer(){ if (healthStateTimer){ clearTimeout(healthStateTimer); healthStateTimer = null; } }

function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
function pickWeighted(items){
  const sum = items.reduce((s,i)=>s+i.w,0);
  let r = Math.random()*sum;
  for (const i of items){ if ((r-=i.w) <= 0) return i.value; }
  return items[items.length-1].value;
}
function rrFromHr(hr, n=12){
  const base = 60000/Math.max(hr,1);
  let v = base + (Math.random()*40-20);
  return Array.from({length:n}, ()=>{ v = Math.max(300, v+(Math.random()*30-15)); return Math.round(v); });
}

function setPressure({living=0, studio=0, bedroom=0, kitchen=0}) {
  pub(client, `home/${USER}/sensors/pressure/living-room`, { value: living });
  pub(client, `home/${USER}/sensors/pressure/studio`,      { value: studio });
  pub(client, `home/${USER}/sensors/pressure/bedroom`,     { value: bedroom });
  pub(client, `home/${USER}/sensors/pressure/kitchen`,     { value: kitchen });
  log(`[PRESSURE] Living:${living} Studio:${studio} Bedroom:${bedroom} Kitchen:${kitchen}`);
}
function setDoor(where, state){
  if (!tDoor[where]) return log('[DOOR] stanza non valida:', where);
  const val = String(state).toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED';
  pub(client, tDoor[where], { state: val });
}
function setTv(on){ pub(client, tTv, { status: on ? 'on' : 'off' }); }
function setPir(where, motion){
  if (!tPir[where]) return log('[PIR] stanza non valida:', where);
  pub(client, tPir[where], { motion: !!motion });
}

function setWindow(where, state){
  if (!tWindow[where]) return log('[WINDOW] stanza non valida:', where);
  const val = String(state).toUpperCase() === 'OPEN' ? 'OPEN' : 'CLOSED';
  pub(client, tWindow[where], { state: val });
}

function pushBand(hr){ pub(client, tBand, { hr, rr_intervals: rrFromHr(hr) }); }
function pushUserStress(value){ pub(client, tUserStress, { value }); }
function pushHealth({steps, sleep, rest, stress}){
  const safe = { user: USER, steps, sleep, rest };
  if (typeof stress !== 'undefined') safe.stress = stress;
  pub(client, tHealth, safe);
}

function setSpeakerPower(where, on) {
  if (tSpkPower[where]) { pub(client, tSpkPower[where], on ? 'on' : 'off'); }
}
function setAllSpeakers(on) { Object.keys(tSpkPower).forEach(z => setSpeakerPower(z, on)); }


function setOccupancy(place, occupied){
  const p = occupied ? 750 : 0; 
  switch (place) {
    case 'sofa':   
      setPressure({ living: p });
      setPir('living', !!occupied);
      break;
    case 'chair':
      setPressure({ studio: p });
      setPir('studio', !!occupied);
      break;
    case 'bed':
      setPressure({ bedroom: p });
      break;
    default:
      log('[OCC] postazione non valida:', place);
  }
}

function armAway(){ pub(client, tSec.cmd, 'ARM_AWAY'); }
function armHome(){ pub(client, tSec.cmd, 'ARM_HOME'); }
function disarm(){  pub(client, tSec.cmd, 'DISARM');  }
function entryIdentity(who){ pub(client, tSec.identity, String(who||'unknown').toLowerCase()); }
function entryDoor(state){ setDoor('living', state); }
function entryPir(active){ setPir('living', !!active); }

const ROOMS = ['living','studio','bedroom','kitchen','bath'];

const T_BASE = { living: 22.0, studio: 23.0, bedroom: 21.0, kitchen: 24.0, bath: 23.0 };
const H_BASE = { living: 48,   studio: 45,   bedroom: 50,   kitchen: 55,   bath: 60   };
let thPhase = 0;

const envState = {};
ROOMS.forEach(r => envState[r] = { mode: 'auto', t: T_BASE[r], rh: H_BASE[r] });

function pushTH(where, tC, rh){
  if (tTemp[where]) pub(client, tTemp[where], { value: Number(tC.toFixed(1)), unit: 'C' });
  if (tHum[where])  pub(client, tHum[where],  { value: Math.round(rh),        unit: '%' });
}

function setEnvMode(room, mode){
  if (!envState[room]) return;
  envState[room].mode = (mode === 'manual') ? 'manual' : 'auto';
  log(`[ENV] ${room} mode -> ${envState[room].mode}`);
}
function setEnvManual(room, t, rh){
  if (!envState[room]) return;
  if (isFinite(t))  envState[room].t  = Number(t);
  if (isFinite(rh)) envState[room].rh = Number(rh);
  setEnvMode(room, 'manual');
  pushTH(room, envState[room].t, envState[room].rh);
}

let telemTicker=null;
const HEALTH_STATES = [
  { name: 'Riposo',           hrMean: 68,  hrJitter: 4,  stress: 20, restMean: 1.5, stepsRatePerMin: 0   },
  { name: 'Attivo leggero',   hrMean: 82,  hrJitter: 6,  stress: 35, restMean: 1.0, stepsRatePerMin: 90  },
  { name: 'Stressato',        hrMean: 94,  hrJitter: 9,  stress: 65, restMean: 0.6, stepsRatePerMin: 30  },
  { name: 'Molto stressato',  hrMean: 104, hrJitter: 12, stress: 85, restMean: 0.4, stepsRatePerMin: 0   },
];
let CURRENT_STATE = HEALTH_STATES[0];
let stepsToday = 0;

function scheduleNextHealthState(prev = CURRENT_STATE){
  let options;
  switch (prev.name) {
    case 'Riposo': options = [
      { w:45, value:HEALTH_STATES[0] }, { w:35, value:HEALTH_STATES[1] },
      { w:15, value:HEALTH_STATES[2] }, { w:5,  value:HEALTH_STATES[3] }
    ]; break;
    case 'Attivo leggero': options = [
      { w:25, value:HEALTH_STATES[0] }, { w:45, value:HEALTH_STATES[1] },
      { w:25, value:HEALTH_STATES[2] }, { w:5,  value:HEALTH_STATES[3] }
    ]; break;
    case 'Stressato': options = [
      { w:30, value:HEALTH_STATES[1] }, { w:40, value:HEALTH_STATES[2] },
      { w:20, value:HEALTH_STATES[0] }, { w:10, value:HEALTH_STATES[3] }
    ]; break;
    case 'Molto stressato': options = [
      { w:35, value:HEALTH_STATES[2] }, { w:40, value:HEALTH_STATES[1] },
      { w:20, value:HEALTH_STATES[0] }, { w:5,  value:HEALTH_STATES[3] }
    ]; break;
    default: options = [
      { w:40, value:HEALTH_STATES[0] }, { w:40, value:HEALTH_STATES[1] },
      { w:15, value:HEALTH_STATES[2] }, { w:5,  value:HEALTH_STATES[3] }
    ];
  }
  CURRENT_STATE = pickWeighted(options);
  const holdSec = randInt(45, 120);
  log('[HEALTH] Stato:', CURRENT_STATE.name, `(per ~${holdSec}s)`);
  clearHealthTimer();
  healthStateTimer = setTimeout(()=> scheduleNextHealthState(CURRENT_STATE), holdSec*1000);
}

function startTelemetry(){
  if (telemTicker) return;
  setPressure({});
  Object.keys(tDoor).forEach(k => setDoor(k,'CLOSED'));
  setTv(false);
  Object.keys(tPir).forEach(k => setPir(k, false));
  Object.keys(tWindow).forEach(k => setWindow(k,'CLOSED'));
  setAllSpeakers(false);

  scheduleNextHealthState(CURRENT_STATE);

  telemTicker = setInterval(()=>{
    const st = CURRENT_STATE;
    let hr = Math.round(st.hrMean + (Math.random()*2 - 1) * st.hrJitter);
    if (Math.random() < 0.03) hr += randInt(5, 12);
    const perTick = Math.round((st.stepsRatePerMin / 60) * 3); // tick=3s
    stepsToday += perTick + (perTick ? randInt(0,2) : 0);
    const sleep  = [5.5,6.5,7.2,8.0,9.0][Math.floor(Math.random()*5)];
    const rest   = Math.max(0, +(st.restMean + (Math.random()*0.3-0.15)).toFixed(1));
    const stress = st.stress + randInt(-3, 3);
    pushBand(hr);
    pushHealth({steps: stepsToday, sleep, rest, stress});
    pushUserStress(stress);

    thPhase += 0.12;
    ROOMS.forEach((r, i)=>{
      if (envState[r].mode === 'manual'){
        pushTH(r, envState[r].t, envState[r].rh);
      } else {
        const t  = T_BASE[r] + Math.sin(thPhase + i)*0.3 + (Math.random()*0.2 - 0.1);
        let   rh = H_BASE[r] + Math.sin(thPhase*0.7 + i)*3 + (Math.random()*3 - 1.5);
        rh = Math.max(30, Math.min(75, rh));
        envState[r].t  = t;
        envState[r].rh = rh;
        pushTH(r, t, rh);
      }
    });
  }, 3000);
  log('[TELEM] avviata');
}
function stopTelemetry(){
  if (telemTicker){ clearInterval(telemTicker); telemTicker=null; log('[TELEM] stoppata'); }
  clearHealthTimer();
}

function scenarioNotte(){
  clearScenarioTimers();
  log('[SCENARIO] Notte – inizio');
  scenarioLater(1, ()=> setDoor('bedroom','OPEN'));
  scenarioLater(2, ()=>{ setPressure({ bedroom: 800 }); setPir('bedroom', true); });
  
  scenarioLater(10,()=> setPressure({}));
  scenarioLater(11,()=> log('[SCENARIO] Notte – fine'));
}
function scenarioFilm(){
  clearScenarioTimers();
  log('[SCENARIO] Film – inizio');
  scenarioLater(1, ()=> setPir('living', true));
  scenarioLater(2, ()=>{ setPressure({ living: 600 }); setTv(true); });
  scenarioLater(30,()=> setTv(false));
  scenarioLater(34,()=> setPressure({}));
  scenarioLater(34,()=> setPir('living', false));
  scenarioLater(34,()=> log('[SCENARIO] Film – fine'));
}
function scenarioStudio(){
  clearScenarioTimers();
  log('[SCENARIO] Studio – inizio');
  scenarioLater(1, ()=> { setDoor('studio','OPEN'); setDoor('studio','CLOSED'); });
  scenarioLater(2, ()=> setPir('studio', true));
  scenarioLater(2, ()=> setPressure({ studio: 600 }));
  scenarioLater(21,()=> setPressure({}));
  scenarioLater(21,()=> { setDoor('studio','OPEN'); setDoor('studio','CLOSED'); });
  scenarioLater(22,()=> setPir('studio', false));
  scenarioLater(23,()=> log('[SCENARIO] Studio – fine'));
}
function stopScenari(){ clearScenarioTimers(); setPressure({}); log('[SCENARIO] stoppati'); }


function scenarioRelax(){
  clearScenarioTimers();
  log('[SCENARIO] Relax – inizio');
  CURRENT_STATE = HEALTH_STATES[3];
  clearHealthTimer();
  log('[HEALTH] Stato forzato:', CURRENT_STATE.name);
  healthStateTimer = setTimeout(()=> scheduleNextHealthState(CURRENT_STATE), 30*1000);
  setOccupancy('sofa', true);
  scenarioLater(31, ()=> {setOccupancy('sofa', false); log('[SCENARIO] Relax – fine');});
}

function scenarioEntry(who){
  clearScenarioTimers();
  log('[SCENARIO] Entrata', who || '(senza identità)');
  scenarioLater(0, ()=> { entryDoor('OPEN'); entryPir(true); });
  if (who) scenarioLater(2, ()=> entryIdentity(who));
  scenarioLater(2, ()=> { entryDoor('CLOSED'); });
  scenarioLater(3, ()=> log('[SCENARIO] Entrata – fine (attendi esito FSM)'));
}
function scenarioExitOk(){
  clearScenarioTimers();
  log('[SCENARIO] Uscita (OK) — inizio');
  scenarioLater(1, ()=>{ entryDoor('OPEN'); });
  scenarioLater(3, ()=>{ entryDoor('CLOSED'); });
  scenarioLater(5, ()=>{ Object.keys(tPir).forEach(k => setPir(k, false)); });
  scenarioLater(6, ()=>{ armAway(); });
  scenarioLater(7,()=> log('[SCENARIO] Uscita (OK) — armato.'));
  scenarioLater(10,()=> log('[SCENARIO] Uscita (OK) — fine'));
}

function bootstrap(){ startTelemetry(); }

app.get('/', (_,res)=>{
  res.setHeader('content-type','text/html; charset=utf-8');
  res.end(`<!doctype html>
  <meta charset="utf-8"/>
  <title>Simulatore Casa & Antifurto</title>
  <style>
    :root{ --bg:#0b1020; --card:#121938; --line:#22315c; --txt:#e9eefb; --mut:#9fb2e8 }
    *{ box-sizing:border-box } body{background:var(--bg);color:var(--txt);font:14px system-ui;margin:0}
    main{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px}
    .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
    button{padding:8px 12px;border-radius:8px;border:1px solid var(--line);background:#1a2550;color:var(--txt);cursor:pointer;margin:4px 6px}
    button:active{transform:translateY(1px)}
    .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .mut{color:var(--mut)} .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
    input[type=number],select{background:#0e1533;border:1px solid var(--line);color:var(--txt);padding:6px;border-radius:6px;width:100%}
    .small{font-size:12px}
  </style>
  <main>
    <section class="card">
      <h3>Scenarios</h3>
      <div class="row">
        <button onclick="emit('sc:night')">Night</button>
        <button onclick="emit('sc:film')">Movie</button>
        <button onclick="emit('sc:studio')">Study</button>
        <button onclick="emit('sc:relax')">Relax</button>
        <button onclick="emit('sc:stop')">Stop scenarios</button>
      </div>
      <h3>Alarm</h3>
      <div class="row">
        <button onclick="emit('sec:arm_away')">ARM_AWAY</button>
        <button onclick="emit('sec:arm_home')">ARM_HOME</button>
        <button onclick="emit('sec:disarm')">DISARM</button>
      </div>
      <div class="row">
        <button onclick="emit('sc:entry:user1')">Entry user1</button>
        <button onclick="emit('sc:entry:guest')">Entry guest</button>
        <button onclick="emit('sc:entry:unknown')">Entry unknown</button>
        <button onclick="emit('sc:exit:ok')">Exit OK</button>
      </div>
    </section>

    <section class="card">
      <h3>Telemetry & Actuators</h3>
      <div class="row">
        <button onclick="emit('t:on')">Start Telemetry</button>
        <button onclick="emit('t:off')">Stop Telemetry</button>
        <button onclick="emit('tv:on')">TV ON</button>
        <button onclick="emit('tv:off')">TV OFF</button>
        <button onclick="emit('spk:all:off')">Speakers OFF (all)</button>
      </div>
      <div class="row small mut">Log:</div>
      <pre id="log" style="white-space:pre-wrap;max-height:180px;overflow:auto;border-top:1px solid var(--line);padding-top:6px"></pre>
    </section>

   <section class="card">
  <h3>Manual Control Doors / Windows / PIR</h3>
  <!-- 6 columns: Room | Door | Window | PIR | Speaker | TV -->
  <div class="grid" style="grid-template-columns:repeat(6,1fr)">
    <div><b>Room</b></div>
    <div><b>Door</b></div>
    <div><b>Window</b></div>
    <div><b>PIR</b></div>
    <div><b>Speaker</b></div>
    <div><b>TV</b></div>

    ${ROOMS.map(r=>`
    <div>${r}</div>
    <div>
      <select onchange="emit('door:set',{room:'${r}',state:this.value})">
        <option>—</option>
        <option value="OPEN">OPEN</option>
        <option value="CLOSED">CLOSED</option>
      </select>
    </div>
    <div>
      <select onchange="emit('window:set',{room:'${r}',state:this.value})">
        <option>—</option>
        <option value="OPEN">OPEN</option>
        <option value="CLOSED">CLOSED</option>
      </select>
    </div>
    <div>
      <select onchange="emit('pir:set',{room:'${r}',motion:this.value==='true'})">
        <option>—</option>
        <option value="true">motion true</option>
        <option value="false">motion false</option>
      </select>
    </div>
    <div>
      <select onchange="emit('spk:set',{room:'${r}',on:this.value==='on'})">
        <option>—</option>
        <option value="on">ON</option>
        <option value="off">OFF</option>
      </select>
    </div>
    <div>
      ${r==='living'
        ? `<select onchange="emit(this.value==='on'?'tv:on':'tv:off')">
             <option>—</option>
             <option value="on">ON</option>
             <option value="off">OFF</option>
           </select>`
        : '<span class="mut">n/a</span>'}
    </div>
    `).join('')}
  </div>
</section>

    <section class="card">
      <h3>Occupazione (Divano / Sedia Studio / Letto)</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div><b>Postazione</b></div>
        <div><b>Stato</b></div>
        <div><b>Ultimo comando</b></div>
        <div></div>
        <div>Divano (living)</div>
        <div>
          <select onchange="emit('occ:set',{place:'sofa',occupied:this.value==='on'})">
            <option>—</option><option value="on">Occupato</option><option value="off">Libero</option>
          </select>
        </div><div class="mut small">pressione living</div><div></div>
        <div>Sedia (studio)</div>
        <div>
          <select onchange="emit('occ:set',{place:'chair',occupied:this.value==='on'})">
            <option>—</option><option value="on">Occupato</option><option value="off">Libero</option>
          </select>
        </div><div class="mut small">pressione studio</div><div></div>
        <div>Letto (bedroom)</div>
        <div>
          <select onchange="emit('occ:set',{place:'bed',occupied:this.value==='on'})">
            <option>—</option><option value="on">Occupato</option><option value="off">Libero</option>
          </select>
        </div><div class="mut small">pressione bedroom</div><div></div>
      </div>
    </section>

    <section class="card">
      <h3> Temperature / Humidity (Auto/Manual)</h3>
      <div class="grid">
        <div><b>Stanza</b></div><div><b>Modo</b></div><div><b>T (°C)</b></div><div><b>RH (%)</b></div><div></div>
        ${ROOMS.map(r=>`
        <div>${r}</div>
        <div>
          <select id="m-${r}" onchange="emit('th:mode',{room:'${r}',mode:this.value})">
            <option value="auto" selected>Auto</option>
            <option value="manual">Manuale</option>
          </select>
        </div>
        <div><input id="t-${r}" type="number" step="0.1" value="${T_BASE[r].toFixed(1)}"></div>
        <div><input id="h-${r}" type="number" step="1"   value="${H_BASE[r]}"></div>
        <div><button onclick="sendTH('${r}')">Send</button></div>
        `).join('')}
      </div>
    </section>
  </main>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const s = io();
    s.on('connect', ()=> append('[UI] connesso'));
    s.on('log', line => append(line));
    function append(line){
      const el = document.getElementById('log');
      if (!el) return;
      el.textContent = (el.textContent + '\\n' + line).trim().slice(-5000);
      el.scrollTop = el.scrollHeight;
    }
    function emit(ev, data){ s.emit('cmd', { ev, data }); }
    function sendTH(room){
      const t = parseFloat(document.getElementById('t-'+room).value);
      const h = parseInt(document.getElementById('h-'+room).value,10);
      emit('th:set',{ room, t, rh:h });
    }
  </script>
  `);
});


io.on('connection', (socket)=>{
  socket.on('cmd', ({ev, data})=>{

    if (ev==='sc:entry:user1')   scenarioEntry('user1');
    else if (ev==='sc:entry:guest')   scenarioEntry('guest');
    else if (ev==='sc:entry:unknown') scenarioEntry('unknown');

    else if (ev==='sc:exit:ok')       scenarioExitOk();


    else if (ev==='sc:night')  scenarioNotte();
    else if (ev==='sc:film')   scenarioFilm();
    else if (ev==='sc:studio') scenarioStudio();
    else if (ev==='sc:relax')  scenarioRelax();
    else if (ev==='sc:stop')   stopScenari();


    else if (ev==='sec:arm_away') armAway();
    else if (ev==='sec:arm_home') armHome();
    else if (ev==='sec:disarm')   disarm();


    else if (ev==='t:on')  startTelemetry();
    else if (ev==='t:off') stopTelemetry();

 
    else if (ev==='tv:on') setTv(true);
    else if (ev==='tv:off') setTv(false);
    else if (ev==='spk:set')         setSpeakerPower(data?.room, !!data?.on);
    else if (ev==='spk:all:off')     setAllSpeakers(false);


    else if (ev==='door:set') setDoor(data?.room, data?.state);
    else if (ev==='pir:set')  setPir(data?.room,  !!data?.motion);
    else if (ev==='window:set') setWindow(data?.room, data?.state);


    else if (ev==='th:mode')  setEnvMode(data?.room, data?.mode);
    else if (ev==='th:set')   setEnvManual(data?.room, Number(data?.t), Number(data?.rh));


    else if (ev==='occ:set')  setOccupancy(String(data?.place), !!data?.occupied);

    else log('[UI] comando sconosciuto:', ev);
  });
});

srv.listen(HTTP_PORT, ()=> log('[HTTP] dashboard su http://localhost:'+HTTP_PORT));
