// Impostazioni del sito da compilare prima della pubblicazione (vedi DA-FARE.md).
// moduli: indirizzo a cui i moduli inviano i dati in JSON. Ora FormSubmit, che inoltra all'email indicata
// (al primo invio manda un'email di attivazione; dopo si può sostituire l'email con l'alias casuale che fornisce).
// Se è vuoto i moduli non spediscono nulla e lo dicono.
// newsletter: indirizzo «subscribe» del modulo incorporato di MailerLite (vedi business/email-automazioni.md).
//   Se c'è, chi si iscrive alla lista d'attesa entra anche in MailerLite, che manda le email automatiche.
// instagram: indirizzo del profilo, quando esiste.
window.ORBINEL = {
  moduli: 'https://formsubmit.co/ajax/christiangiancola23@gmail.com',
  newsletter: '',
  instagram: '',
  email: 'christiangiancola23@gmail.com',
};
