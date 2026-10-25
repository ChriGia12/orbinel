// Percorso Orbinel Learn con Kheiron: sei lezioni, ognuna con teoria breve, esercizi che il simulatore
// verifica da solo e una domanda. Le verifiche ricevono il contesto c = { q, pinza, fk, problemi, an, carico, eventi }:
// an è l'ultima analisi (coppie, margini, singolarità), eventi i fatti accaduti durante la lezione.
'use strict';

const vicino = (p, b, tol) => Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2]) <= tol;
const versoIlBasso = fk => fk.R[2][0] < -0.97;            // asse di avvicinamento della pinza verso -Z
const radiale = p => Math.hypot(p[0], p[1]);

const LEZIONI = [
  {
    id: 'giunti',
    titolo: '1 · Giunti e gradi di libertà',
    durata: '1 ora',
    obiettivi: ['Riconoscere i sei giunti di un braccio antropomorfo', 'Capire cosa sono i gradi di libertà', 'Muovere il robot giunto per giunto'],
    teoria: `
      <p>Un <b>giunto rotoidale</b> fa ruotare un pezzo del robot (il <i>link</i>) attorno a un asse. Kheiron ne ha sei, in fila:
      la base (J1), la spalla (J2), il gomito (J3) e tre giunti del polso (J4, J5, J6).</p>
      <p>Ogni giunto aggiunge un <b>grado di libertà</b>. Per mettere un oggetto in un punto qualsiasi dello spazio <i>e</i> con
      l'orientamento che vogliamo servono sei numeri: tre per la posizione (X, Y, Z) e tre per l'orientamento. Per questo i
      bracci industriali hanno quasi sempre sei assi.</p>
      <p>I primi tre giunti decidono soprattutto <b>dove</b> si trova il polso; gli ultimi tre decidono <b>come è orientata</b> la pinza.</p>`,
    esercizi: [
      { testo: 'Ruota la base (J1) a +90°', verifica: c => Math.abs(c.q[0] - 90) < 3 },
      { testo: 'Porta la pinza a meno di 60 mm dal tavolo, senza avvisi rossi', verifica: c => c.fk.tcp[2] < 60 && !c.problemi.length },
      { testo: 'Apri la pinza del tutto (20 mm per dito)', verifica: c => c.pinza >= 19.5 },
    ],
    domanda: {
      testo: 'Quali giunti decidono soprattutto l\'orientamento della pinza?',
      scelte: ['J1, J2 e J3', 'J4, J5 e J6', 'Solo J6'],
      giusta: 1,
    },
  },
  {
    id: 'spazio',
    titolo: '2 · Spazio di lavoro e limiti',
    durata: '1 ora',
    obiettivi: ['Vedere quali punti il robot può raggiungere', 'Distinguere limiti dei giunti e collisioni', 'Capire perché lo sbraccio massimo è un vincolo di progetto'],
    teoria: `
      <p>Lo <b>spazio di lavoro</b> è l'insieme dei punti che la pinza può raggiungere. Dipende dalle lunghezze dei link
      (in Kheiron braccio e avambraccio sono lunghi 130 mm) e dai <b>limiti dei giunti</b>: nessun giunto vero può girare all'infinito,
      perché i pezzi urterebbero tra loro o i cavi si torcerebbero.</p>
      <p>Il simulatore controlla anche le <b>collisioni</b> più semplici: la pinza o il polso che toccano il tavolo o la base.
      Quando succede, il robot diventa rosso e compare un avviso. Il robot vero, in quella posa, non viene mosso.</p>`,
    esercizi: [
      { testo: 'Accendi «Spazio di lavoro» nella vista 3D e osserva la nuvola di punti', verifica: c => c.eventi.spazio },
      { testo: 'Chiedi alla cinematica inversa un punto fuori portata (per esempio X = 500) e leggi il messaggio', verifica: c => c.eventi.ikErrore },
      { testo: 'Allunga la pinza a più di 350 mm dall\'asse della base, senza avvisi', verifica: c => radiale(c.fk.tcp) > 350 && !c.problemi.length },
    ],
    domanda: {
      testo: 'Un punto è dentro il cerchio dello sbraccio, ma il simulatore lo segna rosso. Perché può succedere?',
      scelte: ['Il robot è spento', 'Per arrivarci un giunto supera il suo limite o un pezzo urta', 'I punti vicini alla base sono sempre irraggiungibili'],
      giusta: 1,
    },
  },
  {
    id: 'inversa',
    titolo: '3 · Cinematica diretta e inversa',
    durata: '2 ore',
    obiettivi: ['Distinguere cinematica diretta e inversa', 'Comandare il robot in coordinate X, Y, Z', 'Capire che la stessa posizione si raggiunge con orientamenti diversi'],
    teoria: `
      <p><b>Cinematica diretta</b>: conosco gli angoli dei giunti e calcolo dove si trova la pinza. È quello che succede quando muovi i cursori.</p>
      <p><b>Cinematica inversa</b>: so dove voglio la pinza e calcolo gli angoli. È più difficile: a volte non esiste soluzione
      (punto troppo lontano), a volte ce ne sono diverse (gomito alto o basso, polso girato da una parte o dall'altra).</p>
      <p>Kheiron ha un <b>polso sferico</b>: gli assi di J4, J5 e J6 si incontrano in un punto. Questo permette di separare il problema:
      prima si trova il centro del polso con J1, J2, J3, poi l'orientamento con J4, J5, J6. I robot industriali usano lo stesso trucco.</p>
      <p>Prova la scheda «Posizione della pinza»: inserisci X, Y, Z e l'inclinazione, poi «Vai».</p>`,
    esercizi: [
      { testo: 'Porta la pinza in X 200, Y 100, Z 60 (entro 5 mm)', verifica: c => vicino(c.fk.tcp, [200, 100, 60], 5) },
      { testo: 'Nello stesso punto, ma con la pinza rivolta verso il basso (inclinazione −90°)', verifica: c => vicino(c.fk.tcp, [200, 100, 60], 5) && versoIlBasso(c.fk) },
      { testo: 'Pinza verso il basso in un punto con Y minore di −150 mm, senza avvisi', verifica: c => c.fk.tcp[1] < -150 && versoIlBasso(c.fk) && !c.problemi.length },
    ],
    domanda: {
      testo: 'Che cosa calcola la cinematica inversa?',
      scelte: ['La posizione della pinza a partire dagli angoli', 'Gli angoli dei giunti a partire dalla posizione voluta della pinza', 'La velocità massima dei motori'],
      giusta: 1,
    },
  },
  {
    id: 'singolarita',
    titolo: '4 · Singolarità',
    durata: '1 ora',
    obiettivi: ['Riconoscere le tre singolarità tipiche di un braccio a sei assi', 'Capire perché vanno evitate durante i movimenti'],
    teoria: `
      <p>In una <b>singolarità</b> il robot perde, per un momento, un grado di libertà: due assi si allineano, oppure il braccio è
      completamente disteso. Vicino a una singolarità, per muovere la pinza di pochi millimetri alcuni giunti dovrebbero ruotare
      moltissimo e molto velocemente.</p>
      <ul>
        <li><b>Polso</b>: J5 a zero, quindi J4 e J6 girano attorno allo stesso asse.</li>
        <li><b>Gomito</b>: braccio disteso, il polso non può allontanarsi di più.</li>
        <li><b>Spalla</b>: il centro del polso è sopra l'asse della base, J1 non sa dove girare.</li>
      </ul>
      <p>La scheda «Analisi» segnala le singolarità vicine con il simbolo ◆.</p>`,
    esercizi: [
      { testo: 'Metti il polso in singolarità', verifica: c => c.an?.singolarita.some(s => s.tipo === 'polso') },
      { testo: 'Distendi del tutto il braccio (singolarità del gomito)', verifica: c => c.an?.singolarita.some(s => s.tipo === 'gomito') },
      { testo: 'Esci da tutte le singolarità con la pinza a più di 150 mm di altezza', verifica: c => c.an && !c.an.singolarita.length && c.fk.tcp[2] > 150 },
    ],
    domanda: {
      testo: 'Perché un robot industriale evita di passare vicino a una singolarità?',
      scelte: ['Perché consuma più corrente da fermo', 'Perché alcuni giunti dovrebbero muoversi in modo molto rapido per piccoli spostamenti della pinza', 'Perché il robot si spegne'],
      giusta: 1,
    },
  },
  {
    id: 'coppie',
    titolo: '5 · Coppie, carichi e scelta dei motori',
    durata: '2 ore',
    obiettivi: ['Calcolare la coppia dovuta alla gravità', 'Capire perché la spalla ha due servo', 'Leggere un margine di sicurezza'],
    teoria: `
      <p>La <b>coppia</b> è la tendenza di una forza a far ruotare qualcosa: forza × braccio di leva. Un peso di 1 kg a 1 cm dall'asse
      dà 1 kg·cm. La gravità tira verso il basso tutti i pezzi del robot e l'oggetto in presa: più sono lontani dall'asse di un giunto,
      più coppia deve fare quel motore.</p>
      <p>I servo di Kheiron (STS3215 a 12 V) danno circa <b>10 kg·cm in modo continuo</b> e 30 kg·cm di picco. Per questo la spalla, che porta
      tutto il braccio, ha <b>due servo</b>. Il <b>margine</b> è coppia disponibile ÷ coppia richiesta: sopra 1,5 è comodo, sotto 1 il motore
      lavora oltre il valore continuo e scalda.</p>
      <p class="nota">I valori sono stime: masse calcolate dal volume dei pezzi stampati, senza attriti e senza accelerazioni. Sul robot vero
      si confrontano con il carico letto dai servo.</p>`,
    esercizi: [
      { testo: 'Imposta un carico di almeno 200 g con il cursore «Carico in presa»', verifica: c => c.carico >= 200 },
      { testo: 'Con il carico, trova una posa in cui un giunto supera la coppia continua (margine < 1)', verifica: c => c.carico >= 200 && c.an?.giunti.some(g => g.margine < 1) },
      { testo: 'Sempre con 200 g, trova una posa con tutti i margini ≥ 1,5 e la pinza ad almeno 200 mm dall\'asse', verifica: c => c.carico >= 200 && c.an?.giunti.every(g => g.margine >= 1.5) && radiale(c.fk.tcp) >= 200 },
    ],
    domanda: {
      testo: 'Il braccio è disteso in orizzontale. Se lo pieghi tenendo la pinza più vicina alla base, la coppia sulla spalla…',
      scelte: ['aumenta', 'diminuisce', 'resta uguale'],
      giusta: 1,
    },
  },
  {
    id: 'sequenze',
    titolo: '6 · Sequenze e pick-and-place',
    durata: '2 ore',
    obiettivi: ['Programmare il robot per punti', 'Costruire un ciclo di presa e rilascio', 'Verificare il programma in simulazione prima del robot vero'],
    teoria: `
      <p>I robot industriali si programmano spesso <b>per punti</b>: si salvano alcune pose (sopra il pezzo, sul pezzo, sopra la scatola,
      dentro la scatola) e si mettono in fila con i tempi. È il <b>pick-and-place</b>.</p>
      <p>Regola d'oro: <b>prima in simulazione, poi sul robot vero</b>. Il simulatore controlla limiti e collisioni di ogni posa; prima di
      muovere il robot vero c'è un conto alla rovescia e il fungo di arresto resta sempre a portata di mano.</p>
      <p>Usa la scheda «Pose e sequenze»: salva le pose, aggiungi i passi, premi «Esegui».</p>`,
    esercizi: [
      { testo: 'Salva almeno 3 pose', verifica: () => pose.length >= 3 },
      { testo: 'Crea una sequenza di almeno 4 passi (avvicinamento, presa, sollevamento, rilascio)', verifica: () => sequenza.length >= 4 },
      { testo: 'Esegui la sequenza fino in fondo', verifica: c => c.eventi.sequenza },
    ],
    domanda: {
      testo: 'Perché si aggiunge una posa «sopra il pezzo» prima della posa di presa?',
      scelte: ['Per far scendere la pinza in verticale senza urtare il pezzo di lato', 'Perché il robot non può fermarsi sul pezzo', 'Per risparmiare batteria'],
      giusta: 0,
    },
  },
];
