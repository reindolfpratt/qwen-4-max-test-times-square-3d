import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand, rr, ri, pick } from './config.js';

export { mergeGeometries };

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(c, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.needsUpdate = true;
  return t;
}

// ---- Ground materials ----------------------------------------------------
export function asphaltTexture() {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#23252b'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = ri(20, 70);
    g.fillStyle = `rgba(${v},${v},${v + 4},${rr(0.04, 0.16)})`;
    g.fillRect(rr(0, 512), rr(0, 512), rr(1, 3), rr(1, 3));
  }
  // faint cracks
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    let x = rr(0, 512), y = rr(0, 512);
    g.moveTo(x, y);
    for (let j = 0; j < 6; j++) { x += rr(-40, 40); y += rr(-40, 40); g.lineTo(x, y); }
    g.stroke();
  }
  return canvasTexture(c, { repeat: [40, 40] });
}

export function concreteTexture(base = '#8d8f96', tile = 64) {
  const c = canvas(512, 512), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) {
    const v = ri(120, 175);
    g.fillStyle = `rgba(${v},${v},${v},${rr(0.03, 0.1)})`;
    g.fillRect(rr(0, 512), rr(0, 512), rr(1, 3), rr(1, 3));
  }
  // expansion joints
  g.strokeStyle = 'rgba(40,40,44,0.5)'; g.lineWidth = 2;
  for (let x = 0; x <= 512; x += tile) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += tile) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  return canvasTexture(c, { repeat: [24, 24] });
}

// ---- Building facades ----------------------------------------------------
// Returns { map, emissive } canvas textures. Windows light up at night via emissiveMap.
export function facadeTexture({ cols = 8, rows = 16, base = '#3a3f4a', glass = '#1c2733', lit = 0.35, style = 'office' } = {}) {
  const W = 256, H = 512;
  const c = canvas(W, H), g = c.getContext('2d');
  const e = canvas(W, H), eg = e.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  // subtle vertical panel shading
  for (let i = 0; i < cols; i++) {
    g.fillStyle = `rgba(255,255,255,${rr(0, 0.04)})`;
    g.fillRect((i / cols) * W, 0, W / cols, H);
  }
  const mx = W / cols, my = H / rows;
  const winW = mx * 0.62, winH = my * 0.6;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * mx + (mx - winW) / 2;
      const y = r * my + (my - winH) / 2;
      const isLit = rand() < lit;
      // glass
      const grad = g.createLinearGradient(x, y, x, y + winH);
      grad.addColorStop(0, glass);
      grad.addColorStop(1, '#0d141c');
      g.fillStyle = grad; g.fillRect(x, y, winW, winH);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y, winW, winH * 0.18);
      // frame
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.strokeRect(x, y, winW, winH);
      if (isLit) {
        const warm = pick(['#ffd98a', '#ffe9b8', '#cfe0ff', '#fff2cf', '#ffd27f']);
        eg.fillStyle = warm; eg.fillRect(x, y, winW, winH);
        eg.fillStyle = 'rgba(0,0,0,0.25)';
        if (rand() < 0.4) eg.fillRect(x, y + winH * rr(0.3, 0.7), winW, winH * 0.12);
      }
    }
  }
  // ground floor storefront band
  if (style === 'office' || style === 'tower') {
    g.fillStyle = '#15161c'; g.fillRect(0, H - my * 1.2, W, my * 1.2);
    eg.fillStyle = '#ffdf9e'; eg.fillRect(0, H - my * 1.05, W, my * 0.7);
  }
  return { map: canvasTexture(c), emissive: canvasTexture(e) };
}

// ---- Billboard ad designs (procedural, self-contained) -------------------
const AD_WORDS = ['NOVA', 'AURORA', 'PIXEL', 'LUMEN', 'ORBIT', 'ZENITH', 'PULSE', 'VERTEX', 'ECHO', 'PRISM', 'FLUX', 'HELIX', 'QUANTA', 'SOLSTICE', 'NEBULA', 'CIPHER'];
const AD_TAG = ['THE FUTURE IS NOW', 'LIVE BRIGHTER', 'BEYOND LIMITS', 'NEW YORK MINUTES', 'SEE EVERYTHING', 'PURE ENERGY', 'NEXT LEVEL', 'ALWAYS ON', 'FEEL THE CITY', 'UNSTOPPABLE'];
const AD_COLORS = [
  ['#ff2d78', '#2b0a3d'], ['#00e5ff', '#03203a'], ['#ffd400', '#3a1d00'],
  ['#7c4dff', '#0d0630'], ['#00ff9d', '#03301f'], ['#ff6a00', '#330d00'],
  ['#ff3b3b', '#2a0505'], ['#3d8bff', '#04143a'], ['#ff00cc', '#2a0022'],
];

export function makeAdCanvas(seed = 0, w = 512, h = 256) {
  const c = canvas(w, h), g = c.getContext('2d');
  const [fg, bg] = AD_COLORS[seed % AD_COLORS.length];
  const word = AD_WORDS[seed % AD_WORDS.length];
  const tag = AD_TAG[seed % AD_TAG.length];
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg); grad.addColorStop(1, shade(bg, 1.6));
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // decorative shapes
  g.globalAlpha = 0.18; g.fillStyle = fg;
  for (let i = 0; i < 6; i++) {
    const r = rr(30, 120);
    g.beginPath(); g.arc(rr(0, w), rr(0, h), r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // big word
  g.fillStyle = fg;
  g.font = `900 ${Math.floor(h * 0.42)}px -apple-system, Helvetica, Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 24;
  g.fillText(word, w / 2, h * 0.42);
  g.shadowBlur = 0;
  // tagline
  g.fillStyle = '#ffffff';
  g.font = `600 ${Math.floor(h * 0.09)}px -apple-system, Helvetica, Arial, sans-serif`;
  g.fillText(tag, w / 2, h * 0.78);
  // border glow
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  return c;
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r * f)); gg = Math.min(255, Math.round(gg * f)); b = Math.min(255, Math.round(b * f));
  return `rgb(${r},${gg},${b})`;
}

// Simple merged box helper for static props.
export function box(w, h, d, x = 0, y = 0, z = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return geo;
}

export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }