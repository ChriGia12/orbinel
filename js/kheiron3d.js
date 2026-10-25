// Kheiron in 3D sul sito: riusa la scena di Orbinel Motion (motion/js/scena.js) con gli stessi STL e la
// stessa cinematica (aspetto in motion/js/vetrina.js), e fa un ciclo di presa e rilascio calcolato con la cinematica inversa.
// Contenitore: un elemento con [data-kheiron]. data-kheiron="interattivo": presa e rilascio, con lo zoom (pagina Kheiron);
// data-kheiron="orbita": la pinza disegna nell'aria il simbolo di Orbinel, un'orbita aperta con il nodo nel varco (home).
'use strict';

(async () => {
  const contenitore = document.querySelector('[data-kheiron]');
  if (!contenitore || typeof Scena === 'undefined') return;
  const interattivo = contenitore.dataset.kheiron === 'interattivo';
  const orbita = contenitore.dataset.kheiron === 'orbita';
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ROBOT.cartella = 'motion/' + ROBOT.cartella;

  const sc = new Scena(contenitore);
  vetrina(sc, { sfondo: getComputedStyle(document.body).backgroundColor || '#0B0D10' });

  sc.camera.fov = 32; sc.camera.updateProjectionMatrix();
  sc.camera.position.set(640, -560, 420);
  sc.controlli.target.set(110, 0, 150);
  sc.controlli.enableZoom = interattivo;
  sc.controlli.enablePan = false;
  sc.controlli.autoRotate = !fermo && !interattivo;
  sc.controlli.autoRotateSpeed = 0.6;
  if (matchMedia('(pointer: coarse)').matches && !interattivo) sc.controlli.enabled = false;   // non blocca lo scorrimento

  const avviso = contenitore.querySelector('.caricando');
  try {
    await sc.carica(k => { if (avviso) avviso.textContent = Math.round(k * 100) + '%'; });
  } catch (e) {
    if (avviso) avviso.textContent = '';
    return;
  }
  avviso?.remove();
  vetrinaPronta(sc);

  if (orbita) return disegnaOrbita(sc, fermo);

  // pose del ciclo: sopra il pezzo, presa, sollevamento, sopra la scatola, rilascio, riposo
  const riposo = [0, 0, 0, 0, 0, 0];
  const punti = [
    { p: [210, 130, 120], aperta: 20 }, { p: [210, 130, 45], aperta: 20 }, { p: [210, 130, 45], aperta: 8 },
    { p: [210, 130, 140], aperta: 8 }, { p: [190, -150, 140], aperta: 8 }, { p: [190, -150, 60], aperta: 8 },
    { p: [190, -150, 60], aperta: 20 }, { p: [190, -150, 150], aperta: 20 },
  ];
  const pose = [{ q: riposo, pinza: 12 }];
  let q = riposo;
  for (const t of punti) {
    const r = inversa(t.p, orientamento(t.p, -90, 0, q[0]), q);
    if (r.q && !controlla(r.q, ROBOT.giunti).length) { q = r.q; pose.push({ q, pinza: t.aperta }); }
  }
  pose.push({ q: riposo, pinza: 12 });

  sc.posa(riposo, 12);
  if (fermo) { sc.posa(pose[2]?.q || riposo, 20); return; }

  const liscia = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  let i = 0, t0 = performance.now();
  const durata = (a, b) => Math.max(0.6, Math.max(...a.q.map((v, j) => Math.abs(v - b.q[j]))) / 55, Math.abs(a.pinza - b.pinza) / 18);
  const ciclo = ora => {
    const a = pose[i], b = pose[(i + 1) % pose.length], d = durata(a, b) * 1000;
    const k = Math.max(0, Math.min(1, (ora - t0) / d)), e = liscia(k);
    sc.posa(a.q.map((v, j) => v + (b.q[j] - v) * e), a.pinza + (b.pinza - a.pinza) * e);
    if (k >= 1) { i = (i + 1) % pose.length; t0 = ora + (i === 0 ? 1200 : 250); }
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
})();

// La pinza, rivolta verso il basso, gira su un cerchio orizzontale. La scia copre l'85 % del giro e si accorcia
// dietro alla pinza: resta sempre un varco davanti, con la pinza come nodo, come nel simbolo di Orbinel.
function disegnaOrbita(sc, fermo) {
  const centro = [215, 0, 75], raggio = 75, giro = 9;           // mm, mm, secondi per giro
  sc.camera.position.set(470, -420, 640);                      // più dall'alto, perché l'anello si legga come tale
  sc.controlli.target.set(170, 0, 100);
  const scia = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xff6b2c }));
  sc.scena.add(scia);
  const punto = a => [centro[0] + raggio * Math.cos(a), centro[1] + raggio * Math.sin(a), centro[2]];
  let q = [0, 0, 0, 0, 0, 0];
  const risolvi = a => {
    const p = punto(a);
    const r = inversa(p, orientamento(p, -90, 0, q[0]), q);
    return r.q && !controlla(r.q, ROBOT.giunti).length ? r.q : null;
  };
  const inizio = risolvi(0) || q;
  if (fermo) { sc.posa(inizio, 10); return; }
  const scieDi = a => {
    const passi = 120, lunghezza = Math.min(a, 2 * Math.PI * 0.85);
    if (lunghezza < 0.05) return null;
    const punti = [];
    for (let k = 0; k <= passi; k++) punti.push(new THREE.Vector3(...punto(a - lunghezza + lunghezza * k / passi)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(punti), passi, 2.2, 8, false);
  };
  const liscia = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const t0 = performance.now(), avvicinamento = 1800;
  const ciclo = ora => {
    const t = ora - t0;
    if (t < avvicinamento) {                                    // dal riposo al punto di partenza
      const e = liscia(t / avvicinamento);
      sc.posa([0, 0, 0, 0, 0, 0].map((v, i) => v + (inizio[i] - v) * e), 12 - 2 * e);
      q = inizio;
    } else {
      const a = ((t - avvicinamento) / 1000) * (2 * Math.PI / giro);
      const nuovo = risolvi(a);
      if (nuovo) { q = nuovo; sc.posa(q, 10); }
      const g = scieDi(a);
      if (g) { scia.geometry.dispose(); scia.geometry = g; }
    }
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
}
