// Sezione Lezioni di Orbinel Motion: elenco, teoria, esercizi verificati in tempo reale sul simulatore
// (riquadro sopra la vista 3D) e domanda finale. I progressi restano in questo browser.
'use strict';

// lingua delle lezioni (it/en): cambia solo i testi, non le verifiche
let linguaLezioni = (() => { try { return localStorage.getItem('orbinel.learn.lingua') || 'it'; } catch { return 'it'; } })();
function testo(l) {
  const en = linguaLezioni === 'en' && LEZIONI_EN[l.id];
  if (!en) return { titolo: l.titolo, durata: l.durata, obiettivi: l.obiettivi, teoria: l.teoria, esercizi: l.esercizi.map(e => e.testo), domanda: l.domanda };
  return { ...en, domanda: { ...l.domanda, ...en.domanda } };
}
const DICITURE = {
  it: { obiettivi: 'Obiettivi', esercizi: 'Esercizi nel simulatore', inizia: 'Inizia nel simulatore', torna: 'Torna al simulatore', ricomincia: 'Ricomincia la lezione', domanda: 'Domanda', giusta: '✓ Risposta giusta', sbagliata: '✗ Non è questa: rileggi la teoria e riprova', teoria: 'Teoria', fatto: '✓ Esercizio completato: ' },
  en: { obiettivi: 'Goals', esercizi: 'Exercises in the simulator', inizia: 'Start in the simulator', torna: 'Back to the simulator', ricomincia: 'Restart the lesson', domanda: 'Question', giusta: '✓ Correct', sbagliata: '✗ Not this one: read the theory again and retry', teoria: 'Theory', fatto: '✓ Exercise completed: ' },
};
const D = () => DICITURE[linguaLezioni];

const lezioni = {
  attiva: null,                       // indice della lezione in corso
  eventi: {},                         // fatti accaduti dall'inizio della lezione
  progressi: (() => { try { return JSON.parse(localStorage.getItem('orbinel.learn.progressi')) || {}; } catch { return {}; } })(),
};

function salvaProgressi() {
  try { localStorage.setItem('orbinel.learn.progressi', JSON.stringify(lezioni.progressi)); } catch {}
}

function progressoDi(l) {
  return lezioni.progressi[l.id] || (lezioni.progressi[l.id] = { esercizi: l.esercizi.map(() => false), domanda: false });
}

function fatti(l) {
  const p = progressoDi(l);
  return p.esercizi.filter(Boolean).length + (p.domanda ? 1 : 0);
}

function mostraElenco() {
  document.getElementById('elencoLezioni').innerHTML = LEZIONI.map((l, k) => {
    const n = fatti(l), tot = l.esercizi.length + 1;
    return `<button class="voce-lezione${k === lezioni.scelta ? ' scelta' : ''}" data-lezione="${k}">
      <span>${testo(l).titolo}</span><span class="muted num">${n}/${tot}${n === tot ? ' ✓' : ''}</span>
      <i style="width:${(n / tot * 100).toFixed(0)}%"></i></button>`;
  }).join('');
}

function mostraLezione(k) {
  lezioni.scelta = k;
  const l = LEZIONI[k], p = progressoDi(l), x = testo(l), d = D();
  document.getElementById('contenutoLezione').innerHTML = `
    <div class="card">
      <div class="riga"><h3 style="margin:0;flex:1">${x.titolo}</h3><span class="chip">${x.durata}</span></div>
      <h2 style="margin-top:14px">${d.obiettivi}</h2>
      <ul>${x.obiettivi.map(o => `<li>${o}</li>`).join('')}</ul>
      <div class="guida">${x.teoria}</div>
    </div>
    <div class="card">
      <h2>${d.esercizi}</h2>
      <ol class="esercizi">${x.esercizi.map((e, i) => `<li class="${p.esercizi[i] ? 'fatto' : ''}">${e}</li>`).join('')}</ol>
      <div class="riga"><button class="primario" id="btnIniziaLezione">${lezioni.attiva === k ? d.torna : d.inizia}</button>
        <button id="btnAzzeraLezione">${d.ricomincia}</button></div>
    </div>
    <div class="card">
      <h2>${d.domanda}</h2>
      <p>${x.domanda.testo}</p>
      <div class="scelte">${x.domanda.scelte.map((s, i) => `<label><input type="radio" name="domanda" value="${i}"> ${s}</label>`).join('')}</div>
      <p id="esitoDomanda" class="${p.domanda ? 'ok' : ''}">${p.domanda ? d.giusta : ''}</p>
    </div>`;
  mostraElenco();
  document.getElementById('btnIniziaLezione').onclick = () => avviaLezione(k);
  document.getElementById('btnAzzeraLezione').onclick = () => {
    delete lezioni.progressi[l.id]; salvaProgressi(); lezioni.eventi = {}; mostraLezione(k); mostraRiquadro();
  };
  document.querySelectorAll('input[name=domanda]').forEach(r => r.onchange = () => {
    const giusta = +r.value === l.domanda.giusta;
    const esito = document.getElementById('esitoDomanda');
    esito.textContent = giusta ? D().giusta : D().sbagliata;
    esito.className = giusta ? 'ok' : 'no';
    if (giusta) { p.domanda = true; salvaProgressi(); mostraElenco(); }
  });
}

function avviaLezione(k) {
  if (lezioni.attiva !== k) lezioni.eventi = {};
  lezioni.attiva = k;
  document.querySelector('nav button[data-sezione=muovi]').click();
  mostraRiquadro();
  impostaPosa(stato.q);                // ricontrolla subito la posa attuale
}

function mostraRiquadro() {
  const el = document.getElementById('lezioneAttiva');
  if (lezioni.attiva === null) { el.hidden = true; return; }
  const l = LEZIONI[lezioni.attiva], p = progressoDi(l), x = testo(l);
  el.hidden = false;
  el.innerHTML = `<div class="riga" style="margin-bottom:6px"><b style="flex:1">${x.titolo}</b>
      <button class="piccolo" id="btnApriLezione">${D().teoria}</button>
      <button class="piccolo" id="btnChiudiLezione">✕</button></div>
    <ol class="esercizi">${x.esercizi.map((e, i) => `<li class="${p.esercizi[i] ? 'fatto' : ''}">${e}</li>`).join('')}</ol>`;
  document.getElementById('btnChiudiLezione').onclick = () => { lezioni.attiva = null; mostraRiquadro(); };
  document.getElementById('btnApriLezione').onclick = () => {
    document.querySelector('nav button[data-sezione=lezioni]').click();
    mostraLezione(lezioni.attiva);
  };
}

function verifica(dettaglio) {
  if (lezioni.attiva === null) return;
  const l = LEZIONI[lezioni.attiva], p = progressoDi(l);
  const c = { ...dettaglio, an: analisi.ultimo, carico: analisi.carico, eventi: lezioni.eventi };
  let nuovi = false;
  l.esercizi.forEach((e, i) => {
    if (p.esercizi[i]) return;
    let ok = false;
    try { ok = !!e.verifica(c); } catch {}
    if (ok) { p.esercizi[i] = true; nuovi = true; avviso(D().fatto + testo(l).esercizi[i]); }
  });
  if (nuovi) { salvaProgressi(); mostraRiquadro(); mostraElenco(); }
}

let ultimaPosa = null;
document.addEventListener('motion:posa', e => { ultimaPosa = e.detail; verifica(e.detail); });
document.addEventListener('motion:ik', e => { if (e.detail.errore) { lezioni.eventi.ikErrore = true; ultimaPosa && verifica(ultimaPosa); } });
document.addEventListener('motion:spazio', e => { if (e.detail) { lezioni.eventi.spazio = true; ultimaPosa && verifica(ultimaPosa); } });
document.addEventListener('motion:sequenza', e => { if (e.detail.completata) { lezioni.eventi.sequenza = true; ultimaPosa && verifica(ultimaPosa); } });

(() => {
  document.querySelectorAll('[data-lingua-lezioni]').forEach(b => {
    b.classList.toggle('attivo', b.dataset.linguaLezioni === linguaLezioni);
    b.addEventListener('click', () => {
      linguaLezioni = b.dataset.linguaLezioni;
      try { localStorage.setItem('orbinel.learn.lingua', linguaLezioni); } catch {}
      document.querySelectorAll('[data-lingua-lezioni]').forEach(c => c.classList.toggle('attivo', c === b));
      mostraLezione(lezioni.scelta || 0); mostraRiquadro();
    });
  });
  document.getElementById('elencoLezioni').addEventListener('click', e => {
    const b = e.target.closest('[data-lezione]');
    if (b) mostraLezione(+b.dataset.lezione);
  });
  mostraLezione(0);
})();
