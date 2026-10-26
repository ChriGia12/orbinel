// Orbinel Motion con Kheiron, il braccio a 6 assi: simulazione, comando del robot, pose e sequenze, servo, impostazioni.
// Analisi (js/analisi.js) e lezioni (js/lezioni.js) ricevono ogni posa dall'evento «motion:posa».
'use strict';

const $ = id => document.getElementById(id);
const PASSI_GRADO = 4096 / 360;

// --- Stato ---
const salvato = chiave => { try { return JSON.parse(localStorage.getItem('orbinel.kheiron.' + chiave)); } catch { return null; } };
const salva = (chiave, v) => { try { localStorage.setItem('orbinel.kheiron.' + chiave, JSON.stringify(v)); } catch {} };

let imp = Object.assign(impostazioniIniziali(), salvato('impostazioni') || {});
let pose = salvato('pose') || [];
let sequenza = salvato('sequenza') || [];
const stato = {
  q: imp.riposo.slice(), pinza: imp.pinzaRiposo,
  reale: {},                 // id -> ultimo stato letto
  segui: false, coppia: null, scia: false,
  inEsecuzione: false, annulla: false, occupato: false,
  ultimoInvio: 0, invioInAttesa: null,
};
const bus = new Bus();
let scena;

function avviso(testo, ms = 3500) {
  const a = $('avviso');
  a.textContent = testo;
  a.classList.add('visibile');
  clearTimeout(avviso.t);
  avviso.t = setTimeout(() => a.classList.remove('visibile'), ms);
}

// --- Conversioni giunto <-> servo ---
function idUsati() {
  const ids = [];
  imp.giunti.forEach(g => g.servo.forEach(s => s.id && ids.push(s.id)));
  if (imp.pinza.id) ids.push(imp.pinza.id);
  return ids;
}
function giuntoDiServo(id) {
  for (let i = 0; i < imp.giunti.length; i++) if (imp.giunti[i].servo.some(s => s.id === id)) return ROBOT.giunti[i].nome;
  return id === imp.pinza.id ? 'Pinza' : '—';
}
const gradiAPassi = (s, gradi) => s.centro + s.verso * gradi * PASSI_GRADO;
const passiAGradi = (s, passi) => (passi - s.centro) / (s.verso * PASSI_GRADO);
const mmAPassi = mm => imp.pinza.chiusa + (imp.pinza.aperta - imp.pinza.chiusa) * mm / ROBOT.pinza.corsa;
const passiAMm = p => (p - imp.pinza.chiusa) / (imp.pinza.aperta - imp.pinza.chiusa) * ROBOT.pinza.corsa;

// posa reale letta dai servo (null se manca qualche servo)
function posaReale() {
  const q = imp.giunti.map(g => {
    const s = g.servo[0], r = stato.reale[s.id];
    return r ? passiAGradi(s, r.posizione) : null;
  });
  if (q.some(v => v === null)) return null;
  const rp = stato.reale[imp.pinza.id];
  return { q, pinza: rp ? passiAMm(rp.posizione) : stato.pinza };
}

// --- Invio al robot ---
function puoMuovere() {
  return bus.collegato && !(bus.modo === 'ponte' && bus.arresto) && stato.coppia !== false;
}

// porta il robot su (q, pinza) in `durata` secondi, o alla velocità massima se durata manca
function inviaAlRobot(q, pinza, durata) {
  if (!puoMuovere()) return;
  const prima = posaReale() || { q: stato.q, pinza: stato.pinza };
  const delta = q.map((v, i) => Math.abs(v - prima.q[i]));
  const t = durata || Math.max(0.15, Math.max(...delta) / imp.velocita);
  const obiettivi = [];
  imp.giunti.forEach((g, i) => {
    const v = Math.max(g.min, Math.min(g.max, q[i]));
    g.servo.forEach(s => {
      if (!s.id) return;
      obiettivi.push({ id: s.id, posizione: gradiAPassi(s, v), velocita: Math.max(20, delta[i] / t * PASSI_GRADO) });
    });
  });
  // con un utensile diverso dalla pinza il suo servo non c'è (utensili.js)
  if (imp.pinza.id && (typeof utensili === 'undefined' || utensili.pinza)) {
    const dp = Math.abs(mmAPassi(pinza) - mmAPassi(prima.pinza));
    obiettivi.push({ id: imp.pinza.id, posizione: mmAPassi(pinza), velocita: Math.max(50, dp / t) });
  }
  bus.muovi(obiettivi);
}

// con "segue" attivo, al massimo 20 invii al secondo
function seguiSimulazione() {
  if (!stato.segui) return;
  const ora = performance.now();
  clearTimeout(stato.invioInAttesa);
  if (ora - stato.ultimoInvio > 50) { stato.ultimoInvio = ora; inviaAlRobot(stato.q, stato.pinza); }
  else stato.invioInAttesa = setTimeout(seguiSimulazione, 55);
}

async function ferma() {
  stato.annulla = true;
  impostaSegui(false);
  if (!bus.collegato) return;
  const obiettivi = [];
  for (const id of idUsati()) {
    const r = stato.reale[id] || await bus.stato(id);
    if (r) obiettivi.push({ id, posizione: r.posizione, velocita: 3000 });
  }
  await bus.muovi(obiettivi);
  avviso('Fermato: ogni servo tiene la posizione in cui era');
}

// --- Simulazione ---
function aggiorna(daIk = false) {
  scena?.posa(stato.q, stato.pinza);
  const fk = diretta(stato.q);
  const problemi = controlla(stato.q, imp.giunti);
  scena?.segnala(problemi.length > 0);
  $('avvisi').innerHTML = problemi.map(p => `<div>⚠ ${p}</div>`).join('');
  $('posizionePinza').textContent = `Pinza: X ${fk.tcp[0].toFixed(0)}  Y ${fk.tcp[1].toFixed(0)}  Z ${fk.tcp[2].toFixed(0)} mm`;
  if (stato.scia) scena?.aggiungiScia(fk.tcp);
  stato.q.forEach((v, i) => {
    $('r' + i).value = v.toFixed(1);
    $('n' + i).value = v.toFixed(1);
  });
  $('pinza').value = stato.pinza; $('pinzaNum').value = stato.pinza.toFixed(1);
  if (!daIk) {
    const inc = Math.asin(Math.max(-1, Math.min(1, M.t(fk.R)[0][2]))) / RAD;
    $('ikX').value = fk.tcp[0].toFixed(0); $('ikY').value = fk.tcp[1].toFixed(0); $('ikZ').value = fk.tcp[2].toFixed(0);
    $('ikInc').value = inc.toFixed(0);
  }
  if (problemi.length === 0) seguiSimulazione();
  document.dispatchEvent(new CustomEvent('motion:posa', { detail: { q: stato.q.slice(), pinza: stato.pinza, fk, problemi } }));
}

function impostaPosa(q, pinza) {
  stato.q = q.slice();
  if (pinza !== undefined) stato.pinza = pinza;
  aggiorna();
}

function costruisciGiunti() {
  $('giunti').innerHTML = ROBOT.giunti.map((g, i) => `
    <div class="giunto">
      <label for="r${i}">${g.nome}</label>
      <input type="range" id="r${i}" min="${imp.giunti[i].min}" max="${imp.giunti[i].max}" step="0.5">
      <input type="number" id="n${i}" min="${imp.giunti[i].min}" max="${imp.giunti[i].max}" step="1">
      <span class="reale num" id="reale${i}"></span>
    </div>`).join('');
  ROBOT.giunti.forEach((g, i) => {
    $('r' + i).addEventListener('input', e => { stato.q[i] = +e.target.value; aggiorna(); });
    $('n' + i).addEventListener('change', e => {
      stato.q[i] = Math.max(imp.giunti[i].min, Math.min(imp.giunti[i].max, +e.target.value || 0));
      aggiorna();
    });
  });
}

function vaiIk() {
  const p = [+$('ikX').value, +$('ikY').value, +$('ikZ').value];
  const R = orientamento(p, +$('ikInc').value, +$('ikRot').value, stato.q[0]);
  const r = inversa(p, R, stato.q, imp.giunti);
  document.dispatchEvent(new CustomEvent('motion:ik', { detail: { bersaglio: p, errore: r.errore || null } }));
  if (r.errore) { $('esitoIk').textContent = '✗ ' + r.errore; scena?.mostraBersaglio(p); return false; }
  const problemi = controlla(r.q, imp.giunti);
  $('esitoIk').textContent = problemi.length ? '⚠ Raggiungibile, ma: ' + problemi.join('; ') : '✓ Raggiungibile';
  scena?.mostraBersaglio(p);
  if (problemi.length && stato.segui) { avviso('Posa non sicura: il robot vero non si muove'); }
  stato.q = r.q;
  aggiorna(true);
  return true;
}

// Porta la pinza nel punto p con l'orientamento che serve: l'inclinazione dei campi e poi tutte le altre
// da −90° a +90° (ogni 5°). Tra le pose valide (limiti, tavolo, base) vince la più vicina a quella attuale,
// con una piccola preferenza per l'inclinazione già scelta. Ritorna { q, inc } o null.
const PORTATA = ROBOT.a2 + ROBOT.d4;
function posaVerso(p) {
  const tcp = V.norm(V.sub(ROBOT.tcp, ROBOT.polso));
  if (V.norm(V.sub(p, [0, 0, ROBOT.d1])) > PORTATA + tcp + 1) return null;
  const inc0 = +$('ikInc').value, rot = +$('ikRot').value;
  let migliore = null, costo = Infinity;
  for (const inc of [inc0, ...Array.from({ length: 37 }, (_, k) => -90 + 5 * k)]) {
    const r = inversa(p, orientamento(p, inc, rot, stato.q[0]), stato.q, imp.giunti);
    if (r.errore || controlla(r.q, imp.giunti).length) continue;
    const k = r.q.reduce((t, v, i) => t + Math.abs(v - stato.q[i]), 0) + Math.abs(inc - inc0) * 0.5;
    if (k < costo) { costo = k; migliore = { q: r.q, inc }; }
  }
  return migliore;
}

// Dal clic al punto: oggetto, punto della nuvola o tavolo (20 mm sopra il piano, sotto la pinza lo
// tocca); clic nel vuoto: il primo punto raggiungibile lungo la linea del clic. Mai oltre lo spazio di lavoro.
const QUOTA_TAVOLO = 20;
function puntoDalClic(s) {
  if (s.punto) {
    const p = s.tipo === 'piano' ? [s.punto[0], s.punto[1], QUOTA_TAVOLO] : s.punto;
    return { p, posa: posaVerso(p) };
  }
  for (let t = 0; t < 4000; t += 5) {
    const p = V.add(s.origine, V.scale(s.direzione, t));
    if (p[2] < QUOTA_TAVOLO) break;
    const posa = posaVerso(p);
    if (posa) return { p, posa };
  }
  return { p: null, posa: null };
}

function suPunto(s, anteprima) {
  if (!s) { scena.mostraBersaglio(null); return; }
  const { p, posa } = puntoDalClic(s);
  scena.mostraBersaglio(p, !!posa);
  if (anteprima) return;
  if (!posa) {
    document.dispatchEvent(new CustomEvent('motion:ik', { detail: { bersaglio: p, errore: 'fuori dallo spazio di lavoro' } }));
    $('esitoIk').textContent = '✗ Fuori dallo spazio di lavoro: la pinza non ci arriva senza urtare o superare i limiti';
    return;
  }
  $('ikX').value = p[0].toFixed(0); $('ikY').value = p[1].toFixed(0); $('ikZ').value = p[2].toFixed(0);
  $('ikInc').value = posa.inc.toFixed(0);
  document.dispatchEvent(new CustomEvent('motion:ik', { detail: { bersaglio: p, errore: null } }));
  $('esitoIk').textContent = `✓ Raggiungibile · inclinazione ${posa.inc.toFixed(0)}°`;
  stato.q = posa.q;
  aggiorna(true);
}

function costruisciJog() {
  const tasti = [['X', 0, -1], ['X', 0, 1], ['Y', 1, -1], ['Y', 1, 1], ['Z', 2, -1], ['Z', 2, 1]];
  $('jog').innerHTML = tasti.map(([n, , s], k) => `<button class="piccolo" data-k="${k}">${s > 0 ? '+' : '−'}${n}</button>`).join('');
  $('jog').addEventListener('click', e => {
    const k = e.target.dataset.k;
    if (k === undefined) return;
    const [, asse, segno] = tasti[k];
    const campo = ['ikX', 'ikY', 'ikZ'][asse];
    $(campo).value = +$(campo).value + segno * +$('passoJog').value;
    vaiIk();
  });
}

// --- Collegamento ---
function aggiornaCollegamento() {
  const c = bus.collegato;
  $('pallino').classList.toggle('on', c);
  $('testoCollegamento').textContent = !c ? 'Non collegato'
    : bus.modo === 'ponte' ? 'Collegato tramite ESP32' : 'Collegato all\'adattatore (USB diretta)';
  $('btnCollega').hidden = c; $('btnScollega').hidden = !c;
  ['segui', 'btnCopiaReale', 'btnCoppia', 'btnCerca', 'btnCoppiaOff', 'btnSalvaZero', 'btnCoppiaOn',
   'btnPinzaChiusa', 'btnPinzaAperta', 'btnCambiaId', 'btnSalvaPosaReale'].forEach(id => { $(id).disabled = !c; });
  $('notaSegui').textContent = !c ? 'Collega la schedina per muovere il robot vero. Senza, muovi solo la simulazione.'
    : bus.modo === 'diretto' ? 'Attenzione: con la USB diretta all\'adattatore il fungo non è attivo. Usa il tasto FERMA o Esc.'
    : 'Con l\'interruttore acceso, ogni movimento della simulazione arriva al robot.';
  aggiornaArresto();
  if (!c) { impostaSegui(false); stato.reale = {}; stato.coppia = null; aggiornaCoppia(); mostraReali(); }
}

function aggiornaArresto() {
  const chip = $('chipArresto');
  if (!bus.collegato) { chip.className = 'chip nd'; chip.textContent = 'FUNGO: —'; return; }
  if (bus.modo === 'diretto') { chip.className = 'chip nd'; chip.textContent = 'FUNGO: non attivo'; return; }
  if (bus.arresto) { chip.className = 'chip stop'; chip.textContent = 'FUNGO PREMUTO · servo fermi'; }
  else { chip.className = 'chip ok'; chip.textContent = 'FUNGO: OK'; }
}

function impostaSegui(v) {
  stato.segui = v;
  $('segui').checked = v;
}

function aggiornaCoppia() {
  $('btnCoppia').textContent = stato.coppia === null ? 'Coppia: —' : stato.coppia ? 'Coppia: accesa' : 'Coppia: spenta';
}

// lettura continua dello stato dei servo
async function ciclo() {
  while (true) {
    if (bus.collegato && !stato.occupato) {
      for (const id of [...new Set([...idUsati(), ...(stato.extra || [])])]) {
        if (!bus.collegato || stato.occupato) break;
        const r = await bus.stato(id);
        if (r) stato.reale[id] = r; else delete stato.reale[id];
      }
      mostraReali();
      // con la coppia spenta la simulazione segue il braccio mosso a mano
      if (stato.coppia === false) {
        const pr = posaReale();
        if (pr) { stato.q = pr.q; stato.pinza = Math.max(0, Math.min(20, pr.pinza)); aggiorna(); }
      }
    }
    await pausa(bus.collegato ? 120 : 400);
  }
}

function mostraReali() {
  imp.giunti.forEach((g, i) => {
    const r = stato.reale[g.servo[0].id];
    $('reale' + i).textContent = r ? `robot: ${passiAGradi(g.servo[0], r.posizione).toFixed(1)}°` : '';
  });
  const rp = stato.reale[imp.pinza.id];
  $('pinzaReale').textContent = rp ? `robot: ${passiAMm(rp.posizione).toFixed(1)} mm` : '';
  // tabella della sezione Servo
  const righe = Object.entries(stato.reale).sort((a, b) => a[0] - b[0]).map(([id, r]) => {
    id = +id;
    const g = imp.giunti.find(g => g.servo.some(s => s.id === id));
    const s = g?.servo.find(s => s.id === id);
    const caldo = r.temperatura >= 60 ? ' style="color:var(--stop)"' : '';
    return `<tr><td><b>${id}</b></td><td>${giuntoDiServo(id)}</td><td class="num">${r.posizione}</td>
      <td class="num">${s ? passiAGradi(s, r.posizione).toFixed(1) + '°' : ''}</td>
      <td class="num">${r.tensione.toFixed(1)} V</td><td class="num"${caldo}>${r.temperatura} °C</td>
      <td class="num">${r.carico.toFixed(0)} %</td><td class="num">${r.corrente.toFixed(0)} mA</td>
      <td><button class="piccolo" data-prova="${id}" data-d="-5">−5°</button> <button class="piccolo" data-prova="${id}" data-d="5">+5°</button></td></tr>`;
  });
  $('tabServo').innerHTML = righe.join('') || `<tr><td colspan="9" class="elenco-vuoto">${bus.collegato ? 'Nessun servo letto. Premi «Cerca i servo».' : 'Non collegato.'}</td></tr>`;
}

async function cerca() {
  stato.occupato = true;
  const trovati = [];
  for (let id = 1; id <= 20; id++) {
    $('esitoCerca').textContent = `Cerco… ID ${id}`;
    if (await bus.ping(id)) trovati.push(id);
  }
  stato.occupato = false;
  $('esitoCerca').textContent = trovati.length ? `Trovati: ${trovati.join(', ')}` : 'Nessun servo trovato. 12 V collegati? TX e RX giusti?';
  // la lettura continua include anche gli ID trovati che non sono tra quelli previsti
  stato.extra = trovati.filter(id => !idUsati().includes(id));
  for (const id of trovati) { const r = await bus.stato(id); if (r) stato.reale[id] = r; }
  mostraReali();
}

// --- Pose e sequenza ---
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function mostraPose() {
  $('tabPose').innerHTML = pose.map((p, k) => `<tr>
      <td><input type="text" value="${esc(p.nome)}" data-rinomina="${k}"></td>
      <td class="num muted" style="font-size:12px">${p.q.map(v => v.toFixed(0)).join(' · ')}</td>
      <td class="num">${p.pinza.toFixed(0)}</td>
      <td style="white-space:nowrap"><button class="piccolo" data-vai="${k}">Vai</button>
        <button class="piccolo" data-sostituisci="${k}" title="Sostituisci con la posa attuale">Aggiorna</button>
        <button class="piccolo" data-elimina="${k}">✕</button></td></tr>`).join('')
    || '<tr><td colspan="4" class="elenco-vuoto">Nessuna posa. Muovi il braccio e premi «Salva la posa attuale».</td></tr>';
  mostraSequenza();
}

function mostraSequenza() {
  const opzioni = sel => pose.map((p, k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(p.nome)}</option>`).join('');
  $('tabSequenza').innerHTML = sequenza.map((s, k) => `<tr>
      <td class="num">${k + 1}</td>
      <td><select data-passo="${k}" data-campo="posa">${opzioni(s.posa)}</select></td>
      <td><input type="number" min="0.2" step="0.5" value="${s.durata}" data-passo="${k}" data-campo="durata"></td>
      <td><input type="number" min="0" step="0.5" value="${s.pausa}" data-passo="${k}" data-campo="pausa"></td>
      <td style="white-space:nowrap"><button class="piccolo" data-su="${k}">↑</button> <button class="piccolo" data-giu="${k}">↓</button>
        <button class="piccolo" data-togli="${k}">✕</button></td></tr>`).join('')
    || '<tr><td colspan="5" class="elenco-vuoto">Sequenza vuota.</td></tr>';
}

function salvaPosa(q, pinza) {
  const nome = $('nomePosa').value.trim() || `Posa ${pose.length + 1}`;
  pose.push({ nome, q: q.map(v => +v.toFixed(1)), pinza: +pinza.toFixed(1) });
  salva('pose', pose);
  $('nomePosa').value = '';
  mostraPose();
  avviso(`Posa «${nome}» salvata`);
}

// animazione della simulazione da una posa all'altra, in sincrono con il robot
function anima(daQ, daP, aQ, aP, secondi) {
  return new Promise(risolvi => {
    const t0 = performance.now();
    const passo = () => {
      if (stato.annulla) return risolvi(false);
      const k = Math.min(1, (performance.now() - t0) / (secondi * 1000));
      const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      stato.q = daQ.map((v, i) => v + (aQ[i] - v) * e);
      stato.pinza = daP + (aP - daP) * e;
      const segui = stato.segui; stato.segui = false; aggiorna(); stato.segui = segui;
      if (k < 1) requestAnimationFrame(passo); else risolvi(true);
    };
    passo();
  });
}

async function contoAllaRovescia() {
  const n = Math.max(0, +imp.conteggio || 0);
  if (!n) return true;
  $('conto').style.display = 'grid';
  for (let i = n; i > 0 && !stato.annulla; i--) {
    $('contoNumero').textContent = i;
    await pausa(1000);
  }
  $('conto').style.display = 'none';
  return !stato.annulla;
}

async function esegui() {
  if (!sequenza.length) return avviso('La sequenza è vuota');
  if (sequenza.some(s => !pose[s.posa])) return avviso('Un passo usa una posa che non esiste più');
  for (const s of sequenza) {
    const pr = controlla(pose[s.posa].q, imp.giunti);
    if (pr.length) return avviso(`«${pose[s.posa].nome}»: ${pr[0]}`, 5000);
  }
  stato.annulla = false; stato.inEsecuzione = true;
  const segui = stato.segui; impostaSegui(false);
  $('btnEsegui').disabled = true; $('btnStopSeq').disabled = false;
  const robot = puoMuovere();
  const fine = () => {
    stato.inEsecuzione = false;
    $('conto').style.display = 'none';
    $('btnEsegui').disabled = false; $('btnStopSeq').disabled = true;
    $('statoSeq').textContent = stato.annulla ? 'Interrotta' : 'Finita';
    document.dispatchEvent(new CustomEvent('motion:sequenza', { detail: { completata: !stato.annulla, passi: sequenza.length } }));
    impostaSegui(segui && !stato.annulla);
  };
  if (robot && !(await contoAllaRovescia())) return fine();
  do {
    for (let k = 0; k < sequenza.length && !stato.annulla; k++) {
      const s = sequenza[k], p = pose[s.posa];
      $('statoSeq').textContent = `Passo ${k + 1} di ${sequenza.length}: ${p.nome}${robot ? '' : ' (solo simulazione)'}`;
      if (robot) inviaAlRobot(p.q, p.pinza, Math.max(0.2, +s.durata));
      if (!(await anima(stato.q.slice(), stato.pinza, p.q, p.pinza, Math.max(0.2, +s.durata)))) break;
      await pausa((+s.pausa || 0) * 1000);
    }
  } while ($('ripeti').checked && !stato.annulla);
  fine();
}

// --- Impostazioni ---
function mostraImpostazioni() {
  $('tabGiunti').innerHTML = ROBOT.giunti.map((g, i) => {
    const s = imp.giunti[i].servo, c = (k, campo) => s[k] ? `<input type="number" data-g="${i}" data-s="${k}" data-campo="${campo}" value="${s[k][campo]}">` : '';
    return `<tr><td>${g.nome}</td>
      <td><input type="number" data-g="${i}" data-campo="min" value="${imp.giunti[i].min}"></td>
      <td><input type="number" data-g="${i}" data-campo="max" value="${imp.giunti[i].max}"></td>
      <td>${c(0, 'id')}</td><td>${c(0, 'verso')}</td><td>${c(0, 'centro')}</td>
      <td>${c(1, 'id')}</td><td>${c(1, 'verso')}</td><td>${c(1, 'centro')}</td></tr>`;
  }).join('');
  document.querySelectorAll('[data-imp]').forEach(el => {
    el.value = el.dataset.imp.split('.').reduce((o, k) => o[k], imp);
  });
  $('impRiposo').value = imp.riposo.join(', ');
  $('velocita').value = imp.velocita; $('valVelocita').textContent = imp.velocita;
  $('tabAssegnazione').innerHTML = ROBOT.giunti.map((g, i) =>
    `<tr><td>${g.nome}</td><td class="num">${imp.giunti[i].servo.map(s => s.id).join(' e ')}</td></tr>`).join('')
    + `<tr><td>Pinza</td><td class="num">${imp.pinza.id}</td></tr>`;
}

function salvaImpostazioni() {
  salva('impostazioni', imp);
  ROBOT.giunti.forEach((g, i) => {
    ['r', 'n'].forEach(p => { $(p + i).min = imp.giunti[i].min; $(p + i).max = imp.giunti[i].max; });
  });
  aggiorna();
}

function esporta() {
  const dati = { tipo: 'pannello-braccio', robot: ROBOT.nome, data: new Date().toISOString(), impostazioni: imp, pose, sequenza };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(dati, null, 2)], { type: 'application/json' }));
  a.download = `orbinel-kheiron-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importa(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.tipo !== 'pannello-braccio') throw new Error('non è un file del pannello');
    imp = Object.assign(impostazioniIniziali(), d.impostazioni || {});
    pose = d.pose || []; sequenza = d.sequenza || [];
    salva('impostazioni', imp); salva('pose', pose); salva('sequenza', sequenza);
    costruisciGiunti(); mostraImpostazioni(); mostraPose(); aggiorna();
    avviso('Importato');
  } catch (e) { avviso('Non riesco a leggere il file: ' + e.message); }
}

// --- Avvio ---
function collegaEventi() {
  document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('nav button, main > section').forEach(x => x.classList.remove('attivo'));
    b.classList.add('attivo');
    $(b.dataset.sezione).classList.add('attivo');
    scena?.ridimensiona();
  }));
  document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => scena?.vista(b.dataset.vista)));
  $('btnScia').addEventListener('click', () => { stato.scia = !stato.scia; $('btnScia').textContent = 'Scia: ' + (stato.scia ? 'accesa' : 'spenta'); });
  $('btnPulisciScia').addEventListener('click', () => scena?.pulisciScia());

  $('pinza').addEventListener('input', e => { stato.pinza = +e.target.value; aggiorna(); });
  $('pinzaNum').addEventListener('change', e => { stato.pinza = Math.max(0, Math.min(20, +e.target.value || 0)); aggiorna(); });
  $('btnRiposo').addEventListener('click', () => impostaPosa(imp.riposo, imp.pinzaRiposo));
  $('btnZero').addEventListener('click', () => impostaPosa([0, 0, 0, 0, 0, 0]));
  $('btnIk').addEventListener('click', vaiIk);
  ['ikX', 'ikY', 'ikZ', 'ikInc', 'ikRot'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') vaiIk(); }));
  $('velocita').addEventListener('input', e => { imp.velocita = +e.target.value; $('valVelocita').textContent = imp.velocita; salva('impostazioni', imp); });

  $('btnCollega').addEventListener('click', async () => {
    if (!('serial' in navigator)) return avviso('Serve Google Chrome (o Edge) per collegarsi via USB', 6000);
    try {
      await bus.collega();
      aggiornaCollegamento();
      avviso(bus.modo === 'ponte' ? 'Collegato tramite ESP32' : 'Collegato: nessun ponte ESP32, uso la USB diretta dell\'adattatore', 5000);
      // accelerazione dei servo e stato della coppia
      const ids = idUsati();
      await bus.scriviTutti(STS.reg.ACC, ids.map(id => ({ id, byte: [imp.accelerazione] })));
      let coppia = null;
      for (const id of ids) {
        const r = await bus.leggiRegistri(id, STS.reg.COPPIA, 1);
        if (r) { coppia = !!r[0]; break; }
      }
      stato.coppia = coppia;
      aggiornaCoppia();
    } catch (e) {
      if (e.name !== 'NotFoundError') avviso('Non riesco a collegarmi: ' + e.message, 6000);
    }
  });
  $('btnScollega').addEventListener('click', () => bus.scollega());
  bus.addEventListener('stato', aggiornaCollegamento);
  bus.addEventListener('errore', e => avviso(e.detail, 6000));
  bus.addEventListener('silenzio', () => avviso('Nessun segnale dal ponte: premi RST sulla schedina'));
  bus.addEventListener('arresto', e => {
    aggiornaArresto();
    if (e.detail) {
      stato.annulla = true; impostaSegui(false);
      avviso('Fungo premuto: servo fermi', 5000);
    } else {
      // al rilascio la simulazione riparte da dove si trova il robot, così niente scatti
      const pr = posaReale();
      if (pr) { stato.q = pr.q; stato.pinza = Math.max(0, Math.min(20, pr.pinza)); aggiorna(); }
      avviso('Fungo rilasciato. Riattiva «segue la simulazione» per ripartire', 5000);
    }
  });

  $('btnFerma').addEventListener('click', ferma);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ferma(); });
  $('btnAnnullaConto').addEventListener('click', () => { stato.annulla = true; });

  $('segui').addEventListener('change', e => {
    if (!e.target.checked) return impostaSegui(false);
    if (bus.modo === 'ponte' && bus.arresto) { e.target.checked = false; return avviso('Il fungo è premuto'); }
    if (stato.coppia === false) { e.target.checked = false; return avviso('Prima riaccendi la coppia'); }
    const problemi = controlla(stato.q, imp.giunti);
    if (problemi.length) { e.target.checked = false; return avviso('Posa non sicura: ' + problemi[0]); }
    const pr = posaReale();
    if (pr) {
      const salto = Math.max(...stato.q.map((v, i) => Math.abs(v - pr.q[i])));
      if (salto > 20 && !confirm(`Il robot si muoverà fino a ${salto.toFixed(0)}° per raggiungere la simulazione, a ${imp.velocita}°/s. Procedo?`)) {
        e.target.checked = false; return;
      }
    }
    impostaSegui(true);
    stato.ultimoInvio = 0;
    seguiSimulazione();
  });
  $('btnCopiaReale').addEventListener('click', () => {
    const pr = posaReale();
    if (!pr) return avviso('Non leggo tutti i servo dei giunti');
    impostaPosa(pr.q, Math.max(0, Math.min(20, pr.pinza)));
  });
  const coppia = async accesa => {
    if (!accesa && !confirm('Senza coppia i servo diventano liberi e il braccio può cadere. Sostienilo. Procedo?')) return;
    impostaSegui(false);
    if (accesa) {      // prima di riaccendere, obiettivo = posizione attuale: niente scatti
      const ob = idUsati().filter(id => stato.reale[id]).map(id => ({ id, posizione: stato.reale[id].posizione, velocita: 500 }));
      await bus.muovi(ob);
    }
    await bus.coppia(idUsati(), accesa);
    stato.coppia = accesa;
    aggiornaCoppia();
  };
  $('btnCoppia').addEventListener('click', () => coppia(!stato.coppia));
  $('btnCoppiaOff').addEventListener('click', () => coppia(false));
  $('btnCoppiaOn').addEventListener('click', () => coppia(true));

  // Servo
  $('btnCerca').addEventListener('click', cerca);
  $('tabServo').addEventListener('click', async e => {
    const id = +e.target.dataset.prova;
    if (!id) return;
    if (bus.modo === 'ponte' && bus.arresto) return avviso('Il fungo è premuto');
    const r = stato.reale[id] || await bus.stato(id);
    if (!r) return avviso('Il servo non risponde');
    await bus.scrivi(id, STS.reg.COPPIA, [1]);
    await bus.muovi([{ id, posizione: r.posizione + +e.target.dataset.d * PASSI_GRADO, velocita: 150 }]);
  });
  $('btnSalvaZero').addEventListener('click', () => {
    const mancano = [];
    imp.giunti.forEach((g, i) => g.servo.forEach(s => {
      const r = stato.reale[s.id];
      if (r) s.centro = r.posizione; else mancano.push(`${ROBOT.giunti[i].nome} (ID ${s.id})`);
    }));
    salva('impostazioni', imp); mostraImpostazioni(); mostraReali();
    avviso(mancano.length ? 'Zero salvato, ma non leggo: ' + mancano.join(', ') : 'Zero salvato per tutti i giunti', 6000);
  });
  const calPinza = campo => {
    const r = stato.reale[imp.pinza.id];
    if (!r) return avviso(`Non leggo il servo della pinza (ID ${imp.pinza.id})`);
    imp.pinza[campo] = r.posizione; salva('impostazioni', imp); mostraImpostazioni();
    $('valPinzaCal').textContent = `chiusa ${imp.pinza.chiusa} · aperta ${imp.pinza.aperta}`;
  };
  $('btnPinzaChiusa').addEventListener('click', () => calPinza('chiusa'));
  $('btnPinzaAperta').addEventListener('click', () => calPinza('aperta'));
  $('btnCambiaId').addEventListener('click', async () => {
    const da = +$('idDa').value, a = +$('idA').value;
    if (!(a >= 0 && a <= 252) || da === a) return;
    if (!confirm(`Cambio l'ID ${da} in ${a}. Sul cavo deve esserci un solo servo. Procedo?`)) return;
    stato.occupato = true;
    if (!(await bus.ping(da))) { stato.occupato = false; $('esitoId').textContent = `Nessun servo con ID ${da}`; return; }
    const ok = await bus.cambiaId(da, a);
    stato.occupato = false;
    delete stato.reale[da];
    stato.extra = (stato.extra || []).filter(id => id !== da).concat(idUsati().includes(a) ? [] : [a]);
    $('esitoId').textContent = ok ? `✓ Ora il servo ha ID ${a}. Scrivilo su un pezzo di nastro sul servo.` : '✗ Il servo non risponde con il nuovo ID';
  });

  // Pose e sequenza
  $('btnSalvaPosa').addEventListener('click', () => salvaPosa(stato.q, stato.pinza));
  $('btnSalvaPosaReale').addEventListener('click', () => {
    const pr = posaReale();
    if (!pr) return avviso('Non leggo tutti i servo dei giunti');
    salvaPosa(pr.q, pr.pinza);
  });
  $('tabPose').addEventListener('click', e => {
    const d = e.target.dataset;
    if (d.vai !== undefined) {
      const p = pose[+d.vai];
      impostaPosa(p.q, p.pinza);
      document.querySelector('nav button[data-sezione=muovi]').click();
    }
    if (d.sostituisci !== undefined) {
      Object.assign(pose[+d.sostituisci], { q: stato.q.map(v => +v.toFixed(1)), pinza: +stato.pinza.toFixed(1) });
      salva('pose', pose); mostraPose(); avviso('Posa aggiornata');
    }
    if (d.elimina !== undefined && confirm(`Elimino «${pose[+d.elimina].nome}»?`)) {
      const k = +d.elimina;
      pose.splice(k, 1);
      sequenza = sequenza.filter(s => s.posa !== k).map(s => ({ ...s, posa: s.posa > k ? s.posa - 1 : s.posa }));
      salva('pose', pose); salva('sequenza', sequenza); mostraPose();
    }
  });
  $('tabPose').addEventListener('change', e => {
    const k = e.target.dataset.rinomina;
    if (k !== undefined) { pose[+k].nome = e.target.value; salva('pose', pose); mostraSequenza(); }
  });
  $('btnAggiungiPasso').addEventListener('click', () => {
    if (!pose.length) return avviso('Prima salva almeno una posa');
    sequenza.push({ posa: pose.length - 1, durata: 2, pausa: 0.5 });
    salva('sequenza', sequenza); mostraSequenza();
  });
  $('tabSequenza').addEventListener('change', e => {
    const k = e.target.dataset.passo;
    if (k === undefined) return;
    sequenza[+k][e.target.dataset.campo] = +e.target.value;
    salva('sequenza', sequenza);
  });
  $('tabSequenza').addEventListener('click', e => {
    const d = e.target.dataset, sposta = (k, j) => { if (j < 0 || j >= sequenza.length) return; [sequenza[k], sequenza[j]] = [sequenza[j], sequenza[k]]; };
    if (d.su !== undefined) sposta(+d.su, +d.su - 1);
    else if (d.giu !== undefined) sposta(+d.giu, +d.giu + 1);
    else if (d.togli !== undefined) sequenza.splice(+d.togli, 1);
    else return;
    salva('sequenza', sequenza); mostraSequenza();
  });
  $('btnEsegui').addEventListener('click', esegui);
  $('btnStopSeq').addEventListener('click', () => { stato.annulla = true; if (bus.collegato) ferma(); });
  $('btnEsporta').addEventListener('click', esporta);
  $('btnImporta').addEventListener('click', () => $('fileImporta').click());
  $('fileImporta').addEventListener('change', e => e.target.files[0] && importa(e.target.files[0]));

  // Impostazioni
  $('tabGiunti').addEventListener('change', e => {
    const d = e.target.dataset, v = +e.target.value;
    if (d.g === undefined) return;
    if (d.s !== undefined) imp.giunti[+d.g].servo[+d.s][d.campo] = d.campo === 'verso' ? (v < 0 ? -1 : 1) : v;
    else imp.giunti[+d.g][d.campo] = v;
    salvaImpostazioni(); mostraImpostazioni();
  });
  document.querySelectorAll('[data-imp]').forEach(el => el.addEventListener('change', () => {
    const chiavi = el.dataset.imp.split('.'), ultima = chiavi.pop();
    chiavi.reduce((o, k) => o[k], imp)[ultima] = +el.value;
    salvaImpostazioni(); mostraImpostazioni();
  }));
  $('impRiposo').addEventListener('change', e => {
    const v = e.target.value.split(/[,;\s]+/).filter(Boolean).map(Number);
    if (v.length === 6 && v.every(Number.isFinite)) { imp.riposo = v; salvaImpostazioni(); }
    else { avviso('Servono 6 numeri separati da virgole'); }
    mostraImpostazioni();
  });
  $('btnRipristina').addEventListener('click', () => {
    if (!confirm('Ripristino le impostazioni iniziali? Calibrazione e ID tornano ai valori di partenza.')) return;
    imp = impostazioniIniziali(); salvaImpostazioni(); costruisciGiunti(); mostraImpostazioni(); aggiorna();
  });
}

async function avvia() {
  costruisciGiunti();
  costruisciJog();
  collegaEventi();
  mostraImpostazioni();
  mostraPose();
  aggiornaCollegamento();
  aggiorna();
  scena = window.scena = new Scena($('vista3d'));
  scena.suPunto = suPunto;
  try {
    await scena.carica(k => { $('caricamento').textContent = `Carico il modello… ${Math.round(k * 100)}%`; });
    $('caricamento').remove();
    document.dispatchEvent(new CustomEvent('motion:modello', { detail: scena }));
    aggiorna();
  } catch (e) {
    $('caricamento').textContent = 'Non riesco a caricare il modello (' + e.message + '). Apri Motion con «Orbinel Motion.command».';
  }
  ciclo();
}

avvia();
