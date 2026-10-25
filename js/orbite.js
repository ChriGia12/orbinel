// Animazione della home: il linguaggio del simbolo Orbinel in movimento. Orbite che girano piano con i loro
// nodi e, davanti, un braccio astratto (giunti ad anello, link, punta arancione) che lascia una scia.
// Non è un robot preciso: rappresenta l'idea di Orbinel. Se il puntatore è sopra, la punta lo segue.
// Contenitore: un elemento con [data-orbite] che contiene un <canvas>.
'use strict';

(() => {
  const box = document.querySelector('[data-orbite]');
  if (!box) return;
  const canvas = box.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const colore = n => css.getPropertyValue(n).trim();
  const C = { testo: colore('--testo'), linea: colore('--linea2'), tenue: colore('--tenue2'), arancio: colore('--arancio') };

  let W = 0, H = 0, dpr = 1;
  const ridimensiona = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = box.clientWidth; H = box.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  };
  new ResizeObserver(ridimensiona).observe(box);
  ridimensiona();

  // orbite di sfondo: raggio (frazione del lato), velocità, fase, spessore
  const orbite = [
    { r: 0.46, v: 0.05, f: 0.6, s: 1 }, { r: 0.36, v: -0.08, f: 2.1, s: 1 },
    { r: 0.25, v: 0.12, f: 4.0, s: 1 }, { r: 0.14, v: -0.2, f: 1.2, s: 1 },
  ];
  // braccio: lunghezze dei link (frazioni del lato) e moto spontaneo di ogni giunto (ampiezza, pulsazione, fase)
  const link = [0.17, 0.15, 0.12, 0.08];
  const moto = [[0.9, 0.23, 0], [0.8, 0.31, 1.3], [1.1, 0.41, 2.2], [1.3, 0.57, 0.7]];
  const base = () => [W * 0.5, H * 0.5];
  let angoli = link.map(() => 0);
  const scia = [];
  let puntatore = null, peso = 0;

  box.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); puntatore = [e.clientX - r.left, e.clientY - r.top]; });
  box.addEventListener('pointerleave', () => { puntatore = null; });

  // posizioni dei giunti dagli angoli relativi
  const catena = a => {
    const L = Math.min(W, H), punti = [base()];
    let ang = -Math.PI / 2;
    a.forEach((x, i) => {
      ang += x;
      const [px, py] = punti[i];
      punti.push([px + Math.cos(ang) * link[i] * L, py + Math.sin(ang) * link[i] * L]);
    });
    return punti;
  };

  // un passo di inseguimento del bersaglio (discesa del gradiente, numerica): basta per un moto morbido
  const insegui = (a, bersaglio) => {
    const errore = x => { const p = catena(x).at(-1); return (p[0] - bersaglio[0]) ** 2 + (p[1] - bersaglio[1]) ** 2; };
    const nuovo = a.slice();
    for (let iter = 0; iter < 4; iter++) {
      const e0 = errore(nuovo);
      nuovo.forEach((_, i) => {
        const prova = nuovo.slice(); prova[i] += 0.002;
        nuovo[i] -= Math.max(-0.08, Math.min(0.08, (errore(prova) - e0) / 0.002 * 2e-6));
      });
    }
    return nuovo;
  };

  const disegna = t => {
    const L = Math.min(W, H), [cx, cy] = base();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // orbite e nodi
    orbite.forEach(o => {
      const r = o.r * L, a = o.f + o.v * t;
      ctx.strokeStyle = C.linea; ctx.lineWidth = o.s;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = C.tenue;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0, Math.PI * 2); ctx.fill();
    });

    // moto del braccio: spontaneo, oppure verso il puntatore
    const spontaneo = moto.map(([amp, w, f]) => amp * Math.sin(w * t + f));
    peso += ((puntatore ? 1 : 0) - peso) * 0.06;
    if (peso > 0.01 && puntatore) {
      const inseguito = insegui(angoli, puntatore);
      angoli = angoli.map((x, i) => x + (inseguito[i] - x) * peso + (spontaneo[i] - x) * (1 - peso) * 0.05);
    } else angoli = angoli.map((x, i) => x + (spontaneo[i] - x) * 0.08);
    const p = catena(angoli);

    // scia della punta, che sfuma
    const punta = p.at(-1);
    scia.push({ x: punta[0], y: punta[1], t });
    while (scia.length && t - scia[0].t > 6) scia.shift();
    ctx.lineCap = 'round';
    for (let i = 1; i < scia.length; i++) {
      const k = 1 - (t - scia[i].t) / 6;
      ctx.strokeStyle = C.arancio; ctx.globalAlpha = k * 0.9; ctx.lineWidth = 1 + 2.5 * k;
      ctx.beginPath(); ctx.moveTo(scia[i - 1].x, scia[i - 1].y); ctx.lineTo(scia[i].x, scia[i].y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // link e giunti ad anello, come la «O» di Orbinel
    ctx.strokeStyle = C.testo; ctx.lineWidth = Math.max(3, L * 0.012);
    ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    p.slice(0, -1).forEach(([x, y], i) => {
      const r = L * (i ? 0.022 : 0.034);
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(2.5, L * 0.009); ctx.stroke();
    });
    ctx.fillStyle = C.arancio;
    ctx.beginPath(); ctx.arc(punta[0], punta[1], L * 0.02, 0, Math.PI * 2); ctx.fill();
  };

  if (fermo) { for (let k = 0; k < 120; k++) disegna(6 + k / 60); return; }
  const t0 = performance.now();
  const ciclo = ora => { disegna((ora - t0) / 1000); requestAnimationFrame(ciclo); };
  requestAnimationFrame(ciclo);
})();
