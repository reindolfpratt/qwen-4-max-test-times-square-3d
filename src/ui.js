import { WORLD, CROSS_STREETS, SEVENTH_AVE, BROADWAY } from './config.js';

export function setupUI({ env, player, post, audio, camera, colliders }) {
  const btnNight = document.getElementById('btn-night');
  const btnAudio = document.getElementById('btn-audio');
  const btnView = document.getElementById('btn-view');
  const btnSSAO = document.getElementById('btn-ssao');
  const btnMap = document.getElementById('btn-map');
  const help = document.getElementById('help');
  const minimap = document.getElementById('minimap');
  const mctx = minimap.getContext('2d');
  let mapOn = false, helpOn = false;

  function sync() {
    const night = env.t > 0.5;
    btnNight.textContent = night ? '☀️ Day' : '🌙 Night';
    btnNight.classList.toggle('active', night);
    btnAudio.textContent = audio.muted ? '🔇 Audio' : '🔊 Audio';
    btnAudio.classList.toggle('active', !audio.muted);
    const orbit = player.mode === 'orbit';
    btnView.textContent = orbit ? '🚶 Walk' : '🛰 Orbit';
    btnView.classList.toggle('active', orbit);
    btnSSAO.classList.toggle('active', post.ssaoEnabled);
    btnMap.classList.toggle('active', mapOn);
    minimap.style.display = mapOn ? 'block' : 'none';
  }

  const act = {
    night() { env.toggle(); sync(); },
    audio() { audio.toggle(); sync(); },
    view() { player.toggleView(); sync(); },
    ssao() { post.toggleSSAO(); sync(); },
    map() { mapOn = !mapOn; sync(); },
    help() { helpOn = !helpOn; help.style.display = helpOn ? 'block' : 'none'; },
  };

  btnNight.addEventListener('click', act.night);
  btnAudio.addEventListener('click', act.audio);
  btnView.addEventListener('click', act.view);
  btnSSAO.addEventListener('click', act.ssao);
  btnMap.addEventListener('click', act.map);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyN': act.night(); break;
      case 'KeyM': act.audio(); break;
      case 'KeyV': act.view(); break;
      case 'KeyP': act.ssao(); break;
      case 'KeyG': act.map(); break;
      case 'KeyH': act.help(); break;
    }
  });

  // Minimap projection
  const MW = minimap.width, MH = minimap.height;
  const sx = MW / (WORLD.maxX - WORLD.minX), sz = MH / (WORLD.maxZ - WORLD.minZ);
  const px = (x) => (x - WORLD.minX) * sx;
  const pz = (z) => (z - WORLD.minZ) * sz;
  const dir = { x: 0, z: -1 };

  function drawMap() {
    mctx.clearRect(0, 0, MW, MH);
    mctx.fillStyle = 'rgba(8,10,16,0.9)'; mctx.fillRect(0, 0, MW, MH);
    // buildings
    mctx.fillStyle = 'rgba(120,130,150,0.35)';
    for (const b of colliders) {
      mctx.fillRect(px(b.minX), pz(b.minZ), Math.max(1, (b.maxX - b.minX) * sx), Math.max(1, (b.maxZ - b.minZ) * sz));
    }
    // roads
    mctx.strokeStyle = 'rgba(200,200,210,0.5)'; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.moveTo(px(SEVENTH_AVE.x), 0); mctx.lineTo(px(SEVENTH_AVE.x), MH); mctx.stroke();
    mctx.beginPath();
    mctx.moveTo(px(BROADWAY.xAt(WORLD.minZ)), pz(WORLD.minZ));
    mctx.lineTo(px(BROADWAY.xAt(WORLD.maxZ)), pz(WORLD.maxZ)); mctx.stroke();
    mctx.lineWidth = 1;
    for (const s of CROSS_STREETS) { mctx.beginPath(); mctx.moveTo(0, pz(s.z)); mctx.lineTo(MW, pz(s.z)); mctx.stroke(); }
    // player arrow
    camera.getWorldDirection(dir);
    const cx = px(player.position.x), cz = pz(player.position.z);
    const ang = Math.atan2(dir.x, -dir.z);
    mctx.save(); mctx.translate(cx, cz); mctx.rotate(ang);
    mctx.fillStyle = '#6ea8ff';
    mctx.beginPath(); mctx.moveTo(0, -6); mctx.lineTo(4, 5); mctx.lineTo(-4, 5); mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  let mapFrame = 0;
  sync();
  return {
    sync,
    update() { if (mapOn && (mapFrame++ % 2 === 0)) drawMap(); },
  };
}