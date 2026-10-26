// Scena 3D del braccio con three.js: i pezzi sono gli STL della cartella del robot, appesi a una catena di
// nodi, uno per giunto, così basta ruotare i nodi per muovere il braccio.
'use strict';

class Scena {
  constructor(contenitore) {
    this.contenitore = contenitore;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.outputEncoding = THREE.sRGBEncoding;
    contenitore.appendChild(r.domElement);

    const s = this.scena = new THREE.Scene();
    s.background = new THREE.Color(0x15171b);
    const cam = this.camera = new THREE.PerspectiveCamera(40, 1, 5, 5000);
    cam.up.set(0, 0, 1);
    cam.position.set(620, -520, 430);
    this.controlli = new THREE.OrbitControls(cam, r.domElement);
    this.controlli.target.set(90, 0, 160);
    this.controlli.enableDamping = true;

    s.add(new THREE.HemisphereLight(0xdfe6f0, 0x2a2622, 0.75));
    const sole = new THREE.DirectionalLight(0xffffff, 0.75);
    sole.position.set(400, -600, 900);
    s.add(sole);
    const contro = new THREE.DirectionalLight(0xbfd0ff, 0.25);
    contro.position.set(-500, 400, 300);
    s.add(contro);

    const griglia = new THREE.GridHelper(1000, 20, 0x3a3f47, 0x262a30);
    griglia.rotation.x = Math.PI / 2;
    s.add(griglia);
    // cerchio della portata massima del polso
    const portata = new THREE.RingGeometry(ROBOT.a2 + ROBOT.d4 - 1, ROBOT.a2 + ROBOT.d4 + 1, 96);
    s.add(new THREE.Mesh(portata, new THREE.MeshBasicMaterial({ color: 0x3d4a5c, side: THREE.DoubleSide })));

    this.materiali = {
      pezzo: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.05 }),   // PETG nero
      servo: new THREE.MeshStandardMaterial({ color: 0x5c6672, roughness: 0.5, metalness: 0.15 }),
      fisso: new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6 }),
      errore: new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.55 }),
    };

    this.bersaglio = new THREE.Mesh(new THREE.SphereGeometry(6, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
    this.bersaglio.visible = false;
    s.add(this.bersaglio);

    this.scia = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4cc3ff }));
    s.add(this.scia);
    this.puntiScia = [];

    new ResizeObserver(() => this.ridimensiona()).observe(contenitore);
    this.ridimensiona();
    const ciclo = () => { this.controlli.update(); r.render(s, cam); requestAnimationFrame(ciclo); };
    ciclo();

    // Maiusc + clic: sceglie il punto per la pinza (suPunto); Maiusc + movimento: anteprima.
    // Con Maiusc premuto la telecamera non si sposta, così il clic non trascina la vista.
    this.cliccabili = [];
    const scelta = e => {
      const rect = r.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.params.Points.threshold = 6;
      ray.setFromCamera({ x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1 }, cam);
      const v = x => [x.x, x.y, x.z];
      const s = { origine: v(ray.ray.origin), direzione: v(ray.ray.direction), punto: null, tipo: null };
      const oggetto = ray.intersectObjects(this.cliccabili.filter(m => m.visible), false)[0];
      const nuvola = this.nuvola ? ray.intersectObject(this.nuvola).filter(h => this.nuvolaOk[h.index])[0] : null;
      const piano = new THREE.Vector3();
      const suPiano = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), piano);
      const primo = [oggetto && { d: oggetto.distance, punto: v(oggetto.point), tipo: 'oggetto', oggetto: oggetto.object },
        nuvola && { d: nuvola.distance, punto: v(this.nuvolaPunti[nuvola.index]), tipo: 'nuvola' },
        suPiano && { d: ray.ray.origin.distanceTo(piano), punto: v(piano), tipo: 'piano' }]
        .filter(Boolean).sort((a, b) => a.d - b.d)[0];
      if (primo) Object.assign(s, { punto: primo.punto, tipo: primo.tipo, oggetto: primo.oggetto || null });
      return s;
    };
    let attesa = false;
    r.domElement.addEventListener('pointerdown', e => {
      if (e.shiftKey && this.suPunto) this.suPunto(scelta(e), false);
    });
    r.domElement.addEventListener('pointermove', e => {
      if (!e.shiftKey || !this.suPunto || attesa) return;
      attesa = true;
      requestAnimationFrame(() => { attesa = false; this.suPunto(scelta(e), true); });
    });
    const maiusc = e => {
      if (e.key !== 'Shift') return;
      this.controlli.enabled = e.type === 'keyup';
      if (e.type === 'keyup') this.suPunto?.(null, true);
    };
    addEventListener('keydown', maiusc);
    addEventListener('keyup', maiusc);
  }

  ridimensiona() {
    const w = this.contenitore.clientWidth, h = this.contenitore.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async carica(avanzamento) {
    const nomi = new Set(['servo']);
    Object.values(ROBOT.link).forEach(l => { l.pezzi.forEach(n => nomi.add(n)); (l.fissi || []).forEach(n => nomi.add(n)); });
    Object.values(ROBOT.dita).forEach(n => nomi.add(n));
    // online i pezzi arrivano tutti in pacchetto.bin (pubblica.py); gli STL singoli restano per quelli che mancano
    const geo = await leggiPacchetto(`${ROBOT.cartella}/pacchetto.bin`, nomi, avanzamento);
    let fatti = Object.keys(geo).length;
    await Promise.all([...nomi].filter(nome => !geo[nome]).map(async nome => {
      const r = await fetch(`${ROBOT.cartella}/${nome}.stl`);
      if (!r.ok) throw new Error(`manca ${ROBOT.cartella}/${nome}.stl`);
      geo[nome] = leggiStl(await r.arrayBuffer());
      avanzamento?.(++fatti / nomi.size);
    }));

    this.geo = geo;

    // catena dei nodi: ogni nodo sta nell'origine del suo giunto, relativa al nodo precedente
    this.nodi = [];
    let padre = this.scena, prima = [0, 0, 0];
    const genitori = { base: this.scena };
    ROBOT.giunti.forEach(g => {
      const n = new THREE.Group();
      n.position.set(g.origine[0] - prima[0], g.origine[1] - prima[1], g.origine[2] - prima[2]);
      padre.add(n);
      this.nodi.push(n);
      genitori[g.link] = n;
      padre = n; prima = g.origine;
    });
    const origineDi = link => (ROBOT.giunti.find(g => g.link === link) || { origine: [0, 0, 0] }).origine;

    this.mesh = [];
    const aggiungi = (geometria, materiale, link, matrice) => {
      const m = new THREE.Mesh(geometria, materiale);
      const o = origineDi(link);
      const sposta = new THREE.Matrix4().makeTranslation(-o[0], -o[1], -o[2]);
      m.matrixAutoUpdate = false;
      m.matrix.copy(matrice ? sposta.multiply(matrice) : sposta);
      genitori[link].add(m);
      this.mesh.push(m);
      return m;
    };
    for (const [link, def] of Object.entries(ROBOT.link)) {
      def.pezzi.forEach(n => { aggiungi(geo[n], this.materiali.pezzo, link).userData.pezzo = n; });
      (def.fissi || []).forEach(n => aggiungi(geo[n], this.materiali.fisso, link));
      def.servo.forEach(i => {
        const f = ROBOT.servoPose[i];
        const m = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(f[3], f[4], f[5]), new THREE.Vector3(f[6], f[7], f[8]), new THREE.Vector3(f[9], f[10], f[11]));
        m.setPosition(f[0], f[1], f[2]);
        aggiungi(geo.servo, this.materiali.servo, link, m).userData.pezzo = 'servo' + i;
      });
    }
    this.dita = {
      sx: aggiungi(geo[ROBOT.dita.sx], this.materiali.pezzo, 'utensile'),
      dx: aggiungi(geo[ROBOT.dita.dx], this.materiali.pezzo, 'utensile'),
    };
    this.baseDita = { sx: this.dita.sx.matrix.clone(), dx: this.dita.dx.matrix.clone() };
  }

  // q in gradi, pinza = apertura di ogni dito in mm
  posa(q, pinza) {
    if (!this.nodi) return;
    ROBOT.giunti.forEach((g, i) => {
      this.nodi[i].quaternion.setFromAxisAngle(new THREE.Vector3(...g.asse), (q[i] || 0) * RAD);
    });
    const d = pinza - ROBOT.pinza.disegno;
    this.dita.sx.matrix.copy(new THREE.Matrix4().makeTranslation(0, d, 0).multiply(this.baseDita.sx));
    this.dita.dx.matrix.copy(new THREE.Matrix4().makeTranslation(0, -d, 0).multiply(this.baseDita.dx));
  }

  segnala(errore) {
    for (const m of this.mesh) {
      if (m.material === this.materiali.pezzo || m.material === this.materiali.errore)
        m.material = errore ? this.materiali.errore : this.materiali.pezzo;
    }
  }

  // ok = false: punto non raggiungibile (pallino rosso)
  mostraBersaglio(p, ok = true) {
    this.bersaglio.visible = !!p;
    if (p) this.bersaglio.position.set(...p);
    this.bersaglio.material.color.set(ok ? 0xff8a3d : 0xff4d4d);
  }

  aggiungiScia(p) {
    this.puntiScia.push(new THREE.Vector3(...p));
    if (this.puntiScia.length > 2000) this.puntiScia.shift();
    this.scia.geometry.setFromPoints(this.puntiScia);
  }
  pulisciScia() { this.puntiScia = []; this.scia.geometry.setFromPoints([]); }

  // punti raggiungibili dalla pinza: verdi se la posa è valida, rossi se no
  mostraNuvola(punti) {
    if (this.nuvola) { this.scena.remove(this.nuvola); this.nuvola.geometry.dispose(); this.nuvola = null; }
    if (!punti) return;
    const pos = new Float32Array(punti.length * 3), col = new Float32Array(punti.length * 3);
    punti.forEach((p, i) => {
      pos.set(p.p, i * 3);
      col.set(p.ok ? [0.18, 0.75, 0.44] : [0.8, 0.25, 0.22], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.nuvolaPunti = punti.map(p => p.p);
    this.nuvolaOk = punti.map(p => p.ok);
    this.nuvola = new THREE.Points(g, new THREE.PointsMaterial({ size: 7, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false }));
    this.scena.add(this.nuvola);
  }

  // freccia del carico in punta alla pinza
  mostraCarico(p, grammi) {
    if (!this.freccia) {
      this.freccia = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 60, 0xff8a3d, 16, 10);
      this.scena.add(this.freccia);
    }
    this.freccia.visible = grammi > 0;
    if (grammi > 0) {
      this.freccia.position.set(p[0], p[1], p[2]);
      this.freccia.setLength(30 + grammi * 0.15, 14, 9);
    }
  }

  vista(nome) {
    const viste = {
      prospettiva: [[620, -520, 430], [90, 0, 160]],
      fronte: [[900, 0, 200], [90, 0, 180]],
      lato: [[90, -900, 200], [90, 0, 180]],
      alto: [[90, -1, 1000], [90, 0, 0]],
    };
    const [p, t] = viste[nome];
    this.camera.position.set(...p);
    this.controlli.target.set(...t);
  }
}

// Pacchetto dei pezzi scritto da pubblica.py (impacchetta): vertici condivisi in passi da 0,5 mm, indici e
// normali dei triangoli su un byte. Restituisce le geometrie dei nomi chiesti, {} se il pacchetto non c'è.
async function leggiPacchetto(url, nomi, avanzamento) {
  let buffer;
  try {
    const r = await fetch(url);
    if (!r.ok) return {};
    const totale = +r.headers.get('content-length') || 0, parti = [];
    let letti = 0;
    for (const lettore = r.body.getReader(); ;) {
      const { done, value } = await lettore.read();
      if (done) break;
      parti.push(value);
      letti += value.length;
      if (totale) avanzamento?.(Math.min(letti / totale, 1) * 0.95);
    }
    buffer = await new Blob(parti).arrayBuffer();
  } catch (e) { return {}; }
  const dv = new DataView(buffer), testo = new TextDecoder();
  if (testo.decode(new Uint8Array(buffer, 0, 4)) !== 'ORB1') return {};
  const PASSO = 0.5, voci = [];
  let o = 8;
  for (let k = dv.getUint32(4, true); k > 0; k--) {
    const l = dv.getUint8(o);
    voci.push({ nome: testo.decode(new Uint8Array(buffer, o + 1, l)), nv: dv.getUint32(o + 1 + l, true), nt: dv.getUint32(o + 5 + l, true) });
    o += 9 + l;
  }
  const allinea = x => (x + 3) & ~3, geo = {};
  o = allinea(o);
  for (const { nome, nv, nt } of voci) {
    const v = new Int16Array(buffer, o, nv * 3); o = allinea(o + nv * 6);
    const idx = nv < 65536 ? new Uint16Array(buffer, o, nt * 3) : new Uint32Array(buffer, o, nt * 3);
    o = allinea(o + idx.byteLength);
    const nr = new Int8Array(buffer, o, nt * 3); o = allinea(o + nt * 3);
    if (!nomi.has(nome)) continue;
    const pos = new Float32Array(nt * 9), nor = new Float32Array(nt * 9);
    for (let i = 0; i < nt * 3; i++) {
      const a = idx[i] * 3, t = Math.floor(i / 3) * 3;
      pos[i * 3] = v[a] * PASSO; pos[i * 3 + 1] = v[a + 1] * PASSO; pos[i * 3 + 2] = v[a + 2] * PASSO;
      nor[i * 3] = nr[t] / 127; nor[i * 3 + 1] = nr[t + 1] / 127; nor[i * 3 + 2] = nr[t + 2] / 127;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo[nome] = g;
  }
  return geo;
}

function leggiStl(buffer) {
  const dv = new DataView(buffer);
  const n = dv.getUint32(80, true);
  const pos = new Float32Array(n * 9), nor = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50;
    const nx = dv.getFloat32(o, true), ny = dv.getFloat32(o + 4, true), nz = dv.getFloat32(o + 8, true);
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < 3; j++) pos[i * 9 + k * 3 + j] = dv.getFloat32(o + 12 + k * 12 + j * 4, true);
      nor[i * 9 + k * 3] = nx; nor[i * 9 + k * 3 + 1] = ny; nor[i * 9 + k * 3 + 2] = nz;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}
