import * as THREE from 'three';
import { WORLD, CROSS_STREETS, SEVENTH_AVE, BROADWAY, rand, rr, ri } from './config.js';
import { mergeGeometries, box } from './utils.js';

export function buildProps(scene, colliders) {
  const group = new THREE.Group(); group.name = 'props';
  const nightLights = [];
  const emissiveMats = [];

  const metal = new THREE.MeshStandardMaterial({ color: 0x2f333a, roughness: 0.6, metalness: 0.7 });
  const darkGreen = new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 0.7, metalness: 0.3 });

  // ---- TKTS red glass steps (Father Duffy Square) ----
  const tkts = new THREE.Group();
  const redGlass = new THREE.MeshStandardMaterial({ color: 0xd21f2c, emissive: 0xff2233, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
  emissiveMats.push({ mat: redGlass, day: 0.25, night: 1.4 });
  const stepGeos = [];
  const tx = -19, tz = -186;
  for (let i = 0; i < 11; i++) {
    stepGeos.push(box(24, 0.42, 2.0, tx, 0.16 + i * 0.42 + 0.21, tz + 9 - i * 1.7));
  }
  const steps = new THREE.Mesh(mergeGeometries(stepGeos), redGlass);
  steps.castShadow = steps.receiveShadow = true;
  tkts.add(steps);
  // glowing underside canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(25, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff2030, emissiveIntensity: 0.8, roughness: 0.4 }));
  canopy.position.set(tx, 5.4, tz + 1); canopy.rotation.x = -0.18;
  emissiveMats.push({ mat: canopy.material, day: 0.4, night: 1.6 });
  tkts.add(canopy);
  // TKTS sign
  const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff4455, emissiveIntensity: 1.2 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 0.4), signMat);
  sign.position.set(tx, 6.6, tz + 10); tkts.add(sign);
  emissiveMats.push({ mat: signMat, day: 0.6, night: 1.8 });
  group.add(tkts);

  // ---- Street lamps (instanced poles + emissive heads) ----
  const lampPos = [];
  for (let z = WORLD.minZ + 15; z < WORLD.maxZ - 15; z += 26) {
    lampPos.push([SEVENTH_AVE.x - SEVENTH_AVE.half - 3, z]);
    lampPos.push([SEVENTH_AVE.x + SEVENTH_AVE.half + 3, z]);
  }
  for (const s of CROSS_STREETS) {
    for (let x = WORLD.minX + 25; x < WORLD.maxX - 25; x += 40) {
      if (Math.abs(x) < 20) continue;
      lampPos.push([x, s.z - s.half - 3]);
    }
  }
  const poleGeo = mergeGeometries([
    box(0.22, 7, 0.22, 0, 3.5, 0),
    box(1.6, 0.18, 0.18, 0.8, 7, 0),
  ]);
  const headGeo = new THREE.SphereGeometry(0.32, 10, 8); headGeo.translate(1.5, 6.9, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffd98a, emissiveIntensity: 0.2 });
  emissiveMats.push({ mat: headMat, day: 0.15, night: 2.4 });
  const poles = new THREE.InstancedMesh(poleGeo, metal, lampPos.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampPos.length);
  const m4 = new THREE.Matrix4();
  lampPos.forEach(([x, z], i) => {
    m4.makeTranslation(x, WORLD.curbHeight, z);
    poles.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
  });
  poles.castShadow = true;
  group.add(poles, heads);

  // A handful of real point lights for night plaza illumination (no shadows).
  const plazaSpots = [[10, 60], [10, -60], [-15, -150], [28, 150], [40, 0], [-30, 20]];
  for (const [x, z] of plazaSpots) {
    const pl = new THREE.PointLight(0xffd9a0, 0, 55, 2);
    pl.position.set(x, 8, z);
    group.add(pl); nightLights.push(pl);
  }

  // ---- Bollards (instanced) ----
  const bollardGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.9, 8); bollardGeo.translate(0, 0.45, 0);
  const bollardPos = [];
  for (let z = -195; z < 195; z += 8) {
    bollardPos.push([SEVENTH_AVE.x + SEVENTH_AVE.half + 1.2, z]);
    bollardPos.push([SEVENTH_AVE.x - SEVENTH_AVE.half - 1.2, z]);
  }
  for (let i = 0; i < 24; i++) bollardPos.push([rr(-40, 45), rr(-195, 195)]);
  const bollards = new THREE.InstancedMesh(bollardGeo, metal, bollardPos.length);
  bollardPos.forEach(([x, z], i) => { m4.makeTranslation(x, WORLD.curbHeight, z); bollards.setMatrixAt(i, m4); });
  bollards.castShadow = true; group.add(bollards);

  // ---- Trash cans (instanced) ----
  const trashGeo = new THREE.CylinderGeometry(0.34, 0.3, 1.0, 10); trashGeo.translate(0, 0.5, 0);
  const trashPos = [];
  for (let i = 0; i < 34; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    trashPos.push([SEVENTH_AVE.x + side * (SEVENTH_AVE.half + 2.5), rr(WORLD.minZ + 10, WORLD.maxZ - 10)]);
  }
  const trash = new THREE.InstancedMesh(trashGeo, darkGreen, trashPos.length);
  trashPos.forEach(([x, z], i) => { m4.makeTranslation(x, WORLD.curbHeight, z); trash.setMatrixAt(i, m4); });
  trash.castShadow = true; group.add(trash);

  // ---- Food carts ----
  const cartSpots = [[20, 70], [22, -30], [-16, 100], [38, 150], [-25, -120], [16, -160]];
  const cartBody = new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.5, metalness: 0.6 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xd23b3b, roughness: 0.7 });
  const cartSign = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffcf70, emissiveIntensity: 0.6 });
  emissiveMats.push({ mat: cartSign, day: 0.3, night: 1.6 });
  for (const [x, z] of cartSpots) {
    const cart = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.6), cartBody); body.position.y = 1.0; body.castShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 1.8), metal); top.position.y = 1.8;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 2.0), canopyMat); canopy.position.y = 2.5;
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), metal); poleL.position.set(-1.1, 2.1, 0.7);
    const poleR = poleL.clone(); poleR.position.x = 1.1;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.1), cartSign); sign.position.set(0, 2.2, 0.95);
    cart.add(body, top, canopy, poleL, poleR, sign);
    cart.position.set(x, WORLD.curbHeight, z); cart.rotation.y = rr(0, Math.PI * 2);
    group.add(cart);
    colliders.push({ minX: x - 1.4, maxX: x + 1.4, minZ: z - 1.0, maxZ: z + 1.0 });
  }

  // ---- Subway entrances ----
  const subwaySpots = [[16.5, 120, 0], [-16.5, -40, Math.PI], [16.5, -120, 0], [-16.5, 40, Math.PI]];
  const railMat = new THREE.MeshStandardMaterial({ color: 0x1f6b3a, roughness: 0.5, metalness: 0.5 });
  const subSign = new THREE.MeshStandardMaterial({ color: 0x0a2a1a, emissive: 0x2aff8a, emissiveIntensity: 0.7 });
  emissiveMats.push({ mat: subSign, day: 0.4, night: 1.6 });
  for (const [x, z, ry] of subwaySpots) {
    const sub = new THREE.Group();
    const opening = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x0c0e12 })); opening.position.y = 0.16;
    const railGeos = [];
    for (const sx of [-1.6, 1.6]) railGeos.push(box(0.1, 1.1, 4, sx, 0.7, 0));
    railGeos.push(box(3.3, 0.1, 0.1, 0, 1.25, -2));
    railGeos.push(box(3.3, 0.1, 0.1, 0, 1.25, 2));
    const rails = new THREE.Mesh(mergeGeometries(railGeos), railMat); rails.castShadow = true;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.15), subSign); sign.position.set(0, 1.7, -2);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd98a, emissiveIntensity: 1.0 }));
    globe.position.set(1.6, 1.9, -2);
    emissiveMats.push({ mat: globe.material, day: 0.3, night: 2.0 });
    sub.add(opening, rails, sign, globe);
    sub.position.set(x, WORLD.curbHeight, z); sub.rotation.y = ry;
    group.add(sub);
  }

  // ---- Scaffolding on a couple of facades ----
  const scaffMat = new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.6, metalness: 0.6 });
  const scaffGeos = [];
  const scaffSpots = [[-60, 80, 0], [70, -100, Math.PI]];
  for (const [x, z, ry] of scaffSpots) {
    const w = 18, h = 12;
    for (let px = -w / 2; px <= w / 2; px += 3) scaffGeos.push(box(0.12, h, 0.12, x + px, h / 2 + 0.16, z));
    for (let py = 2; py <= h; py += 3) {
      scaffGeos.push(box(w, 0.1, 0.1, x, py + 0.16, z));
      scaffGeos.push(box(w, 0.08, 1.2, x, py + 0.2, z + 0.6)); // plank
    }
  }
  const scaff = new THREE.Mesh(mergeGeometries(scaffGeos), scaffMat);
  scaff.castShadow = true; group.add(scaff);

  scene.add(group);

  return {
    group, nightLights,
    update(dt, t) {
      for (const e of emissiveMats) e.mat.emissiveIntensity = e.day + (e.night - e.day) * t;
      for (const pl of nightLights) pl.intensity = t * 26;
    },
  };
}