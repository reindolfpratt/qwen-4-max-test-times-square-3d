import * as THREE from 'three';
import { WORLD, CROSS_STREETS, SEVENTH_AVE, BROADWAY, PAL } from './config.js';
import { asphaltTexture, concreteTexture, mergeGeometries, box } from './utils.js';

// Intersections of each cross street with 7th Ave and Broadway.
export const INTERSECTIONS = [];
for (const s of CROSS_STREETS) {
  INTERSECTIONS.push({ street: s, road: '7th', x: SEVENTH_AVE.x, z: s.z, half: s.half, roadHalf: SEVENTH_AVE.half });
  INTERSECTIONS.push({ street: s, road: 'bwy', x: BROADWAY.xAt(s.z), z: s.z, half: s.half, roadHalf: BROADWAY.half });
}

export function buildWorld(scene) {
  const group = new THREE.Group();
  group.name = 'world';

  const W = WORLD.maxX - WORLD.minX, D = WORLD.maxZ - WORLD.minZ;
  const cx = (WORLD.minX + WORLD.maxX) / 2, cz = (WORLD.minZ + WORLD.maxZ) / 2;

  // Base asphalt at road grade.
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: 0.95, metalness: 0.0, color: 0xffffff });
  const base = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, D + 40), asphaltMat);
  base.rotation.x = -Math.PI / 2; base.position.set(cx, 0, cz);
  base.receiveShadow = true;
  group.add(base);

  // Raised concrete sidewalks + plaza (top at curbHeight).
  const concMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#94969d', 64), roughness: 0.9, metalness: 0.0 });
  const plazaMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#a2a4ab', 48), roughness: 0.85, metalness: 0.0 });
  const swGeos = [], plazaGeos = [];
  const ch = WORLD.curbHeight, sw = WORLD.sidewalkWidth;

  const addSlab = (arr, w, d, x, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, ch, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, ch / 2, z);
    arr.push(g);
  };

  // 7th Ave sidewalks (both sides), full length.
  const len = D + 20;
  addSlab(swGeos, sw, len, SEVENTH_AVE.x - SEVENTH_AVE.half - sw / 2, cz);
  addSlab(swGeos, sw, len, SEVENTH_AVE.x + SEVENTH_AVE.half + sw / 2, cz);

  // Broadway sidewalks (diagonal).
  const a = BROADWAY.angleDeg * Math.PI / 180;
  const bwyLen = D / Math.cos(a) + 30;
  const perpX = Math.cos(a), perpZ = Math.sin(a); // perpendicular to Broadway dir (dir = (-sin a, -cos a))
  const off = BROADWAY.half + sw / 2;
  const bwyMidZ = cz, bwyMidX = BROADWAY.xAt(cz);
  addSlab(swGeos, sw, bwyLen, bwyMidX - perpX * off, bwyMidZ - perpZ * off, -a);
  addSlab(swGeos, sw, bwyLen, bwyMidX + perpX * off, bwyMidZ + perpZ * off, -a);

  // Cross street sidewalks.
  for (const s of CROSS_STREETS) {
    addSlab(swGeos, W + 20, sw, cx, s.z - s.half - sw / 2);
    addSlab(swGeos, W + 20, sw, cx, s.z + s.half + sw / 2);
  }

  // Bowtie plaza triangles (north = Father Duffy, south = One Times Sq island).
  addSlab(plazaGeos, 46, 60, -20, -178);
  addSlab(plazaGeos, 40, 52, 30, 178);
  // central pedestrian median between 7th & Broadway around 44th-45th
  addSlab(plazaGeos, 30, 120, 14, 0);

  const swMesh = new THREE.Mesh(mergeGeometries(swGeos), concMat);
  swMesh.receiveShadow = true; group.add(swMesh);
  const plazaMesh = new THREE.Mesh(mergeGeometries(plazaGeos), plazaMat);
  plazaMesh.receiveShadow = true; group.add(plazaMesh);

  // ---- Lane markings (merged white + yellow) ----
  const whiteGeos = [], yellowGeos = [];
  const mark = (arr, w, d, x, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, 0.02, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, 0.025, z);
    arr.push(g);
  };
  const nearCross = (z, pad = 0) => CROSS_STREETS.some(s => Math.abs(z - s.z) < s.half + pad);

  // 7th Ave: dashed lane dividers + solid edges.
  for (const lx of [-6.5, 0, 6.5]) {
    for (let z = WORLD.minZ + 4; z < WORLD.maxZ - 4; z += 7) {
      if (nearCross(z, 3)) continue;
      mark(whiteGeos, 0.18, 3.2, SEVENTH_AVE.x + lx, z);
    }
  }
  for (const ex of [-12.4, 12.4]) mark(whiteGeos, 0.2, len, SEVENTH_AVE.x + ex, cz);

  // Broadway: center dashed + edges (diagonal).
  const dirX = -Math.sin(a), dirZ = -Math.cos(a);
  for (let t = -bwyLen / 2 + 4; t < bwyLen / 2 - 4; t += 7) {
    const z = bwyMidZ + dirZ * t, x = bwyMidX + dirX * t;
    if (nearCross(z, 3)) continue;
    mark(whiteGeos, 0.18, 3.2, x, z, -a);
  }
  for (const side of [-1, 1]) {
    const ex = bwyMidX + perpX * (BROADWAY.half - 0.6) * side;
    const ez = bwyMidZ + perpZ * (BROADWAY.half - 0.6) * side;
    mark(whiteGeos, 0.2, bwyLen, ex, ez, -a);
  }

  // Cross streets: double yellow center + dashed lanes.
  for (const s of CROSS_STREETS) {
    mark(yellowGeos, W + 20, 0.16, cx, s.z - 0.3);
    mark(yellowGeos, W + 20, 0.16, cx, s.z + 0.3);
    for (const lz of [-4.5, 4.5]) {
      for (let x = WORLD.minX + 4; x < WORLD.maxX - 4; x += 7) {
        if (Math.abs(x - SEVENTH_AVE.x) < SEVENTH_AVE.half + 3) continue;
        if (Math.abs(x - BROADWAY.xAt(s.z)) * Math.cos(a) < BROADWAY.half + 3) continue;
        mark(whiteGeos, 3.2, 0.18, x, s.z + lz);
      }
    }
  }

  // Crosswalks (zebra) at every intersection approach.
  for (const it of INTERSECTIONS) {
    const rh = it.roadHalf;
    // stripes across the cross street (pedestrians crossing the avenue run E-W? no—)
    // Crosswalk over the avenue (7th/Broadway): stripes run along avenue dir, placed at street edges.
    for (const side of [-1, 1]) {
      const zz = it.z + side * (it.half + 1.2);
      const n = Math.floor((rh * 2) / 1.4);
      for (let i = 0; i < n; i++) {
        const xx = it.x - rh + 0.8 + i * 1.4;
        if (it.road === 'bwy') mark(whiteGeos, 0.7, 2.6, xx, zz, -a);
        else mark(whiteGeos, 0.7, 2.6, xx, zz);
      }
    }
    // Crosswalk over the cross street: stripes at avenue edges.
    for (const side of [-1, 1]) {
      const xx = it.x + side * (rh + 1.2);
      const n = Math.floor((it.half * 2) / 1.4);
      for (let i = 0; i < n; i++) {
        const zz = it.z - it.half + 0.8 + i * 1.4;
        if (it.road === 'bwy') mark(whiteGeos, 2.6, 0.7, xx, zz, -a);
        else mark(whiteGeos, 2.6, 0.7, xx, zz);
      }
    }
  }

  const whiteMat = new THREE.MeshStandardMaterial({ color: PAL.laneWhite, roughness: 0.7, emissive: 0x202018, emissiveIntensity: 0.15 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: PAL.laneYellow, roughness: 0.7, emissive: 0x201800, emissiveIntensity: 0.15 });
  const whiteMesh = new THREE.Mesh(mergeGeometries(whiteGeos), whiteMat);
  const yellowMesh = new THREE.Mesh(mergeGeometries(yellowGeos), yellowMat);
  whiteMesh.receiveShadow = yellowMesh.receiveShadow = true;
  group.add(whiteMesh, yellowMesh);

  scene.add(group);
  return { group, asphaltMat, concMat, plazaMat, whiteMat, yellowMat };
}