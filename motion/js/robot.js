// Geometria del braccio e impostazioni di partenza.
// Quote in mm nel sistema del modello Fusion (z verso l'alto, braccio in posa di riposo:
// braccio verticale, avambraccio orizzontale lungo x). Vengono da fusion/AssiemeMobile e
// GiuntoSpalla con d1 = 125 mm: se il modello cambia, vanno aggiornate qui.
'use strict';

const ROBOT = {
  nome: 'Kheiron',
  cartella: 'robot/kheiron/stl',         // STL dei pezzi, copiati da Robot Arm/cad
  // dati per la stima delle coppie: PETG al 55 % del pieno e servo STS3215 a 12 V
  materiale: { densita: 1.27, riempimento: 0.55 },     // g/cm³, frazione del volume pieno
  servoDati: { massa: 55, nominale: 10, picco: 30 },   // g, kg·cm, kg·cm
  d1: 125, a2: 130, d4: 130,            // spalla dal piano, braccio, gomito -> centro polso
  polso: [130, 0, 255],                  // centro del polso in posa di riposo
  tcp: [287, 0, 275],                    // punto di presa della pinza in posa di riposo

  giunti: [
    { nome: 'J1 base',        asse: [0, 0, 1], origine: [0, 0, 80],    min: -150, max: 150, link: 'torretta' },
    { nome: 'J2 spalla',      asse: [0, 1, 0], origine: [0, 0, 125],   min: -100, max: 100, link: 'braccio' },
    { nome: 'J3 gomito',      asse: [0, 1, 0], origine: [0, 0, 255],   min: -120, max: 45,  link: 'avambraccio' },
    { nome: 'J4 rollio',      asse: [1, 0, 0], origine: [76, 0, 255],  min: -170, max: 170, link: 'polsoA' },
    { nome: 'J5 polso',       asse: [0, 1, 0], origine: [130, 0, 255], min: -95,  max: 95,  link: 'polsoB' },
    { nome: 'J6 rollio pinza', asse: [1, 0, 0], origine: [196, 0, 255], min: -170, max: 170, link: 'utensile' },
  ],
  pinza: { corsa: 20, disegno: 12 },     // mm per dito; nel modello le dita sono aperte di 12

  // pezzi stampati e servo di ogni link (file nella cartella del robot)
  link: {
    base:        { pezzi: ['base', 'base_fondo'], servo: [0] },
    torretta:    { pezzi: ['torretta_j2'], servo: [1, 2] },
    braccio:     { pezzi: ['braccio'], servo: [3] },
    avambraccio: { pezzi: ['avambraccio'], servo: [4] },
    polsoA:      { pezzi: ['polso_a'], servo: [5] },
    polsoB:      { pezzi: ['polso_b'], servo: [6] },
    utensile:    { pezzi: ['flangia', 'pinza_palmo', 'pinza_coperchio', 'pinza_pignone'], servo: [7] },
  },
  dita: { sx: 'pinza_dito_sx', dx: 'pinza_dito_dx' },  // il sinistro sta verso y positive

  // i servo nel modello: origine, poi assi x, y, z del servo (come nel visualizzatore)
  servoPose: [
    [12.5, 0, 61.3, -1, 0, 0, 0, -1, 0, 0, 0, 1],      // J1
    [0, 25, 112.5, 0, 0, 1, 1, 0, 0, 0, 1, 0],         // J2 sinistro
    [0, -25, 112.5, 0, 0, 1, -1, 0, 0, 0, -1, 0],      // J2 destro
    [0, 0, 242.5, 0, 0, 1, 1, 0, 0, 0, 1, 0],          // J3
    [57.7, 0, 267.5, 0, 0, -1, 0, 1, 0, 1, 0, 0],      // J4
    [117.5, 0, 255, 1, 0, 0, 0, 0, -1, 0, 1, 0],       // J5
    [177.3, 0, 267.5, 0, 0, -1, 0, 1, 0, 1, 0, 0],     // J6
    [233.7, 0, 255, 1, 0, 0, 0, 1, 0, 0, 0, 1],        // pinza
  ],
};

// Impostazioni modificabili dal pannello (salvate nel browser, esportabili in un file).
// centro: posizione del servo (0..4095) con il giunto a 0 gradi; verso: +1 o -1.
function impostazioniIniziali() {
  return {
    versione: 1,
    giunti: ROBOT.giunti.map((g, i) => ({
      min: g.min, max: g.max,
      servo: i === 1
        ? [{ id: 2, verso: 1, centro: 2048 }, { id: 3, verso: -1, centro: 2048 }]   // spalla: due servo a specchio
        : [{ id: [1, 0, 4, 5, 6, 7][i], verso: 1, centro: 2048 }],
    })),
    pinza: { id: 8, chiusa: 2048, aperta: 2700 },   // posizioni del servo con dita chiuse e tutte aperte
    velocita: 30,          // gradi al secondo, per il giunto che si muove di più
    accelerazione: 20,     // registro del servo, 0..254 (x 100 passi/s²)
    riposo: [0, 0, 0, 0, 0, 0],      // posa home
    pinzaRiposo: 12,
    parcheggio: [0, 90, -37, 0, -53, 0],  // braccio steso in avanti, pinza e polso appoggiati sul piano
    pinzaParcheggio: 12,
    conteggio: 3,          // secondi di conto alla rovescia prima di una sequenza
  };
}
