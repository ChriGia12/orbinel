// Impostazioni del sito da compilare prima della pubblicazione (vedi DA-FARE.md).
// moduli: indirizzo a cui i moduli inviano i dati in JSON. Ora FormSubmit, che inoltra all'email indicata
// (al primo invio manda un'email di attivazione; dopo si può sostituire l'email con l'alias casuale che fornisce).
// Se è vuoto i moduli non spediscono nulla e lo dicono.
// newsletter: indirizzo «action» del modulo di iscrizione di Brevo (vedi business/email-automazioni.md).
//   Se c'è, chi si iscrive alla lista d'attesa entra anche in Brevo, che manda le email automatiche.
// instagram: indirizzo del profilo, quando esiste.
window.ORBINEL = {
  moduli: 'https://formsubmit.co/ajax/christiangiancola23@gmail.com',
  newsletter: 'https://f2384edd.sibforms.com/serve/MUIFAN1yoifCN6robS4AwsIspLSVXtj9Ljui6R6cs7Ut5NwVEh4NTGwWYORXENQtXfyAYTS8lMIO3sZgNvk-jorfw-NnFLOFO6mLQivdh3YAJujAod9wMay7o2yBkhKajQEv__GU2D_PGiWKQhckRd9D8HNiaUZGrEkaCbrYQYplGDyKIqcHesMrvD-8GjuYldNdZtfRKUUOiGwvZw==',
  instagram: '',
  email: 'christiangiancola23@gmail.com',
};
