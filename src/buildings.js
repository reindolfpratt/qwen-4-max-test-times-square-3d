import * as THREE from 'three';
import { WORLD, HEROES, onRoad, rand, rr, ri, pick } from './config.js';
import { facadeTexture, mergeGeometries, box } from './utils.js';

// Shared facade material pool (merged per-variant => few draw calls for the whole city).
const VARIANTS = [
  { base: '#3a3f4a', glass: '#1c2733', lit: 0.34, cols: 8, rows: 18 },
  { base: '#4a4038', glass: '#241d16', lit: 0.30, cols: 7, rows: 16 },
  { base: '#2f3a44', glass: '#16222c', lit: 0.40, cols: 9, rows: 20 },
  { base: '#52483c', glass: '#2a231a', lit: 0.28, cols: 6, rows: 14 },
  { base: '#39424e', glass: '#1a2530', lit: 0.36, cols: 8, rows: 22 },
  { base: '#433a4a', glass: '#201a28', lit: 0.32, cols: 7, rows: 18 },
  { base: '#5a5248', glass: '#2c271f', lit: 0.26, cols: 6, rows: 12 },
  { base: '#2c333d', glass: '#141d26', lit: 0.42, cols: 10, rows: 24 },
];

export function buildBuildings(scene, colliders) {
  const group = new THREE.Group(); group.name = 'buildings';
  const anchors = []; // billboard slots
  const facadeMats = [];
  const variantGeos = VARIANTS.map(() => []);
  const roofGeos = [];

  const heroRects = Object.values(HEROES).map(h => ({
    minX: h.x - h.w / 2 - 3, maxX: h.x + h.w / 2 + 3,
    minZ: h.z - h.d / 2 - 3, maxZ: h.z + h.d / 2 + 3,
  }));
  const inHero = (x, z) => heroRects.some(r => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ);
  const inPlaza = (x, z) => (x > -45 && x < 55 && z > -200 && z < 200 && Math.abs(x) < 40);

  // ---- Procedural city fill ----
  const lot = 24;
  for (let gx = WORLD.minX + 12; gx < WORLD.maxX - 12; gx += lot) {
    for (let gz = WORLD.minZ + 12; gz < WORLD.maxZ - 12; gz += lot) {
      const x = gx + rr(-3, 3), z = gz + rr(-3, 3);
      const w = rr(15, 22), d = rr(15, 22);
      // reject if footprint touches a road, hero, or central plaza
      const corners = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x - w / 2, z + d / 2], [x + w / 2, z + d / 2], [x, z]];
      if (corners.some(([cx, cz]) => onRoad(cx, cz, 5) || inHero(cx, cz) || inPlaza(cx, cz))) continue;
      if (rand() < 0.12) continue; // vacant lots / variety
      // taller near the square
      const dist = Math.hypot(x, z);
      const hMax = dist < 120 ? 150 : dist < 200 ? 95 : 60;
      const h = rr(18, hMax);
      const vi = ri(0, VARIANTS.length - 1);
      const g = new THREE.BoxGeometry(w, h, d);
      // bake UV repeat so window density scales with size
      const sx = Math.max(w, d) / 24, sy = h / 48;
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
      g.translate(x, h / 2, z);
      variantGeos[vi].push(g);
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      // rooftop massing
      if (h > 40 && rand() < 0.6) {
        roofGeos.push(box(rr(3, 6), rr(2, 5), rr(3, 6), x + rr(-w / 4, w / 4), h + 1.5, z + rr(-d / 4, d / 4)));
      }
      // billboard anchor on the face toward the square (for nearby mid/high-rises)
      if (dist < 150 && h > 30 && rand() < 0.5) {
        const dirX = -x, dirZ = -z, dl = Math.hypot(dirX, dirZ) || 1;
        const nx = dirX / dl, nz = dirZ / dl;
        const faceW = Math.abs(nx) > Math.abs(nz) ? d : w;
        const off = (Math.abs(nx) > Math.abs(nz) ? w : d) / 2 + 0.4;
        anchors.push({
          x: x + nx * off, y: rr(14, Math.min(h - 8, 40)), z: z + nz * off,
          ry: Math.atan2(nx, nz), w: Math.min(faceW * 0.85, 18), h: rr(7, 12), kind: 'flat',
        });
      }
    }
  }

  // merge per variant
  VARIANTS.forEach((v, i) => {
    if (!variantGeos[i].length) return;
    const { map, emissive } = facadeTexture(v);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({
      map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0,
      roughness: 0.85, metalness: 0.15,
    });
    facadeMats.push(mat);
    const mesh = new THREE.Mesh(mergeGeometries(variantGeos[i]), mat);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  });
  if (roofGeos.length) {
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x2c2e34, roughness: 0.9 });
    const roof = new THREE.Mesh(mergeGeometries(roofGeos), roofMat);
    roof.castShadow = true; group.add(roof);
  }

  // ---- Heroes ----
  const heroMat = (color, rough = 0.7, metal = 0.3) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

  // One Times Square: slim slab + ball-drop pole.
  {
    const h = HEROES.oneTimesSquare;
    const { map, emissive } = facadeTexture({ base: '#2b2f38', glass: '#141c26', lit: 0.3, cols: 6, rows: 24 });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8, metalness: 0.2 });
    facadeMats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), mat);
    body.position.set(h.x, h.h / 2, h.z); body.castShadow = body.receiveShadow = true;
    group.add(body);
    colliders.push({ minX: h.x - h.w / 2, maxX: h.x + h.w / 2, minZ: h.z - h.d / 2, maxZ: h.z + h.d / 2 });
    // pole + ball
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 18, 8), heroMat(0x9aa0aa, 0.5, 0.7));
    pole.position.set(h.x, h.h + 9, h.z); group.add(pole);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 1.2, roughness: 0.3 }));
    ball.position.set(h.x, h.h + 19, h.z); group.add(ball);
    // wraparound stacked billboards (4 sides x 3 heights)
    const sides = [
      { nx: 0, nz: 1, fw: h.w, off: h.d / 2 }, { nx: 0, nz: -1, fw: h.w, off: h.d / 2 },
      { nx: 1, nz: 0, fw: h.d, off: h.w / 2 }, { nx: -1, nz: 0, fw: h.d, off: h.w / 2 },
    ];
    for (const s of sides) {
      for (const yy of [22, 48, 74]) {
        anchors.push({ x: h.x + s.nx * (s.off + 0.5), y: yy, z: h.z + s.nz * (s.off + 0.5), ry: Math.atan2(s.nx, s.nz), w: s.fw * 0.92, h: 20, kind: 'flat' });
      }
    }
  }

  // Nasdaq / 4 Times Square: tower + curved LED screen facing west.
  {
    const h = HEROES.nasdaq;
    const { map, emissive } = facadeTexture({ base: '#33404d', glass: '#16222e', lit: 0.4, cols: 9, rows: 26 });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7, metalness: 0.35 });
    facadeMats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), mat);
    body.position.set(h.x, h.h / 2, h.z); body.castShadow = body.receiveShadow = true;
    group.add(body);
    colliders.push({ minX: h.x - h.w / 2, maxX: h.x + h.w / 2, minZ: h.z - h.d / 2, maxZ: h.z + h.d / 2 });
    // curved screen on west face (cylinder segment), facing -X toward square
    anchors.push({ x: h.x - h.w / 2 - 0.6, y: 34, z: h.z, ry: -Math.PI / 2, w: h.d * 0.95, h: 40, kind: 'curved' });
    anchors.push({ x: h.x, y: 70, z: h.z - h.d / 2 - 0.5, ry: Math.PI, w: h.w * 0.9, h: 16, kind: 'flat' });
  }

  // One Astor Plaza (1515 Broadway): tall slab + base billboards facing east.
  {
    const h = HEROES.astor;
    const { map, emissive } = facadeTexture({ base: '#3d3a33', glass: '#1d1b15', lit: 0.32, cols: 10, rows: 30 });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.75, metalness: 0.25 });
    facadeMats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(h.w, h.h, h.d), mat);
    body.position.set(h.x, h.h / 2, h.z); body.castShadow = body.receiveShadow = true;
    group.add(body);
    colliders.push({ minX: h.x - h.w / 2, maxX: h.x + h.w / 2, minZ: h.z - h.d / 2, maxZ: h.z + h.d / 2 });
    for (const yy of [16, 38, 60]) {
      anchors.push({ x: h.x + h.w / 2 + 0.5, y: yy, z: h.z, ry: Math.PI / 2, w: h.d * 0.9, h: 18, kind: 'flat' });
    }
  }

  // Theater district marquees (mid-rise) along 44th-46th west + east side.
  const theaters = [
    { x: -70, z: -40, w: 26, d: 22, h: 34, name: 'BROADWAY THEATRE' },
    { x: -72, z: -120, w: 24, d: 22, h: 30, name: 'PALACE' },
    { x: 78, z: -40, w: 24, d: 22, h: 32, name: 'LYRIC' },
    { x: 80, z: 40, w: 26, d: 22, h: 36, name: 'APOLLO' },
    { x: -74, z: 40, w: 24, d: 22, h: 30, name: 'EMPIRE' },
  ];
  const marqueeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffb050, emissiveIntensity: 1.0, roughness: 0.6 });
  for (const t of theaters) {
    const { map, emissive } = facadeTexture({ base: '#4a3a2c', glass: '#241a12', lit: 0.3, cols: 6, rows: 8 });
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.85 });
    facadeMats.push(mat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.d), mat);
    body.position.set(t.x, t.h / 2, t.z); body.castShadow = body.receiveShadow = true;
    group.add(body);
    colliders.push({ minX: t.x - t.w / 2, maxX: t.x + t.w / 2, minZ: t.z - t.d / 2, maxZ: t.z + t.d / 2 });
    // marquee sign facing the square
    const nx = t.x < 0 ? 1 : -1;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5, t.d * 0.8), marqueeMat);
    sign.position.set(t.x + nx * (t.w / 2 + 0.6), 9, t.z); group.add(sign);
    anchors.push({ x: t.x + nx * (t.w / 2 + 1.3), y: 16, z: t.z, ry: nx > 0 ? Math.PI / 2 : -Math.PI / 2, w: t.d * 0.8, h: 7, kind: 'flat' });
  }

  scene.add(group);

  return {
    group, anchors, facadeMats, marqueeMat,
    update(dt, t) {
      const ei = t * 1.15;
      for (const m of facadeMats) m.emissiveIntensity = ei;
      marqueeMat.emissiveIntensity = 0.5 + t * 1.2;
    },
  };
}