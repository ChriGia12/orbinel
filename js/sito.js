// Comportamenti comuni del sito: lingua (inglese / italiano), menu, comparsa allo scorrimento e moduli.
'use strict';

(() => {
  const html = document.documentElement;

  // --- lingua: scelta salvata, altrimenti quella del browser ---
  let lingua = null;
  try { lingua = localStorage.getItem('orbinel.lingua'); } catch {}
  if (!lingua) lingua = (navigator.language || 'en').toLowerCase().startsWith('it') ? 'it' : 'en';
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
  document.querySelectorAll('[data-email]').forEach(a => {
    if (conf.email) { a.href = 'mailto:' + conf.email; a.textContent = conf.email; } else a.hidden = true;
  });

  // --- moduli: inviano JSON all'indirizzo configurato ---
  const testi = {
    it: { invio: 'Invio…', ok: 'Grazie! Ti scriveremo quando ci sono novità.', no: 'Invio non riuscito. Riprova tra poco.', manca: 'I moduli non sono ancora attivi: il sito è in anteprima.', email: 'Serve un indirizzo email valido.' },
    en: { invio: 'Sending…', ok: 'Thank you! We will write when there is news.', no: 'Could not send. Please try again shortly.', manca: 'Forms are not active yet: this is a preview.', email: 'Please enter a valid email address.' },
  };
  document.querySelectorAll('form[data-modulo]').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault();
    const t = testi[html.dataset.lingua] || testi.en;
    const esito = f.querySelector('.esito');
    const dati = Object.fromEntries(new FormData(f));
    dati.interessi = [...f.querySelectorAll('input[name=interessi]:checked')].map(i => i.value);
    dati.modulo = f.dataset.modulo;
    dati.lingua = html.dataset.lingua;
    dati._subject = `Orbinel · ${dati.modulo}`;
    dati._template = 'table';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dati.email || '')) { esito.className = 'esito no'; esito.textContent = t.email; return; }
    if (!conf.moduli) { esito.className = 'esito no'; esito.textContent = t.manca; return; }
    esito.className = 'esito'; esito.textContent = t.invio;
    try {
      const r = await fetch(conf.moduli, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(dati) });
      const risposta = await r.json().catch(() => ({}));
      if (!r.ok || risposta.success === false || risposta.success === 'false') throw new Error(risposta.message || r.status);
      esito.className = 'esito ok'; esito.textContent = t.ok; f.reset();
    } catch { esito.className = 'esito no'; esito.textContent = t.no; }
  }));
})();
