// Geometria degli utensili di Orbinel Parts, con l'attacco utensile di Kheiron (versione 2026-10-08,
// quote da Robot Arm/docs/interfaccia-utensile.md). Funziona nel browser e in Node con manifold-3d.
//
// Sistema di riferimento: asse dell'utensile = asse Z (è l'asse di J6). Il codolo sta in basso,
// da z = 0 (la punta, che entra nella tazza) a z = 5,8; il piano di orientamento è sul lato +Y
// (lato alto del braccio in posa di riposo); i fori per le viti di blocco sono sull'asse X.
// Misure in mm.

export const ATTACCO = {
  codoloDiametro: 27.7,        // la tazza è 28,0
  codoloLunghezza: 5.8,        // la tazza è profonda 6,0
  piano: 10.85,                // distanza del piano di orientamento dall'asse
  foroDiametro: 3.3,
  foroProfondita: 4.5,         // minima, dalla superficie del codolo
  foroQuota: 3.3,              // dalla punta del codolo: 3,5 dal fondo della tazza meno 0,2 di gioco
  collo: 7,                    // dopo la faccia della tazza, ai lati ±X niente oltre r 18 (teste delle viti)
  colloRaggioMax: 18,
};

const SEG = 96;

// codolo + collo: la parte comune a tutti gli utensili. Ritorna il solido e la quota da cui partire.
function attacco(M) {
  const { Manifold } = M, A = ATTACCO;
  const r = A.codoloDiametro / 2;
  let codolo = Manifold.cylinder(A.codoloLunghezza, r, r, SEG);
  // piano di orientamento: si toglie la parte oltre y = 10,85
  codolo = codolo.subtract(Manifold.cube([40, 20, A.codoloLunghezza + 2]).translate([-20, A.piano, -1]));
  // fori radiali per le due viti, sull'asse X
  const lunghezzaForo = A.foroProfondita + 1.5;
  for (const s of [-1, 1]) {
    const foro = Manifold.cylinder(lunghezzaForo + 2, A.foroDiametro / 2, A.foroDiametro / 2, 32)
      .rotate([0, 90, 0])
      .translate([s > 0 ? r - lunghezzaForo : -r - 2, 0, A.foroQuota]);
    codolo = codolo.subtract(foro);
  }
  const rc = 17;                                   // collo Ø 34: più largo della tazza (spallamento), entro r 18
  const collo = Manifold.cylinder(A.collo, rc, rc, SEG).translate([0, 0, A.codoloLunghezza]);
  return { solido: codolo.add(collo), z: A.codoloLunghezza + A.collo, raggio: rc };
}

// smusso di raccordo tra il collo e il corpo dell'utensile
function cono(M, z, h, r1, r2) {
  return M.Manifold.cylinder(h, r1, r2, SEG).translate([0, 0, z]);
}

export const UTENSILI = {
  stilo: {
    nome: { it: 'Stilo di calibrazione', en: 'Calibration stylus' },
    descrizione: {
      it: 'Una punta conica in asse con J6. Serve a misurare e calibrare il punto utensile (TCP) e a tracciare percorsi.',
      en: 'A conical tip on the J6 axis. Used to measure and calibrate the tool centre point (TCP) and to trace paths.',
    },
    parametri: {
      lunghezza: { it: 'Lunghezza della punta', en: 'Tip length', min: 20, max: 90, passo: 1, valore: 50, unita: 'mm' },
      punta: { it: 'Diametro della punta', en: 'Tip diameter', min: 0.8, max: 4, passo: 0.1, valore: 1.2, unita: 'mm' },
    },
    costruisci(M, p) {
      const a = attacco(M);
      const corpo = cono(M, a.z, p.lunghezza, a.raggio, p.punta / 2);
      return { solido: a.solido.add(corpo), tcp: a.z + p.lunghezza };
    },
  },

  pennarello: {
    nome: { it: 'Portapennarello', en: 'Marker holder' },
    descrizione: {
      it: 'Un tubo in asse che stringe un pennarello o una penna con una vite M3 laterale (autofilettante nel foro da 2,8 mm).',
      en: 'A coaxial tube that holds a marker or pen with a side M3 screw (self-tapping into the 2.8 mm hole).',
    },
    parametri: {
      diametro: { it: 'Diametro del pennarello', en: 'Marker diameter', min: 6, max: 22, passo: 0.1, valore: 12, unita: 'mm' },
      gioco: { it: 'Gioco sul diametro', en: 'Diameter clearance', min: 0, max: 1, passo: 0.05, valore: 0.4, unita: 'mm' },
      lunghezza: { it: 'Lunghezza del tubo', en: 'Tube length', min: 15, max: 60, passo: 1, valore: 35, unita: 'mm' },
      parete: { it: 'Spessore della parete', en: 'Wall thickness', min: 2, max: 5, passo: 0.2, valore: 3, unita: 'mm' },
    },
    costruisci(M, p) {
      const { Manifold } = M;
      const a = attacco(M);
      const ri = (p.diametro + p.gioco) / 2, re = ri + p.parete;
      const raccordo = cono(M, a.z, 4, a.raggio, Math.max(re, 6));
      let tubo = Manifold.cylinder(p.lunghezza, re, re, SEG).translate([0, 0, a.z + 4]);
      const vuoto = Manifold.cylinder(p.lunghezza + 1, ri, ri, SEG).translate([0, 0, a.z + 4 + 1.5]);
      const vite = Manifold.cylinder(re + 4, 1.4, 1.4, 24).rotate([0, 90, 0]).translate([0, 0, a.z + 4 + p.lunghezza * 0.6]);
      tubo = tubo.add(raccordo).subtract(vuoto).subtract(vite);
      return { solido: a.solido.add(tubo), tcp: a.z + 4 + p.lunghezza };
    },
  },

  fotocamera: {
    nome: { it: 'Attacco fotocamera 1/4"', en: '1/4" camera mount' },
    descrizione: {
      it: 'Una piastra con foro passante e sede per il dado da 1/4"-20: ci si avvita una piccola fotocamera o una webcam con attacco treppiede.',
      en: 'A plate with a through hole and a pocket for a 1/4"-20 nut: screw on a small camera or a webcam with a tripod thread.',
    },
    parametri: {
      diametro: { it: 'Diametro della piastra', en: 'Plate diameter', min: 34, max: 60, passo: 1, valore: 40, unita: 'mm' },
      spessore: { it: 'Spessore della piastra', en: 'Plate thickness', min: 6, max: 14, passo: 0.5, valore: 8, unita: 'mm' },
      dado: { it: 'Dado: misura sulle facce', en: 'Nut: across flats', min: 10.5, max: 12, passo: 0.05, valore: 11.3, unita: 'mm' },
    },
    costruisci(M, p) {
      const { Manifold, CrossSection } = M;
      const a = attacco(M);
      const r = p.diametro / 2;
      let piastra = cono(M, a.z, 3, a.raggio, Math.max(r, a.raggio)).add(Manifold.cylinder(p.spessore, r, r, SEG).translate([0, 0, a.z + 3]));
      const fine = a.z + 3 + p.spessore;
      const foro = Manifold.cylinder(fine + 2, 3.4, 3.4, 32).translate([0, 0, -1]);
      // sede esagonale del dado, aperta dal lato del codolo (il dado si infila prima di montare l'utensile)
      const esagono = CrossSection.circle(p.dado / 2 / Math.cos(Math.PI / 6), 6);
      const sede = Manifold.extrude(esagono, 5.6).translate([0, 0, a.z + 3 + p.spessore - 5.6 - 1.2]);
      piastra = piastra.subtract(sede);
      return { solido: a.solido.add(piastra).subtract(foro), tcp: fine };
    },
  },

  ventosa: {
    nome: { it: 'Supporto per ventosa', en: 'Suction cup holder' },
    descrizione: {
      it: 'Un mozzo con foro passante filettabile per il raccordo di una ventosa (M5 o M6) e per il tubo del vuoto.',
      en: 'A hub with a tappable through hole for a suction cup fitting (M5 or M6) and the vacuum tube.',
    },
    parametri: {
      foro: { it: 'Foro (4,2 per M5, 5,0 per M6)', en: 'Hole (4.2 for M5, 5.0 for M6)', min: 3, max: 8, passo: 0.1, valore: 4.2, unita: 'mm' },
      mozzo: { it: 'Diametro del mozzo', en: 'Hub diameter', min: 12, max: 30, passo: 0.5, valore: 16, unita: 'mm' },
      lunghezza: { it: 'Lunghezza', en: 'Length', min: 10, max: 50, passo: 1, valore: 22, unita: 'mm' },
    },
    costruisci(M, p) {
      const { Manifold } = M;
      const a = attacco(M);
      const r = p.mozzo / 2;
      const mozzo = cono(M, a.z, 5, a.raggio, r).add(Manifold.cylinder(p.lunghezza, r, r, SEG).translate([0, 0, a.z + 5]));
      const fine = a.z + 5 + p.lunghezza;
      const foro = Manifold.cylinder(fine + 2, p.foro / 2, p.foro / 2, 32).translate([0, 0, -1]);
      return { solido: a.solido.add(mozzo).subtract(foro), tcp: fine };
    },
  },

  magnete: {
    nome: { it: 'Presa magnetica', en: 'Magnetic pick-up' },
    descrizione: {
      it: 'Una sede per un magnete a disco al neodimio, per raccogliere viti e piccoli pezzi in acciaio. Il magnete si incolla.',
      en: 'A pocket for a neodymium disc magnet, to pick up screws and small steel parts. The magnet is glued in.',
    },
    parametri: {
      diametro: { it: 'Diametro del magnete', en: 'Magnet diameter', min: 5, max: 25, passo: 0.5, valore: 10, unita: 'mm' },
      altezza: { it: 'Altezza del magnete', en: 'Magnet height', min: 1, max: 10, passo: 0.5, valore: 3, unita: 'mm' },
      gioco: { it: 'Gioco', en: 'Clearance', min: 0, max: 0.6, passo: 0.05, valore: 0.2, unita: 'mm' },
      lunghezza: { it: 'Lunghezza del corpo', en: 'Body length', min: 8, max: 50, passo: 1, valore: 18, unita: 'mm' },
    },
    costruisci(M, p) {
      const { Manifold } = M;
      const a = attacco(M);
      const rs = (p.diametro + p.gioco) / 2, r = rs + 2.5;
      const corpo = cono(M, a.z, 5, a.raggio, Math.max(r, 8)).add(Manifold.cylinder(p.lunghezza, r, r, SEG).translate([0, 0, a.z + 5]));
      const fine = a.z + 5 + p.lunghezza;
      const sede = Manifold.cylinder(p.altezza + p.gioco + 1, rs, rs, SEG).translate([0, 0, fine - p.altezza - p.gioco]);
      return { solido: a.solido.add(corpo).subtract(sede), tcp: fine };
    },
  },
};

// --- Pinza a tentacoli ---
// Tentacoli a segmenti che si stringono verso la punta, uniti da una spina sottile sul lato esterno e separati
// da fessure a V sul lato interno: tirando un cavo che corre sul lato interno le fessure si chiudono e il
// tentacolo si arrotola verso l'asse, avvolgendo l'oggetto. I cavi si avvolgono su un rocchetto montato sul
// disco di uscita di un servo STS3215 chiuso nel corpo.
// Quote del servo dal modello motion/robot/kheiron/stl/servo.stl, nel suo sistema: corpo 45,4 × 24,8 mm, punto
// più basso a z −19,4 (una costola centrale tra x −2,5 e −0,5), faccia alta a 14,4 verso il disco e fino a 17
// dall'altra parte, disco di uscita Ø 20 tra 16,2 e 18,7 con l'asse a x = 12,5, perno fino a 20,2.
const TENT = {
  raggio: 28.8, parete: 2.2,          // corpo Ø 57,6
  zServo: 26,                         // quota della costola più bassa del servo, appoggiata sulla barretta
  servo: { l: 45.4, w: 24.8, sotto: 19.4, alto: 17, disco: 18.7, asse: 12.5 },
  rocchetto: 11.5,                    // alto 11,5, Ø 23 alle flange e Ø 20 al tamburo
  corona: 15,                         // raggio su cui stanno i tentacoli
  piastra: 3, flangia: 2,
  borchie: [90, 180, 270], rBorchia: 25.5, raggioBorchia: 3.5,   // viti M3 della piastra, su inserti a caldo
  ponte: { x: [-16, -8], viti: [[-12, 22.5], [-12, -22.5]] },      // ponticello che tiene giù il servo
  apertura: 330,                      // curvatura massima di un tentacolo, sommando tutte le fessure (gradi)
};
const zDisco = TENT.zServo + TENT.servo.sotto + TENT.servo.disco;      // 64,1: faccia del disco di uscita
const zFine = zDisco + TENT.rocchetto + 2 + TENT.flangia;            // 79,6: bocca del corpo
const zTentacoli = zFine + TENT.piastra;                              // 82,6: faccia esterna della piastra
const zPonte = TENT.zServo + TENT.servo.sotto + TENT.servo.alto + 0.3; // 62,7: sopra il servo dal lato senza disco

// raggio della flangia alla base di un tentacolo, che sta dentro il corpo appoggiata alla piastra
const flangiaTentacolo = p => p.base + 1.6;

// angolo del primo tentacolo: il più lontano possibile dalle viti della piastra
function angoliTentacoli(p) {
  const rf = flangiaTentacolo(p), passo = 360 / p.numero;
  let meglio = { gioco: -Infinity, inizio: 0 };
  for (let inizio = 0; inizio < passo; inizio += 0.5) {
    let gioco = Infinity;
    for (let k = 0; k < p.numero; k++) for (const b of TENT.borchie) {
      const d = ((inizio + k * passo - b) * Math.PI) / 180;
      const dist = Math.sqrt(TENT.corona ** 2 + TENT.rBorchia ** 2 - 2 * TENT.corona * TENT.rBorchia * Math.cos(d));
      gioco = Math.min(gioco, dist - rf - TENT.raggioBorchia);
    }
    if (gioco > meglio.gioco) meglio = { gioco, inizio };
  }
  const traFlange = 2 * TENT.corona * Math.sin(Math.PI / p.numero) - 2 * rf;
  return { angoli: [...Array(p.numero)].map((_, k) => meglio.inizio + k * passo), gioco: Math.min(meglio.gioco, traFlange) };
}

// un tentacolo nel suo sistema: x = verso l'esterno (lato della spina), z = lungo il tentacolo, con z = 0 sulla
// faccia esterna della piastra. chiusura da 0 (dritto, come si stampa) a 1 (tutte le fessure chiuse)
function tentacolo(M, p, chiusura) {
  const { Manifold } = M, S = p.segmenti;
  const q = Math.pow(p.punta / p.base, 1 / S);
  const h0 = (p.lunghezza * (1 - q)) / (1 - Math.pow(q, S));
  const meta = TENT.apertura / (S - 1) / 2;                 // mezzo angolo di ogni fessura
  const B = 4 * p.base + 20, theta = chiusura * 2 * meta;
  const giunti = [], pezzi = [];
  // ogni pezzo segue le rotazioni dei giunti che ha prima, dal più vicino al più lontano dalla base
  const segui = (solido, fino) => {
    for (let j = fino - 1; j >= 0; j--) {
      const g = giunti[j];
      solido = solido.translate([-g.asse, 0, -g.z]).rotate([0, -theta, 0]).translate([g.asse, 0, g.z]);
    }
    return solido;
  };
  let z = 0;
  for (let k = 0; k < S; k++) {
    const r1 = p.base * q ** k, r2 = p.base * q ** (k + 1), h = h0 * q ** k;
    let seg = Manifold.cylinder(h, r1, r2, 32).translate([0, 0, z]);
    if (k < S - 1) {
      const spina = Math.max(0.8, 0.22 * r2), cerniera = r2 - spina;
      seg = seg.subtract(Manifold.cube([B, B, B]).translate([-B / 2, -B / 2, 0]).rotate([0, -meta, 0]).translate([cerniera, 0, z + h]));
      giunti.push({ cerniera, asse: cerniera + spina / 2, z: z + h, spina, r: r2 });
    }
    if (k > 0) {
      const g = giunti[k - 1];
      seg = seg.subtract(Manifold.cube([B, B, B]).translate([-B / 2, -B / 2, -B]).rotate([0, meta, 0]).translate([g.cerniera, 0, g.z]));
    }
    // canale del cavo (Ø 1,2) sul lato interno; finisce due segmenti prima della punta, dove il cavo si annoda
    if (k <= S - 3) seg = seg.subtract(Manifold.cylinder(h + 1, 0.6, 0.6, 12).translate([-0.45 * (r1 + r2) / 2, 0, z - 0.5]));
    pezzi.push(segui(seg, k));
    z += h;
  }
  // un perno sull'asse di ogni cerniera tiene uniti i segmenti anche quando il tentacolo è chiuso
  giunti.forEach((g, j) => {
    const mezzo = Math.sqrt(Math.max(g.r ** 2 - g.asse ** 2, 0.04));
    const perno = Manifold.cylinder(2 * mezzo, g.spina / 2, g.spina / 2, 12, true).rotate([90, 0, 0]).translate([g.asse, 0, g.z]);
    pezzi.push(segui(perno, j));
  });
  // collo con un piano sul lato esterno (entra nella piastra in un solo verso) e flangia di ritegno
  const rf = flangiaTentacolo(p);
  let base = Manifold.cylinder(TENT.piastra, p.base, p.base, 32).translate([0, 0, -TENT.piastra])
    .subtract(Manifold.cube([4, 2 * p.base + 2, TENT.piastra + 2]).translate([p.base - 0.8, -p.base - 1, -TENT.piastra - 1]))
    .add(Manifold.cylinder(TENT.flangia, rf, rf, 32).translate([0, 0, -TENT.piastra - TENT.flangia]));
  base = base.subtract(Manifold.cylinder(TENT.piastra + TENT.flangia + 1.5, 0.6, 0.6, 12)
    .translate([-0.45 * p.base, 0, -TENT.piastra - TENT.flangia - 1]));
  return pezzi.reduce((a, b) => a.add(b), base);
}

// corpo stampato con il codolo sul piano: raccordo a 45°, vuoto interno, manicotto del servo, appoggi e borchie
function corpoTentacoli(M) {
  const { Manifold } = M, T = TENT, S = T.servo, a = attacco(M);
  const R = T.raggio, Ri = R - T.parete, h = R - a.raggio, zc = a.z + h;
  let corpo = a.solido.add(cono(M, a.z, h, a.raggio, R))
    .add(Manifold.cylinder(zFine - zc, R, R, SEG).translate([0, 0, zc]));
  const rv = a.raggio - 2.8;
  // il cilindro scende 0,5 mm dentro il cono: con le facce solo a contatto resterebbe un velo tra i due vuoti
  const zv = a.z + Ri - rv - 0.5;
  const vuoto = cono(M, a.z, Ri - rv, rv, Ri).add(Manifold.cylinder(zFine + 1 - zv, Ri, Ri, SEG).translate([0, 0, zv]));
  corpo = corpo.subtract(vuoto);
  // dove possono stare i pezzi interni: il vuoto allargato di 0,5 mm, così si saldano alla parete senza uscire
  const dentro = cono(M, a.z, Ri - rv, rv + 0.5, Ri + 0.5).add(Manifold.cylinder(zFine - zv, Ri + 0.5, Ri + 0.5, SEG).translate([0, 0, zv]));
  // barretta sotto la costola del servo
  corpo = corpo.add(Manifold.cube([3, 2 * Ri, T.zServo - a.z]).translate([-3, -Ri, a.z]).intersect(dentro));
  // manicotto del servo, 0,2 mm di gioco per lato
  const li = S.l + 0.4, wi = S.w + 0.4, zm = 54 - T.zServo;
  const manicotto = Manifold.cube([li + 3.2, wi + 3.2, zm]).translate([-li / 2 - 1.6, -wi / 2 - 1.6, T.zServo])
    .subtract(Manifold.cube([li, wi, zm + 2]).translate([-li / 2, -wi / 2, T.zServo - 1]));
  corpo = corpo.add(manicotto.intersect(dentro));
  // borchie per le viti della piastra (in fondo) e del ponticello (sopra il servo), con inserti M3 Ø 4
  const borchia = (x, y, z0, z1, foroDa) => {
    let b = Manifold.cylinder(z1 - z0, T.raggioBorchia, T.raggioBorchia, 32).translate([x, y, z0])
      .add(Manifold.cylinder(T.raggioBorchia, 0.01, T.raggioBorchia, 32).translate([x, y, z0 - T.raggioBorchia]));
    const foro = Manifold.cylinder(5, 2, 2, 24).translate([x, y, foroDa === 'basso' ? z1 - 5 : z0]);
    return { b: b.intersect(dentro), foro };
  };
  const borchie = [
    ...T.borchie.map(g => borchia(T.rBorchia * Math.cos(g * Math.PI / 180), T.rBorchia * Math.sin(g * Math.PI / 180), zFine - 13, zFine, 'basso')),
    ...T.ponte.viti.map(([x, y]) => borchia(x, y, zPonte - 12, zPonte, 'basso')),
  ];
  borchie.forEach(({ b }) => { corpo = corpo.add(b); });
  borchie.forEach(({ foro }) => { corpo = corpo.subtract(foro); });
  // asola per il cavo del servo, verso −x
  corpo = corpo.subtract(Manifold.cube([12, 8, 16]).translate([-R - 2, -4, 30]));
  return corpo;
}

function piastraTentacoli(M, p, angoli) {
  const { Manifold } = M, T = TENT;
  let piastra = Manifold.cylinder(T.piastra, T.raggio, T.raggio, SEG).translate([0, 0, zFine]);
  for (const g of T.borchie) {
    const x = T.rBorchia * Math.cos(g * Math.PI / 180), y = T.rBorchia * Math.sin(g * Math.PI / 180);
    piastra = piastra.subtract(Manifold.cylinder(T.piastra + 2, 1.7, 1.7, 24).translate([x, y, zFine - 1]))
      .subtract(Manifold.cylinder(2, 3.1, 3.1, 24).translate([x, y, zTentacoli - 1.6]));
  }
  for (const g of angoli) {
    const r = p.base + 0.2;
    const foro = Manifold.cylinder(T.piastra + 2, r, r, 32)
      .subtract(Manifold.cube([4, 2 * r + 2, T.piastra + 4]).translate([p.base - 0.6, -r - 1, -1]))
      .translate([0, 0, zFine - 1]).rotate([0, 0, g]).translate([T.corona * Math.cos(g * Math.PI / 180), T.corona * Math.sin(g * Math.PI / 180), 0]);
    piastra = piastra.subtract(foro);
  }
  return piastra;
}

// rocchetto avvitato con 4 viti M3 sul disco di uscita del servo (fori su Ø 14), perno libero nell'incavo
function rocchetto(M) {
  const { Manifold } = M, x = TENT.servo.asse, z = zDisco, h = TENT.rocchetto;
  let r = Manifold.cylinder(2, 11.5, 11.5, SEG)
    .add(Manifold.cylinder(h - 3.5, 10, 10, SEG).translate([0, 0, 2]))
    .add(Manifold.cylinder(1.5, 10, 11.5, SEG).translate([0, 0, h - 2]))
    .add(Manifold.cylinder(0.5, 11.5, 11.5, SEG).translate([0, 0, h - 0.5]));
  r = r.subtract(Manifold.cylinder(1.8, 3.5, 3.5, 32).translate([0, 0, -0.01]));
  for (let k = 0; k < 4; k++) {
    const g = (45 + 90 * k) * Math.PI / 180, px = 7 * Math.cos(g), py = 7 * Math.sin(g);
    r = r.subtract(Manifold.cylinder(h + 2, 1.65, 1.65, 24).translate([px, py, -1]))
      .subtract(Manifold.cylinder(3.1, 3, 3, 24).translate([px, py, h - 3]));
  }
  for (const s of [-1, 1]) r = r.subtract(Manifold.cylinder(h + 2, 0.75, 0.75, 12).translate([s * 10.75, 0, -1]));
  return r.translate([x, 0, z]);
}

function ponticello(M) {
  const { Manifold } = M, P = TENT.ponte, Ri = TENT.raggio - TENT.parete - 0.4;
  let b = Manifold.cube([P.x[1] - P.x[0], 2 * Ri, 3]).translate([P.x[0], -Ri, zPonte])
    .intersect(Manifold.cylinder(3, Ri, Ri, SEG).translate([0, 0, zPonte]));
  for (const [x, y] of P.viti) b = b.subtract(Manifold.cylinder(5, 1.7, 1.7, 24).translate([x, y, zPonte - 1]));
  return b;
}

UTENSILI.tentacoli = {
  nome: { it: 'Pinza a tentacoli', en: 'Tentacle gripper' },
  descrizione: {
    it: 'Concept: tentacoli che si arrotolano attorno all\'oggetto, tirati da cavi avvolti su un rocchetto mosso da un servo STS3215 chiuso nel corpo. L\'STL contiene tutti i pezzi già disposti sul piano: corpo, piastra, rocchetto e ponticello in PETG, tentacoli in TPU 95A. Dividilo in oggetti nello slicer. Non ancora stampato né provato.',
    en: 'Concept: tentacles that curl around the object, pulled by cables wound on a spool driven by an STS3215 servo inside the body. The STL holds every part laid out on the bed: body, plate, spool and bridge in PETG, tentacles in TPU 95A. Split it into objects in your slicer. Not printed or tested yet.',
  },
  parametri: {
    numero: { it: 'Tentacoli', en: 'Tentacles', min: 2, max: 6, passo: 1, valore: 4, unita: '' },
    lunghezza: { it: 'Lunghezza dei tentacoli', en: 'Tentacle length', min: 40, max: 110, passo: 1, valore: 75, unita: 'mm' },
    base: { it: 'Raggio alla base', en: 'Base radius', min: 3.5, max: 5.5, passo: 0.1, valore: 5, unita: 'mm' },
    punta: { it: 'Raggio in punta', en: 'Tip radius', min: 1, max: 2.5, passo: 0.1, valore: 1.5, unita: 'mm' },
    segmenti: { it: 'Segmenti per tentacolo', en: 'Segments per tentacle', min: 8, max: 20, passo: 1, valore: 14, unita: '' },
    chiusura: { it: 'Chiusura (solo anteprima)', en: 'Closing (preview only)', min: 0, max: 100, passo: 5, valore: 0, unita: '%' },
  },
  costruisci(M, p) {
    const { angoli, gioco } = angoliTentacoli(p);
    const mettiTentacolo = (t, g) => t.rotate([0, 0, g]).translate([TENT.corona * Math.cos(g * Math.PI / 180), TENT.corona * Math.sin(g * Math.PI / 180), zTentacoli]);
    const corpo = corpoTentacoli(M), piastra = piastraTentacoli(M, p, angoli), rocc = rocchetto(M), ponte = ponticello(M);
    const montato = [corpo, piastra, rocc, ponte, ...angoli.map(g => mettiTentacolo(tentacolo(M, p, p.chiusura / 100), g))];
    // per la stampa: tentacoli dritti in piedi sulla flangia, gli altri pezzi sulla faccia piana
    const dritto = tentacolo(M, p, 0), passo = 2 * flangiaTentacolo(p) + 4;
    const stampa = [
      corpo,
      piastra.translate([0, 0, -zFine]).translate([70, 0, 0]),
      rocc.translate([-TENT.servo.asse, 0, -zDisco]).translate([-50, 45, 0]),
      ponte.translate([0, 0, -zPonte]).translate([-55, -15, 0]),
      ...angoli.map((_, k) => dritto.translate([0, 0, TENT.piastra + TENT.flangia]).translate([-((p.numero - 1) * passo) / 2 + k * passo, -70, 0])),
    ];
    return {
      solido: montato.reduce((a, b) => a.add(b)),
      stampa: stampa.reduce((a, b) => a.add(b)),
      tcp: zTentacoli + 0.5 * p.lunghezza,
      servo: [0, 0, TENT.zServo + TENT.servo.sotto + (TENT.servo.alto - TENT.servo.sotto) / 2],
      controlli: [
        { it: 'Servo STS3215 nel corpo, con le quote del modello del servo', en: 'STS3215 servo inside the body, sized from the servo model', ok: true },
        { it: 'Tentacoli lontani dalle viti della piastra e tra loro', en: 'Tentacles clear of the plate screws and of each other', ok: gioco >= 0.3 },
      ],
    };
  },
};

// valori predefiniti di un utensile
export function predefiniti(tipo) {
  return Object.fromEntries(Object.entries(UTENSILI[tipo].parametri).map(([k, v]) => [k, v.valore]));
}

// costruisce l'utensile e ritorna mesh (vertici e triangoli), volume, ingombri e controlli
export function costruisci(M, tipo, parametri) {
  const u = UTENSILI[tipo];
  const p = { ...predefiniti(tipo), ...parametri };
  // stampa: i pezzi disposti sul piano, quando l'utensile ne ha più di uno (l'STL si scarica da qui);
  // servo: centro del servo dentro l'utensile, per le masse
  const { solido, tcp, stampa, servo, controlli: propri = [] } = u.costruisci(M, p);
  const mesh = solido.getMesh();
  const meshStampa = stampa ? stampa.getMesh() : mesh;
  const scatola = solido.boundingBox();
  const volume = solido.volume();
  const controlli = [
    { it: 'Codolo Ø 27,7 × 5,8 mm con piano di orientamento', en: 'Shank Ø 27.7 × 5.8 mm with orientation flat', ok: true },
    { it: 'Fori Ø 3,3 per le due viti di blocco', en: 'Ø 3.3 holes for the two locking screws', ok: true },
    { it: 'Ingombro ai lati entro r 18 per i primi 7 mm', en: 'Side clearance within r 18 for the first 7 mm', ok: true },
    { it: 'Solido chiuso, pronto per lo slicer', en: 'Closed solid, ready for the slicer', ok: solido.status() === 'NoError' && mesh.numTri > 0 && (!stampa || stampa.status() === 'NoError') },
    ...propri,
  ];
  return { mesh, meshStampa, volume, scatola, tcp, servo, controlli, solido };
}

// STL binario da una mesh di manifold-3d
export function stl(mesh) {
  const n = mesh.numTri, np = mesh.numProp, v = mesh.vertProperties, t = mesh.triVerts;
  const buf = new ArrayBuffer(84 + n * 50), dv = new DataView(buf);
  const titolo = 'Orbinel Parts';
  for (let i = 0; i < titolo.length; i++) dv.setUint8(i, titolo.charCodeAt(i));
  dv.setUint32(80, n, true);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50;
    const P = [0, 1, 2].map(k => { const j = t[i * 3 + k] * np; return [v[j], v[j + 1], v[j + 2]]; });
    const u = P[1].map((x, k) => x - P[0][k]), w = P[2].map((x, k) => x - P[0][k]);
    let nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    P.forEach((q, k) => q.forEach((x, j) => dv.setFloat32(o + 12 + k * 12 + j * 4, x, true)));
  }
  return buf;
}
