// Pinza a tentacoli, in fase di studio: anteprima animata nella pagina Make. Non è un pezzo del generatore di
// Parts né di Motion: mostra l'idea, con forma e movimento indicativi.
// Sei tentacoli affusolati escono dal fondo arrotondato del corpo, leggermente aperti verso l'esterno, e si
// arrotolano a spirale verso l'asse: la curvatura cresce verso la punta, dove il tentacolo è più sottile, come
// succede tirando un cavo che corre sul lato interno. Le scanalature sul lato interno sono le fessure tra i segmenti.
// Contenitore: un elemento con [data-tentacoli]. Assi: z verso l'alto, codolo in cima.
'use strict';

(() => {
  const contenitore = document.querySelector('[data-tentacoli]');
  if (!contenitore || typeof THREE === 'undefined') return;
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const N = 6;                       // tentacoli
  const L = 112, R0 = 7.2, RT = 0.8; // lunghezza, raggio alla base e in punta (mm)
  const SEGMENTI = 24;               // fessure lungo il tentacolo
  const CORONA = 16.5;               // raggio su cui escono dal fondo del corpo
  const APERTURA = 0.62;             // inclinazione verso l'esterno all'uscita (rad)
  const GIRO = 6.3;                  // curvatura totale a tentacolo chiuso (rad, circa 360°)
  const RIPOSO = 0.2;                // anche aperti restano un po' arricciati in punta
  const ANELLI = 150, LATI = 28;

  // --- scena ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  contenitore.prepend(renderer.domElement);
  const scena = new THREE.Scene();
  scena.background = new THREE.Color(getComputedStyle(document.body).backgroundColor || '#0B0D10');
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 3000);
  camera.up.set(0, 0, 1);
  camera.position.set(290, -330, 60);
  const controlli = new THREE.OrbitControls(camera, renderer.domElement);
  controlli.target.set(0, 0, -70);
  controlli.enableDamping = true;
  controlli.enablePan = false;
  controlli.enableZoom = false;
  controlli.autoRotate = !fermo;
  controlli.autoRotateSpeed = 0.7;
  if (matchMedia('(pointer: coarse)').matches) controlli.enabled = false;   // non blocca lo scorrimento

  scena.add(new THREE.HemisphereLight(0xe6ebf2, 0x1a1714, 0.75));
  const sole = new THREE.DirectionalLight(0xffffff, 0.85); sole.position.set(200, -260, 320); scena.add(sole);
  const bordo = new THREE.DirectionalLight(0xff6b2c, 0.55); bordo.position.set(-260, 200, 40); scena.add(bordo);
  const sotto = new THREE.DirectionalLight(0x9fb3c8, 0.25); sotto.position.set(60, 80, -300); scena.add(sotto);

  const griglia = new THREE.GridHelper(420, 21, 0x262b33, 0x181b21);
  griglia.rotation.x = Math.PI / 2; griglia.position.z = -215; scena.add(griglia);

  // --- corpo: un profilo morbido fatto ruotare attorno all'asse ---
  // il codolo (Ø 27,7, come l'attacco di Kheiron) e il collo, poi una spalla larga e bassa che scende in una cupola
  const profilo = new THREE.SplineCurve([
    [0, 2], [13.85, 2], [13.85, -5.8], [17, -6.2], [17, -11], [20, -13.5],
    [28, -18.5], [33.5, -25], [35.5, -33], [35, -42], [33, -50], [30.5, -55.5],
    [27, -59.5], [21, -62.4], [11, -64], [0, -64.4],
  ].map(([r, z]) => new THREE.Vector2(r, z)));
  const punti = profilo.getPoints(160).map(p => new THREE.Vector2(Math.max(p.x, 0), p.y));
  // LatheGeometry vuole il profilo dal basso verso l'alto, altrimenti le facce guardano dentro
  const geoCorpo = new THREE.LatheGeometry(punti.slice().reverse(), 140);
  geoCorpo.rotateX(Math.PI / 2);                 // l'asse della rotazione passa da y a z
  geoCorpo.computeVertexNormals();
  const grafite = new THREE.MeshStandardMaterial({ color: 0x262a31, roughness: 0.34, metalness: 0.4 });
  scena.add(new THREE.Mesh(geoCorpo, grafite));
  // un solo dettaglio arancione: un filo sottile sulla spalla
  const anello = new THREE.Mesh(new THREE.TorusGeometry(35.55, 0.55, 12, 180), new THREE.MeshStandardMaterial({ color: 0xff6b2c, roughness: 0.4, emissive: 0x5a1e05 }));
  anello.position.z = -33; scena.add(anello);
  // giunzione tra corpo e piastra, appena incisa
  const giunta = new THREE.Mesh(new THREE.TorusGeometry(32.9, 0.32, 8, 180), new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
  giunta.position.z = -49.5; scena.add(giunta);
  // dove la cupola incontra la superficie: per mettere a filo l'attacco di ogni tentacolo
  const zCupola = r => { let m = punti[punti.length - 1]; for (const p of punti) if (p.x >= r) m = p; return m.y; };

  // --- tentacoli ---
  const raggio = s => R0 * Math.pow(RT / R0, s / L);
  // integrale di 1/r lungo il tentacolo: la curvatura va con 1/r, quindi la punta si arrotola di più
  const integrale = s => (L / Math.log(R0 / RT)) * (Math.pow(R0 / RT, s / L) - 1) / R0;
  const totale = integrale(L);
  const materialeTentacolo = new THREE.MeshStandardMaterial({ color: 0xe8e3d8, roughness: 0.62, metalness: 0 });

  const tentacoli = [...Array(N)].map((_, k) => {
    const a = (k / N) * Math.PI * 2 + Math.PI / N;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((ANELLI + 1) * (LATI + 1) * 3 + 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const indici = [];
    for (let i = 0; i < ANELLI; i++) for (let j = 0; j < LATI; j++) {
      const p = i * (LATI + 1) + j, q = p + LATI + 1;
      indici.push(p, q, p + 1, p + 1, q, q + 1);
    }
    const punta = (ANELLI + 1) * (LATI + 1);     // un vertice in punta chiude il tentacolo
    for (let j = 0; j < LATI; j++) { const p = ANELLI * (LATI + 1) + j; indici.push(p, punta, p + 1); }
    geo.setIndex(indici);
    const mesh = new THREE.Mesh(geo, materialeTentacolo);
    scena.add(mesh);
    // anello di attacco in grafite, inclinato come il tentacolo all'uscita
    const attacco = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.6, 1.9, 14, 48), grafite);
    attacco.position.set(CORONA * Math.cos(a), CORONA * Math.sin(a), zCupola(CORONA) - 0.4);
    attacco.lookAt(attacco.position.clone().add(new THREE.Vector3(Math.sin(APERTURA) * Math.cos(a), Math.sin(APERTURA) * Math.sin(a), -Math.cos(APERTURA))));
    scena.add(attacco);
    return { a, geo, pos, fase: k * 1.37, mesh };
  });

  const v = new THREE.Vector3(), T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3();
  function aggiornaTentacolo(t, chiusura, tempo) {
    const fuori = new THREE.Vector3(Math.cos(t.a), Math.sin(t.a), 0);   // verso l'esterno
    const lato = new THREE.Vector3(-Math.sin(t.a), Math.cos(t.a), 0);   // tangente alla corona
    const giu = new THREE.Vector3(0, 0, -1);
    // il tentacolo parte 10 mm dentro il corpo, nella sua direzione di uscita, così attraversa la cupola pulito
    const DENTRO = 10, ds = (L + DENTRO) / ANELLI;
    const p = new THREE.Vector3(CORONA * Math.cos(t.a), CORONA * Math.sin(t.a), zCupola(CORONA))
      .addScaledVector(fuori, -Math.sin(APERTURA) * DENTRO).addScaledVector(giu, -Math.cos(APERTURA) * DENTRO);
    for (let i = 0; i <= ANELLI; i++) {
      const s = Math.max(0, i * ds - DENTRO), f = integrale(s) / totale;
      // angolo dalla verticale: parte aperto verso l'esterno e ruota verso l'asse, di più verso la punta;
      // un'ondulazione lenta, diversa per ogni tentacolo, lo rende meno rigido
      const onda = fermo ? 0 : 0.09 * Math.sin(tempo * 1.3 + t.fase + s / 18) * (s / L);
      const c = RIPOSO + (1 - RIPOSO) * chiusura;
      const th = i * ds < DENTRO ? APERTURA : APERTURA * (1 - 0.55 * chiusura) - c * GIRO * f + onda;
      const sw = fermo ? 0 : 0.12 * Math.sin(tempo * 0.9 + t.fase * 2 + s / 26) * (s / L);
      T.copy(giu).multiplyScalar(Math.cos(th)).addScaledVector(fuori, Math.sin(th)).addScaledVector(lato, sw).normalize();
      if (i > 0) p.addScaledVector(T, ds);
      // sezione: normale verso l'esterno della curva (lato della spina) e lato
      B.copy(lato);
      Nn.crossVectors(B, T).normalize();
      const r = raggio(s);
      // scanalature sul lato interno, una per segmento; si stringono quando il tentacolo si chiude
      const n = (SEGMENTI * f) % 1;
      const fessura = Math.pow(Math.max(0, 1 - Math.abs(n - 0.5) * 4.2), 1.5) * (0.32 - 0.14 * chiusura);
      for (let j = 0; j <= LATI; j++) {
        const phi = (j / LATI) * Math.PI * 2;
        const dentro = Math.max(0, -Math.cos(phi));            // 1 sul lato interno della spirale
        const rr = r * (1 - fessura * Math.pow(dentro, 2));
        v.copy(p).addScaledVector(Nn, rr * Math.cos(phi)).addScaledVector(B, rr * Math.sin(phi));
        t.pos.set([v.x, v.y, v.z], (i * (LATI + 1) + j) * 3);
      }
      if (i === ANELLI) t.pos.set([p.x + T.x * RT, p.y + T.y * RT, p.z + T.z * RT], (ANELLI + 1) * (LATI + 1) * 3);
    }
    t.geo.attributes.position.needsUpdate = true;
    t.geo.computeVertexNormals();
    t.geo.computeBoundingSphere();
  }

  function ridimensiona() {
    const w = contenitore.clientWidth, h = contenitore.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(ridimensiona).observe(contenitore);
  ridimensiona();
  contenitore.querySelector('.caricando')?.remove();

  // ciclo: aperti, si chiudono a spirale, tengono, si riaprono
  const liscia = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const fasi = [[1.6, 0.06, 0.06], [2.4, 0.06, 0.82], [1.4, 0.82, 0.82], [2.2, 0.82, 0.06]];
  const durata = fasi.reduce((t, f) => t + f[0], 0);
  function chiusuraAl(t) {
    let x = t % durata;
    for (const [d, da, a] of fasi) { if (x < d) return da + (a - da) * liscia(x / d); x -= d; }
    return 0.06;
  }
  let visibile = true;
  new IntersectionObserver(([e]) => { visibile = e.isIntersecting; }).observe(contenitore);
  const t0 = performance.now();
  (function ciclo(ora) {
    requestAnimationFrame(ciclo);
    if (!visibile) return;
    const t = (ora - t0) / 1000;
    // data-chiusura (da 0 a 1) ferma la pinza a quella chiusura: per le immagini e i controlli
    const fissa = contenitore.dataset.chiusura;
    const c = fissa !== undefined ? +fissa : fermo ? 0.55 : chiusuraAl(t);
    tentacoli.forEach(x => aggiornaTentacolo(x, c, t));
    controlli.update();
    renderer.render(scena, camera);
  })(t0);
})();
