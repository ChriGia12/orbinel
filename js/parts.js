// Generatore di Orbinel Parts: sceglie l'utensile, regola i parametri, mostra l'anteprima 3D
// e scarica l'STL. La geometria è in parts-geometria.js; three.js arriva da motion/lib.
import Module from './lib/manifold.js';
import { UTENSILI, predefiniti, costruisci, stl } from './parts-geometria.js';

const $ = id => document.getElementById(id);
const html = document.documentElement;
const lingua = () => (html.dataset.lingua === 'it' ? 'it' : 'en');
const DENSITA = 1.27;   // PETG, g/cm³

const stato = { tipo: 'stilo', p: predefiniti('stilo'), M: null, ultimo: null };

// --- anteprima 3D ---
const vista = $('vistaParts');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
vista.prepend(renderer.domElement);
const scena = new THREE.Scene();
scena.background = new THREE.Color(0x101318);
const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
camera.up.set(0, 0, 1);
camera.position.set(110, -130, 90);
const controlli = new THREE.OrbitControls(camera, renderer.domElement);
controlli.target.set(0, 0, 20);
controlli.enableDamping = true;
scena.add(new THREE.HemisphereLight(0xe6ebf2, 0x24201c, 0.8));
const sole = new THREE.DirectionalLight(0xffffff, 0.7); sole.position.set(150, -200, 300); scena.add(sole);
const bordo = new THREE.DirectionalLight(0xff6b2c, 0.9); bordo.position.set(-200, 150, 80); scena.add(bordo);
const griglia = new THREE.GridHelper(200, 20, 0x2e343d, 0x1c2027); griglia.rotation.x = Math.PI / 2; scena.add(griglia);
const materiale = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.45, metalness: 0.15 });
let oggetto = null;

function ridimensiona() {
  const w = vista.clientWidth, h = vista.clientHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(ridimensiona).observe(vista);
(function ciclo() { controlli.update(); renderer.render(scena, camera); requestAnimationFrame(ciclo); })();

function mostraMesh(mesh) {
  const n = mesh.numTri, np = mesh.numProp, v = mesh.vertProperties, t = mesh.triVerts;
  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n * 3; i++) { const j = t[i] * np; pos[i * 3] = v[j]; pos[i * 3 + 1] = v[j + 1]; pos[i * 3 + 2] = v[j + 2]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  if (oggetto) { scena.remove(oggetto); oggetto.geometry.dispose(); }
  oggetto = new THREE.Mesh(g, materiale);
  scena.add(oggetto);
}

// la camera si allontana per i pezzi più grandi, sempre dalla stessa direzione
let inquadrato = 0;
function inquadra(b) {
  const misura = Math.max(...[0, 1, 2].map(k => b.max[k] - b.min[k]));
  if (Math.abs(misura - inquadrato) < 15) return;
  inquadrato = misura;
  const k = Math.max(1, misura / 45);
  controlli.target.set(0, 0, (b.min[2] + b.max[2]) / 2);
  camera.position.set(110 * k, -130 * k, 90 * k);
}

// --- pannello dei parametri ---
function mostraScelta() {
  $('sceltaUtensile').innerHTML = Object.entries(UTENSILI).map(([k, u]) =>
    `<option value="${k}"${k === stato.tipo ? ' selected' : ''}>${u.nome[lingua()]}</option>`).join('');
}

function mostraParametri() {
  const u = UTENSILI[stato.tipo];
  $('descrizioneUtensile').textContent = u.descrizione[lingua()];
  $('parametri').innerHTML = Object.entries(u.parametri).map(([k, d]) => `
    <div class="campo">
      <label for="p-${k}">${d[lingua()]}</label>
      <div class="cursore"><input type="range" id="p-${k}" data-p="${k}" min="${d.min}" max="${d.max}" step="${d.passo}" value="${stato.p[k]}">
      <output id="o-${k}">${stato.p[k]} ${d.unita}</output></div>
    </div>`).join('');
}

function genera() {
  if (!stato.M) return;
  try {
    const r = costruisci(stato.M, stato.tipo, stato.p);
    stato.ultimo?.solido.delete?.();
    stato.ultimo = r;
    mostraMesh(r.mesh);
    const b = r.scatola, cm3 = r.volume / 1000;
    const dim = [0, 1, 2].map(k => (b.max[k] - b.min[k]).toFixed(1)).join(' × ');
    const l = lingua();
    const servo = r.servo ? (l === 'it' ? ' + servo 55 g' : ' + 55 g servo') : '';
    $('infoParts').textContent = `${dim} mm · ${cm3.toFixed(1)} cm³ · ~${(cm3 * DENSITA * 0.55).toFixed(0)} g ${l === 'it' ? 'al 55 %' : 'at 55 %'}${servo}`;
    inquadra(b);
    $('controlliParts').innerHTML = r.controlli.map(c => `<li class="${c.ok ? '' : 'no'}">${c.ok ? '✓' : '✗'} ${c[l]}</li>`).join('');
    $('scaricaParts').disabled = false;
  } catch (e) {
    $('infoParts').textContent = (lingua() === 'it' ? 'Non riesco a generare il pezzo: ' : 'Could not build the part: ') + e.message;
  }
}

let attesa = null;
$('parametri').addEventListener('input', e => {
  const k = e.target.dataset.p;
  if (!k) return;
  stato.p[k] = +e.target.value;
  $('o-' + k).textContent = `${stato.p[k]} ${UTENSILI[stato.tipo].parametri[k].unita}`;
  clearTimeout(attesa);
  attesa = setTimeout(genera, 40);
});
$('sceltaUtensile').addEventListener('change', e => {
  stato.tipo = e.target.value;
  stato.p = predefiniti(stato.tipo);
  mostraParametri();
  genera();
});
$('azzeraParts').addEventListener('click', () => { stato.p = predefiniti(stato.tipo); mostraParametri(); genera(); });
$('scaricaParts').addEventListener('click', () => {
  if (!stato.ultimo) return;
  const nome = `orbinel-${stato.tipo}-${Object.values(stato.p).map(v => String(v).replace('.', '_')).join('-')}.stl`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([stl(stato.ultimo.meshStampa)], { type: 'model/stl' }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// quando cambia la lingua si riscrivono le etichette
new MutationObserver(() => { mostraScelta(); mostraParametri(); genera(); }).observe(html, { attributes: true, attributeFilter: ['data-lingua'] });

mostraScelta();
mostraParametri();
ridimensiona();
Module().then(M => { M.setup(); stato.M = M; genera(); })
  .catch(e => { $('infoParts').textContent = 'manifold-3d: ' + e.message; });
