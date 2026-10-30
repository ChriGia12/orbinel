// Pagina Kheiron: il robot resta fermo sullo schermo e cambia mentre si scorre, un passo alla volta
// (assi, esploso, servo, pinza, movimento: quest'ultimo parte da solo). Riusa la scena di Orbinel Motion (motion/js/scena.js) con
// gli stessi STL. Ogni passo è uno stato (telecamera, esploso, trasparenza, pinza); lo scorrimento
// sceglie dove stare tra due stati e la scena li raggiunge con un inseguimento morbido.
'use strict';

(async () => {
  const racconto = document.querySelector('[data-racconto]');
  const contenitore = racconto?.querySelector('[data-kheiron="racconto"]');
  if (!contenitore) return;
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const passi = [...racconto.querySelectorAll('.passo')];
  const indice = [...racconto.querySelectorAll('.racconto-indice a')];

  // testo e indice funzionano anche senza 3D: si accende il passo più vicino al centro dello schermo
  let s = 0, centri = [];
  const misura = () => {
    centri = passi.map(p => { const r = p.getBoundingClientRect(); return { c: r.top + scrollY + r.height / 2, h: r.height }; });
  };
  const leggiScorrimento = () => {
    const y = scrollY + innerHeight / 2, n = centri.length;
    if (!n || y <= centri[0].c) return 0;
    for (let i = 0; i < n - 1; i++) if (y < centri[i + 1].c) return i + (y - centri[i].c) / (centri[i + 1].c - centri[i].c);
    return Math.min(n - 0.5, n - 1 + (y - centri[n - 1].c) / centri[n - 1].h);
  };
  const aggiornaTesti = () => {
    s = leggiScorrimento();
    const attivo = Math.round(Math.min(s, passi.length - 1));
    passi.forEach((p, i) => p.classList.toggle('attivo', i === attivo));
    indice.forEach((a, i) => a.classList.toggle('attivo', i === attivo));
    racconto.style.setProperty('--avanzamento', (s / (passi.length - 1)).toFixed(4));
    // dopo l'ultimo passo il robot svanisce, prima che arrivino le specifiche
    racconto.style.setProperty('--uscita', Math.max(0, Math.min(1, (s - (passi.length - 1) - 0.05) / 0.3)).toFixed(3));
  };
  new ResizeObserver(() => { misura(); aggiornaTesti(); }).observe(document.body);
  addEventListener('scroll', aggiornaTesti, { passive: true });
  racconto.classList.add('animato');                 // senza script i testi restano tutti visibili
  misura(); aggiornaTesti();
  indice.forEach((a, i) => a.addEventListener('click', e => {
    e.preventDefault();
    scrollTo({ top: centri[i].c - innerHeight / 2, behavior: fermo ? 'auto' : 'smooth' });
  }));

  if (typeof Scena === 'undefined') return;
  ROBOT.cartella = 'motion/' + ROBOT.cartella;
  const sc = new Scena(contenitore);
  vetrina(sc, { sfondo: getComputedStyle(document.body).backgroundColor || '#0B0D10' });
  sc.controlli.enabled = false;                        // la telecamera la muove lo scorrimento
  sc.renderer.domElement.style.pointerEvents = 'none'; // e il dito sul telefono scorre la pagina
  sc.camera.fov = 30;
  // luce più morbida dall'alto: sulle facce superiori il nero del PETG non deve sbiancare
  sc.scena.children.filter(o => o.isLight).forEach(l => { l.intensity *= l.color.r > l.color.b * 1.5 ? 0.55 : 0.7; });

  const avviso = contenitore.querySelector('.caricando');
  try {
    await sc.carica(k => { if (avviso) avviso.textContent = Math.round(k * 100) + '%'; });
  } catch (e) {
    if (avviso) avviso.textContent = '';
    return;
  }
  avviso?.remove();
  vetrinaPronta(sc);

  const V = (...a) => new THREE.Vector3(...a);
  const mesh = nome => sc.mesh.find(m => m.userData.pezzo === nome);
  Object.assign(sc.dita.sx.userData, { pezzo: 'pinza_dito_sx' });
  Object.assign(sc.dita.dx.userData, { pezzo: 'pinza_dito_dx' });
  sc.mesh.forEach(m => { m.userData.m0 = m.matrix.clone(); });
  const nodi0 = sc.nodi.map(n => n.position.clone());

  // esploso: ogni nodo si allontana dal precedente, nel sistema del padre (a riposo coincide col mondo)
  const esplodi = [V(0, 0, 46), V(0, 0, 44), V(0, 0, 36), V(34, 0, 0), V(34, 0, 0), V(44, 0, 0)];
  const fondo = mesh('base_fondo');
  // la pinza si apre a sé: pezzi dell'utensile spostati nel sistema del nodo J6
  const pinzaEsplosa = [
    [mesh('flangia'), V(-22, 0, 0)], [mesh('pinza_coperchio'), V(0, 0, 34)], [mesh('pinza_pignone'), V(0, 0, 18)],
    [mesh('servo7'), V(0, 0, 58)],
  ].filter(([m]) => m);

  // stati dei passi: telecamera (posizione, bersaglio), esploso, trasparenza dei pezzi, pinza esplosa
  const stati = [
    { cam: [640, -600, 380], mira: [120, 0, 165], e: 0, g: 0, pe: 0 },   // Kheiron
    { cam: [140, -820, 250], mira: [110, 0, 175], e: 0, g: 0, pe: 0 },   // assi
    { cam: [760, -700, 560], mira: [150, 0, 230], e: 1, g: 0, pe: 0 },   // esploso
    { cam: [560, -520, 470], mira: [110, 0, 170], e: 0, g: 1, pe: 0 },   // servo
    { cam: [600, -400, 430], mira: [235, 0, 245], e: 0, g: 0, pe: 1 },   // pinza
    { cam: [700, -560, 520], mira: [170, 0, 120], e: 0, g: 0, pe: 0 },   // movimento
  ];
  const chiavi = ['e', 'g', 'pe'];
  const liscia = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const obiettivo = x => {
    const i = Math.max(0, Math.min(stati.length - 1, Math.floor(x))), j = Math.min(stati.length - 1, i + 1);
    const k = liscia(Math.max(0, Math.min(1, x - i))), a = stati[i], b = stati[j];
    const o = { cam: a.cam.map((v, n) => v + (b.cam[n] - v) * k), mira: a.mira.map((v, n) => v + (b.mira[n] - v) * k) };
    chiavi.forEach(c => { o[c] = a[c] + (b[c] - a[c]) * k; });
    return o;
  };

  // movimento dell'ultimo passo: presa e deposito calcolati con la cinematica inversa
  const riposo = [0, 0, 0, 0, 0, 0];
  const pose = [{ q: riposo, pinza: 12 }];
  let q = riposo;
  for (const t of [
    { p: [215, 135, 130], a: 20 }, { p: [215, 135, 45], a: 20 }, { p: [215, 135, 45], a: 7 }, { p: [215, 135, 150], a: 7 },
    { p: [195, -150, 150], a: 7 }, { p: [195, -150, 60], a: 7 }, { p: [195, -150, 60], a: 20 }, { p: [195, -150, 160], a: 20 },
  ]) {
    const r = inversa(t.p, orientamento(t.p, -90, 0, q[0]), q);
    if (r.q && !controlla(r.q, ROBOT.giunti).length) { q = r.q; pose.push({ q, pinza: t.a }); }
  }
  pose.push({ q: riposo, pinza: 12 });
  const lungo = pose.slice(1).map((b, i) => Math.max(1, ...b.q.map((v, j) => Math.abs(v - pose[i].q[j])), Math.abs(b.pinza - pose[i].pinza) * 3));
  const totale = lungo.reduce((a, b) => a + b, 0);
  const posaA = m => {                                  // m da 0 a 1 lungo tutta la sequenza
    let d = m * totale;
    for (let i = 0; i < lungo.length; i++) {
      if (d <= lungo[i] || i === lungo.length - 1) {
        const k = liscia(Math.max(0, Math.min(1, d / lungo[i]))), a = pose[i], b = pose[i + 1];
        return { q: a.q.map((v, j) => v + (b.q[j] - v) * k), pinza: a.pinza + (b.pinza - a.pinza) * k };
      }
      d -= lungo[i];
    }
    return pose[0];
  };

  // scia della pinza, calcolata una volta: lo scorrimento ne mostra solo il tratto già percorso
  const punta = new THREE.Object3D();
  const tcp = ROBOT.tcp, o6 = ROBOT.giunti[5].origine;
  punta.position.set(tcp[0] - o6[0], tcp[1] - o6[1], tcp[2] - o6[2]);
  sc.nodi[5].add(punta);
  const CAMPIONI = 240, scia = new Float32Array(CAMPIONI * 3), w = new THREE.Vector3();
  for (let i = 0; i < CAMPIONI; i++) {
    const p = posaA(i / (CAMPIONI - 1));
    sc.posa(p.q, p.pinza); sc.scena.updateMatrixWorld(true);
    punta.getWorldPosition(w); scia.set([w.x, w.y, w.z], i * 3);
  }
  const geoScia = new THREE.BufferGeometry();
  geoScia.setAttribute('position', new THREE.BufferAttribute(scia, 3));
  const linea = new THREE.Line(geoScia, new THREE.LineBasicMaterial({ color: 0xff6b2c, transparent: true, opacity: 0.85 }));
  sc.scena.add(linea);
  sc.posa(riposo, 12);

  // etichette: un punto del modello (centro di un pezzo, o una quota a riposo) proiettato sullo schermo
  const strato = racconto.querySelector('.racconto-etichette');
  const etichette = [...strato.querySelectorAll('[data-pezzo]')].map(el => {
    const m = mesh(el.dataset.pezzo);
    if (!m) { el.remove(); return null; }
    const ancora = new THREE.Object3D();
    if (el.dataset.punto) ancora.position.set(...el.dataset.punto.split(',').map(Number));
    else { m.geometry.computeBoundingBox(); m.geometry.boundingBox.getCenter(ancora.position); }
    m.add(ancora);
    return { el, ancora, passo: +el.dataset.passo };
  }).filter(Boolean);

  // stato attuale, che insegue l'obiettivo
  const ora = obiettivo(s);
  const cam = V(...ora.cam), mira = V(...ora.mira);
  const grigio = sc.materiali.servo.color.clone(), arancio = new THREE.Color(0xff6b2c);
  const pezzo = sc.materiali.pezzo;

  // inquadratura: su schermo largo il robot sta a destra del testo, sul telefono sopra
  const inquadra = () => {
    const W = contenitore.clientWidth, H = contenitore.clientHeight;
    if (!W || !H) return;
    const largo = W > 900;
    sc.camera.setViewOffset(W, H, largo ? -W * 0.15 : 0, largo ? -H * 0.03 : H * 0.19, W, H);
    sc.camera.updateProjectionMatrix();
  };
  new ResizeObserver(inquadra).observe(contenitore);
  inquadra();
  racconto.classList.add('pronto');

  const DURATA = 9, PAUSA = 1.2;                       // secondi per il ciclo di presa, sosta prima di ripartire
  let presenza = 0, ciclo5 = 0;
  let prima = performance.now();
  const p = new THREE.Vector3();
  const ciclo = adesso => {
    const dt = Math.min(0.05, (adesso - prima) / 1000); prima = adesso;
    const k = fermo ? 1 : 1 - Math.exp(-dt * 6);
    const ob = obiettivo(s);
    const formato = contenitore.clientWidth / contenitore.clientHeight;
    const lontano = formato < 0.8 ? 1.18 * 0.9 / formato : 1.18;   // telefono in verticale: il robot deve stare nella larghezza
    cam.lerp(V(...ob.mira).add(V(...ob.cam).sub(V(...ob.mira)).multiplyScalar(lontano)), k);
    mira.lerp(V(...ob.mira), k);
    chiavi.forEach(c => { ora[c] += (ob[c] - ora[c]) * k; });
    sc.camera.position.copy(cam); sc.controlli.target.copy(mira); sc.camera.lookAt(mira);

    // ultimo passo: quando arriva, il braccio fa da solo il ciclo di presa e deposito e lo ripete;
    // quando si esce, torna morbido al riposo. Nel passo della pinza le dita si aprono e chiudono.
    const dentro = s > 4.6;
    presenza += ((dentro ? 1 : 0) - presenza) * k;
    if (dentro && !fermo) {
      ciclo5 += dt / DURATA;
      if (ciclo5 > 1 + PAUSA / DURATA) ciclo5 = 0;
    } else if (presenza < 0.02) ciclo5 = 0;
    const m = fermo ? (dentro ? 0.3 : 0) : Math.min(1, ciclo5);
    const pinzaViva = Math.max(0, 1 - Math.abs(s - 4) * 2) * (fermo ? 0 : 1);
    const base = posaA(m);
    sc.posa(base.q.map(v => v * presenza), 12 + (base.pinza - 12) * presenza + pinzaViva * 7 * Math.sin(adesso / 520));

    sc.nodi.forEach((n, i) => n.position.copy(nodi0[i]).addScaledVector(esplodi[i], ora.e));
    if (fondo) fondo.matrix.copy(new THREE.Matrix4().makeTranslation(0, 0, -34 * ora.e).multiply(fondo.userData.m0));
    pinzaEsplosa.forEach(([mm, v]) => mm.matrix.copy(new THREE.Matrix4().makeTranslation(v.x * ora.pe, v.y * ora.pe, v.z * ora.pe).multiply(mm.userData.m0)));
    for (const [d, segno] of [[sc.dita.sx, 1], [sc.dita.dx, -1]]) d.matrix.premultiply(new THREE.Matrix4().makeTranslation(0, 10 * segno * ora.pe, 0));

    // passo dei servo: la plastica diventa trasparente, i servo prendono il colore del marchio
    pezzo.transparent = ora.g > 0.03;
    pezzo.opacity = 1 - 0.86 * ora.g;
    pezzo.depthWrite = ora.g < 0.5;
    sc.materiali.servo.color.copy(grigio).lerp(arancio, ora.g);

    linea.geometry.setDrawRange(0, Math.round(m * CAMPIONI));
    linea.visible = m > 0 && presenza > 0.5;

    sc.scena.updateMatrixWorld(true);
    const W = contenitore.clientWidth, H = contenitore.clientHeight;
    for (const e of etichette) {
      const forza = Math.max(0, 1 - Math.abs(s - e.passo) * 2.4);
      e.ancora.getWorldPosition(p); p.project(sc.camera);
      const visibile = forza > 0.02 && p.z < 1;
      e.el.style.opacity = visibile ? forza.toFixed(3) : '0';
      if (visibile) e.el.style.transform = `translate(${((p.x + 1) / 2 * W).toFixed(1)}px, ${((1 - p.y) / 2 * H).toFixed(1)}px)`;
    }
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
})();
