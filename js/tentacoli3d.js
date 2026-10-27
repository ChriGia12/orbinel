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
  const GIRO = 5;                    // curvatura totale verso l'interno, in presa (rad): basta per stringere i fianchi
  const GIRO_RITRATTO = 17;          // curvatura totale verso l'esterno, ritratti a rosetta (rad, quasi tre giri)
  const RIPOSO = 0.12;               // anche aperti restano un po' arricciati in punta
  const ONDA = 0.6;                  // ampiezza dell'ondeggiamento da aperti (rad su tutta la lunghezza)
  const FRONTE = 0.75;               // quanto del tentacolo si piega insieme: l'arrotolamento parte dalla punta
  const FRONTE_PRESA = 0.5;          // in presa si piega soprattutto il tratto finale, quello che pende lungo i fianchi
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

  // --- fisica dei tentacoli ---
  // Ogni tentacolo è una catena di M punti con il suo peso. A ogni passo: i punti si muovono per inerzia e gravità;
  // poi, dalla base alla punta, ogni punto è tirato verso la posizione che avrebbe se il tentacolo avesse la sua
  // curva «a riposo» (rigidità alla flessione, alta alla base e bassa in punta), rimesso alla distanza giusta dal
  // precedente e spinto fuori da scatola, piano e corpo, con attrito dove tocca. I due cavi cambiano solo la curva
  // a riposo: il cavo esterno la arrotola verso fuori (rosetta), quello interno verso l'asse, con una torsione che
  // ruota il piano della spirale. Il resto (appoggiarsi, ricadere, avvolgersi, staccarsi) viene dalla fisica.
  const M = 40, l = L / M, DENTRO = 10;
  const K = GIRO / totale, KR = GIRO_RITRATTO / totale;
  const GRAVITA = 2600, SMORZA = 0.965, ITERAZIONI = 10, ATTRITO = 0.55, PASSO = 1 / 120;
  const liscia01 = k => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  const zc = new THREE.Vector3(0, 0, 1);
  const d = new THREE.Vector3(), D = new THREE.Vector3(), q = new THREE.Vector3(), w = new THREE.Vector3();

  function base(t, presa) {
    const fuori = new THREE.Vector3(Math.cos(t.a), Math.sin(t.a), 0), giu = new THREE.Vector3(0, 0, -1);
    const T0 = giu.clone().multiplyScalar(Math.cos(APERTURA)).addScaledVector(fuori, Math.sin(APERTURA));
    const D0 = fuori.clone().multiplyScalar(-Math.cos(APERTURA)).addScaledVector(giu, Math.sin(APERTURA));
    const vortice = VORTICE * liscia01(presa * 1.3);
    T0.applyAxisAngle(zc, vortice); D0.applyAxisAngle(zc, vortice);
    const P0 = new THREE.Vector3(CORONA * Math.cos(t.a), CORONA * Math.sin(t.a), zCupola(CORONA));
    return { P0, T0, D0 };
  }
  tentacoli.forEach(t => {
    const { P0, T0 } = base(t, 0);
    t.x = [...Array(M + 1)].map((_, i) => P0.clone().addScaledVector(T0, i * l));
    t.y = t.x.map(v => v.clone());
  });

  // un punto non entra nella scatola, nel piano né nel corpo; ritorna true se tocca qualcosa
  function scosta(c, r, centro, pavimento) {
    let tocca = false;
    q.copy(c).sub(centro);
    const pen = [SCATOLA.x + r - Math.abs(q.x), SCATOLA.y + r - Math.abs(q.y), SCATOLA.z + r - Math.abs(q.z)];
    if (pen[0] > 0 && pen[1] > 0 && pen[2] > 0) {
      const k = pen.indexOf(Math.min(...pen)), asse = ['x', 'y', 'z'][k];
      c[asse] += (Math.sign(q[asse]) || 1) * pen[k];
      tocca = true;
    }
    if (c.z < pavimento + r) { c.z = pavimento + r; tocca = true; }
    // il corpo, approssimato con una sfera: i tentacoli arrotolati non ci entrano
    q.copy(c); q.z += 38;
    const dc = q.length();
    if (dc < 34 + r) { c.addScaledVector(q, (34 + r - dc) / dc); }
    return tocca;
  }

  function passo(st, tempo, centro, pavimento, spinta) {
    const morbido = fermo ? 0 : (1 - st.ritratto) * (1 - 0.75 * st.chiusura);
    for (const t of tentacoli) {
      const { P0, T0, D0 } = base(t, st.chiusura);
      // inerzia e gravità; spinta: quanto si è mosso il corpo, che i punti liberi seguono in ritardo
      for (let i = 2; i <= M; i++) {
        const x = t.x[i], y = t.y[i];
        w.copy(x).sub(y).multiplyScalar(SMORZA);
        y.copy(x);
        x.add(w); x.z -= GRAVITA * PASSO * PASSO + spinta;
      }
      t.x[0].copy(P0); t.x[1].copy(P0).addScaledVector(T0, l);
      t.y[0].copy(t.x[0]); t.y[1].copy(t.x[1]);
      for (let it = 0; it < ITERAZIONI; it++) {
        D.copy(D0);
        for (let i = 2; i <= M; i++) {
          const a = t.x[i - 2], b = t.x[i - 1], c = t.x[i];
          const s = (i - 1) * l, u = s / L;
          d.copy(b).sub(a).normalize();
          D.addScaledVector(d, -D.dot(d)).normalize();
          const fuoriAttivo = liscia01((st.ritratto * (1 + FRONTE) - (1 - u)) / FRONTE);
          const dentroAttivo = Math.max(RIPOSO * u * u * (1 - st.ritratto), liscia01((st.chiusura * (1 + FRONTE_PRESA) - (1 - u)) / FRONTE_PRESA));
          // torsione: il lato verso cui si piega gira lentamente attorno al tentacolo
          D.applyAxisAngle(d, TORSIONE * dentroAttivo / M);
          const onda = ONDA * morbido * u / M * Math.sin(2 * Math.PI * 1.3 * u - tempo * 1.6 + t.fase);
          const th = (K * dentroAttivo - KR * fuoriAttivo) / raggio(s) * l + onda;
          // dove dovrebbe stare il punto con la curva a riposo
          w.copy(d).multiplyScalar(Math.cos(th)).addScaledVector(D, Math.sin(th)).multiplyScalar(l).add(b);
          const rigido = 0.45 - 0.3 * u + 0.35 * Math.max(fuoriAttivo, dentroAttivo);
          c.lerp(w, Math.min(1, rigido));
          // distanza fissa dal punto precedente
          w.copy(c).sub(b).setLength(l);
          c.copy(b).add(w);
          if (scosta(c, raggio(s) * 0.95, centro, pavimento)) t.y[i].lerp(c, ATTRITO);
        }
      }
    }
  }

  // superficie del tentacolo dalla catena: una curva liscia per i punti, con le sezioni orientate per trasporto
  const v = new THREE.Vector3(), Tg = new THREE.Vector3(), Dg = new THREE.Vector3(), Bg = new THREE.Vector3();
  function disegna(t, presa) {
    const { T0, D0 } = base(t, presa);
    const punti = [t.x[0].clone().addScaledVector(T0, -DENTRO), ...t.x];
    const curva = new THREE.CatmullRomCurve3(punti, false, 'centripetal');
    curva.arcLengthDivisions = 160;
    const lungo = curva.getSpacedPoints(ANELLI);
    Dg.copy(D0);
    for (let i = 0; i <= ANELLI; i++) {
      const s = Math.max(0, (i / ANELLI) * (L + DENTRO) - DENTRO), f = integrale(s) / totale;
      Tg.copy(lungo[Math.min(ANELLI, i + 1)]).sub(lungo[Math.max(0, i - 1)]).normalize();
      Dg.addScaledVector(Tg, -Dg.dot(Tg)).normalize();
      Bg.crossVectors(Tg, Dg);
      const r = raggio(s), n = (SEGMENTI * f) % 1;
      const fessura = Math.pow(Math.max(0, 1 - Math.abs(n - 0.5) * 4.2), 1.5) * (0.3 - 0.16 * presa);
      for (let j = 0; j <= LATI; j++) {
        const phi = (j / LATI) * Math.PI * 2, dentro = Math.max(0, Math.cos(phi));
        const rr = r * (1 - fessura * dentro * dentro);
        v.copy(lungo[i]).addScaledVector(Dg, rr * Math.cos(phi)).addScaledVector(Bg, rr * Math.sin(phi));
        t.pos.set([v.x, v.y, v.z], (i * (LATI + 1) + j) * 3);
      }
      if (i === ANELLI) t.pos.set([lungo[i].x + Tg.x * RT, lungo[i].y + Tg.y * RT, lungo[i].z + Tg.z * RT], (ANELLI + 1) * (LATI + 1) * 3);
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
  const SU = ALTO + 64.4 + L + 15, GIU = ALTO + 64.4 + 24;   // tentacoli distesi sopra la scatola; spazio per srotolarsi
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
  // la simulazione avanza a passi fissi; data-tempo (in secondi) la ricalcola da capo fino a quell'istante
  const centro = new THREE.Vector3();
  let tSim = 0, quotaPrima = SU, spintaPrima = 0, ultimo = null, tempoFisso = null;
  function avanza(fino) {
    while (tSim + PASSO <= fino) {
      tSim += PASSO;
      const st = fermo ? { quota: GIU, ritratto: 0, chiusura: 1, presa: false } : statoAl(tSim);
      pinza.position.z = st.quota;
      scatola.position.z = PAVIMENTO + SCATOLA.z + (st.presa ? st.quota - GIU : 0);
      centro.copy(scatola.position).sub(pinza.position);
      // nel sistema della pinza, quando lei accelera i tentacoli restano indietro
      const mosso = st.quota - quotaPrima;
      passo(st, tSim, centro, PAVIMENTO - st.quota, mosso - spintaPrima);
      quotaPrima = st.quota; spintaPrima = mosso;
      ultimo = st;
    }
  }
  function ricomincia() {
    tSim = 0; quotaPrima = SU; spintaPrima = 0;
    tentacoli.forEach(t => {
      const { P0, T0 } = base(t, 0);
      t.x.forEach((v, i) => v.copy(P0).addScaledVector(T0, i * l));
      t.y.forEach((v, i) => v.copy(t.x[i]));
    });
  }
  let visibile = true;
  new IntersectionObserver(([e]) => { visibile = e.isIntersecting; }).observe(contenitore);
  let prima = performance.now(), tempoReale = 0;
  (function ciclo(ora) {
    requestAnimationFrame(ciclo);
    const dt = Math.min(0.05, (ora - prima) / 1000); prima = ora;
    if (!visibile) return;
    const fisso = contenitore.dataset.tempo;
    if (fisso !== undefined) {
      if (+fisso !== tempoFisso) { tempoFisso = +fisso; ricomincia(); avanza(tempoFisso); }
    } else {
      tempoReale += dt;
      avanza(tempoReale);
    }
    if (ultimo) tentacoli.forEach(t => disegna(t, ultimo.chiusura));
    controlli.update();
    renderer.render(scena, camera);
  })(prima);
})();
