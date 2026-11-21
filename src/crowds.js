import * as THREE from 'three';
import { WORLD, CROSS_STREETS, SEVENTH_AVE, BROADWAY, QUALITY, SIGNAL, rand, rr, pick } from './config.js';
import { mergeGeometries, box } from './utils.js';

const a = BROADWAY.angleDeg * Math.PI / 180;
const clothing = [0x2c3e50, 0x8e3b3b, 0x3a6a4a, 0x4a4a5a, 0xb8a06a, 0x6a4a7a, 0x2a2a2e, 0xc4c4cc, 0x3a5a8a, 0x7a5a3a, 0xd28a4a, 0x40485a];
const skins = [0xe8b89a, 0xc68642, 0x8d5524, 0xf0c8a0, 0xa06840, 0x5c3a24];
const pants = [0x22252c, 0x3a3f4a, 0x1a1a22, 0x4a4038, 0x2a3a4a];

// Sidewalk wander segments (stay off the roadway).
function wanderSegments() {
  const segs = [];
  const sw = SEVENTH_AVE.half + 3.5;
  segs.push({ ax: -sw, az: -205, bx: -sw, bz: 205 });
  segs.push({ ax: sw, az: -205, bx: sw, bz: 205 });
  segs.push({ ax: -sw - 2, az: -205, bx: -sw - 2, bz: 205 });
  segs.push({ ax: sw + 2, az: -205, bx: sw + 2, bz: 205 });
  for (const s of CROSS_STREETS) {
    segs.push({ ax: -150, az: s.z + s.half + 3.5, bx: -22, bz: s.z + s.half + 3.5 });
    segs.push({ ax: 22, az: s.z + s.half + 3.5, bx: 150, bz: s.z + s.half + 3.5 });
    segs.push({ ax: -150, az: s.z - s.half - 3.5, bx: -22, bz: s.z - s.half - 3.5 });
  }
  // plaza loops
  segs.push({ ax: -30, az: -170, bx: 30, bz: -150 });
  segs.push({ ax: 5, az: -100, bx: 25, bz: 100 });
  segs.push({ ax: 20, az: 150, bx: 40, bz: 175 });
  return segs;
}

// Crosswalks over 7th Ave (pedestrians cross E-W during EW green / NS red).
function crosswalks() {
  const cw = [];
  for (const s of [CROSS_STREETS[2], CROSS_STREETS[3], CROSS_STREETS[4]]) { // 45th,44th,43rd
    const z = s.z + s.half + 1.6;
    cw.push({ ax: -SEVENTH_AVE.half - 2, az: z, bx: SEVENTH_AVE.half + 2, bz: z });
  }
  return cw;
}

function phaseAt(time) {
  const { nsGreen, nsYellow, ewGreen, ewYellow, allRed } = SIGNAL;
  const cycle = nsGreen + nsYellow + allRed + ewGreen + ewYellow + allRed;
  const t = time % cycle;
  if (t < nsGreen) return 'nsGreen';
  if (t < nsGreen + nsYellow) return 'nsYellow';
  if (t < nsGreen + nsYellow + allRed) return 'allRed1';
  if (t < nsGreen + nsYellow + allRed + ewGreen) return 'ewGreen';
  return 'ewRest';
}

export function buildCrowds(scene) {
  const group = new THREE.Group(); group.name = 'crowds';
  const N = QUALITY.pedestrianCount;

  // Geometry (pivot at feet y=0).
  const torsoGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.16, 0.2, 0.72, 8).translate(0, 1.12, 0),
    box(0.42, 0.2, 0.24, 0, 1.42, 0),
  ]);
  const headGeo = new THREE.SphereGeometry(0.135, 10, 8); headGeo.translate(0, 1.62, 0);
  const legGeo = box(0.14, 0.78, 0.16, 0, -0.39, 0); // pivot at hip (y=0), extends down

  const torsoMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const legMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const torso = new THREE.InstancedMesh(torsoGeo, torsoMat, N);
  const head = new THREE.InstancedMesh(headGeo, headMat, N);
  const legL = new THREE.InstancedMesh(legGeo, legMat, N);
  const legR = new THREE.InstancedMesh(legGeo, legMat, N);
  torso.castShadow = true;
  for (let i = 0; i < N; i++) {
    torso.setColorAt(i, new THREE.Color(pick(clothing)));
    head.setColorAt(i, new THREE.Color(pick(skins)));
    const pc = new THREE.Color(pick(pants));
    legL.setColorAt(i, pc); legR.setColorAt(i, pc);
  }
  group.add(torso, head, legL, legR);

  const segs = wanderSegments();
  const cws = crosswalks();
  const peds = [];
  for (let i = 0; i < N; i++) {
    const isCrosser = i % 4 === 0 && cws.length;
    if (isCrosser) {
      const cw = cws[i % cws.length];
      peds.push({
        kind: 'cross', cw, t: rand(), dir: rand() < 0.5 ? 1 : -1,
        state: 'wait', speed: rr(1.2, 1.9), phase: rr(0, 6), waitT: rr(0, 4),
        x: cw.ax, z: cw.az, jitter: rr(-0.6, 0.6),
      });
    } else {
      const s = pick(segs);
      peds.push({
        kind: 'wander', seg: s, t: rand(), dir: rand() < 0.5 ? 1 : -1,
        speed: rr(0.9, 1.7), phase: rr(0, 6), jitter: rr(-1.2, 1.2),
        x: s.ax, z: s.az,
      });
    }
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const posV = new THREE.Vector3(), scl = new THREE.Vector3(1, 1, 1);
  const legQ = new THREE.Quaternion(), legM = new THREE.Matrix4(), hipV = new THREE.Vector3();
  const xAxis = new THREE.Vector3(1, 0, 0);
  let elapsed = 0;

  function update(dt, t) {
    elapsed += dt;
    const phase = phaseAt(elapsed);
    const canCross = phase === 'ewGreen' || phase === 'ewRest'; // NS traffic stopped

    for (let i = 0; i < N; i++) {
      const p = peds[i];
      let moving = false, fx = 0, fz = 1;
      if (p.kind === 'wander') {
        const s = p.seg;
        const len = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1;
        p.t += (p.speed * dt / len) * p.dir;
        if (p.t > 1) { p.t = 1; p.dir = -1; } else if (p.t < 0) { p.t = 0; p.dir = 1; }
        const dx = (s.bx - s.ax) / len, dz = (s.bz - s.az) / len;
        p.x = s.ax + (s.bx - s.ax) * p.t + (-dz) * p.jitter;
        p.z = s.az + (s.bz - s.az) * p.t + (dx) * p.jitter;
        fx = dx * p.dir; fz = dz * p.dir; moving = true;
      } else {
        const cw = p.cw;
        if (p.state === 'wait') {
          p.waitT -= dt;
          if (canCross && p.waitT <= 0) { p.state = 'cross'; p.t = 0; }
          p.x = p.dir > 0 ? cw.ax : cw.bx; p.z = cw.az + p.jitter;
          fx = p.dir; fz = 0;
        } else {
          const len = Math.hypot(cw.bx - cw.ax, cw.bz - cw.az) || 1;
          p.t += p.speed * dt / len;
          if (p.t >= 1) { p.t = 1; p.state = 'wait'; p.dir *= -1; p.waitT = rr(2, 7); }
          const u = p.dir > 0 ? p.t : 1 - p.t;
          p.x = cw.ax + (cw.bx - cw.ax) * u; p.z = cw.az + p.jitter;
          fx = p.dir; fz = 0; moving = true;
        }
      }

      const ry = Math.atan2(fx, fz);
      p.phase += dt * (moving ? p.speed * 3.4 : 1.2);
      const bob = moving ? Math.abs(Math.sin(p.phase)) * 0.05 : 0;
      const swing = moving ? Math.sin(p.phase) * 0.5 : 0;

      posV.set(p.x, WORLD.curbHeight + bob, p.z);
      q.setFromAxisAngle(up, ry);
      m4.compose(posV, q, scl);
      torso.setMatrixAt(i, m4);
      head.setMatrixAt(i, m4);

      // legs swing about hip
      const hipY = WORLD.curbHeight + 0.78 + bob;
      const lx = Math.cos(ry) * 0.1, lz = -Math.sin(ry) * 0.1;
      legQ.setFromAxisAngle(xAxis, swing);
      const legRot = new THREE.Quaternion().setFromAxisAngle(up, ry).multiply(legQ);
      hipV.set(p.x + lx, hipY, p.z + lz);
      legM.compose(hipV, legRot, scl); legL.setMatrixAt(i, legM);
      legQ.setFromAxisAngle(xAxis, -swing);
      const legRot2 = new THREE.Quaternion().setFromAxisAngle(up, ry).multiply(legQ);
      hipV.set(p.x - lx, hipY, p.z - lz);
      legM.compose(hipV, legRot2, scl); legR.setMatrixAt(i, legM);
    }
    torso.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    legL.instanceMatrix.needsUpdate = true;
    legR.instanceMatrix.needsUpdate = true;
  }

  scene.add(group);
  return { group, update, count: N };
}