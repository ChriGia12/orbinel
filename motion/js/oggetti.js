// Oggetti accanto al robot, da file STL o un cubo di prova, da prendere con la pinza. Quando le dita
// si chiudono su un oggetto con il punto di presa (TCP) dentro, l'oggetto segue la pinza e il suo peso
// entra nell'analisi delle coppie; quando si riaprono cade sul tavolo o sull'oggetto che c'è sotto.
// Le dita si considerano a 2 × «Pinza (mm)» l'una dall'altra: si prende un oggetto largo fino a 40 mm tra le dita. Gli oggetti restano solo in questa pagina.
'use strict';

const oggetti = {
  lista: [],
  preso: null,          // oggetto nella pinza
  relativa: null,       // posa dell'oggetto rispetto alla pinza al momento della presa
  caricoPrima: 0,       // carico del cursore prima della presa, rimesso al rilascio
  aperturaPrima: 0,     // all'avvio la pinza conta come chiusa: per prendere bisogna prima aprirla
  conta: 0,
};
const materialeOggetto = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.6, metalness: 0.05 });
const materialePreso = new THREE.MeshStandardMaterial({ color: 0x4cc3ff, roughness: 0.5, metalness: 0.05 });

// STL binario o ASCII
function leggiStlOggetto(buffer) {
  const dv = new DataView(buffer);
  const n = buffer.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (84 + n * 50 === buffer.byteLength) return leggiStl(buffer);
  const testo = new TextDecoder().decode(buffer);
  const v = [...testo.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m => [+m[1], +m[2], +m[3]]);
  if (!v.length || v.length % 3) throw new Error('non è un file STL valido');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v.flat()), 3));
  g.computeVertexNormals();
  return g;
}

const ALTO = 2000;     // quota da cui si fa cadere un oggetto spostato: si appoggia su quello che trova
const posizionaOggetto = o => {
  o.mesh.matrix.makeRotationZ(o.rz * RAD).setPosition(o.x, o.y, o.z);
  o.mesh.updateMatrixWorld(true);
};

function aggiungiOggetto(nome, geo) {
  if (geo.index) geo = geo.toNonIndexed();        // il volume si calcola su triangoli separati
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);   // centrato, appoggiato sul piano
  geo.computeBoundingBox();
  const dim = new THREE.Vector3(); geo.boundingBox.getSize(dim);
  // massa stimata: PLA (1,24 g/cm³) al 30 % del pieno; si può correggere nell'elenco
  const massa = Math.max(1, Math.round(proprieta(geo).volume / 1000 * 1.24 * 0.3));
  const mesh = new THREE.Mesh(geo, materialeOggetto);
  mesh.matrixAutoUpdate = false;
  const k = oggetti.conta++;
  const o = { id: k, nome, mesh, dim, massa, x: 230, y: -90 + (k % 4) * 60, z: ALTO, rz: 0 };
  posizionaOggetto(o);
  scena.scena.add(mesh);
  scena.cliccabili.push(mesh);
  oggetti.lista.push(o);
  appoggia(o);
  mostraOggetti();
  if (Math.max(dim.x, dim.y, dim.z) > 400) avviso(`«${nome}» è più grande di 40 cm: il file è in millimetri?`);
}

function togliOggetto(o) {
  if (oggetti.preso === o) rilascia(false);
  scena.scena.remove(o.mesh);
  scena.cliccabili = scena.cliccabili.filter(m => m !== o.mesh);
  o.mesh.geometry.dispose();
  oggetti.lista = oggetti.lista.filter(x => x !== o);
  mostraOggetti();
}

// --- presa ---
function matricePinza(fk) {
  const R = fk.R, p = fk.tcp;
  return new THREE.Matrix4().set(R[0][0], R[0][1], R[0][2], p[0], R[1][0], R[1][1], R[1][2], p[1], R[2][0], R[2][1], R[2][2], p[2], 0, 0, 0, 1);
}

// larghezza dell'oggetto lungo la direzione in cui si chiudono le dita (asse y della pinza):
// proiezione di tutti i vertici, esatta per gli oggetti convessi in qualsiasi orientamento
function larghezza(o, asse) {
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  o.mesh.matrix.extractBasis(x, y, z);
  const a = new THREE.Vector3(...asse), ax = x.dot(a), ay = y.dot(a), az = z.dot(a);
  const v = o.mesh.geometry.attributes.position.array;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    const d = v[i] * ax + v[i + 1] * ay + v[i + 2] * az;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return max - min;
}

function contieneTcp(o, tcp) {
  const p = new THREE.Vector3(...tcp).applyMatrix4(o.mesh.matrix.clone().invert());
  return o.mesh.geometry.boundingBox.clone().expandByScalar(3).containsPoint(p);
}

// Presa realistica: le due dita tengono solo se appoggiano su facce quasi parallele alle loro piastre
// (entro 20°, circa l'attrito di plastica su plastica) e quelle facce stanno davvero sotto le piastre.
// Due spigoli, una punta o una faccia sfiorata con la punta del dito non tengono.
const CONO_PRESA = Math.cos(20 * RAD);
const PIASTRA = { indietro: -20, avanti: 24, lato: 10 };   // mm attorno al TCP: lungo l'avvicinamento e di lato
const colonna = (R, j) => [R[0][j], R[1][j], R[2][j]];

// triangolo (punti 2D) e rettangolo [x0, x1] × [y0, y1] si toccano?
function triangoloNelRettangolo(t, x0, x1, y0, y1) {
  if (t.some(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return true;
  const dentro = ([px, py]) => {
    const s = (a, b) => (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
    const d1 = s(t[0], t[1]), d2 = s(t[1], t[2]), d3 = s(t[2], t[0]);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  if ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].some(dentro)) return true;
  const incrocia = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  const lati = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]];
  return [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].some(([a, b]) => lati.some(([c, d]) => incrocia(a, b, c, d)));
}

function presaStabile(o, fk) {
  const inv = o.mesh.matrix.clone().invert();
  const rot = new THREE.Matrix3().setFromMatrix4(o.mesh.matrix).transpose();
  const loc = v => new THREE.Vector3(...v).applyMatrix3(rot);
  const a = loc(colonna(fk.R, 1)), u = loc(colonna(fk.R, 0)), w = loc(colonna(fk.R, 2));
  const t = new THREE.Vector3(...fk.tcp).applyMatrix4(inv);
  const v = o.mesh.geometry.attributes.position.array;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < v.length; i += 3) { const d = v[i] * a.x + v[i + 1] * a.y + v[i + 2] * a.z; min = Math.min(min, d); max = Math.max(max, d); }
  const appoggi = [false, false];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < v.length && !(appoggi[0] && appoggi[1]); i += 9) {
    A.fromArray(v, i); B.fromArray(v, i + 3); C.fromArray(v, i + 6);
    n.subVectors(C, B).cross(A.clone().sub(B)).normalize();
    if (Math.abs(n.dot(a)) < CONO_PRESA) continue;                      // faccia non parallela alla piastra
    // la faccia tocca il dito se un suo vertice è sul punto più esterno: entro 20° il dito si appoggia
    const d = [A, B, C].map(P => P.dot(a));
    const verso = (d[0] + d[1] + d[2]) / 3 > (min + max) / 2 ? 1 : 0;          // lato dell'oggetto su cui sta
    const lato = verso ? (d.some(x => x >= max - 0.5) ? 1 : -1) : (d.some(x => x <= min + 0.5) ? 0 : -1);
    if (lato < 0 || appoggi[lato]) continue;                            // non sta dove tocca il dito
    const t2 = [A, B, C].map(P => { const r = P.clone().sub(t); return [r.dot(u), r.dot(w)]; });
    if (triangoloNelRettangolo(t2, PIASTRA.indietro, PIASTRA.avanti, -PIASTRA.lato, PIASTRA.lato)) appoggi[lato] = true;
  }
  return appoggi[0] && appoggi[1];
}

// Snap alla presa: con la casella accesa, Maiusc + clic su un oggetto porta la pinza aperta al suo centro,
// con le dita perpendicolari a due facce opposte. Prova l'avvicinamento dall'alto fino a quello orizzontale
// e tiene la posa valida più vicina a quella attuale. Ritorna null se lo snap è spento.
function presaSnap(s) {
  if (!document.getElementById('snapPresa').checked) return null;
  const o = oggetti.lista.find(x => x.mesh === s.oggetto);
  if (!o || oggetti.preso === o) return null;
  const c = o.mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(o.mesh.matrix);
  const p = [c.x, c.y, Math.max(c.z, 16)];                // sotto i 15 mm la pinza tocca il tavolo
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
  o.mesh.matrix.extractBasis(x, y, z);
  const facce = [x, y, z].filter(n => Math.abs(n.z) < 0.7)              // dita in verticale: una finirebbe nel tavolo
    .map(n => ({ n: [n.x, n.y, n.z], w: larghezza(o, [n.x, n.y, n.z]) }))
    .filter(f => f.w < 2 * ROBOT.pinza.corsa - 1);                         // deve stare tra le dita aperte
  let migliore = null, costo = Infinity;
  for (let inc = -90; inc <= 0; inc += 5) {
    const R0 = orientamento(p, inc, 0, stato.q[0]);
    const [x0, y0, z0] = [0, 1, 2].map(j => colonna(R0, j));
    for (const f of facce) {
      if (Math.abs(V.dot(f.n, x0)) > 0.09) continue;                    // la faccia deve guardare le dita
      const th = Math.atan2(V.dot(f.n, z0), V.dot(f.n, y0)) / RAD;
      for (const rot of [th, th > 0 ? th - 180 : th + 180]) {
        const r = inversa(p, orientamento(p, inc, rot, stato.q[0]), stato.q, imp.giunti);
        if (r.errore || controlla(r.q, imp.giunti).length) continue;
        const k = r.q.reduce((t, v, i) => t + Math.abs(v - stato.q[i]), 0);
        if (k < costo) { costo = k; migliore = { q: r.q, inc, rot, w: f.w }; }
      }
    }
  }
  if (!migliore) return { p, posa: null };
  return { p, posa: { q: migliore.q, inc: migliore.inc }, rot: migliore.rot, pinza: Math.min(ROBOT.pinza.corsa, migliore.w / 2 + 4) };
}

function impostaCaricoOggetti(grammi) {
  analisi.carico = grammi;
  document.getElementById('carico').value = grammi;
  document.getElementById('valCarico').textContent = grammi;
  setTimeout(() => impostaPosa(stato.q));      // ricalcola coppie e margini con il nuovo carico
}

function prendi(o, fk) {
  oggetti.preso = o;
  oggetti.relativa = matricePinza(fk).invert().multiply(o.mesh.matrix);
  o.mesh.material = materialePreso;
  oggetti.caricoPrima = analisi.carico;
  impostaCaricoOggetti(o.massa);
  mostraOggetti();
}

// appoggia l'oggetto sotto di sé: sul tavolo o sull'oggetto più alto che ha sotto
function appoggia(o) {
  o.mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o.mesh);
  let sotto = 0;
  for (const altro of oggetti.lista) {
    if (altro === o || altro === oggetti.preso) continue;
    const b = new THREE.Box3().setFromObject(altro.mesh);
    const sopra = box.min.x < b.max.x && box.max.x > b.min.x && box.min.y < b.max.y && box.max.y > b.min.y;
    if (sopra && b.max.z <= box.min.z + 1) sotto = Math.max(sotto, b.max.z);
  }
  o.mesh.matrix.premultiply(new THREE.Matrix4().makeTranslation(0, 0, sotto - box.min.z));
  o.mesh.updateMatrixWorld(true);
  const e = o.mesh.matrix.elements;
  o.x = e[12]; o.y = e[13]; o.z = e[14];
}

function rilascia(rimettiCarico = true) {
  const o = oggetti.preso;
  if (!o) return;
  oggetti.preso = null;
  o.mesh.material = materialeOggetto;
  // cade di piatto: tiene solo la rotazione attorno alla verticale e il centro in pianta
  const e = o.mesh.matrix.elements;
  const centro = new THREE.Box3().setFromObject(o.mesh).getCenter(new THREE.Vector3());
  o.rz = Math.atan2(e[1], e[0]) / RAD;
  o.x = centro.x; o.y = centro.y; o.z = ALTO;
  posizionaOggetto(o);
  appoggia(o);
  if (rimettiCarico) impostaCaricoOggetti(oggetti.caricoPrima);
  mostraOggetti();
}

document.addEventListener('motion:posa', e => {
  if (!scena?.nodi) return;
  const { q, pinza, fk } = e.detail;
  const apertura = 2 * pinza;
  const asse = [fk.R[0][1], fk.R[1][1], fk.R[2][1]];
  const pinzaMontata = typeof utensili === 'undefined' || utensili.pinza;
  if (oggetti.preso) {
    const o = oggetti.preso, w = larghezza(o, asse);
    if (!pinzaMontata || apertura > w + 0.5) rilascia();
    else {
      o.mesh.matrix.multiplyMatrices(matricePinza(fk), oggetti.relativa);
      o.mesh.updateMatrixWorld(true);
      scena.posa(q, Math.max(pinza, w / 2));     // le dita si fermano sull'oggetto
    }
  } else if (pinzaMontata) {
    // si prende solo chiudendo le dita: entrare con la pinza già chiusa non prende niente
    const o = oggetti.lista.find(x => contieneTcp(x, fk.tcp));
    if (o) {
      const w = larghezza(o, asse);
      if (apertura <= w) {
        scena.posa(q, w / 2);                                             // le dita si fermano sull'oggetto
        if (oggetti.aperturaPrima > w) {                                  // le dita lo toccano adesso
          if (presaStabile(o, fk)) prendi(o, fk);
          else avviso('Presa instabile: le dita non appoggiano su due facce opposte (per esempio stringono due spigoli)');
        }
      }
    }
  }
  oggetti.aperturaPrima = apertura;
});

// --- pannello ---
function mostraOggetti() {
  const el = document.getElementById('listaOggetti');
  if (!oggetti.lista.length) { el.innerHTML = '<p class="muted" style="font-size:12px;margin:8px 0 0">Nessun oggetto sul tavolo.</p>'; return; }
  const campo = (o, k, passo = 1) => `<input type="number" data-o="${o.id}" data-k="${k}" step="${passo}" value="${(+o[k]).toFixed(0)}"${oggetti.preso === o ? ' disabled' : ''}>`;
  el.innerHTML = `<table class="oggetti"><thead><tr><th>Oggetto</th><th>X</th><th>Y</th><th>Rot °</th><th>g</th><th></th></tr></thead><tbody>`
    + oggetti.lista.map(o => `<tr>
      <td title="${o.dim.x.toFixed(0)} × ${o.dim.y.toFixed(0)} × ${o.dim.z.toFixed(0)} mm">${oggetti.preso === o ? '✋ ' : ''}${o.nome.replace(/</g, '&lt;')}</td>
      <td>${campo(o, 'x')}</td><td>${campo(o, 'y')}</td><td>${campo(o, 'rz', 15)}</td><td>${campo(o, 'massa')}</td>
      <td><button class="piccolo" data-togli="${o.id}" title="Togli">×</button></td></tr>`).join('')
    + '</tbody></table>';
}

(() => {
  const file = document.getElementById('fileOggetto');
  document.getElementById('btnAggiungiStl').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    for (const f of file.files) {
      try { aggiungiOggetto(f.name.replace(/\.stl$/i, ''), leggiStlOggetto(await f.arrayBuffer())); }
      catch (e) { avviso(`Non riesco a leggere «${f.name}»: ${e.message}`); }
    }
    file.value = '';
  });
  const snap = document.getElementById('snapPresa');
  snap.checked = !!salvato('snap');
  snap.addEventListener('change', () => salva('snap', snap.checked));
  document.getElementById('btnCubo').addEventListener('click', () => {
    if (scena?.scena) aggiungiOggetto('Cubo 30 mm', new THREE.BoxGeometry(30, 30, 30));
  });
  const lista = document.getElementById('listaOggetti');
  lista.addEventListener('change', e => {
    const o = oggetti.lista.find(x => x.id === +e.target.dataset.o);
    if (!o || oggetti.preso === o) return;
    const k = e.target.dataset.k;
    o[k] = k === 'massa' ? Math.max(0, +e.target.value) : +e.target.value;
    if (k !== 'massa') { o.z = ALTO; posizionaOggetto(o); appoggia(o); }
    mostraOggetti();
  });
  lista.addEventListener('click', e => {
    const o = oggetti.lista.find(x => x.id === +e.target.dataset.togli);
    if (o) togliOggetto(o);
  });
  mostraOggetti();
})();
