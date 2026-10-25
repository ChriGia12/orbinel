// Sezione Lezioni di Orbinel Motion: elenco, teoria, esercizi verificati in tempo reale sul simulatore
// (riquadro sopra la vista 3D) e domanda finale. I progressi restano in questo browser.
'use strict';

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
      <span>${l.titolo}</span><span class="muted num">${n}/${tot}${n === tot ? ' ✓' : ''}</span>
      <i style="width:${(n / tot * 100).toFixed(0)}%"></i></button>`;
  }).join('');
}

function mostraLezione(k) {
  lezioni.scelta = k;
  const l = LEZIONI[k], p = progressoDi(l);
  document.getElementById('contenutoLezione').innerHTML = `
    <div class="card">
      <div class="riga"><h3 style="margin:0;flex:1">${l.titolo}</h3><span class="chip">${l.durata}</span></div>
      <h2 style="margin-top:14px">Obiettivi</h2>
      <ul>${l.obiettivi.map(o => `<li>${o}</li>`).join('')}</ul>
      <div class="guida">${l.teoria}</div>
    </div>
    <div class="card">
      <h2>Esercizi nel simulatore</h2>
      <ol class="esercizi">${l.esercizi.map((e, i) => `<li class="${p.esercizi[i] ? 'fatto' : ''}">${e.testo}</li>`).join('')}</ol>
      <div class="riga"><button class="primario" id="btnIniziaLezione">${lezioni.attiva === k ? 'Torna al simulatore' : 'Inizia nel simulatore'}</button>
        <button id="btnAzzeraLezione">Ricomincia la lezione</button></div>
    </div>
    <div class="card">
      <h2>Domanda</h2>
      <p>${l.domanda.testo}</p>
      <div class="scelte">${l.domanda.scelte.map((s, i) => `<label><input type="radio" name="domanda" value="${i}"> ${s}</label>`).join('')}</div>
      <p id="esitoDomanda" class="${p.domanda ? 'ok' : ''}">${p.domanda ? '✓ Risposta giusta' : ''}</p>
    </div>`;
  mostraElenco();
  document.getElementById('btnIniziaLezione').onclick = () => avviaLezione(k);
  document.getElementById('btnAzzeraLezione').onclick = () => {
    delete lezioni.progressi[l.id]; salvaProgressi(); lezioni.eventi = {}; mostraLezione(k); mostraRiquadro();
  };
  document.querySelectorAll('input[name=domanda]').forEach(r => r.onchange = () => {
    const giusta = +r.value === l.domanda.giusta;
    const esito = document.getElementById('esitoDomanda');
    esito.textContent = giusta ? '✓ Risposta giusta' : '✗ Non è questa: rileggi la teoria e riprova';
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
  const l = LEZIONI[lezioni.attiva], p = progressoDi(l);
  el.hidden = false;
  el.innerHTML = `<div class="riga" style="margin-bottom:6px"><b style="flex:1">${l.titolo}</b>
      <button class="piccolo" id="btnApriLezione" title="Teoria e domanda">Teoria</button>
      <button class="piccolo" id="btnChiudiLezione">✕</button></div>
    <ol class="esercizi">${l.esercizi.map((e, i) => `<li class="${p.esercizi[i] ? 'fatto' : ''}">${e.testo}</li>`).join('')}</ol>`;
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
    if (ok) { p.esercizi[i] = true; nuovi = true; avviso(`✓ Esercizio completato: ${e.testo}`); }
  });
  if (nuovi) { salvaProgressi(); mostraRiquadro(); mostraElenco(); }
}

let ultimaPosa = null;
document.addEventListener('motion:posa', e => { ultimaPosa = e.detail; verifica(e.detail); });
document.addEventListener('motion:ik', e => { if (e.detail.errore) { lezioni.eventi.ikErrore = true; ultimaPosa && verifica(ultimaPosa); } });
document.addEventListener('motion:spazio', e => { if (e.detail) { lezioni.eventi.spazio = true; ultimaPosa && verifica(ultimaPosa); } });
document.addEventListener('motion:sequenza', e => { if (e.detail.completata) { lezioni.eventi.sequenza = true; ultimaPosa && verifica(ultimaPosa); } });

(() => {
  document.getElementById('elencoLezioni').addEventListener('click', e => {
    const b = e.target.closest('[data-lezione]');
    if (b) mostraLezione(+b.dataset.lezione);
  });
  mostraLezione(0);
})();
