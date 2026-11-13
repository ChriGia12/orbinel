// Lingua di Orbinel Motion (italiano / inglese). Segue la scelta fatta sul sito (localStorage «orbinel.lingua»,
// stesso dominio); senza scelta usa la lingua del browser. ?lang=en o ?lang=it nell'indirizzo la impone e la salva.
// Il codice dell'app scrive i testi in italiano: in inglese questo file li traduce mentre compaiono nella pagina
// (testi, title, placeholder, finestre di conferma). Un testo nuovo in italiano va aggiunto qui sotto.
'use strict';

const LINGUA = (() => {
  let l = null;
  const par = new URLSearchParams(location.search).get('lang');
  if (par === 'it' || par === 'en') { l = par; try { localStorage.setItem('orbinel.lingua', l); } catch {} }
  if (!l) { try { l = localStorage.getItem('orbinel.lingua'); } catch {} }
  if (l !== 'it' && l !== 'en') l = (navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en';
  document.documentElement.lang = l;
  return l;
})();

function cambiaLingua(l) {
  try { localStorage.setItem('orbinel.lingua', l); localStorage.setItem('orbinel.learn.lingua', l); } catch {}
  const u = new URL(location.href); u.searchParams.delete('lang');
  location.href = u.toString();
}

const TRADUZIONI_EN = {
  // intestazione e schede
  'Orbinel Motion · Simulatore di Kheiron': 'Orbinel Motion · Kheiron simulator',
  'Torna al sito di Orbinel Robotics': 'Back to the Orbinel Robotics website',
  'Robot selezionato': 'Selected robot',
  'Simulatore · Kheiron 6 assi': 'Simulator · Kheiron 6-axis',
  'Non collegato': 'Not connected',
  'Non collegato.': 'Not connected.',
  'Collegato tramite ESP32': 'Connected via ESP32',
  "Collegato all'adattatore (USB diretta)": 'Connected to the adapter (direct USB)',
  'FUNGO: —': 'E-STOP: —',
  'FUNGO: non attivo': 'E-STOP: not active',
  'FUNGO PREMUTO · servo fermi': 'E-STOP PRESSED · servos stopped',
  'FUNGO: OK': 'E-STOP: OK',
  'FUNGO PREMUTO': 'E-STOP PRESSED',
  '← Sito': '← Website',
  'Collega': 'Connect',
  'Scollega': 'Disconnect',
  'Ferma subito tutti i servo dove sono (tasto Esc)': 'Stop all servos where they are, now (Esc key)',
  'FERMA': 'STOP',
  'Muovi': 'Move',
  'Pose e sequenze': 'Poses & sequences',
  'Servo': 'Servos',
  'Lezioni': 'Lessons',
  'Impostazioni': 'Settings',
  'Guida': 'Guide',
  'Carico il modello…': 'Loading the model…',

  // vista
  'Prospettiva': 'Perspective', 'Fronte': 'Front', 'Lato': 'Side', 'Alto': 'Top',
  'Scia: spenta': 'Trail: off', 'Scia: accesa': 'Trail: on', 'Pulisci scia': 'Clear trail',
  'Spazio di lavoro: spento': 'Workspace: off', 'Spazio di lavoro: acceso': 'Workspace: on',
  'Pinza: —': 'Gripper: —',

  // robot vero
  'Robot vero': 'Real robot',
  'Il robot segue la simulazione': 'The robot follows the simulation',
  'Collega la schedina per muovere il robot vero. Senza, muovi solo la simulazione.': 'Connect the board to move the real robot. Without it, only the simulation moves.',
  "Attenzione: con la USB diretta all'adattatore il fungo non è attivo. Usa il tasto FERMA o Esc.": 'Warning: with direct USB to the adapter the e-stop is not active. Use the STOP button or Esc.',
  "Con l'interruttore acceso, ogni movimento della simulazione arriva al robot.": 'With the switch on, every move in the simulation reaches the robot.',
  'Porta la simulazione dove si trova il robot': 'Move the simulation to where the robot is',
  'Copia la posa dal robot': 'Copy pose from robot',
  'Coppia: —': 'Torque: —', 'Coppia: accesa': 'Torque: on', 'Coppia: spenta': 'Torque: off',
  'Alza il braccio un giunto alla volta, dalla spalla alla base, fino alla posa home': 'Raises the arm one joint at a time, from the shoulder to the base, up to the home pose',
  'Vai in home': 'Go home',
  'Stende il braccio in avanti fino ad appoggiarlo sul piano, poi spegne la coppia: da fare prima di togliere la corrente': 'Stretches the arm forward until it rests on the table, then turns torque off: do it before cutting power',
  'Parcheggia': 'Park',
  'Con il braccio appoggiato a mano sul piano: salva questa posa come parcheggio': 'With the arm resting on the table by hand: save this pose as the park pose',
  'Salva il parcheggio': 'Save park pose',
  'Velocità massima:': 'Max speed:',

  // giunti, utensile, oggetti
  'Giunti': 'Joints',
  'J1 base': 'J1 base', 'J2 spalla': 'J2 shoulder', 'J3 gomito': 'J3 elbow', 'J4 rollio': 'J4 roll', 'J5 polso': 'J5 wrist', 'J6 rollio pinza': 'J6 gripper roll',
  'Pinza (mm)': 'Gripper (mm)',
  'Tutti a zero': 'All to zero',
  'Utensile': 'Tool',
  "Scarica l'STL": 'Download the STL',
  'Gli utensili di Orbinel Parts, con le stesse misure del generatore del sito: cambiano il modello, il punto utensile e le coppie.': 'The Orbinel Parts tools, with the same sizes as the generator on the website: they change the model, the tool point and the torques.',
  'Pinza di serie': 'Standard gripper',
  'La pinza a due dita di serie, con il suo servo.': 'The standard two-finger gripper, with its servo.',
  "Costruisco l'utensile…": 'Building the tool…',
  'Oggetti': 'Objects',
  'Aggiungi STL…': 'Add STL…',
  'Cubo di prova 30 mm': '30 mm test cube',
  'Snap alla presa: Maiusc + clic su un oggetto porta la pinza aperta in posizione per prenderlo': 'Snap to grasp: Shift + click on an object brings the open gripper into position to pick it',
  "Porta la pinza aperta intorno a un oggetto e chiudila: lo prende se le due dita appoggiano su due facce opposte (non su spigoli) e il suo peso entra nell'analisi. Riaprendola, l'oggetto cade sul tavolo o sull'oggetto sotto. Maiusc + clic su un oggetto porta la pinza in quel punto.": 'Bring the open gripper around an object and close it: it picks the object if both fingers rest on two opposite faces (not on edges), and its weight enters the analysis. Open it again and the object drops onto the table or the object below. Shift + click on an object brings the gripper there.',
  'Nessun oggetto sul tavolo.': 'No objects on the table.',
  'Oggetto': 'Object',

  // analisi
  'Analisi': 'Analysis', '· stima': '· estimate',
  'Carico in presa:': 'Payload:',
  'coppia rispetto al picco · tacca = continua': 'torque vs peak · notch = continuous',
  'margine': 'margin',
  'Massa in movimento': 'Moving mass',
  'Carico massimo in questa posa': 'Max payload in this pose',
  'Masse dal volume degli STL (PETG al 55 %), servo da 55 g, coppia continua 10 kg·cm per servo. Senza attriti né accelerazioni.': 'Masses from STL volume (PETG at 55 %), 55 g servos, 10 kg·cm continuous torque per servo. No friction or acceleration.',
  'Calcolo le masse dal modello…': 'Computing masses from the model…',
  'Nessuna singolarità vicina': 'No singularity nearby',
  'Braccio disteso: il gomito è al limite e il polso non può allontanarsi': 'Arm stretched out: the elbow is at its limit and the wrist cannot move further away',
  "Polso sopra l'asse della base: J1 non ha una posizione definita": 'Wrist above the base axis: J1 has no defined position',

  // posizione della pinza
  'Posizione della pinza': 'Gripper position',
  'Inclinazione (°)': 'Pitch (°)',
  '0 = orizzontale, -90 = verso il basso': '0 = horizontal, -90 = pointing down',
  'Rotazione (°)': 'Rotation (°)',
  'Vai': 'Go', 'Passo': 'Step',
  'mm · Maiusc + clic per scegliere il punto: sul tavolo (alla quota più bassa sicura), su un oggetto o, con lo spazio di lavoro acceso, su un punto verde': 'mm · Shift + click to pick the point: on the table (at the lowest safe height), on an object or, with the workspace on, on a green point',
  '✓ Raggiungibile': '✓ Reachable',
  'Fuori dallo spazio di lavoro: la pinza non ci arriva senza urtare o superare i limiti': 'Outside the workspace: the gripper cannot get there without a collision or exceeding the limits',
  'Troppo lontano o troppo vicino: il polso non ci arriva': 'Too far or too close: the wrist cannot reach it',

  // pose e sequenze
  'Pose salvate': 'Saved poses',
  'Nome della posa': 'Pose name',
  'Salva la posa attuale': 'Save current pose',
  'Salva dal robot': 'Save from robot',
  'Nome': 'Name', 'Giunti (°)': 'Joints (°)', 'Pinza': 'Gripper',
  'Aggiorna': 'Update', 'Sostituisci con la posa attuale': 'Replace with the current pose',
  'Nessuna posa. Muovi il braccio e premi «Salva la posa attuale».': 'No poses yet. Move the arm and press “Save current pose”.',
  'Sequenza': 'Sequence',
  'Le pose in fila. Ogni passo dura il tempo indicato: tutti i giunti partono e arrivano insieme.': 'Poses in a row. Each step lasts the time shown: all joints start and arrive together.',
  'Posa': 'Pose', 'Durata (s)': 'Duration (s)', 'Pausa (s)': 'Pause (s)',
  'Aggiungi passo': 'Add step', 'Ripeti': 'Repeat', 'Esegui': 'Run',
  'Sequenza vuota.': 'Empty sequence.',
  'Interrotta': 'Interrupted', 'Finita': 'Finished',
  'Pose, sequenza e impostazioni restano salvate in questo browser. Per portarle su un altro computer, esportale in un file.': 'Poses, sequence and settings stay saved in this browser. To move them to another computer, export them to a file.',
  'Esporta tutto': 'Export all', 'Importa…': 'Import…',

  // servo
  'Servo sul cavo': 'Servos on the bus',
  'Cerca i servo': 'Find servos',
  'Giunto': 'Joint', 'Posizione': 'Position', 'Angolo': 'Angle', 'Tensione': 'Voltage', 'Carico': 'Load', 'Corrente': 'Current',
  'Nessun servo letto. Premi «Cerca i servo».': 'No servo read. Press “Find servos”.',
  'Nessun servo trovato. 12 V collegati? TX e RX giusti?': 'No servo found. 12 V connected? TX and RX the right way round?',
  'Calibrazione dello zero': 'Zero calibration',
  'Spegni la coppia: i servo diventano liberi.': 'Turn torque off: the servos go limp.',
  'Sostieni il braccio': 'Hold the arm',
  ', che altrimenti cade.': ', or it will fall.',
  'Porta a mano il braccio in posa di riposo: braccio verticale, avambraccio orizzontale in avanti, polso dritto, pinza orizzontale.': 'Move the arm by hand to the rest pose: upper arm vertical, forearm horizontal and forward, wrist straight, gripper horizontal.',
  'Premi «Salva lo zero»: la posizione di ogni servo diventa il suo zero.': 'Press “Save zero”: each servo’s position becomes its zero.',
  'Spegni la coppia': 'Torque off', 'Salva lo zero': 'Save zero', 'Riaccendi la coppia': 'Torque on',
  'Con la coppia spenta, chiudi le dita a mano e premi «Chiusa»; poi aprile del tutto e premi «Aperta».': 'With torque off, close the fingers by hand and press “Closed”; then open them fully and press “Open”.',
  'Chiusa': 'Closed', 'Aperta': 'Open',
  'Cambia ID': 'Change ID',
  "I servo nuovi hanno tutti l'ID 1.": 'New servos all have ID 1.',
  'Collegane uno alla volta': 'Connect one at a time',
  ': con due servo con lo stesso ID il cambio li cambierebbe entrambi.': ': with two servos on the same ID, the change would apply to both.',
  'Da': 'From', 'a': 'to', 'Cambia': 'Change',
  'ID previsti': 'Planned IDs',
  'Il servo non risponde con il nuovo ID': 'The servo does not answer on the new ID',

  // lezioni
  'Sei lezioni da fare nel simulatore. Gli esercizi si verificano da soli mentre muovi il robot; il robot vero non serve.': 'Six lessons to do in the simulator. Exercises check themselves while you move the robot; no real robot needed.',

  // impostazioni
  'Limiti in gradi. Per ogni servo: ID, verso (+1 o −1, se il giunto gira al contrario) e centro, cioè la posizione del servo (0–4095) con il giunto a zero. Il centro si imposta da solo con la calibrazione.': 'Limits in degrees. For each servo: ID, direction (+1 or −1, if the joint turns the wrong way) and center, i.e. the servo position (0–4095) with the joint at zero. Calibration sets the center automatically.',
  'Verso': 'Direction', 'Centro': 'Center',
  '2° servo: ID': '2nd servo: ID',
  'ID del servo': 'Servo ID',
  'Posizione con dita chiuse': 'Position with fingers closed',
  'Posizione con dita aperte (20 mm)': 'Position with fingers open (20 mm)',
  'Movimento': 'Motion',
  'Velocità massima (°/s)': 'Max speed (°/s)',
  'Accelerazione dei servo (0–254)': 'Servo acceleration (0–254)',
  'Conto alla rovescia prima delle sequenze (s)': 'Countdown before sequences (s)',
  'Posa home (J1…J6, °)': 'Home pose (J1…J6, °)',
  'Posa di parcheggio (J1…J6, °)': 'Park pose (J1…J6, °)',
  'Ripristina i valori iniziali': 'Reset to defaults',
  'Le modifiche si salvano da sole.': 'Changes are saved automatically.',

  // guida
  'Collegamenti': 'Wiring',
  'Mac ──USB──► ESP32 ──3 Dupont: GND, TX, RX──► Adattatore ──cavo servo──► J1 ► J2 ► … ► pinza ▲ ▲ fungo, contatto NC (2 fili) alimentatore 12 V (presa tonda)': 'Mac ──USB──► ESP32 ──3 Dupont: GND, TX, RX──► Adapter ──servo cable──► J1 ► J2 ► … ► gripper ▲ ▲ e-stop, NC contact (2 wires) 12 V power supply (barrel jack)',
  'ESP32 piedino': 'ESP32 pin', 'Adattatore': 'Adapter',
  'Fungo, morsetto 1 (blocchetto NC, levetta rossa)': 'E-stop, terminal 1 (NC block, red lever)',
  'Fungo, morsetto 2': 'E-stop, terminal 2',
  "Mai collegare 5V, 3V3 o i 12 V tra ESP32 e adattatore: solo GND, TX e RX. Il morsetto verde dell'adattatore resta libero. Ponticelli gialli su": 'Never connect 5V, 3V3 or 12 V between the ESP32 and the adapter: only GND, TX and RX. The green terminal on the adapter stays free. Yellow jumpers on',
  '. Se il pannello non trova i servo, scambia i due fili TX e RX: non si rompe niente.': '. If the panel finds no servos, swap the TX and RX wires: nothing breaks.',
  'Accensione e spegnimento': 'Power on and off',
  "Cavo USB dell'ESP32 nel Mac.": 'ESP32 USB cable into the Mac.',
  "Alimentatore 12 V nell'adattatore. Con il primo alimentatore regolabile: rotella fissata a 12 V con il nastro.": '12 V power supply into the adapter. With the first adjustable supply: dial taped at 12 V.',
  'Nel pannello: «Collega» e scegli la schedina.': 'In the panel: “Connect” and pick the board.',
  'Fungo rilasciato: in alto deve comparire': 'E-stop released: at the top you should see',
  'Per spegnere, al contrario: prima i 12 V, poi la USB.': 'To switch off, in reverse: first the 12 V, then the USB.',
  'Primo test di un servo nuovo': 'First test of a new servo',
  'Un solo servo collegato, nessun pezzo montato sulla squadretta.': 'Only one servo connected, nothing mounted on the horn.',
  'Sezione': 'Section',
  '→ «Cerca i servo»: deve comparire con ID 1, tensione intorno a 12 V.': '→ “Find servos”: it should show up with ID 1, voltage around 12 V.',
  "Dagli l'ID previsto (tabella «ID previsti») con «Cambia ID». Scrivilo su un pezzetto di nastro sul servo.": 'Give it the planned ID (“Planned IDs” table) with “Change ID”. Write it on a bit of tape on the servo.',
  '«+5°» e «−5°» nella riga del servo: deve girare piano di poco.': '“+5°” and “−5°” in the servo row: it should turn slowly by a small amount.',
  'Premi il fungo mentre si muove: si deve fermare e in alto compare': 'Press the e-stop while it moves: it must stop and the top bar shows',
  'Se qualcosa non va': 'If something goes wrong',
  'Il Mac non vede la schedina': 'The Mac does not see the board',
  'Altro cavo (deve passare i dati), altra porta. Poi BOOT tenuto premuto mentre colleghi.': 'Another cable (it must carry data), another port. Then hold BOOT while plugging in.',
  '«Nessun segnale dal ponte»': '“No signal from the bridge”',
  'Premi una volta RST sulla schedina. Se resta, il firmware ponte non è caricato sulla schedina: va caricato prima di collegare i servo.': 'Press RST on the board once. If it persists, the bridge firmware is not on the board: flash it before connecting the servos.',
  'Collegato ma nessun servo trovato': 'Connected but no servo found',
  '12 V collegati? Ponticelli su A? Scambia TX e RX. Un servo appena comprato ha ID 1.': '12 V connected? Jumpers on A? Swap TX and RX. A brand-new servo has ID 1.',
  'FUNGO PREMUTO anche se rilasciato': 'E-STOP PRESSED even when released',
  'Filo staccato o sul blocchetto sbagliato: deve essere il NC (1-2, levetta rossa). Il fungo si sblocca girandolo.': 'Loose wire or wrong block: it must be the NC one (1-2, red lever). Twist the e-stop to release it.',
  'Il giunto gira al contrario': 'The joint turns the wrong way',
  'Impostazioni → verso del servo da +1 a −1.': 'Settings → servo direction from +1 to −1.',
  'Servo caldo (oltre 60 °C)': 'Hot servo (above 60 °C)',
  'Fermati, lascialo raffreddare, controlla che il pezzo non sia forzato o troppo pesante.': 'Stop, let it cool down, check that the part is not forced or too heavy.',
  'File del progetto': 'Project files',
  'Orbinel Motion: cartella': 'Orbinel Motion: folder',
  ', si apre con': ', opened with',
  '. Modelli:': '. Models:',
  ', copiati da': ', copied from',
  '. Firmware della schedina e progetto originale: cartella': '. Board firmware and original project: folder',
  'Annulla': 'Cancel',

  // avvisi e conferme
  'Fermato: ogni servo tiene la posizione in cui era': 'Stopped: every servo holds its position',
  'Collega prima il robot': 'Connect the robot first',
  'Il fungo è premuto': 'The e-stop is pressed',
  'Non leggo tutti i servo dei giunti': 'Cannot read all joint servos',
  'Robot in home. Attiva «segue la simulazione» per comandarlo': 'Robot at home. Turn on “follows the simulation” to control it',
  "Robot appoggiato sul piano, coppia spenta: ora puoi togliere l'alimentazione": 'Robot resting on the table, torque off: you can now cut the power',
  'Posa di parcheggio salvata': 'Park pose saved',
  'La sequenza è vuota': 'The sequence is empty',
  'Un passo usa una posa che non esiste più': 'A step uses a pose that no longer exists',
  'Importato': 'Imported',
  'Serve Google Chrome (o Edge) per collegarsi via USB': 'Google Chrome (or Edge) is needed to connect over USB',
  "Collegato: nessun ponte ESP32, uso la USB diretta dell'adattatore": 'Connected: no ESP32 bridge, using the adapter’s direct USB',
  'Nessun segnale dal ponte: premi RST sulla schedina': 'No signal from the bridge: press RST on the board',
  'Fungo premuto: servo fermi': 'E-stop pressed: servos stopped',
  'Fungo rilasciato. Riattiva «segue la simulazione» per ripartire': 'E-stop released. Turn “follows the simulation” back on to restart',
  'Prima riaccendi la coppia': 'Turn torque back on first',
  'Il servo non risponde': 'The servo does not answer',
  'Zero salvato per tutti i giunti': 'Zero saved for all joints',
  'Posa aggiornata': 'Pose updated',
  'Prima salva almeno una posa': 'Save at least one pose first',
  'Servono 6 numeri separati da virgole': '6 comma-separated numbers are needed',
  'Presa instabile: le dita non appoggiano su due facce opposte (per esempio stringono due spigoli)': 'Unstable grasp: the fingers are not on two opposite faces (for example they pinch two edges)',
  'Senza coppia i servo diventano liberi e il braccio può cadere. Sostienilo. Procedo?': 'Without torque the servos go limp and the arm can fall. Hold it. Continue?',
  'Ripristino le impostazioni iniziali? Calibrazione e ID tornano ai valori di partenza.': 'Reset to the default settings? Calibration and IDs go back to their starting values.',
  'Parcheggio': 'Park',
  'Il polso': 'The wrist', 'La flangia': 'The flange', 'La pinza': 'The gripper', 'Il gomito': 'The elbow', "L'utensile": 'The tool',
};

// testi composti: [espressione, funzione che costruisce l'inglese]
const REGOLE_EN = [
  [/^Pinza: X (.*)$/, m => `Gripper: X ${m[1]}`],
  [/^Massa stimata con il servo: (\d+) g · TCP a (\d+) mm dalla flangia$/, m => `Estimated mass with servo: ${m[1]} g · TCP ${m[2]} mm from the flange`],
  [/^(.*) mm · massa stimata (\d+) g(.*) · TCP a (\d+) mm dalla punta del codolo$/, m => `${m[1]} mm · estimated mass ${m[2]} g${m[3]} · TCP ${m[4]} mm from the shank tip`],
  [/^Non riesco a costruire l'utensile: (.*)$/, m => `Cannot build the tool: ${m[1]}`],
  [/^Non riesco a caricare gli utensili: (.*)$/, m => `Cannot load the tools: ${m[1]}`],
  [/^Carico il modello… (\d+%)$/, m => `Loading the model… ${m[1]}`],
  [/^Non riesco a caricare il modello \((.*)\)\. Apri Motion con «Orbinel Motion\.command»\.$/, m => `Cannot load the model (${m[1]}). Open Motion with “Orbinel Motion.command”.`],
  [/^(.*): fase (\d+) di (\d+)$/, m => `${traduci(m[1])}: phase ${m[2]} of ${m[3]}`],
  [/^(J\d [^:]+) è fuori dai limiti: controlla lo zero$/, m => `${traduci(m[1])} is outside its limits: check the zero`],
  [/^(J\d [^:]+): (-?\d+)° fuori dai limiti \((.*)\)$/, m => `${traduci(m[1])}: ${m[2]}° outside the limits (${m[3]})`],
  [/^(.+) tocca il tavolo$/, m => `${traduci(m[1])} touches the table`],
  [/^(.+) urta la base$/, m => `${traduci(m[1])} hits the base`],
  [/^⚠ Raggiungibile, ma: (.*)$/, m => `⚠ Reachable, but: ${m[1].split('; ').map(traduci).join('; ')}`],
  [/^⚠ (.*)$/, m => `⚠ ${traduci(m[1])}`],
  [/^✗ (.*)$/, m => `✗ ${traduci(m[1])}`],
  [/^◆ (.*)$/, m => `◆ ${traduci(m[1])}`],
  [/^Posa non sicura: il robot vero non si muove$/, () => 'Unsafe pose: the real robot does not move'],
  [/^Posa non sicura: (.*)$/, m => `Unsafe pose: ${traduci(m[1])}`],
  [/^✓ In posizione di presa · inclinazione (-?\d+)°, rotazione (-?\d+)°: chiudi la pinza$/, m => `✓ In grasp position · pitch ${m[1]}°, rotation ${m[2]}°: close the gripper`],
  [/^Cerco… ID (\d+)$/, m => `Searching… ID ${m[1]}`],
  [/^Trovati: (.*)$/, m => `Found: ${m[1]}`],
  [/^Posa «(.*)» salvata$/, m => `Pose “${m[1]}” saved`],
  [/^Passo (\d+) di (\d+): (.*?)( \(solo simulazione\))?$/, m => `Step ${m[1]} of ${m[2]}: ${m[3]}${m[4] ? ' (simulation only)' : ''}`],
  [/^Non riesco a leggere il file: (.*)$/, m => `Cannot read the file: ${m[1]}`],
  [/^Non riesco a leggere «(.*)»: (.*)$/, m => `Cannot read “${m[1]}”: ${m[2]}`],
  [/^Non riesco a collegarmi: (.*)$/, m => `Cannot connect: ${m[1]}`],
  [/^Collegamento perso: (.*)$/, m => `Connection lost: ${m[1]}`],
  [/^Il robot si muoverà fino a (\d+)° per raggiungere la simulazione, a (\d+)°\/s\. Procedo\?$/, m => `The robot will move up to ${m[1]}° to reach the simulation, at ${m[2]}°/s. Continue?`],
  [/^Zero salvato, ma non leggo: (.*)$/, m => `Zero saved, but cannot read: ${m[1].split(', ').map(traduci).join(', ')}`],
  [/^Non leggo il servo della pinza \(ID (\d+)\)$/, m => `Cannot read the gripper servo (ID ${m[1]})`],
  [/^chiusa (\d+) · aperta (\d+)$/, m => `closed ${m[1]} · open ${m[2]}`],
  [/^Cambio l'ID (\d+) in (\d+)\. Sul cavo deve esserci un solo servo\. Procedo\?$/, m => `Changing ID ${m[1]} to ${m[2]}. There must be only one servo on the bus. Continue?`],
  [/^Nessun servo con ID (\d+)$/, m => `No servo with ID ${m[1]}`],
  [/^✓ Ora il servo ha ID (\d+)\. Scrivilo su un pezzo di nastro sul servo\.$/, m => `✓ The servo now has ID ${m[1]}. Write it on a piece of tape on the servo.`],
  [/^Elimino «(.*)»\?$/, m => `Delete “${m[1]}”?`],
  [/^«(.*)» è più grande di 40 cm: il file è in millimetri\?$/, m => `“${m[1]}” is larger than 40 cm: is the file in millimetres?`],
  [/^«(.*)»: (.*)$/, m => `“${m[1]}”: ${traduci(m[2])}`],
  [/^(\d+) e (\d+)$/, m => `${m[1]} and ${m[2]}`],
];

function traduci(s) {
  if (LINGUA !== 'en' || !s) return s;
  const pulito = s.replace(/\s+/g, ' ').trim();
  if (!pulito) return s;
  let en = null;
  if (Object.prototype.hasOwnProperty.call(TRADUZIONI_EN, pulito)) en = TRADUZIONI_EN[pulito];
  else for (const [re, f] of REGOLE_EN) { const m = pulito.match(re); if (m) { en = f(m); break; } }
  if (en === null || en === pulito) return s;
  // conserva gli spazi prima e dopo, che separano il testo dagli elementi vicini
  return (/^\s/.test(s) ? ' ' : '') + en + (/\s$/.test(s) ? ' ' : '');
}

if (LINGUA === 'en') {
  const ATTRIBUTI = ['title', 'placeholder', 'aria-label', 'alt'];
  const nodoTesto = n => {
    const p = n.parentNode;
    if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return;
    const v = n.nodeValue, en = traduci(v);
    if (en !== v) n.nodeValue = en;
  };
  const elemento = el => {
    for (const a of ATTRIBUTI) {
      const v = el.getAttribute?.(a);
      if (v) { const en = traduci(v); if (en !== v) el.setAttribute(a, en); }
    }
  };
  const albero = radice => {
    if (radice.nodeType === 3) return nodoTesto(radice);
    if (radice.nodeType !== 1) return;
    elemento(radice);
    radice.querySelectorAll('*').forEach(elemento);
    const w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) nodoTesto(n);
  };
  const avvia = () => {
    document.title = traduci(document.title);
    albero(document.body);
    new MutationObserver(lista => {
      for (const m of lista) {
        if (m.type === 'characterData') nodoTesto(m.target);
        else if (m.type === 'attributes') elemento(m.target);
        else m.addedNodes.forEach(albero);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTI });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
  const conferma = window.confirm.bind(window), allerta = window.alert.bind(window);
  window.confirm = m => conferma(traduci(m));
  window.alert = m => allerta(traduci(m));
}

// pulsanti IT / EN nell'intestazione
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-lingua-motion]').forEach(b => {
    b.classList.toggle('attivo', b.dataset.linguaMotion === LINGUA);
    b.addEventListener('click', () => { if (b.dataset.linguaMotion !== LINGUA) cambiaLingua(b.dataset.linguaMotion); });
  });
});
