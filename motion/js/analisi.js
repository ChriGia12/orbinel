// Analisi della posa: masse stimate dagli STL, coppie statiche dovute alla gravità su ogni giunto,
// margini rispetto ai servo, singolarità e spazio di lavoro. Sono stime: masse dal volume dei pezzi
// (PETG al 55 % del pieno), niente attriti, niente accelerazioni. Vanno confrontate con il robot vero.
'use strict';

const KGCM = 1 / 10;   // mm·kg -> kg·cm

const analisi = {
  link: null,          // nome -> { massa (g), centro [mm, sistema del modello], giunto }
  carico: 0,           // g in presa
  ultimo: null,        // risultato dell'ultima posa, letto anche dalle lezioni
};

// volume (mm³) e baricentro di una mesh chiusa, dai tetraedri con vertice nell'origine
function proprieta(geo) {
  const p = geo.attributes.position.array;
  let vol = 0, cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2], bx = p[i + 3], by = p[i + 4], bz = p[i + 5];
    const qx = p[i + 6], qy = p[i + 7], qz = p[i + 8];
    const d = (ax * (by * qz - bz * qy) - ay * (bx * qz - bz * qx) + az * (bx * qy - by * qx)) / 6;
    vol += d;
    cx += d * (ax + bx + qx) / 4; cy += d * (ay + by + qy) / 4; cz += d * (az + bz + qz) / 4;
  }
  return { volume: Math.abs(vol), centro: vol ? [cx / vol, cy / vol, cz / vol] : [0, 0, 0] };
}

function calcolaMasse(geo) {
  const { densita, riempimento } = ROBOT.materiale;
  const servo = proprieta(geo.servo);
  const giuntoDi = link => ROBOT.giunti.findIndex(g => g.link === link);
  const link = {};
  for (const [nome, def] of Object.entries(ROBOT.link)) {
    const parti = [];
    const pezzi = [...def.pezzi, ...(nome === 'utensile' ? Object.values(ROBOT.dita) : [])];
    pezzi.forEach(n => {
      const pr = proprieta(geo[n]);
      parti.push({ m: pr.volume / 1000 * densita * riempimento, c: pr.centro });
    });
    def.servo.forEach(i => {
      const f = ROBOT.servoPose[i], s = servo.centro;
      const c = [0, 1, 2].map(k => f[k] + f[3 + k] * s[0] + f[6 + k] * s[1] + f[9 + k] * s[2]);
      parti.push({ m: ROBOT.servoDati.massa, c });
    });
    const m = parti.reduce((t, x) => t + x.m, 0);
    const centro = [0, 1, 2].map(k => parti.reduce((t, x) => t + x.m * x.c[k], 0) / (m || 1));
    link[nome] = { massa: m, centro, giunto: giuntoDi(nome) };
  }
  return link;
}

// coppie in kg·cm attorno all'asse di ogni giunto, con il carico in presa
function coppie(q, caricoG = analisi.carico) {
  const fk = diretta(q);
  const masse = [];
  for (const l of Object.values(analisi.link)) {
    if (l.giunto < 0) continue;                       // la base non si muove
    const g = fk.giunti[l.giunto], o = ROBOT.giunti[l.giunto].origine;
    masse.push({ m: l.massa / 1000, c: V.add(g.p, M.vec(g.R, V.sub(l.centro, o))), da: l.giunto });
  }
  return ROBOT.giunti.map((giunto, i) => {
    const asse = M.vec(fk.giunti[i].R, giunto.asse), p = fk.giunti[i].p;
    const momento = (m, c) => m * V.dot(asse, V.cross(V.sub(c, p), [0, 0, -1]));
    const proprio = masse.filter(x => x.da >= i).reduce((t, x) => t + momento(x.m, x.c), 0) * KGCM;
    const perGrammo = momento(0.001, fk.tcp) * KGCM;
    return { coppia: proprio + perGrammo * caricoG, proprio, perGrammo };
  });
}

function servoDelGiunto(i) {
  return Math.max(1, imp.giunti[i].servo.filter(s => s.id).length);
}

// posizioni in cui la cinematica perde un grado di libertà
function singolarita(q, fk) {
  const lista = [];
  if (Math.abs(q[4]) < 3) lista.push({ tipo: 'polso', testo: 'Polso dritto (J5 ≈ 0°): J4 e J6 ruotano attorno allo stesso asse' });
  const distanza = V.norm(V.sub(fk.polso, [0, 0, ROBOT.d1]));
  if (distanza > ROBOT.a2 + ROBOT.d4 - 4) lista.push({ tipo: 'gomito', testo: 'Braccio disteso: il gomito è al limite e il polso non può allontanarsi' });
  if (Math.hypot(fk.polso[0], fk.polso[1]) < 12) lista.push({ tipo: 'spalla', testo: 'Polso sopra l\'asse della base: J1 non ha una posizione definita' });
  return lista;
}

function analizza(q, fk) {
  if (!analisi.link) return null;
  const giunti = coppie(q).map((x, i) => {
    const n = servoDelGiunto(i);
    const nominale = ROBOT.servoDati.nominale * n, picco = ROBOT.servoDati.picco * n;
    const assoluta = Math.abs(x.coppia);
    return { ...x, assoluta, nominale, picco, margine: assoluta > 1e-6 ? nominale / assoluta : Infinity };
  });
  // carico massimo prima che un giunto superi la coppia nominale
  let caricoMax = Infinity;
  giunti.forEach(g => {
    if (Math.abs(g.perGrammo) < 1e-9) return;
    for (const limite of [g.nominale, -g.nominale]) {
      const w = (limite - g.proprio) / g.perGrammo;
      if (w >= 0) caricoMax = Math.min(caricoMax, w);
    }
  });
  if (giunti.some(g => Math.abs(g.proprio) > g.nominale)) caricoMax = 0;
  const massa = Object.values(analisi.link).filter(l => l.giunto >= 0).reduce((t, l) => t + l.massa, 0);
  return { giunti, caricoMax, massa, singolarita: singolarita(q, fk) };
}

// --- spazio di lavoro: pose casuali entro i limiti ---
function campionaSpazio(n = 5000) {
  const punti = [];
  for (let k = 0; k < n; k++) {
    const q = imp.giunti.map(g => g.min + Math.random() * (g.max - g.min));
    punti.push({ p: diretta(q).tcp, ok: controlla(q, imp.giunti).length === 0 });
  }
  return punti;
}

// --- interfaccia ---
function mostraAnalisi(r) {
  const el = document.getElementById('analisiGiunti');
  if (!el) return;
  if (!r) { el.innerHTML = '<p class="muted" style="font-size:12px">Calcolo le masse dal modello…</p>'; return; }
  el.innerHTML = r.giunti.map((g, i) => {
    const k = Math.min(1, g.assoluta / g.picco);
    const colore = g.margine >= 1.5 ? 'var(--ok)' : g.margine >= 1 ? 'var(--warn)' : 'var(--stop)';
    return `<div class="barra-giunto">
      <span>${ROBOT.giunti[i].nome.split(' ')[0]}</span>
      <div class="barra"><div style="width:${(k * 100).toFixed(1)}%;background:${colore}"></div><i style="left:${(g.nominale / g.picco * 100).toFixed(1)}%"></i></div>
      <span class="num">${g.assoluta.toFixed(1)}</span>
      <span class="num" style="color:${colore}">${g.margine === Infinity ? '—' : g.margine > 20 ? '>20' : '×' + g.margine.toFixed(2)}</span>
    </div>`;
  }).join('');
  document.getElementById('analisiMassa').textContent = `${r.massa.toFixed(0)} g`;
  document.getElementById('analisiMax').textContent = r.caricoMax === Infinity ? '—' : `${Math.max(0, r.caricoMax).toFixed(0)} g`;
  document.getElementById('analisiSing').innerHTML = r.singolarita.length
    ? r.singolarita.map(s => `<div>◆ ${s.testo}</div>`).join('') : '<span class="muted">Nessuna singolarità vicina</span>';
}

document.addEventListener('motion:modello', e => {
  analisi.link = calcolaMasse(e.detail.geo);
});

document.addEventListener('motion:posa', e => {
  const { q, fk } = e.detail;
  analisi.ultimo = analizza(q, fk);
  mostraAnalisi(analisi.ultimo);
  window.scena?.mostraCarico?.(fk.tcp, analisi.carico);
});

(() => {
  const cursore = document.getElementById('carico');
  cursore.addEventListener('input', () => {
    analisi.carico = +cursore.value;
    document.getElementById('valCarico').textContent = analisi.carico;
    impostaPosa(stato.q);
  });
  let accesa = false;
  document.getElementById('btnSpazio').addEventListener('click', () => {
    accesa = !accesa;
    window.scena?.mostraNuvola(accesa ? campionaSpazio() : null);
    document.getElementById('btnSpazio').textContent = 'Spazio di lavoro: ' + (accesa ? 'acceso' : 'spento');
    document.dispatchEvent(new CustomEvent('motion:spazio', { detail: accesa }));
  });
})();
