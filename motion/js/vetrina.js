// Aspetto «da vetrina» della scena di Motion, per il sito e per i render: niente griglia, materiali più
// curati, luce arancione di contorno e ombra sfumata sotto la base. Si chiama dopo new Scena(...).
'use strict';

function vetrina(sc, { sfondo = '#0B0D10', luce = true } = {}) {
  const s = sc.scena;
  s.background = new THREE.Color(sfondo);
  s.children.filter(o => o.type === 'GridHelper' || o.geometry?.type === 'RingGeometry').forEach(o => s.remove(o));
  Object.assign(sc.materiali.pezzo, { roughness: 0.42, metalness: 0.18 });
  sc.materiali.pezzo.color.set(0x15171b);
  sc.materiali.servo.color.set(0x2b3038);
  if (luce) {
    const bordo = new THREE.DirectionalLight(0xff6b2c, 1.1);
    bordo.position.set(-500, 600, 250);
    s.add(bordo);
  }
  // ombra: disco con sfumatura radiale disegnata su un canvas
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.6)'); r.addColorStop(0.45, 'rgba(0,0,0,0.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const ombra = new THREE.Mesh(new THREE.PlaneGeometry(420, 420),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  ombra.position.set(40, 0, 0.5);
  s.add(ombra);
}

// dopo il caricamento: nasconde la scatola del fungo, che sta accanto alla base
function vetrinaPronta(sc) {
  sc.mesh.filter(m => m.material === sc.materiali.fisso).forEach(m => { m.visible = false; });
}
