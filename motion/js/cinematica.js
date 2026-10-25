// Cinematica del braccio: diretta (angoli -> posizione della pinza) e inversa (posizione e
// orientamento della pinza -> angoli). Angoli in gradi, quote in mm, matrici 3x3 come array
// di righe. Polso sferico: J4, J5, J6 si incontrano nel centro del polso.
'use strict';

const RAD = Math.PI / 180;

const M = {
  id: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  mul(a, b) {
    return a.map(r => [0, 1, 2].map(j => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  },
  vec: (a, v) => a.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]),
  t: a => [0, 1, 2].map(i => [a[0][i], a[1][i], a[2][i]]),
  rot(asse, gradi) {
    const c = Math.cos(gradi * RAD), s = Math.sin(gradi * RAD);
    if (asse[0]) return [[1, 0, 0], [0, c, -s], [0, s, c]];
    if (asse[1]) return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
  },
};
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => Math.hypot(a[0], a[1], a[2]),
  unit: a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; },
};

// Cinematica diretta: per ogni giunto origine e rotazione nel mondo, più polso e pinza.
function diretta(q) {
  let R = M.id(), p = [0, 0, 0], prima = [0, 0, 0];
  const giunti = [];
  ROBOT.giunti.forEach((g, i) => {
    p = V.add(p, M.vec(R, V.sub(g.origine, prima)));
    R = M.mul(R, M.rot(g.asse, q[i] || 0));
    prima = g.origine;
    giunti.push({ p: p.slice(), R });
  });
  const ultimo = ROBOT.giunti[5].origine;
  const punto = locale => V.add(p, M.vec(R, V.sub(locale, ultimo)));
  return { giunti, R, polso: giunti[4].p, tcp: punto(ROBOT.tcp), flangia: punto([208, 0, 255]) };
}

// Orientamento della pinza da inclinazione (gradi: 0 orizzontale in fuori, -90 verso il basso)
// e rotazione attorno al proprio asse. L'asse x della pinza è la direzione di avvicinamento.
function orientamento(bersaglio, inclinazione, rotazione, q1Attuale) {
  let radiale = [bersaglio[0], bersaglio[1], 0];
  if (Math.hypot(radiale[0], radiale[1]) < 1) radiale = [Math.cos(q1Attuale * RAD), Math.sin(q1Attuale * RAD), 0];
  radiale = V.unit(radiale);
  const c = Math.cos(inclinazione * RAD), s = Math.sin(inclinazione * RAD);
  const x = [radiale[0] * c, radiale[1] * c, s];
  const y = [-radiale[1], radiale[0], 0];
  const z = V.cross(x, y);
  const base = M.t([x, y, z]);            // colonne x, y, z
  return M.mul(base, M.rot([1, 0, 0], rotazione));
}

// Cinematica inversa. Ritorna gli angoli più vicini a `attuali`, o un motivo se non si può.
function inversa(bersaglio, R, attuali) {
  const offsetPinza = V.sub(ROBOT.tcp, ROBOT.polso);          // nel sistema della pinza
  const W = V.sub(bersaglio, M.vec(R, offsetPinza));
  const { d1, a2, d4 } = ROBOT;

  let q1 = Math.atan2(W[1], W[0]) / RAD;
  if (Math.hypot(W[0], W[1]) < 0.5) q1 = attuali[0];
  const r = Math.hypot(W[0], W[1]);
  const s = W[2] - d1;
  const D = (r * r + s * s - a2 * a2 - d4 * d4) / (2 * a2 * d4);
  if (Math.abs(D) > 1) return { errore: 'Troppo lontano o troppo vicino: il polso non ci arriva' };
  const gamma = -Math.acos(D);                                  // gomito in alto
  const alfa = Math.atan2(s, r) - Math.atan2(d4 * Math.sin(gamma), a2 + d4 * Math.cos(gamma));
  const q2 = 90 - alfa / RAD;
  const q3 = -gamma / RAD - 90;

  const R03 = M.mul(M.rot([0, 0, 1], q1), M.rot([0, 1, 0], q2 + q3));
  const m = M.mul(M.t(R03), R);                                 // = Rx(q4) Ry(q5) Rx(q6)
  const sb = Math.hypot(m[0][1], m[0][2]);
  let soluzioni;
  if (sb < 1e-6) {                                              // J4 e J6 allineati: si tiene J4
    const q4 = attuali[3];
    const somma = Math.atan2(m[2][1], m[1][1]) / RAD;
    soluzioni = [[q4, m[0][0] > 0 ? 0 : 180, somma - q4]];
  } else {
    const b = Math.atan2(sb, m[0][0]) / RAD;
    const a = Math.atan2(m[1][0], -m[2][0]) / RAD;
    const c = Math.atan2(m[0][1], m[0][2]) / RAD;
    soluzioni = [[a, b, c], [a + 180, -b, c + 180]];
  }
  const vicino = (v, rif) => { while (v - rif > 180) v -= 360; while (v - rif < -180) v += 360; return v; };
  let migliore = null, costo = Infinity;
  for (const [a, b, c] of soluzioni) {
    const q = [q1, q2, q3, vicino(a, attuali[3]), b, vicino(c, attuali[5])];
    const k = q.reduce((t, v, i) => t + Math.abs(v - attuali[i]), 0);
    if (k < costo) { costo = k; migliore = q; }
  }
  return { q: migliore };
}

// Controlli sulla posa: limiti dei giunti e punti del braccio sotto il piano o dentro la base.
function controlla(q, limiti) {
  const problemi = [];
  q.forEach((v, i) => {
    if (v < limiti[i].min - 0.01 || v > limiti[i].max + 0.01)
      problemi.push(`${ROBOT.giunti[i].nome}: ${v.toFixed(0)}° fuori dai limiti (${limiti[i].min}…${limiti[i].max})`);
  });
  const fk = diretta(q);
  const punti = { 'il polso': fk.polso, 'la flangia': fk.flangia, 'la pinza': fk.tcp, 'il gomito': fk.giunti[2].p };
  for (const [nome, p] of Object.entries(punti)) {
    if (p[2] < 15) problemi.push(`${nome[0].toUpperCase() + nome.slice(1)} tocca il tavolo`);
    else if (nome !== 'il gomito' && Math.hypot(p[0], p[1]) < 70 && p[2] < 95)
      problemi.push(`${nome[0].toUpperCase() + nome.slice(1)} urta la base`);
  }
  return problemi;
}
