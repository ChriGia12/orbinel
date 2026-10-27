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
