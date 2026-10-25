// Collegamento USB (Web Serial) e protocollo dei servo Feetech STS.
// Due modi: "ponte" (ESP32 con il firmware ponte, che gestisce anche il fungo) oppure
// "diretto" (USB dell'adattatore, ponticelli su B: niente fungo).
'use strict';

const STS = {
  PING: 0x01, READ: 0x02, WRITE: 0x03, SYNC_WRITE: 0x83,
  ID_PONTE: 0xFD, BROADCAST: 0xFE,
  reg: {
    ID: 0x05, MIN_ANGOLO: 0x09, MAX_ANGOLO: 0x0B, COPPIA: 0x28, ACC: 0x29, OBIETTIVO: 0x2A,
    BLOCCO: 0x37, POSIZIONE: 0x38,
  },
};

class Bus extends EventTarget {
  constructor() {
    super();
    this.porta = null;
    this.modo = null;               // 'ponte' | 'diretto'
    this.arresto = null;            // stato del fungo (solo con il ponte)
    this.ultimoPonte = 0;
    this.coda = Promise.resolve();
    this.attesa = null;             // { id, risolvi, inviato }
    this.buf = [];
  }

  get collegato() { return !!this.porta; }

  async collega() {
    const porta = await navigator.serial.requestPort({
      filters: [{ usbVendorId: 0x303a }, { usbVendorId: 0x1a86 }],   // Espressif, WCH (adattatore)
    });
    await porta.open({ baudRate: 1000000, bufferSize: 4096 });
    this.porta = porta;
    this.scrittore = porta.writable.getWriter();
    this.leggi();
    // il ponte si annuncia da solo ogni 500 ms; se tace è l'adattatore diretto
    this.manda(STS.ID_PONTE, STS.PING, []);
    const t0 = Date.now();
    while (Date.now() - t0 < 1500 && !this.ultimoPonte) await pausa(50);
    this.modo = this.ultimoPonte ? 'ponte' : 'diretto';
    this.evento('stato');
    this.sorveglianza = setInterval(() => {
      if (this.modo === 'ponte' && Date.now() - this.ultimoPonte > 2000) this.evento('silenzio');
    }, 500);
  }

  async scollega() {
    clearInterval(this.sorveglianza);
    const porta = this.porta;
    this.porta = null;
    try { await this.lettore?.cancel(); } catch {}
    try { this.scrittore?.releaseLock(); } catch {}
    try { await porta?.close(); } catch {}
    this.modo = null; this.arresto = null; this.ultimoPonte = 0;
    this.evento('stato');
  }

  evento(tipo, dettaglio) { this.dispatchEvent(new CustomEvent(tipo, { detail: dettaglio })); }

  async leggi() {
    this.lettore = this.porta.readable.getReader();
    try {
      while (true) {
        const { value, done } = await this.lettore.read();
        if (done) break;
        for (const b of value) this.byte(b);
      }
    } catch (e) {
      this.evento('errore', 'Collegamento perso: ' + e.message);
    } finally {
      try { this.lettore.releaseLock(); } catch {}
      if (this.porta) this.scollega();
    }
  }

  // raccolta dei pacchetti FF FF ID LEN ERR ... CHK
  byte(b) {
    const buf = this.buf;
    if (buf.length < 2) { if (b === 0xFF) buf.push(b); else buf.length = 0; return; }
    if (buf.length === 2 && b === 0xFF) return;
    buf.push(b);
    if (buf.length >= 4 && buf.length === buf[3] + 4) {
      const p = buf.slice();
      buf.length = 0;
      if (somma(p) === p[p.length - 1]) this.pacchetto(p);
    } else if (buf.length > 260) buf.length = 0;
  }

  pacchetto(p) {
    const id = p[2];
    if (id === STS.ID_PONTE) {
      const arresto = !!p[5];
      this.ultimoPonte = Date.now();
      if (arresto !== this.arresto) { this.arresto = arresto; this.evento('arresto', arresto); }
      return;
    }
    const a = this.attesa;
    if (!a || id !== a.id) return;
    if (p.length === a.inviato.length && p.every((v, i) => v === a.inviato[i])) return;   // eco del comando
    this.attesa = null;
    a.risolvi({ errore: p[4], dati: p.slice(5, -1) });
  }

  manda(id, istruzione, parametri) {
    const p = [0xFF, 0xFF, id, parametri.length + 2, istruzione, ...parametri, 0];
    p[p.length - 1] = somma(p);
    this.scrittore.write(new Uint8Array(p)).catch(() => {});
    return p;
  }

  // una richiesta alla volta; ritorna la risposta o null se il servo non risponde
  richiesta(id, istruzione, parametri, risposta = true, attesaMs = 40) {
    const lavoro = this.coda.then(async () => {
      if (!this.porta) return null;
      if (!risposta || id === STS.BROADCAST) { this.manda(id, istruzione, parametri); return null; }
      return new Promise(risolvi => {
        const t = setTimeout(() => { this.attesa = null; risolvi(null); }, attesaMs);
        this.attesa = { id, inviato: [], risolvi: r => { clearTimeout(t); risolvi(r); } };
        this.attesa.inviato = this.manda(id, istruzione, parametri);
      });
    });
    this.coda = lavoro.catch(() => null);
    return lavoro;
  }

  ping(id) { return this.richiesta(id, STS.PING, [], true, 25).then(r => !!r); }
  leggiRegistri(id, indirizzo, quanti) {
    return this.richiesta(id, STS.READ, [indirizzo, quanti]).then(r => (r && r.dati.length === quanti ? r.dati : null));
  }
  scrivi(id, indirizzo, byte) { return this.richiesta(id, STS.WRITE, [indirizzo, ...byte]); }
  scriviTutti(indirizzo, voci) {          // voci: [{ id, byte: [...] }], tutti della stessa lunghezza
    if (!voci.length) return Promise.resolve();
    const n = voci[0].byte.length;
    const par = [indirizzo, n];
    for (const v of voci) par.push(v.id, ...v.byte);
    return this.richiesta(STS.BROADCAST, STS.SYNC_WRITE, par, false);
  }

  // stato di un servo: posizione, velocità, carico, tensione, temperatura, movimento, corrente
  async stato(id) {
    const d = await this.leggiRegistri(id, STS.reg.POSIZIONE, 15);
    if (!d) return null;
    const conSegno = (lo, hi, bit) => { const v = lo | (hi << 8); return v & (1 << bit) ? -(v & ((1 << bit) - 1)) : v; };
    return {
      posizione: d[0] | (d[1] << 8),
      velocita: conSegno(d[2], d[3], 15),
      carico: conSegno(d[4], d[5], 10) / 10,          // percento
      tensione: d[6] / 10,
      temperatura: d[7],
      inMoto: !!d[10],
      corrente: (d[13] | (d[14] << 8)) * 6.5,         // mA, circa
    };
  }

  coppia(ids, accesa) { return this.scriviTutti(STS.reg.COPPIA, ids.map(id => ({ id, byte: [accesa ? 1 : 0] }))); }

  // obiettivi: [{ id, posizione, velocita }] in passi e passi/s
  muovi(obiettivi) {
    return this.scriviTutti(STS.reg.OBIETTIVO, obiettivi.map(o => {
      const p = Math.max(0, Math.min(4095, Math.round(o.posizione)));
      const v = Math.max(1, Math.min(3400, Math.round(o.velocita)));
      return { id: o.id, byte: [p & 255, p >> 8, 0, 0, v & 255, v >> 8] };
    }));
  }

  async cambiaId(vecchio, nuovo) {
    await this.scrivi(vecchio, STS.reg.BLOCCO, [0]);
    await this.scrivi(vecchio, STS.reg.ID, [nuovo]);
    await pausa(50);
    await this.scrivi(nuovo, STS.reg.BLOCCO, [1]);
    return this.ping(nuovo);
  }
}

function somma(p) {
  let s = 0;
  for (let i = 2; i < p.length - 1; i++) s += p[i];
  return ~s & 0xFF;
}

const pausa = ms => new Promise(r => setTimeout(r, ms));
