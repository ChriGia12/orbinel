// Comportamenti comuni del sito: lingua (inglese / italiano), menu, comparsa allo scorrimento e moduli.
'use strict';

(() => {
  const html = document.documentElement;

  // --- lingua: scelta salvata, altrimenti quella del browser ---
  let lingua = null;
  try { lingua = localStorage.getItem('orbinel.lingua'); } catch {}
  // pagine rivolte al pubblico italiano (es. l'informativa privacy) partono in italiano se non c'è una scelta salvata
  if (!lingua) lingua = html.dataset.linguaPredefinita || ((navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en');
  const imposta = l => {
    html.dataset.lingua = l;
    html.lang = l;
    document.querySelectorAll('.lingua button').forEach(b => b.classList.toggle('attivo', b.dataset.lingua === l));
    document.querySelectorAll('[data-ph-it]').forEach(el => { el.placeholder = el.dataset[l === 'it' ? 'phIt' : 'phEn']; });
    const titolo = document.querySelector(`meta[name="titolo-${l}"]`);
    if (titolo) document.title = titolo.content;
    try { localStorage.setItem('orbinel.lingua', l); } catch {}
  };
  imposta(lingua);
  document.querySelectorAll('.lingua button').forEach(b => b.addEventListener('click', () => imposta(b.dataset.lingua)));

  // --- barra e menu ---
  const barra = document.querySelector('.barra');
  const scorri = () => barra?.classList.toggle('scesa', scrollY > 8);
  addEventListener('scroll', scorri, { passive: true });
  scorri();
  const hamburger = document.querySelector('.hamburger'), menu = document.querySelector('.menu');
  hamburger?.addEventListener('click', () => {
    const aperto = menu.classList.toggle('aperto');
    hamburger.setAttribute('aria-expanded', aperto);
  });
  menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('aperto')));

  // --- comparsa allo scorrimento ---
  if ('IntersectionObserver' in window) {
    const os = new IntersectionObserver(voci => voci.forEach(v => {
      if (v.isIntersecting) { v.target.classList.add('visto'); os.unobserve(v.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.compare').forEach(el => os.observe(el));
  } else document.querySelectorAll('.compare').forEach(el => el.classList.add('visto'));

  // --- anno e collegamenti configurabili ---
  document.querySelectorAll('[data-anno]').forEach(el => { el.textContent = new Date().getFullYear(); });
  const conf = window.ORBINEL || {};
  document.querySelectorAll('[data-instagram]').forEach(a => {
    if (conf.instagram) a.href = conf.instagram; else a.hidden = true;
  });
  document.querySelectorAll('[data-instagram-presto]').forEach(el => { el.hidden = !!conf.instagram; });
  document.querySelectorAll('[data-email]').forEach(a => {
    if (conf.email) { a.href = 'mailto:' + conf.email; a.textContent = conf.email; } else a.hidden = true;
  });

  // --- risposte automatiche: FormSubmit le manda a chi compila il modulo (campo «email») ---
  const risposte = {
    lista: {
      it: "Ciao!\n\nGrazie per esserti iscritto alla lista d'attesa di Orbinel Robotics. Ti scriveremo solo quando c'è qualcosa di concreto da mostrare: i progressi di Kheiron, l'uscita del Build Pack, le novità su simulatore e lezioni.\n\nSe nel frattempo hai domande, rispondi pure a questa email: ti rispondiamo entro 48 ore.\n\nOrbinel Robotics · Engineering Motion\nhttps://orbinel.it/",
      en: "Hi!\n\nThanks for joining the Orbinel Robotics waitlist. We will only write when there is something real to show: Kheiron's progress, the Build Pack release, news about the simulator and lessons.\n\nIf you have questions in the meantime, just reply to this email: we answer within 48 hours.\n\nOrbinel Robotics · Engineering Motion\nhttps://orbinel.it/",
    },
    make: {
      it: "Ciao!\n\nAbbiamo ricevuto la tua richiesta di stampa. Controlliamo il file (stampabilità, orientamento, materiale) e ti rispondiamo entro 48 ore con un preventivo o con qualche domanda.\n\nSe vuoi aggiungere dettagli, rispondi pure a questa email.\n\nOrbinel Make · Orbinel Robotics\nhttps://orbinel.it/make.html",
      en: "Hi!\n\nWe have received your print request. We will check the file (printability, orientation, material) and reply within 48 hours with a quote or a few questions.\n\nTo add details, just reply to this email.\n\nOrbinel Make · Orbinel Robotics\nhttps://orbinel.it/make.html",
    },
    'learn-pilota': {
      it: "Buongiorno,\n\ngrazie per l'interesse al progetto pilota di Orbinel Learn. Leggiamo con attenzione ogni candidatura e la ricontattiamo entro 48 ore per capire classi, tempi e strumenti a disposizione.\n\nNel frattempo può provare le lezioni nel simulatore: https://orbinel.it/motion/ (sezione «Lezioni»).\n\nOrbinel Learn · Orbinel Robotics",
      en: "Hello,\n\nthank you for your interest in the Orbinel Learn pilot. We read every application carefully and will contact you within 48 hours to discuss classes, timing and available equipment.\n\nMeanwhile, you can try the lessons in the simulator: https://orbinel.it/motion/ (\"Lessons\" tab).\n\nOrbinel Learn · Orbinel Robotics",
    },
  };

  // --- lista d'attesa anche nella newsletter (Brevo), se configurata ---
  // conf.newsletter è l'indirizzo «action» del modulo di iscrizione di Brevo (…sibforms.com/serve/…).
  // Brevo accetta solo i campi del suo modulo «Sito Orbinel»: EMAIL, NOME, LINGUA, INTERESSI.
  async function iscriviNewsletter(dati) {
    if (!conf.newsletter || dati.modulo !== 'lista') return;
    const corpo = new FormData();
    corpo.append('EMAIL', dati.email);
    if (dati.nome) corpo.append('NOME', dati.nome);
    corpo.append('LINGUA', dati.lingua);
    corpo.append('INTERESSI', (dati.interessi || []).join(', '));
    corpo.append('email_address_check', '');          // campo anti-spam del modulo Brevo: deve restare vuoto
    corpo.append('locale', dati.lingua === 'it' ? 'it' : 'en');
    try { await fetch(conf.newsletter, { method: 'POST', body: corpo, mode: 'no-cors' }); } catch {}
  }

  // --- moduli: inviano JSON all'indirizzo configurato ---
  const testi = {
    it: { invio: 'Invio…', ok: 'Grazie! Controlla la tua email e conferma l\'iscrizione.', no: 'Invio non riuscito. Riprova tra poco.', manca: 'I moduli non sono ancora attivi: il sito è in anteprima.', email: 'Serve un indirizzo email valido.', consenso: 'Per inviare il modulo serve il consenso al trasferimento dei dati tramite FormSubmit. In alternativa scrivici a info@orbinel.it.' },
    en: { invio: 'Sending…', ok: 'Thank you! Check your inbox and confirm your subscription.', no: 'Could not send. Please try again shortly.', manca: 'Forms are not active yet: this is a preview.', email: 'Please enter a valid email address.', consenso: 'To send the form we need your consent to the data transfer through FormSubmit. Otherwise, email us at info@orbinel.it.' },
  };
  document.querySelectorAll('form[data-modulo]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const t = testi[html.dataset.lingua] || testi.en;
    const esito = f.querySelector('.esito');
    const dati = Object.fromEntries(new FormData(f));
    dati.interessi = [...f.querySelectorAll('input[name=interessi]:checked')].map(i => i.value);
    dati.modulo = f.dataset.modulo;
    dati.lingua = html.dataset.lingua;
    const oggetti = { lista: 'lista d\'attesa', make: 'richiesta di stampa (Make)', 'learn-pilota': 'candidatura scuola (Learn)', contatti: 'messaggio dal sito' };
    dati._subject = `Orbinel · ${oggetti[dati.modulo] || dati.modulo}`;
    dati._template = 'table';
    // la lista d'attesa la conferma Brevo (doppia conferma + benvenuto): niente risposta di FormSubmit, se Brevo è attivo
    if (risposte[dati.modulo] && !(dati.modulo === 'lista' && conf.newsletter)) dati._autoresponse = risposte[dati.modulo][dati.lingua] || risposte[dati.modulo].en;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dati.email || '')) { esito.className = 'esito no'; esito.textContent = t.email; return; }
    // consenso esplicito al trasferimento extra-UE tramite FormSubmit (art. 49.1.a GDPR, vedi privacy.html)
    if (f.querySelector('[name=consenso_trasferimento]') && !dati.consenso_trasferimento) { esito.className = 'esito no'; esito.textContent = t.consenso; return; }
    if (!conf.moduli) { esito.className = 'esito no'; esito.textContent = t.manca; return; }
    // anti-spam: campo trappola compilato o invio troppo rapido dopo l'apertura della pagina → si finge un invio riuscito
    if (dati._honey || performance.now() < 3000) { esito.className = 'esito ok'; esito.textContent = t.ok; f.reset(); return; }
    esito.className = 'esito'; esito.textContent = t.invio;
    try {
      const r = await fetch(conf.moduli, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(dati) });
      const risposta = await r.json().catch(() => ({}));
      if (!r.ok || risposta.success === false || risposta.success === 'false') throw new Error(risposta.message || r.status);
      await iscriviNewsletter(dati);
      const conferme = {
        it: { contatti: 'Messaggio ricevuto! Ti rispondiamo entro 48 ore.', make: 'Richiesta ricevuta! Ti rispondiamo entro 48 ore: controlla anche la tua email.', 'learn-pilota': 'Candidatura ricevuta! La ricontattiamo entro 48 ore.' },
        en: { contatti: 'Message received! We reply within 48 hours.', make: 'Request received! We reply within 48 hours: check your inbox too.', 'learn-pilota': 'Application received! We will contact you within 48 hours.' },
      };
      esito.className = 'esito ok'; esito.textContent = (conferme[html.dataset.lingua] || conferme.en)[dati.modulo] || t.ok; f.reset();
    } catch { esito.className = 'esito no'; esito.textContent = t.no; }
  }));
})();
