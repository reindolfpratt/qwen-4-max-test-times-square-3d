import * as THREE from 'three';
import { QUALITY, rand, rr, ri, pick } from './config.js';
import { makeAdCanvas, canvasTexture, canvas } from './utils.js';

// Wide scrolling marquee canvas (tiles horizontally).
function makeScrollCanvas(seed, w = 1024, h = 256) {
  const c = makeAdCanvas(seed, w, h);
  return c;
}

export function buildBillboards(scene, anchors) {
  const group = new THREE.Group(); group.name = 'billboards';
  const boards = [];

  // Shared static ad pool.
  const POOL = 16;
  const poolTex = [];
  for (let i = 0; i < POOL; i++) poolTex.push(canvasTexture(makeAdCanvas(i, 512, 256)));

  const slots = anchors.slice(0, QUALITY.billboardCount);
  slots.forEach((a, i) => {
    const type = i % 3 === 0 ? 'scroll' : (i % 3 === 1 ? 'cycle' : 'pulse');
    let geo, tex, mat;
    const bright = 1.0;

    if (a.kind === 'curved') {
      // Nasdaq-style curved LED: cylinder segment facing outward.
      const radius = a.w / 2;
      geo = new THREE.CylinderGeometry(radius, radius, a.h, 24, 1, true, -Math.PI * 0.28, Math.PI * 0.56);
      tex = canvasTexture(makeScrollCanvas(i, 1024, 256));
      tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 0.5;
      mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: bright, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(a.x, a.y, a.z);
      mesh.rotation.y = a.ry + Math.PI / 2;
      group.add(mesh);
      boards.push({ mesh, mat, tex, type: 'scroll', speed: rr(0.02, 0.05), phase: rr(0, 6) });
      return;
    }

    geo = new THREE.PlaneGeometry(a.w, a.h);
    if (type === 'scroll') {
      tex = canvasTexture(makeScrollCanvas(i, 1024, 256));
      tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 0.5;
    } else {
      tex = poolTex[i % POOL];
    }
    mat = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: bright,
      roughness: 0.9, metalness: 0, side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(a.x, a.y, a.z);
    mesh.rotation.y = a.ry;
    group.add(mesh);

    // frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(a.w + 0.6, a.h + 0.6, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.7, metalness: 0.4 })
    );
    frame.position.set(a.x, a.y, a.z);
    frame.rotation.y = a.ry;
    frame.translateZ(-0.2);
    group.add(frame);

    boards.push({
      mesh, mat, tex, type, speed: rr(0.02, 0.06), phase: rr(0, 6),
      cycleT: rr(0, 4), cycleEvery: rr(3.5, 6), poolIdx: i % POOL,
      pulseBase: rr(0.8, 1.1),
    });
  });

  scene.add(group);

  return {
    group, count: boards.length,
    update(dt, t) {
      const base = 0.55 + t * 2.0; // brighter at night -> bloom
      for (const b of boards) {
        if (b.type === 'scroll') {
          b.tex.offset.x = (b.tex.offset.x + b.speed * dt) % 1;
          b.mat.emissiveIntensity = base;
        } else if (b.type === 'cycle') {
          b.cycleT += dt;
          if (b.cycleT > b.cycleEvery) {
            b.cycleT = 0; b.poolIdx = (b.poolIdx + 1 + ri(0, 2)) % POOL;
            const nt = poolTex[b.poolIdx];
            b.mat.map = nt; b.mat.emissiveMap = nt; b.mat.needsUpdate = true;
          }
          b.mat.emissiveIntensity = base;
        } else {
          b.phase += dt;
          b.mat.emissiveIntensity = base * (b.pulseBase + 0.25 * Math.sin(b.phase * 2.2));
        }
      }
    },
  };
}