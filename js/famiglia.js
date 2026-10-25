// Animazione della home: la famiglia di robot Orbinel. I pezzi veri di Kheiron e quattro concept (SCARA, cobot,
// doppio braccio, base mobile) si montano dall'esploso, lavorano e si smontano. Nata in strumenti/bozze-home2.html.
// Contenitore: [data-famiglia] con dentro .vista, .didascalia e .caricando.
'use strict';
(async () => {
  const box = document.querySelector('[data-famiglia]');
  if (!box || typeof Scena === 'undefined') return;
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const piccolo = matchMedia('(max-width: 700px)').matches;
  const fisso = new URLSearchParams(location.search).get('t') ?? (fermo ? '4' : null);
  // si carica dopo la pagina, per non rallentare la prima schermata
  await new Promise(ok => (document.readyState === 'complete' ? ok() : addEventListener('load', ok, { once: true })));
  await new Promise(ok => (window.requestIdleCallback ? requestIdleCallback(ok, { timeout: 1500 }) : setTimeout(ok, 300)));
  ROBOT.cartella = 'motion/' + ROBOT.cartella;
  const sc = new Scena(box.querySelector('.vista'));
  const s = sc.scena, r = sc.renderer;
  r.setPixelRatio(Math.min(devicePixelRatio || 1, piccolo ? 1.5 : 2));
  // disegna solo quando la scena è sullo schermo e la scheda è aperta
  let visibile = true;
  new IntersectionObserver(v => { visibile = v[0].isIntersecting; }).observe(box);
  const disegna = r.render.bind(r);
  r.render = (...a) => { if (visibile && !document.hidden) disegna(...a); };

  // --- aspetto da studio: tono cinematografico, riflessi d'ambiente, ombre morbide ---
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.9;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  s.background = new THREE.Color(0x0B0D10);
  s.environment = new THREE.PMREMGenerator(r).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  s.children.filter(o => o.isLight || o.type === 'GridHelper' || o.geometry?.type === 'RingGeometry').forEach(o => s.remove(o));
  s.add(new THREE.HemisphereLight(0xdfe6f0, 0x1a1712, 0.25));
  const chiave = new THREE.DirectionalLight(0xffffff, 1.6);
  chiave.position.set(350, -450, 900);
  chiave.castShadow = true;
  chiave.shadow.mapSize.set(piccolo ? 1024 : 2048, piccolo ? 1024 : 2048);
  Object.assign(chiave.shadow.camera, { left: -500, right: 500, top: 500, bottom: -500, near: 100, far: 2500 });
  chiave.shadow.radius = 6;
  chiave.shadow.bias = -0.0005;
  s.add(chiave);
  const bordo = new THREE.DirectionalLight(0xff6b2c, 1.2);      // luce arancione di contorno, da dietro
  bordo.position.set(-600, 500, 300);
  s.add(bordo);
  const pavimento = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.45 }));
  pavimento.receiveShadow = true;
  s.add(pavimento);

  // materiali: PETG nero satinato, servo grigio scuro
  Object.assign(sc.materiali.pezzo, { roughness: 0.42, metalness: 0.0, envMapIntensity: 0.22 });
  sc.materiali.pezzo.color.set(0x0a0b0d);
  Object.assign(sc.materiali.servo, { roughness: 0.4, metalness: 0.3, envMapIntensity: 0.35 });
  sc.materiali.servo.color.set(0x1c1f24);

  sc.camera.fov = 30; sc.camera.updateProjectionMatrix();
  sc.controlli.enabled = false;
  sc.controlli.update = () => {};

  await sc.carica();
  box.querySelector('.caricando')?.remove();
  sc.mesh.filter(m => m.material === sc.materiali.fisso).forEach(m => { m.visible = false; });

  // tutto il braccio in un gruppo, così si può spostare sopra la base mobile
  const braccio = new THREE.Group();
  s.add(braccio);
  [...s.children].filter(o => o === sc.nodi[0] || sc.mesh.includes(o)).forEach(o => braccio.add(o));

  // --- base mobile (concept): telaio arrotondato, quattro ruote, sensore davanti ---
  const plastica = sc.materiali.pezzo, gomma = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 });
  const arancio = new THREE.MeshStandardMaterial({ color: 0xff6b2c, roughness: 0.5 });
  const R = 52, base = new THREE.Group(), pezziBase = [];
  const forma = new THREE.Shape(), w = 300, h = 230, rr = 40;
  forma.moveTo(-w / 2 + rr, -h / 2); forma.lineTo(w / 2 - rr, -h / 2); forma.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
  forma.lineTo(w / 2, h / 2 - rr); forma.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2); forma.lineTo(-w / 2 + rr, h / 2);
  forma.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr); forma.lineTo(-w / 2, -h / 2 + rr); forma.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  const telaio = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 62, bevelEnabled: true, bevelSize: 8, bevelThickness: 8, bevelSegments: 4, curveSegments: 12 }), plastica);
  telaio.position.set(40, 0, R - 18);
  pezziBase.push(telaio);
  for (const [x, y] of [[-60, -138], [140, -138], [-60, 138], [140, 138]]) {
    const ruota = new THREE.Group();
    const gomme = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 38, 48), gomma);
    const mozzo = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.45, R * 0.45, 40, 32), sc.materiali.servo);
    const anello = new THREE.Mesh(new THREE.TorusGeometry(R * 0.47, 2.2, 8, 40), arancio);
    anello.rotation.x = Math.PI / 2; anello.position.y = Math.sign(y) * 20.5;
    ruota.add(gomme, mozzo, anello);
    ruota.position.set(x, y, R);
    pezziBase.push(ruota);
  }
  const sensore = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 26, 40), sc.materiali.servo);
  sensore.rotation.x = Math.PI / 2; sensore.position.set(170, 0, R - 18 + 70 + 13);
  pezziBase.push(sensore);
  pezziBase.forEach(p => base.add(p));
  s.add(base);
  const altezzaBase = R - 18 + 70;      // dove appoggia il braccio sul telaio


  // --- famiglia di concept: stessi materiali, giunti con servo e anello arancione ---
  const nero = sc.materiali.pezzo, grigio = sc.materiali.servo, X90 = Math.PI / 2;
  const cilindro = (r, h, mat = nero, seg = 48) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);   // asse y
  const verticale = m => { m.rotation.x = X90; return m; };                                                        // asse z
  const asta = (L, W, T, mat = nero) => {           // link arrotondato lungo +x, da 0 a L
    const sh = new THREE.Shape(), r = W / 2;
    sh.moveTo(0, -r); sh.lineTo(L, -r); sh.absarc(L, 0, r, -X90, X90, false); sh.lineTo(0, r); sh.absarc(0, 0, r, X90, X90 * 3, false);
    const g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 3, curveSegments: 24 });
    g.translate(0, 0, -T / 2);
    return new THREE.Mesh(g, mat);
  };
  const disco = (r, h) => {                         // giunto: servo grigio, fascia nera, anello arancione; asse y
    const g = new THREE.Group();
    g.add(cilindro(r, h, grigio), cilindro(r * 1.03, h * 0.4));
    const a = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, 1.6, 8, 48), arancio);
    a.rotation.x = X90; a.position.y = h * 0.5; g.add(a);
    return g;
  };
  const famiglia = {};

  // SCARA · 4 assi: colonna, due bracci orizzontali, asse verticale che scende, rotazione dell'utensile
  (() => {
    const g = new THREE.Group(), parti = [];
    const plinto = verticale(cilindro(85, 22)); plinto.position.z = 11;
    const colonna = verticale(cilindro(46, 210)); colonna.position.z = 127;
    const j1 = new THREE.Group(); j1.position.z = 250;
    const d1 = verticale(disco(54, 44));
    const l1 = asta(240, 84, 40);
    const j2 = new THREE.Group(); j2.position.set(240, 0, 44);
    const d2 = verticale(disco(44, 38));
    const l2 = asta(205, 68, 34);
    const testa = new THREE.Group(); testa.position.x = 205;
    const corpo = verticale(cilindro(30, 80, grigio)); corpo.position.z = 10;
    const asse3 = new THREE.Group();
    const stelo = verticale(cilindro(9, 240, grigio)); stelo.position.z = -60;
    const utensile = new THREE.Group(); utensile.position.z = -180;
    const flangia = verticale(cilindro(22, 12)); const ventosa = verticale(cilindro(15, 18, arancio)); ventosa.position.z = -14;
    utensile.add(flangia, ventosa);
    asse3.add(stelo, utensile);
    testa.add(corpo, asse3);
    j2.add(d2, l2, testa);
    j1.add(d1, l1, j2);
    g.add(plinto, colonna, j1);
    parti.push(plinto, colonna, d1, l1, d2, l2, corpo, asse3);
    famiglia.scara = { g, parti, muovi: k => {
      const w = Math.sin(k * Math.PI * 2);
      j1.rotation.z = 0.9 * w; j2.rotation.z = -1.3 * w + 0.4 * Math.sin(k * Math.PI);
      asse3.position.z = -70 * Math.pow(Math.sin(k * Math.PI * 3), 2); utensile.rotation.z = 3 * k;
    }, camera: [[1020, -940, 730], [160, 0, 170]] };
  })();

  // Cobot · 7 assi: catena snella, giunti alternati attorno a z e a y
  (() => {
    const g = new THREE.Group(), parti = [];
    const base = verticale(cilindro(62, 60)); base.position.z = 30;
    const J = [];
    const giunto = (padre, z, asseZ, r, h) => {
      const j = new THREE.Group(); j.position.z = z; padre.add(j);
      const d = disco(r, h); if (asseZ) verticale(d);
      j.add(d); parti.push(d); J.push({ j, asseZ }); return j;
    };
    const tubo = (padre, z, r, h) => { const t = verticale(cilindro(r, h)); t.position.z = z; padre.add(t); parti.push(t); return t; };
    g.add(base); parti.push(base);
    const j1 = giunto(g, 82, true, 48, 44);
    tubo(j1, 85, 34, 110);
    const j2 = giunto(j1, 170, false, 44, 70);
    tubo(j2, 100, 30, 160);
    const j3 = giunto(j2, 190, true, 38, 38);
    const j4 = giunto(j3, 44, false, 38, 60);
    tubo(j4, 90, 26, 140);
    const j5 = giunto(j4, 172, true, 32, 32);
    const j6 = giunto(j5, 38, false, 30, 50);
    const j7 = giunto(j6, 44, true, 26, 26);
    const pinza = new THREE.Group(); pinza.position.z = 30;
    const palmo = verticale(cilindro(20, 18)); const dx = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 34), nero); dx.position.set(9, 0, 24);
    const sx = dx.clone(); sx.position.x = -9; pinza.add(palmo, dx, sx); j7.add(pinza); parti.push(pinza);
    g.add(base);
    famiglia.cobot = { g, parti, muovi: k => {
      const a = k * Math.PI * 2, w = Math.sin(a);
      j1.rotation.z = 0.8 * w; j2.rotation.y = 0.55 * Math.sin(k * Math.PI); j3.rotation.z = 0.5 * Math.cos(a);
      j4.rotation.y = 1.25 * Math.sin(k * Math.PI); j5.rotation.z = -0.6 * w; j6.rotation.y = 0.8 * Math.sin(k * Math.PI); j7.rotation.z = 2 * k;
    }, camera: [[1120, -1020, 860], [60, 0, 330]] };
  })();

  // Doppio braccio · 2 × 5 assi: busto che ruota, due braccia che si muovono insieme
  (() => {
    const g = new THREE.Group(), parti = [];
    const plinto = verticale(cilindro(95, 30)); plinto.position.z = 15;
    const busto = new THREE.Group(); busto.position.z = 30; g.add(plinto, busto); parti.push(plinto);
    const colonna = verticale(cilindro(52, 300)); colonna.position.z = 150; busto.add(colonna); parti.push(colonna);
    const spalle = asta(260, 70, 60); spalle.rotation.z = X90; spalle.position.set(0, -130, 330); busto.add(spalle); parti.push(spalle);
    const testa = verticale(disco(34, 40)); testa.position.z = 390; busto.add(testa); parti.push(testa);
    const sensore = new THREE.Mesh(new THREE.BoxGeometry(18, 50, 14), arancio); sensore.position.set(30, 0, 395); busto.add(sensore); parti.push(sensore);
    const braccia = [-1, 1].map(lato => {
      const j1 = new THREE.Group(); j1.position.set(0, lato * 150, 330); busto.add(j1);
      const d1 = disco(40, 46); d1.position.y = lato * 8; j1.add(d1); parti.push(d1);
      const j2 = new THREE.Group(); j2.position.y = lato * 40; j1.add(j2);
      const omero = asta(150, 52, 34); omero.rotation.y = X90; j2.add(omero); parti.push(omero);
      const j3 = new THREE.Group(); j3.position.z = -150; j2.add(j3);
      const d3 = disco(30, 40); j3.add(d3); parti.push(d3);
      const avambraccio = asta(130, 42, 28); avambraccio.rotation.y = X90; j3.add(avambraccio); parti.push(avambraccio);
      const j4 = new THREE.Group(); j4.position.z = -130; j3.add(j4);
      const d4 = verticale(disco(22, 30)); j4.add(d4); parti.push(d4);
      const j5 = new THREE.Group(); j5.position.z = -22; j4.add(j5);
      const mano = new THREE.Group();
      const palmo = new THREE.Mesh(new THREE.BoxGeometry(40, 28, 20), nero);
      const dito1 = new THREE.Mesh(new THREE.BoxGeometry(8, 22, 34), grigio); dito1.position.set(14, 0, -24);
      const dito2 = dito1.clone(); dito2.position.x = -14;
      mano.add(palmo, dito1, dito2); mano.position.z = -12; j5.add(mano); parti.push(mano);
      return { lato, j1, j2, j3, j4, j5 };
    });
    famiglia.duo = { g, parti, muovi: k => {
      const a = Math.sin(k * Math.PI), w = Math.sin(k * Math.PI * 2);
      busto.rotation.z = 0.5 * w;
      braccia.forEach(br => {
        br.j1.rotation.y = -1.25 * a;                       // spalla in avanti
        br.j2.rotation.x = br.lato * (0.35 - 0.15 * a);     // braccia leggermente aperte
        br.j3.rotation.y = -0.9 * a;                        // gomito
        br.j4.rotation.z = 0.6 * w * br.lato;
        br.j5.rotation.y = 0.35 * a;
      });
    }, camera: [[680, -1480, 760], [60, 0, 280]] };
  })();

  Object.values(famiglia).forEach(c => { c.g.visible = false; s.add(c.g); c.g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); });
  Object.values(famiglia).forEach(c => c.parti.forEach((pz, i) => {
    pz.userData.base = pz.position.clone(); pz.userData.rot = pz.quaternion.clone();
    pz.userData.dir = new THREE.Vector3((Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, 90 + Math.random() * 160);
    pz.userData.asse = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    pz.userData.ritardo = i / c.parti.length;
  }));

  [...sc.mesh, ...pezziBase].forEach(m => m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }));

  // --- esploso: ogni pezzo ha una posizione di partenza lontana e una rotazione ---
  let seme = 11; const caso = () => { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; };
  const ordineLink = ['base', 'torretta', 'braccio', 'avambraccio', 'polsoA', 'polsoB', 'utensile'];
  const pezzi = [];
  sc.mesh.filter(m => m.visible).forEach(m => {
    m.geometry.computeBoundingSphere();
    const c = m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrix);
    const dir = new THREE.Vector3(c.x - 80, c.y, Math.max(0, c.z - 120) * 0.6).normalize().multiplyScalar(150 + caso() * 90);   // esploso contenuto: i pezzi restano nell'inquadratura
    dir.z += 70 + caso() * 90;
    const genitore = m.parent, livello = genitore === braccio ? 0 : sc.nodi.indexOf(genitore) + 1;
    pezzi.push({ m, base: m.matrix.clone(), c, dir, asse: new THREE.Vector3(caso() - 0.5, caso() - 0.5, caso() - 0.5).normalize(), giro: (caso() - 0.5) * 3, livello });
  });
  pezzi.sort((a, b) => a.livello - b.livello || a.c.z - b.c.z);
  pezzi.forEach((p, i) => { p.ritardo = i / pezzi.length; });
  pezziBase.forEach((p, i) => { p.userData.base = p.position.clone(); p.userData.rot = p.rotation.clone(); p.userData.dir = new THREE.Vector3((caso() - 0.5) * 300, (caso() - 0.5) * 300, 120 + caso() * 160); p.userData.ritardo = i / pezziBase.length; });

  const liscia = k => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - Math.pow(1 - k, 3));     // arrivo morbido
  const clamp = k => Math.max(0, Math.min(1, k));
  // monta = 1 tutto al suo posto, 0 tutto in esploso
  const esplodiBraccio = monta => pezzi.forEach(p => {
    const k = liscia(clamp((monta - p.ritardo * 0.55) / 0.45)), e = 1 - k;
    const M = new THREE.Matrix4().makeTranslation(p.dir.x * e, p.dir.y * e, p.dir.z * e)
      .multiply(new THREE.Matrix4().makeTranslation(p.c.x, p.c.y, p.c.z))
      .multiply(new THREE.Matrix4().makeRotationAxis(p.asse, p.giro * e))
      .multiply(new THREE.Matrix4().makeTranslation(-p.c.x, -p.c.y, -p.c.z))
      .multiply(p.base);
    p.m.matrix.copy(M);
    p.m.visible = k > 0.001;
  });
  const esplodiBase = monta => pezziBase.forEach(p => {
    const k = liscia(clamp((monta - p.userData.ritardo * 0.5) / 0.5)), e = 1 - k;
    p.position.copy(p.userData.base).addScaledVector(p.userData.dir, e);
    p.rotation.set(p.userData.rot.x + e * 2, p.userData.rot.y, p.userData.rot.z + e * 1.5);
    p.visible = k > 0.001;
  });

  const esplodiConcept = (c, monta) => c.parti.forEach(pz => {
    const k = liscia(clamp((monta - pz.userData.ritardo * 0.55) / 0.45)), e = 1 - k;
    pz.position.copy(pz.userData.base).addScaledVector(pz.userData.dir, e);
    if (!pz.userData.libero) pz.quaternion.copy(pz.userData.rot).multiply(new THREE.Quaternion().setFromAxisAngle(pz.userData.asse, e * 2.5));
    pz.visible = k > 0.001;
  });

  // --- regia: cinque robot, 7 secondi ciascuno: monta (0–2,6), lavora (2,6–6), si smonta (6–7) ---
  const SCENE = [
    { nome: 'kheiron', testo: '<b>Kheiron</b> · 6 assi', camera: [[820, -760, 520], [60, 0, 170]] },
    { nome: 'scara', testo: '<b>SCARA</b> · 4 assi · concept' },
    { nome: 'cobot', testo: '<b>Cobot</b> · 7 assi · concept' },
    { nome: 'duo', testo: '<b>Doppio braccio</b> · 2 × 5 assi · concept' },
    { nome: 'rover', testo: 'Stessi moduli · <b>base mobile</b> · concept', camera: [[1190, -1100, 700], [110, 0, 230]] },
  ];
  const PASSO = 7, DURATA = PASSO * SCENE.length, didascalia = box.querySelector('.didascalia');
  const scrivi = testo => { if (didascalia.dataset.t !== testo) { didascalia.dataset.t = testo; didascalia.innerHTML = testo; } };
  const lavoro = k => [Math.sin(k * Math.PI * 2) * 35, 25 * Math.sin(k * Math.PI), -30 * Math.sin(k * Math.PI), 0, 45 * Math.sin(k * Math.PI), Math.sin(k * Math.PI * 2) * 40];
  const stato = t => {
    const n = Math.floor(t / PASSO) % SCENE.length, sc0 = SCENE[n], u = t % PASSO;
    const monta = clamp(u / 2.6) * (1 - clamp(u - 6)), lavora = clamp((u - 2.6) / 3.4);
    Object.entries(famiglia).forEach(([nome, c]) => { c.g.visible = nome === sc0.nome; });
    braccio.visible = sc0.nome === 'kheiron' || sc0.nome === 'rover';
    base.visible = sc0.nome === 'rover';
    let q = [0, 0, 0, 0, 0, 0];
    if (sc0.nome === 'kheiron') {
      braccio.position.set(0, 0, 0);
      esplodiBraccio(monta);
      if (u > 2.6 && u < 6) q = lavoro(lavora);
    } else if (sc0.nome === 'rover') {
      braccio.position.set(0, 0, altezzaBase);
      esplodiBase(clamp(u / 1.8) * (1 - clamp(u - 6)));
      esplodiBraccio(clamp((u - 0.9) / 2) * (1 - clamp(u - 6)));
      base.position.x = braccio.position.x = Math.sin(lavora * Math.PI) * 90;
      pezziBase.slice(1, 5).forEach(ru => { ru.rotation.y = -lavora * 6; });
      if (u > 2.6 && u < 6) q = lavoro(lavora);
    } else {
      const c = famiglia[sc0.nome];
      c.muovi(u > 2.6 && u < 6 ? lavora : 0);
      esplodiConcept(c, monta);
    }
    sc.posa(q, 12);
    scrivi(u > 0.4 && u < 6.2 ? sc0.testo : '');
    // camera che scivola piano, diversa per ogni robot
    const [pos, mira] = sc0.camera || famiglia[sc0.nome].camera, d = u / PASSO, lontano = 0.9 * Math.max(1, 1.2 / sc.camera.aspect) ** 0.7;
    sc.camera.position.set((pos[0] - 100 * d - mira[0]) * lontano + mira[0], (pos[1] + 70 * d - mira[1]) * lontano + mira[1], (pos[2] - mira[2]) * lontano + mira[2]);
    sc.camera.lookAt(...mira);
  };
  stato(fisso !== null ? +fisso : 0);
  document.body.dataset.pronto = '1';
  if (fisso !== null) return;
  let tempo = 0, prima = performance.now();
  (function ciclo(ora) {
    const dt = Math.min(0.1, Math.max(0, ora - prima) / 1000); prima = ora;
    if (visibile && !document.hidden) { tempo = (tempo + dt) % DURATA; stato(tempo); }
    requestAnimationFrame(ciclo);
  })(prima);
})();
