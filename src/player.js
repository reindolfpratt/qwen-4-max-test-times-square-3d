import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WORLD, groundHeight } from './config.js';
import { clamp, damp } from './utils.js';

export function createPlayer(camera, dom, colliders) {
  const controls = new PointerLockControls(camera, dom);
  const orbit = new OrbitControls(camera, dom);
  orbit.enabled = false;
  orbit.enableDamping = true; orbit.dampingFactor = 0.08;
  orbit.target.set(0, 25, 0);
  orbit.maxPolarAngle = Math.PI * 0.49;
  orbit.minDistance = 20; orbit.maxDistance = 420;

  const keys = Object.create(null);
  const vel = new THREE.Vector3();
  const pos = new THREE.Vector3(8, WORLD.eyeHeight, 95);
  camera.position.copy(pos);
  camera.lookAt(8, WORLD.eyeHeight, 0);

  let vy = 0, jumpOffset = 0, onGround = true;
  let mode = 'fps'; // 'fps' | 'orbit'
  const WALK = 4.6, SPRINT = 8.6, ACCEL = 40, FRICTION = 10, GRAVITY = 26, JUMP_V = 8.2;

  const forward = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();

  function onKeyDown(e) {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) { keys[e.code] = false; }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function resolveCollisions(p) {
    const r = WORLD.playerRadius;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of colliders) {
        if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
        const cx = clamp(p.x, b.minX, b.maxX);
        const cz = clamp(p.z, b.minZ, b.maxZ);
        let dx = p.x - cx, dz = p.z - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-8) {
          // inside the box: push out along smallest penetration axis
          const pl = p.x - b.minX, pr = b.maxX - p.x, pt = p.z - b.minZ, pb = b.maxZ - p.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) p.x = b.minX - r; else if (m === pr) p.x = b.maxX + r;
          else if (m === pt) p.z = b.minZ - r; else p.z = b.maxZ + r;
        } else {
          const d = Math.sqrt(d2), push = (r - d) / d;
          p.x += dx * push; p.z += dz * push;
        }
      }
    }
    p.x = clamp(p.x, WORLD.minX + 2, WORLD.maxX - 2);
    p.z = clamp(p.z, WORLD.minZ + 2, WORLD.maxZ - 2);
  }

  function updateFPS(dt) {
    camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    wish.set(0, 0, 0);
    if (keys['KeyW'] || keys['ArrowUp']) wish.add(forward);
    if (keys['KeyS'] || keys['ArrowDown']) wish.sub(forward);
    if (keys['KeyD'] || keys['ArrowRight']) wish.add(right);
    if (keys['KeyA'] || keys['ArrowLeft']) wish.sub(right);
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = sprint ? SPRINT : WALK;
    if (wish.lengthSq() > 0) {
      wish.normalize().multiplyScalar(speed);
      vel.x = damp(vel.x, wish.x, ACCEL / speed, dt);
      vel.z = damp(vel.z, wish.z, ACCEL / speed, dt);
    } else {
      vel.x = damp(vel.x, 0, FRICTION, dt);
      vel.z = damp(vel.z, 0, FRICTION, dt);
    }
    pos.x += vel.x * dt; pos.z += vel.z * dt;
    resolveCollisions(pos);

    // jump / gravity
    if (keys['Space'] && onGround) { vy = JUMP_V; onGround = false; }
    if (!onGround) {
      vy -= GRAVITY * dt; jumpOffset += vy * dt;
      if (jumpOffset <= 0) { jumpOffset = 0; vy = 0; onGround = true; }
    }
    const gh = groundHeight(pos.x, pos.z);
    const targetY = gh + WORLD.eyeHeight + jumpOffset;
    pos.y = damp(pos.y, targetY, 18, dt);
    camera.position.copy(pos);
  }

  return {
    controls, orbit, colliders,
    get mode() { return mode; },
    get locked() { return controls.isLocked; },
    get position() { return pos; },
    get sprinting() { return !!(keys['ShiftLeft'] || keys['ShiftRight']); },
    lock() { if (mode === 'fps') controls.lock(); },
    unlock() { controls.unlock(); },
    onLock(cb) { controls.addEventListener('lock', () => cb(true)); controls.addEventListener('unlock', () => cb(false)); },
    toggleView() {
      if (mode === 'fps') {
        mode = 'orbit'; controls.unlock();
        orbit.enabled = true;
        camera.position.set(150, 120, 190);
        orbit.target.set(0, 25, 0); orbit.update();
      } else {
        mode = 'fps'; orbit.enabled = false;
        camera.position.copy(pos);
      }
      return mode;
    },
    update(dt) {
      if (mode === 'orbit') { orbit.update(); return; }
      if (controls.isLocked) updateFPS(dt);
      else { camera.position.copy(pos); }
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      controls.dispose(); orbit.dispose();
    },
  };
}