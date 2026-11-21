import * as THREE from 'three';
import { QUALITY } from './config.js';
import { buildEnvironment } from './environment.js';
import { buildWorld } from './world.js';
import { buildBuildings } from './buildings.js';
import { buildBillboards } from './billboards.js';
import { buildProps } from './props.js';
import { buildTraffic } from './traffic.js';
import { buildCrowds } from './crowds.js';
import { createPlayer } from './player.js';
import { createPost } from './post.js';
import { createAudio } from './audio.js';
import { setupUI } from './ui.js';

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixelRatioCap));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1200);

// ---- Build the city ----
const env = buildEnvironment(scene, renderer);
const world = buildWorld(scene);
const colliders = [];
const buildings = buildBuildings(scene, colliders);
const billboards = buildBillboards(scene, buildings.anchors);
const props = buildProps(scene, colliders);
const traffic = buildTraffic(scene);
const crowds = buildCrowds(scene);
const audio = createAudio();

const player = createPlayer(camera, renderer.domElement, colliders);
const post = createPost(renderer, scene, camera);
const ui = setupUI({ env, player, post, audio, camera, colliders });

// ---- UI gating ----
const overlay = document.getElementById('overlay');
const crosshair = document.getElementById('crosshair');
const loading = document.getElementById('loading');
overlay.addEventListener('click', () => { audio.ensureStarted(); player.lock(); });
player.onLock((locked) => {
  overlay.style.display = locked ? 'none' : 'flex';
  crosshair.style.display = locked && player.mode === 'fps' ? 'block' : 'none';
  if (locked) audio.ensureStarted();
  ui.sync();
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.resize(innerWidth, innerHeight);
});

// ---- Frame loop ----
const clock = new THREE.Clock();
let frames = 0, fpsTime = 0;
const fpsEl = document.getElementById('fps');
const modeEl = document.getElementById('mode');
const viewEl = document.getElementById('view');
const posEl = document.getElementById('pos');

function frame(dt) {
  const t = env.t;
  env.update(dt);
  player.update(dt);
  buildings.update(dt, t);
  billboards.update(dt, t);
  props.update(dt, t);
  traffic.update(dt, t);
  crowds.update(dt, t);
  audio.update(dt);
  ui.update();
  post.setBloom(env.bloomStrength);
  post.render();

  frames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsEl.textContent = Math.round(frames / fpsTime);
    modeEl.textContent = env.t > 0.5 ? 'Night' : 'Day';
    viewEl.textContent = player.mode === 'fps' ? 'First-person' : 'Orbit';
    posEl.textContent = `${player.position.x.toFixed(0)}, ${player.position.z.toFixed(0)}`;
    frames = 0; fpsTime = 0;
  }
}

function loop() {
  requestAnimationFrame(loop);
  frame(Math.min(clock.getDelta(), 0.05));
}

// Debug / verification hook (drives frames even if rAF is throttled).
window.__ts = {
  frame, renderer, scene, camera, player, env, post,
  buildings, billboards, props, traffic, crowds,
  step(n = 1, dt = 1 / 60) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) frame(dt);
    const ms = (performance.now() - t0) / n;
    return {
      avgFrameMs: +ms.toFixed(2), estFPS: Math.round(1000 / ms),
      drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      billboards: billboards.count, pedestrians: crowds.count,
      errors: window.__errors,
    };
  },
};

loading.style.display = 'none';
loop();