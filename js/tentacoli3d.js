// Pinza a tentacoli, in fase di studio: anteprima animata nella pagina Parts. Non è un pezzo del generatore di
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
  const APERTURA = 0.18;             // inclinazione verso l'esterno all'uscita (rad): quasi verticali, come nel video
  const GIRO = 10;                   // curvatura totale verso l'interno, in presa (rad, circa un giro e mezzo)
  const GIRO_RITRATTO = 17;          // curvatura totale verso l'esterno, ritratti a rosetta (rad, quasi tre giri)
  const RIPOSO = 0.12;               // anche aperti restano un po' arricciati in punta
  const ONDA = 0.6;                  // ampiezza dell'ondeggiamento da aperti (rad su tutta la lunghezza)
  const FRONTE = 0.75;               // quanto del tentacolo si piega insieme: l'arrotolamento parte dalla punta
  const TORSIONE = 1.4;              // rotazione del piano della spirale lungo il tentacolo, a chiusura completa (rad)
  const PESO = 0.05;                // quanto ricade un tratto disteso senza appoggio (rad per mm)
  const VORTICE = 0.32;              // a chiusura completa i tentacoli girano tutti un po' nello stesso verso (rad)
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
  camera.position.set(470, -520, 10);
  const controlli = new THREE.OrbitControls(camera, renderer.domElement);
  controlli.target.set(0, 0, -60);
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

  const PAVIMENTO = -200;
  const griglia = new THREE.GridHelper(420, 21, 0x262b33, 0x181b21);
  griglia.rotation.x = Math.PI / 2; griglia.position.z = PAVIMENTO; scena.add(griglia);

  // la pinza sale e scende tutta insieme: corpo, anelli e tentacoli stanno in questo gruppo
  const pinza = new THREE.Group();
  scena.add(pinza);

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
  pinza.add(new THREE.Mesh(geoCorpo, grafite));
  // un solo dettaglio arancione: un filo sottile sulla spalla
  const anello = new THREE.Mesh(new THREE.TorusGeometry(35.55, 0.55, 12, 180), new THREE.MeshStandardMaterial({ color: 0xff6b2c, roughness: 0.4, emissive: 0x5a1e05 }));
  anello.position.z = -33; pinza.add(anello);
  // giunzione tra corpo e piastra, appena incisa
  const giunta = new THREE.Mesh(new THREE.TorusGeometry(32.9, 0.32, 8, 180), new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
  giunta.position.z = -49.5; pinza.add(giunta);
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
    pinza.add(mesh);
    // anello di attacco in grafite, inclinato come il tentacolo all'uscita
    const attacco = new THREE.Mesh(new THREE.TorusGeometry(R0 + 0.6, 1.9, 14, 48), grafite);
    attacco.position.set(CORONA * Math.cos(a), CORONA * Math.sin(a), zCupola(CORONA) - 0.4);
    attacco.lookAt(attacco.position.clone().add(new THREE.Vector3(Math.sin(APERTURA) * Math.cos(a), Math.sin(APERTURA) * Math.sin(a), -Math.cos(APERTURA))));
    pinza.add(attacco);
    return { a, geo, pos, fase: k * 1.37, mesh };
  });

  // --- la scatola da afferrare, come nel video: alta abbastanza che i tentacoli srotolati non arrivino al piano ---
  const SCATOLA = { x: 38, y: 38, z: 55 };                   // mezze misure: 76 × 76 × 110 mm
  const scatola = new THREE.Group();
  const cartone = new THREE.MeshStandardMaterial({ color: 0xa9824f, roughness: 0.92 });
  scatola.add(new THREE.Mesh(new THREE.BoxGeometry(2 * SCATOLA.x, 2 * SCATOLA.y, 2 * SCATOLA.z), cartone));
  // nastro adesivo sopra e lungo due lati, e la fessura tra i lembi
  const nastro = new THREE.MeshStandardMaterial({ color: 0xc8ad7f, roughness: 0.5 });
  const pezzo = (w, d, h, x, y, zz, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), m); b.position.set(x, y, zz); scatola.add(b); };
  pezzo(2 * SCATOLA.x + 0.6, 14, 0.6, 0, 0, SCATOLA.z, nastro);
  pezzo(0.6, 14, 30, SCATOLA.x, 0, SCATOLA.z - 15, nastro);
  pezzo(0.6, 14, 30, -SCATOLA.x, 0, SCATOLA.z - 15, nastro);
  pezzo(2 * SCATOLA.x - 6, 0.8, 0.7, 0, 0, SCATOLA.z + 0.05, new THREE.MeshStandardMaterial({ color: 0x5c4426, roughness: 1 }));
  scena.add(scatola);

  // Il tentacolo si costruisce passo per passo, portandosi dietro una terna: T lungo il tentacolo, D verso il lato
  // interno (dove corre il cavo e verso cui si piega) e B di lato. A ogni passo la terna ruota per la curvatura
  // verso D, per una piccola curvatura laterale e per la torsione attorno a T, che fa ruotare il piano della
  // spirale: così il tentacolo si avvolge in 3D, non solo in un piano.
  const K = GIRO / totale;                                   // curvatura = K / r: più stretta dove è più sottile
  const v = new THREE.Vector3(), T = new THREE.Vector3(), D = new THREE.Vector3(), B = new THREE.Vector3(), p = new THREE.Vector3();
  const x = new THREE.Vector3(), z = new THREE.Vector3(0, 0, 1);
  const gira = (a, b, ang) => {                              // ruota a verso b (perpendicolari) di ang
    const c = Math.cos(ang), s = Math.sin(ang);
    x.copy(a).multiplyScalar(c).addScaledVector(b, s);
    b.multiplyScalar(c).addScaledVector(a, -s);
    a.copy(x);
  };
  const liscia01 = k => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };

  const q = new THREE.Vector3();
  // un punto del tentacolo non entra nella scatola né nel piano: torna sulla superficie e la direzione perde la
  // parte che spinge dentro, così il resto del tentacolo ci scorre sopra e ne prende la forma
  function appoggia(r, centro, pavimento, stringi) {
    // dentro la scatola (allargata del raggio): si esce dalla faccia più vicina
    q.copy(p).sub(centro);
    const pen = [SCATOLA.x + r * 0.92 - Math.abs(q.x), SCATOLA.y + r * 0.92 - Math.abs(q.y), SCATOLA.z + r * 0.92 - Math.abs(q.z)];
    let tocca = false;
    // stringendo, i tratti vicini a una faccia (entro 14 mm) vengono tirati contro di lei e la seguono
    if (stringi > 0 && Math.min(pen[0], pen[1], pen[2]) <= 0) {
      const fuoriDi = pen.filter(v => v <= 0);
      if (fuoriDi.length === 1 && pen[pen.findIndex(v => v <= 0)] > -14) {
        const k = pen.findIndex(v => v <= 0), asse = ['x', 'y', 'z'][k], verso = Math.sign(q[asse]) || 1;
        p[asse] += verso * pen[k] * Math.min(1, stringi * 1.4);
        T[asse] *= 1 - Math.min(1, stringi * 1.4); T.normalize();
        pen[k] = 0.0001;
      }
    }
    if (pen[0] > 0 && pen[1] > 0 && pen[2] > 0) {
      const k = pen.indexOf(Math.min(...pen)), asse = ['x', 'y', 'z'][k], verso = Math.sign(q[asse]) || 1;
      p[asse] += verso * pen[k];
      if (T[asse] * verso < 0) { T[asse] = 0; T.normalize(); }
      // il lato interno (dove tira il cavo) guarda la scatola: stringendo la preme invece di girarle attorno
      D.set(0, 0, 0); D[asse] = -verso;
      tocca = true;
    }
    if (p.z < pavimento + r) {
      p.z = pavimento + r;
      if (T.z < 0) { T.z = 0; T.normalize(); }
    }
    D.addScaledVector(T, -D.dot(T)).normalize(); B.crossVectors(T, D);
    return tocca;
  }

  // Due cavi per tentacolo, come nel video. ritratto (0–1): il cavo esterno arrotola il tentacolo verso l'esterno e
  // verso l'alto, a rosetta accanto al corpo; srotolandosi si stende prima vicino alla base e per ultima la punta.
  // presa (0–1): il cavo interno arrotola la punta verso l'asse, sotto l'oggetto, con la torsione e il vortice.
  // centro e pavimento: il centro della scatola e il piano, nel sistema della pinza.
  function aggiornaTentacolo(t, ritratto, presa, tempo, centro, pavimento) {
    const fuori = new THREE.Vector3(Math.cos(t.a), Math.sin(t.a), 0);   // verso l'esterno
    const giu = new THREE.Vector3(0, 0, -1);
    T.copy(giu).multiplyScalar(Math.cos(APERTURA)).addScaledVector(fuori, Math.sin(APERTURA));
    D.copy(fuori).multiplyScalar(-Math.cos(APERTURA)).addScaledVector(giu, Math.sin(APERTURA));
    const vortice = VORTICE * liscia01(presa * 1.3);
    T.applyAxisAngle(z, vortice); D.applyAxisAngle(z, vortice);
    B.crossVectors(T, D);
    // parte 10 mm dentro il corpo, nella direzione di uscita, così attraversa la cupola pulito
    const DENTRO = 10, ds = (L + DENTRO) / ANELLI;
    p.set(CORONA * Math.cos(t.a), CORONA * Math.sin(t.a), zCupola(CORONA)).addScaledVector(T, -DENTRO);
    const morbido = fermo ? 0 : (1 - ritratto) * (1 - 0.75 * presa);
    let aderente = 0;                                      // 1 dove il tentacolo appoggia sulla scatola, poi sfuma
    for (let i = 0; i <= ANELLI; i++) {
      const s = Math.max(0, i * ds - DENTRO), u = s / L, f = integrale(s) / totale;
      if (i > 0 && i * ds > DENTRO) {
        // fronte del cavo esterno: arrotolato dove u > 1 − ritratto; quello interno parte dalla punta
        const fuoriAttivo = liscia01((ritratto * (1 + FRONTE) - (1 - u)) / FRONTE);
        const dentroAttivo = Math.max(RIPOSO * u * u * (1 - ritratto), liscia01((presa * (1 + FRONTE) - (1 - u)) / FRONTE));
        // ondeggiamento: due onde lente che corrono lungo il tentacolo, più ampie verso la punta
        const onda = ONDA / L * morbido * u;
        // dove appoggia, il cavo interno lo schiaccia contro la scatola invece di arricciarlo
        const kD = (K * dentroAttivo * (1 - 0.9 * aderente) - GIRO_RITRATTO / totale * fuoriAttivo) / raggio(s)
          + onda * Math.sin(2 * Math.PI * (1.3 * u) - tempo * 1.6 + t.fase);
        const kB = onda * 0.8 * Math.sin(2 * Math.PI * (1.1 * u) - tempo * 1.2 + t.fase * 1.7);
        gira(T, D, kD * ds);
        gira(T, B, kB * ds);
        gira(D, B, TORSIONE / L * dentroAttivo * (1 - aderente) * ds);
        // peso: dove è disteso il tentacolo ricade verso il basso; sopra la scatola lo tiene il contatto,
        // oltre il bordo scende lungo il fianco
        x.set(0, 0, -1).addScaledVector(T, T.z);
        T.addScaledVector(x, PESO * (1 - fuoriAttivo) * (1 - 0.6 * dentroAttivo) * ds);
        T.normalize(); D.addScaledVector(T, -D.dot(T)).normalize(); B.crossVectors(T, D);
        p.addScaledVector(T, ds);
        aderente = appoggia(raggio(s), centro, pavimento, presa) ? 1 : aderente * 0.9;
      } else if (i > 0) p.addScaledVector(T, ds);
      const r = raggio(s);
      // scanalature sul lato interno, una per segmento; si stringono quando il tentacolo si chiude
      const n = (SEGMENTI * f) % 1;
      const fessura = Math.pow(Math.max(0, 1 - Math.abs(n - 0.5) * 4.2), 1.5) * (0.3 - 0.16 * presa);
      for (let j = 0; j <= LATI; j++) {
        const phi = (j / LATI) * Math.PI * 2;
        const dentro = Math.max(0, Math.cos(phi));             // 1 sul lato interno, verso D
        const rr = r * (1 - fessura * dentro * dentro);
        v.copy(p).addScaledVector(D, rr * Math.cos(phi)).addScaledVector(B, rr * Math.sin(phi));
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

  // ciclo del video: i tentacoli pendono distesi, si ritraggono a rosetta, la pinza scende sopra la scatola, i
  // tentacoli si srotolano sopra di lei prendendone la forma e ricadono lungo i fianchi, poi le punte si arrotolano
  // stringendola, la solleva, la tiene, la riappoggia, la lascia, i tentacoli si ritraggono, la pinza risale e li distende
  const ALTO = PAVIMENTO + 2 * SCATOLA.z;                     // faccia alta della scatola appoggiata
  const SU = ALTO + 64.4 + L + 15, GIU = ALTO + 64.4 + 6;    // tentacoli distesi sopra la scatola; cupola appena sopra
  const liscia = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const fasi = [                                             // durata (s), quota da/a, ritratto da/a, presa da/a, scatola presa
    [1.6, SU, SU, 0, 0, 0, 0, false], [1.8, SU, SU, 0, 1, 0, 0, false], [2, SU, GIU, 1, 1, 0, 0, false],
    [2.6, GIU, GIU, 1, 0, 0, 0, false], [2, GIU, GIU, 0, 0, 0, 1, false], [2, GIU, SU - 40, 0, 0, 1, 1, true],
    [1.2, SU - 40, SU - 40, 0, 0, 1, 1, true], [2, SU - 40, GIU, 0, 0, 1, 1, true], [1.4, GIU, GIU, 0, 0.45, 1, 0, false],
    [1.8, GIU, GIU, 0.45, 1, 0, 0, false], [2, GIU, SU, 1, 1, 0, 0, false], [2, SU, SU, 1, 0, 0, 0, false],
  ];

  const durata = fasi.reduce((t, f) => t + f[0], 0);
  function statoAl(t) {
    let y = t % durata;
    for (const [d, h0, h1, r0, r1, p0, p1, presa] of fasi) {
      if (y < d) {
        const k = liscia(y / d);
        return { quota: h0 + (h1 - h0) * k, ritratto: r0 + (r1 - r0) * k, chiusura: p0 + (p1 - p0) * k, presa };
      }
      y -= d;
    }
    return { quota: SU, ritratto: 0, chiusura: 0, presa: false };
  }
  const centro = new THREE.Vector3();
  let visibile = true;
  new IntersectionObserver(([e]) => { visibile = e.isIntersecting; }).observe(contenitore);
  const t0 = performance.now();
  (function ciclo(ora) {
    requestAnimationFrame(ciclo);
    if (!visibile) return;
    // data-tempo (in secondi) ferma l'animazione a quell'istante del ciclo: per le immagini e i controlli
    const fisso = contenitore.dataset.tempo;
    const t = fisso !== undefined ? +fisso : (ora - t0) / 1000;
    const st = fermo ? { quota: GIU, ritratto: 0, chiusura: 1, presa: false } : statoAl(t);
    pinza.position.z = st.quota;
    scatola.position.z = PAVIMENTO + SCATOLA.z + (st.presa ? st.quota - GIU : 0);
    centro.copy(scatola.position).sub(pinza.position);
    tentacoli.forEach(x => aggiornaTentacolo(x, st.ritratto, st.chiusura, t, centro, PAVIMENTO - st.quota));
    controlli.update();
    renderer.render(scena, camera);
  })(t0);
})();
