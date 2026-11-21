// Global layout + tuning constants. 1 unit = 1 meter. Y up. North = -Z.
// Times Square bowtie: 7th Ave (N-S) crossed by Broadway (diagonal), 42nd-47th St (E-W).

export const WORLD = {
  minX: -165, maxX: 165,
  minZ: -240, maxZ: 240,
  eyeHeight: 1.7,
  playerRadius: 0.45,
  curbHeight: 0.16,
  sidewalkWidth: 7,
};

// Cross streets (E-W). z positions north->south. 42nd is the widest.
export const CROSS_STREETS = [
  { name: '47th St', z: -200, half: 8 },
  { name: '46th St', z: -120, half: 8 },
  { name: '45th St', z: -40, half: 8 },
  { name: '44th St', z: 40, half: 8 },
  { name: '43rd St', z: 120, half: 8 },
  { name: '42nd St', z: 200, half: 11 },
];

// 7th Avenue: straight N-S, one-way southbound (+Z).
export const SEVENTH_AVE = { x: 0, half: 13, dir: 1, name: '7th Ave' };

// Broadway: diagonal, crosses 7th at 45th St (z=-40), runs NW. One-way northbound (-Z).
export const BROADWAY = {
  angleDeg: 14,          // west of north
  crossZ: -40,           // z where centerline crosses x=0
  half: 10,
  dir: -1,
  name: 'Broadway',
  // centerline x at a given z:
  xAt(z) { return Math.tan(this.angleDeg * Math.PI / 180) * (z - this.crossZ); },
};

// Signal timing (seconds)
export const SIGNAL = { nsGreen: 13, nsYellow: 2.5, ewGreen: 9, ewYellow: 2.5, allRed: 1.0 };

export const QUALITY = {
  pixelRatioCap: 1.5,
  shadowMapSize: 2048,
  pedestrianCount: 260,
  vehicleCount: 34,
  billboardCount: 46,
};

// Palette
export const PAL = {
  asphalt: 0x23252b,
  asphaltNight: 0x15161c,
  sidewalk: 0x8d8f96,
  plaza: 0x9a9ca3,
  curb: 0xb9bbc2,
  laneWhite: 0xe8e8e2,
  laneYellow: 0xe8c33a,
  crosswalk: 0xdcdcD4,
  taxi: 0xf7c531,
  nypd: 0xf2f4f8,
  glass: 0x9fc4d8,
};

// Hero building specs (explicitly placed; bypass road rejection).
export const HEROES = {
  oneTimesSquare: { x: 30, z: 186, w: 24, d: 20, h: 108, name: 'One Times Square' },
  nasdaq:         { x: 56, z: 112, w: 30, d: 30, h: 128, name: 'Nasdaq / 4 Times Sq' },
  astor:          { x: -46, z: -6, w: 40, d: 34, h: 224, name: 'One Astor Plaza' },
  tkts:           { x: -19, z: -186, w: 26, d: 22, name: 'TKTS / Father Duffy Sq' },
};

// Deterministic PRNG so the city is identical every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(20261120);
export const rr = (a, b) => a + (b - a) * rand();
export const ri = (a, b) => Math.floor(rr(a, b + 1));
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Is a point inside any road roadway (optionally inflated by margin)?
export function onRoad(x, z, margin = 0) {
  // 7th Ave
  if (Math.abs(x - SEVENTH_AVE.x) < SEVENTH_AVE.half + margin &&
      z > WORLD.minZ && z < WORLD.maxZ) return true;
  // Broadway (distance from diagonal centerline, measured horizontally approx)
  const bx = BROADWAY.xAt(z);
  const cosA = Math.cos(BROADWAY.angleDeg * Math.PI / 180);
  if (Math.abs(x - bx) * cosA < BROADWAY.half + margin &&
      z > WORLD.minZ && z < WORLD.maxZ) return true;
  // Cross streets
  for (const s of CROSS_STREETS) {
    if (Math.abs(z - s.z) < s.half + margin && x > WORLD.minX && x < WORLD.maxX) return true;
  }
  return false;
}

// Sidewalk / plaza height at a point (curbs). Roads are 0, everything walkable raised.
export function groundHeight(x, z) {
  if (onRoad(x, z, 0)) return 0;
  return WORLD.curbHeight;
}