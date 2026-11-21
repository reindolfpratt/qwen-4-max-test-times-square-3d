import * as THREE from 'three';
import { WORLD, CROSS_STREETS, SEVENTH_AVE, BROADWAY, SIGNAL, QUALITY, rand, rr, pick } from './config.js';
import { mergeGeometries, box } from './utils.js';

const a = BROADWAY.angleDeg * Math.PI / 180;
const cosA = Math.cos(a), sinA = Math.sin(a);

// Build 1D lanes. Each: origin, dir, length, stopPoints[], group ('ns'|'ew'), cruise.
function makeLanes() {
  const lanes = [];
  const z0 = WORLD.minZ - 20, zLen = (WORLD.maxZ - WORLD.minZ) + 40;
  // 7th Ave southbound (+Z), 4 lanes
  for (const lx of [-9.5, -3.2, 3.2, 9.5]) {
    const stops = CROSS_STREETS.map(s => (s.z - s.half - 2.5) - z0);
    lanes.push({ origin: new THREE.Vector3(lx, 0, z0), dir: new THREE.Vector3(0, 0, 1), length: zLen, stops, group: 'ns', cruise: rr(9, 13) });
  }
  // Broadway northbound (-Z), 2 lanes
  const bOriginZ = WORLD.maxZ + 20;
  for (const side of [-3.6, 3.6]) {
    const ox = BROADWAY.xAt(bOriginZ) + cosA * side;
    const oz = bOriginZ + sinA * side;
    const stops = CROSS_STREETS.map(s => (bOriginZ - (s.z + s.half + 2.5)) / cosA);
    lanes.push({ origin: new THREE.Vector3(ox, 0, oz), dir: new THREE.Vector3(-sinA, 0, -cosA), length: zLen / cosA, stops, group: 'ns', cruise: rr(9, 12) });
  }
  // Cross streets, two directions
  const x0 = WORLD.minX - 20, xLen = (WORLD.maxX - WORLD.minX) + 40;
  for (const s of CROSS_STREETS) {
    const bx = BROADWAY.xAt(s.z);
    // eastbound (+X)
    lanes.push({
      origin: new THREE.Vector3(x0, 0, s.z + 3.6), dir: new THREE.Vector3(1, 0, 0), length: xLen,
      stops: [(-SEVENTH_AVE.half - 2.5) - x0, (bx - BROADWAY.half - 2.5) - x0], group: 'ew', cruise: rr(8, 11),
    });
    // westbound (-X)
    lanes.push({
      origin: new THREE.Vector3(WORLD.maxX + 20, 0, s.z - 3.6), dir: new THREE.Vector3(-1, 0, 0), length: xLen,
      stops: [(WORLD.maxX + 20) - (SEVENTH_AVE.half + 2.5), (WORLD.maxX + 20) - (bx + BROADWAY.half + 2.5)], group: 'ew', cruise: rr(8, 11),
    });
  }
  return lanes;
}

// Signal phase from elapsed time.
function phaseAt(time) {
  const { nsGreen, nsYellow, ewGreen, ewYellow, allRed } = SIGNAL;
  const cycle = nsGreen + nsYellow + allRed + ewGreen + ewYellow + allRed;
  const t = time % cycle;
  if (t < nsGreen) return 'nsGreen';
  if (t < nsGreen + nsYellow) return 'nsYellow';
  if (t < nsGreen + nsYellow + allRed) return 'allRed1';
  if (t < nsGreen + nsYellow + allRed + ewGreen) return 'ewGreen';
  if (t < nsGreen + nsYellow + allRed + ewGreen + ewYellow) return 'ewYellow';
  return 'allRed2';
}

export function buildTraffic(scene) {
  const group = new THREE.Group(); group.name = 'traffic';
  const lanes = makeLanes();

  // Vehicle prototypes (local geometry, +Z forward).
  const wheelGeo = (() => {
    const gs = [];
    for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
      const c = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
      c.rotateZ(Math.PI / 2); c.translate(wx, 0.42, wz); gs.push(c);
    }
    return mergeGeometries(gs);
  })();
  const bodyGeo = box(1.9, 1.0, 4.5, 0, 0.95, 0);
  const cabinGeo = box(1.7, 0.72, 2.3, 0, 1.75, -0.25);
  const headGeo = mergeGeometries([box(0.4, 0.22, 0.1, -0.6, 0.9, 2.26), box(0.4, 0.22, 0.1, 0.6, 0.9, 2.26)]);
  const tailGeo = mergeGeometries([box(0.4, 0.22, 0.1, -0.6, 0.9, -2.26), box(0.4, 0.22, 0.1, 0.6, 0.9, -2.26)]);

  const types = {
    taxi: { count: 16, color: 0xf7c531 },
    car: { count: 14, color: 0xffffff },
    nypd: { count: 4, color: 0xf2f4f8 },
  };
  const carColors = [0x3a4a5a, 0x6a6f78, 0x2c2e34, 0x8a3a3a, 0x3a5a4a, 0xb8bcc4, 0x24304a];

  const meshes = {};
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xfff0c0, emissiveIntensity: 0.3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x141c26, roughness: 0.2, metalness: 0.6 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.9 });

  for (const [name, cfg] of Object.entries(types)) {
    const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.InstancedMesh(bodyGeo, bodyMat, cfg.count);
    const cabin = new THREE.InstancedMesh(cabinGeo, glassMat, cfg.count);
    const wheels = new THREE.InstancedMesh(wheelGeo, wheelMat, cfg.count);
    const head = new THREE.InstancedMesh(headGeo, headMat, cfg.count);
    const tail = new THREE.InstancedMesh(tailGeo, tailMat, cfg.count);
    body.castShadow = true;
    if (name === 'car') for (let i = 0; i < cfg.count; i++) body.setColorAt(i, new THREE.Color(pick(carColors)));
    if (name === 'nypd') for (let i = 0; i < cfg.count; i++) body.setColorAt(i, new THREE.Color(i % 2 ? 0x1a3a6a : 0xf2f4f8));
    body.instanceColor && (body.instanceColor.needsUpdate = true);
    group.add(body, cabin, wheels, head, tail);
    meshes[name] = { body, cabin, wheels, head, tail };
  }

  // Spawn vehicles spread evenly along every lane (multiple per lane).
  const vehicles = [];
  const typeCounters = { taxi: 0, car: 0, nypd: 0 };
  const typeNames = Object.keys(types);
  const total = QUALITY.vehicleCount;
  const perLane = Math.max(1, Math.round(total / lanes.length));
  let spawned = 0;
  for (let li = 0; li < lanes.length && spawned < total; li++) {
    const lane = lanes[li];
    const k = Math.min(perLane, total - spawned);
    for (let j = 0; j < k; j++) {
      let name = spawned < 16 ? 'taxi' : (spawned < 30 ? 'car' : 'nypd');
      if (typeCounters[name] >= types[name].count) name = typeNames.find(n => typeCounters[n] < types[n].count);
      if (!name) break;
      const idx = typeCounters[name]++;
      const s = (lane.length * (j + 0.5) / k + rr(-6, 6) + lane.length) % lane.length;
      vehicles.push({ lane, s, name, idx, speed: lane.cruise });
      spawned++;
    }
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const posV = new THREE.Vector3(), scaleV = new THREE.Vector3(1, 1, 1);
  let elapsed = 0;

  function update(dt, t) {
    elapsed += dt;
    const phase = phaseAt(elapsed);
    const nsGo = phase === 'nsGreen';
    const ewGo = phase === 'ewGreen';

    // group vehicles by lane for following logic
    const byLane = new Map();
    for (const v of vehicles) {
      if (!byLane.has(v.lane)) byLane.set(v.lane, []);
      byLane.get(v.lane).push(v);
    }
    for (const [lane, cars] of byLane) {
      const go = lane.group === 'ns' ? nsGo : ewGo;
      cars.sort((p, q) => q.s - p.s); // front first
      let aheadS = Infinity;
      for (const v of cars) {
        let limit = aheadS - 6.5; // gap to car ahead
        if (!go) {
          // next stop line ahead within braking range
          for (const sp of lane.stops) {
            if (sp >= v.s - 0.5 && sp < v.s + 45) { limit = Math.min(limit, sp - 1.0); break; }
          }
        }
        let ns = v.s + v.speed * dt;
        if (limit > v.s) ns = Math.min(ns, limit);
        // if already committed into intersection, keep clearing
        v.s = ns;
        if (v.s > lane.length) v.s -= lane.length;
        aheadS = v.s;
      }
    }

    // write instance matrices
    for (const v of vehicles) {
      const L = v.lane;
      posV.copy(L.origin).addScaledVector(L.dir, v.s);
      const ry = Math.atan2(L.dir.x, L.dir.z);
      q.setFromAxisAngle(up, ry);
      m4.compose(posV, q, scaleV);
      const M = meshes[v.name];
      M.body.setMatrixAt(v.idx, m4);
      M.cabin.setMatrixAt(v.idx, m4);
      M.wheels.setMatrixAt(v.idx, m4);
      M.head.setMatrixAt(v.idx, m4);
      M.tail.setMatrixAt(v.idx, m4);
    }
    for (const M of Object.values(meshes)) {
      M.body.instanceMatrix.needsUpdate = true;
      M.cabin.instanceMatrix.needsUpdate = true;
      M.wheels.instanceMatrix.needsUpdate = true;
      M.head.instanceMatrix.needsUpdate = true;
      M.tail.instanceMatrix.needsUpdate = true;
    }
    headMat.emissiveIntensity = 0.3 + t * 2.6;
    tailMat.emissiveIntensity = 0.4 + t * 1.6;
  }

  scene.add(group);
  return { group, update, get phase() { return phaseAt(elapsed); } };
}