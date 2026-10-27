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
  camera.position.set(380, -415, -5);
  const controlli = new THREE.OrbitControls(camera, renderer.domElement);
  controlli.target.set(0, 0, -78);
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

  const PAVIMENTO = -170;
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

  // --- la pallina da afferrare, come nel video: una pallina da tennis con la sua cucitura ---
  const RB = 24;
  const palla = new THREE.Group();
  palla.add(new THREE.Mesh(new THREE.SphereGeometry(RB, 64, 48), new THREE.MeshStandardMaterial({ color: 0xcdd65a, roughness: 0.95 })));
  const cucitura = [];
  for (let k = 0; k <= 240; k++) {
    const u = (k / 240) * Math.PI * 2;
    cucitura.push(new THREE.Vector3(0.75 * Math.cos(u) + 0.25 * Math.cos(3 * u), 0.75 * Math.sin(u) - 0.25 * Math.sin(3 * u), 0.85 * Math.sin(2 * u)).setLength(RB + 0.2));
  }
  palla.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cucitura, true), 240, 0.9, 8, true), new THREE.MeshStandardMaterial({ color: 0xf2f1ec, roughness: 0.9 })));
  palla.rotation.set(0.4, 0.2, 0.7);
  scena.add(palla);

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
  // un punto del tentacolo non entra nella pallina né nel piano: torna sulla superficie e la direzione perde la
  // parte che spinge dentro, così il resto del tentacolo ci scorre sopra e ne prende la forma
  function appoggia(r, centro, pavimento) {
    q.copy(p).sub(centro);
    const d = q.length(), minimo = RB + r * 0.92;
    if (d < minimo) {
      q.divideScalar(d);
      const dentro = T.dot(q);
      if (dentro < 0) T.addScaledVector(q, -dentro).normalize();
      p.copy(centro).addScaledVector(q, minimo);
    }
    if (p.z < pavimento + r) {
      p.z = pavimento + r;
      if (T.z < 0) { T.z = 0; T.normalize(); }
    }
    D.addScaledVector(T, -D.dot(T)).normalize(); B.crossVectors(T, D);
  }

  // Due cavi per tentacolo, come nel video. ritratto (0–1): il cavo esterno arrotola il tentacolo verso l'esterno e
  // verso l'alto, a rosetta accanto al corpo; srotolandosi si stende prima vicino alla base e per ultima la punta.
  // presa (0–1): il cavo interno arrotola la punta verso l'asse, sotto l'oggetto, con la torsione e il vortice.
  // centro e pavimento: la pallina e il piano, nel sistema della pinza.
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
    for (let i = 0; i <= ANELLI; i++) {
      const s = Math.max(0, i * ds - DENTRO), u = s / L, f = integrale(s) / totale;
      if (i > 0 && i * ds > DENTRO) {
        // fronte del cavo esterno: arrotolato dove u > 1 − ritratto; quello interno parte dalla punta
        const fuoriAttivo = liscia01((ritratto * (1 + FRONTE) - (1 - u)) / FRONTE);
        const dentroAttivo = Math.max(RIPOSO * u * u * (1 - ritratto), liscia01((presa * (1 + FRONTE) - (1 - u)) / FRONTE));
        // ondeggiamento: due onde lente che corrono lungo il tentacolo, più ampie verso la punta
        const onda = ONDA / L * morbido * u;
        const kD = (K * dentroAttivo - GIRO_RITRATTO / totale * fuoriAttivo) / raggio(s)
          + onda * Math.sin(2 * Math.PI * (1.3 * u) - tempo * 1.6 + t.fase);
        const kB = onda * 0.8 * Math.sin(2 * Math.PI * (1.1 * u) - tempo * 1.2 + t.fase * 1.7);
        gira(T, D, kD * ds);
        gira(T, B, kB * ds);
        gira(D, B, TORSIONE / L * dentroAttivo * ds);
        T.normalize(); D.addScaledVector(T, -D.dot(T)).normalize(); B.crossVectors(T, D);
        p.addScaledVector(T, ds);
        appoggia(raggio(s), centro, pavimento);
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

  // ciclo del video: la pinza arriva con i tentacoli ritratti a rosetta, scende sopra la pallina, i tentacoli si
  // srotolano sopra di lei prendendone la forma e intanto le punte cominciano ad arrotolarsi sotto, la solleva, la tiene, la riappoggia,
  // la lascia, i tentacoli si ritraggono e la pinza risale
  const SU = 35, GIU = -50;                                  // quota della pinza: in alto e appena sopra la pallina
  const liscia = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const fasi = [                                             // durata (s), quota da/a, ritratto da/a, presa da/a, pallina presa
    [1.2, SU, SU, 1, 1, 0, 0, false], [1.8, SU, GIU, 1, 1, 0, 0, false], [2.6, GIU, GIU, 1, 0, 0, 0.45, false],
    [1.8, GIU, GIU, 0, 0, 0.45, 1, false], [2, GIU, SU, 0, 0, 1, 1, true], [1.2, SU, SU, 0, 0, 1, 1, true],
    [2, SU, GIU, 0, 0, 1, 1, true], [1.4, GIU, GIU, 0, 0.45, 1, 0, false], [1.8, GIU, GIU, 0.45, 1, 0, 0, false],
    [1.6, GIU, SU, 1, 1, 0, 0, false],
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
    return { quota: SU, ritratto: 1, chiusura: 0, presa: false };
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
    palla.position.z = PAVIMENTO + RB + (st.presa ? st.quota - GIU : 0);
    centro.copy(palla.position).sub(pinza.position);
    tentacoli.forEach(x => aggiornaTentacolo(x, st.ritratto, st.chiusura, t, centro, PAVIMENTO - st.quota));
    controlli.update();
    renderer.render(scena, camera);
  })(t0);
})();
