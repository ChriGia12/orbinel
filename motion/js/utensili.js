// Utensili montati su Kheiron: la pinza di serie o uno degli utensili di Orbinel Parts, costruito
// con lo stesso generatore del sito (parts-geometria.js e manifold-3d). Cambiano il modello 3D,
// il punto utensile (TCP) della cinematica e le masse dell'analisi delle coppie.
'use strict';

const utensili = {
  tipo: 'pinza',
  parametri: {},
  pinza: true,              // false quando la pinza non è montata: niente comandi al suo servo
  moduli: null,             // { M, G }: manifold-3d e geometria di Parts, caricati alla prima scelta
  mesh: null,               // utensile mostrato al posto della pinza
  ultimo: null,             // ultimo pezzo costruito (per scaricare l'STL)
  tcpPinza: ROBOT.tcp.slice(),
  linkPinza: null,          // masse del link con la pinza, per tornare indietro
};

// La punta del codolo appoggia sul fondo della tazza della flangia J6 (x = 202) con 0,2 mm di gioco.
// Sistema dell'utensile in Parts: z = asse di J6, piano di orientamento verso +y (lato alto del braccio),
// fori delle viti sull'asse x. Nel modello: z -> +x, y -> +z, x -> +y.
const BASE_UTENSILE = [202.2, 0, 255];
const nelModello = (x, y, z) => [BASE_UTENSILE[0] + z, BASE_UTENSILE[1] + x, BASE_UTENSILE[2] + y];

// pezzi della pinza: tutto il link utensile tranne la flangia, il suo servo e le dita
const PEZZI_PINZA = new Set([
  ...ROBOT.link.utensile.pezzi.filter(n => n !== 'flangia'),
  ...ROBOT.link.utensile.servo.map(i => 'servo' + i),
]);

async function caricaModuli() {
  if (utensili.moduli) return utensili.moduli;
  // online Parts sta in /js accanto a /motion; aprendo la cartella del progetto (server.py) sta in /sito/js
  const progetto = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && location.pathname.startsWith('/motion/');
  let errore;
  for (const cartella of progetto ? ['../sito/js/'] : ['../js/']) {
    try {
      const base = new URL(cartella, document.baseURI).href;
      const G = await import(base + 'parts-geometria.js');
      const { default: Module } = await import(base + 'lib/manifold.js');
      const M = await Module();
      M.setup();
      return (utensili.moduli = { M, G });
    } catch (e) { errore = e; }
  }
  throw errore;
}

// geometria three.js dell'utensile, già nel sistema del modello
function geometriaUtensile(mesh) {
  const n = mesh.numTri, np = mesh.numProp, v = mesh.vertProperties, t = mesh.triVerts;
  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n * 3; i++) {
    const j = t[i] * np;
    pos.set(nelModello(v[j], v[j + 1], v[j + 2]), i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function mostraPinza(visibile) {
  scena.mesh.forEach(m => { if (PEZZI_PINZA.has(m.userData.pezzo)) m.visible = visibile; });
  scena.dita.sx.visible = scena.dita.dx.visible = visibile;
  ['pinza', 'pinzaNum'].forEach(id => { document.getElementById(id).disabled = !visibile; });
}

function togliUtensile() {
  if (!utensili.mesh) return;
  utensili.mesh.parent.remove(utensili.mesh);
  utensili.mesh.geometry.dispose();
  utensili.mesh = null;
}

async function montaUtensile(tipo, parametri) {
  if (!scena?.nodi || !analisi.link) return;
  if (!utensili.linkPinza) utensili.linkPinza = analisi.link.utensile;
  const info = document.getElementById('infoUtensile');
  togliUtensile();
  utensili.ultimo?.solido.delete?.();
  utensili.ultimo = null;

  if (tipo === 'pinza') {
    Object.assign(utensili, { tipo, parametri: {}, pinza: true });
    ROBOT.tcp = utensili.tcpPinza.slice();
    analisi.link.utensile = utensili.linkPinza;
    mostraPinza(true);
    info.textContent = `Massa stimata con il servo: ${utensili.linkPinza.massa.toFixed(0)} g · TCP a ${(ROBOT.tcp[0] - BASE_UTENSILE[0]).toFixed(0)} mm dalla flangia`;
  } else {
    info.textContent = 'Costruisco l\'utensile…';
    let r;
    try {
      const { M, G } = await caricaModuli();
      r = G.costruisci(M, tipo, parametri);
    } catch (e) {
      info.textContent = 'Non riesco a costruire l\'utensile: ' + e.message;
      return;
    }
    Object.assign(utensili, { tipo, parametri: { ...parametri }, pinza: false, ultimo: r });
    const geo = geometriaUtensile(r.mesh);
    const o = ROBOT.giunti[5].origine;
    utensili.mesh = new THREE.Mesh(geo, scena.materiali.pezzo);
    utensili.mesh.matrixAutoUpdate = false;
    utensili.mesh.matrix.makeTranslation(-o[0], -o[1], -o[2]);
    scena.nodi[5].add(utensili.mesh);
    mostraPinza(false);
    ROBOT.tcp = nelModello(0, 0, r.tcp);

    // masse: la flangia resta, la pinza e il suo servo lasciano il posto all'utensile
    const { densita, riempimento } = ROBOT.materiale;
    const parti = [proprieta(scena.geo.flangia), proprieta(geo)].map(p => ({ m: p.volume / 1000 * densita * riempimento, c: p.centro }));
    const massa = parti.reduce((t, x) => t + x.m, 0);
    analisi.link.utensile = {
      massa,
      centro: [0, 1, 2].map(k => parti.reduce((t, x) => t + x.m * x.c[k], 0) / massa),
      giunto: utensili.linkPinza.giunto,
    };
    const b = r.scatola, dim = [0, 1, 2].map(k => (b.max[k] - b.min[k]).toFixed(0)).join(' × ');
    info.textContent = `${dim} mm · massa stimata ${parti[1].m.toFixed(0)} g · TCP a ${r.tcp.toFixed(0)} mm dalla punta del codolo`;
  }
  document.getElementById('btnStlUtensile').hidden = !utensili.ultimo;
  salva('utensile', { tipo: utensili.tipo, parametri: utensili.parametri });
  impostaPosa(stato.q);
}

// --- pannello ---
function mostraParametriUtensile() {
  const G = utensili.moduli?.G, u = G?.UTENSILI[utensili.tipo];
  document.getElementById('descrizioneUtensile').textContent = u ? u.descrizione.it
    : 'La pinza a due dita di serie, con il suo servo.';
  document.getElementById('parametriUtensile').innerHTML = u ? Object.entries(u.parametri).map(([k, d]) => `
    <div class="giunto">
      <label for="u-${k}">${d.it}</label>
      <input type="range" id="u-${k}" data-u="${k}" min="${d.min}" max="${d.max}" step="${d.passo}" value="${utensili.parametri[k]}">
      <span class="num" id="uo-${k}" style="font-size:12px;text-align:right">${utensili.parametri[k]} ${d.unita}</span>
    </div>`).join('') : '';
}

async function scegliUtensile(tipo, parametri) {
  if (tipo !== 'pinza') {
    try { await caricaModuli(); } catch (e) {
      document.getElementById('infoUtensile').textContent = 'Non riesco a caricare gli utensili: ' + e.message;
      return;
    }
    if (!utensili.moduli.G.UTENSILI[tipo]) tipo = 'pinza';
  }
  const p = tipo === 'pinza' ? {} : { ...utensili.moduli.G.predefiniti(tipo), ...(parametri || {}) };
  utensili.tipo = tipo; utensili.parametri = p;
  document.getElementById('sceltaUtensile').value = tipo;
  mostraParametriUtensile();
  await montaUtensile(tipo, p);
}

(() => {
  const scelta = document.getElementById('sceltaUtensile');
  // l'elenco degli utensili arriva da Parts: finché non è caricato c'è solo la pinza
  const riempi = () => {
    const U = utensili.moduli?.G.UTENSILI || {};
    scelta.innerHTML = '<option value="pinza">Pinza di serie</option>'
      + Object.entries(U).map(([k, u]) => `<option value="${k}">${u.nome.it}</option>`).join('');
    scelta.value = utensili.tipo;
  };
  riempi();
  mostraParametriUtensile();
  caricaModuli().then(riempi).catch(() => {});

  scelta.addEventListener('change', () => scegliUtensile(scelta.value));
  let attesa = null;
  document.getElementById('parametriUtensile').addEventListener('input', e => {
    const k = e.target.dataset.u;
    if (!k) return;
    utensili.parametri[k] = +e.target.value;
    const d = utensili.moduli.G.UTENSILI[utensili.tipo].parametri[k];
    document.getElementById('uo-' + k).textContent = `${utensili.parametri[k]} ${d.unita}`;
    clearTimeout(attesa);
    attesa = setTimeout(() => montaUtensile(utensili.tipo, utensili.parametri), 60);
  });
  document.getElementById('btnStlUtensile').addEventListener('click', () => {
    if (!utensili.ultimo) return;
    const nome = `orbinel-${utensili.tipo}-${Object.values(utensili.parametri).map(v => String(v).replace('.', '_')).join('-')}.stl`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([utensili.moduli.G.stl(utensili.ultimo.mesh)], { type: 'model/stl' }));
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // a modello caricato rimonta l'utensile dell'ultima volta
  document.addEventListener('motion:modello', () => {
    const s = salvato('utensile');
    setTimeout(() => {
      if (s && s.tipo !== 'pinza') scegliUtensile(s.tipo, s.parametri);
      else montaUtensile('pinza', {});
    });
  });
})();
