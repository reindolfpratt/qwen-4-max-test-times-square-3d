import * as THREE from 'three';
import { WORLD } from './config.js';
import { canvas, canvasTexture, lerp, clamp } from './utils.js';

const DAY = {
  skyTop: new THREE.Color(0x4a90e2), skyBot: new THREE.Color(0xd8e8f6),
  fog: new THREE.Color(0xc6d8ea), fogNear: 140, fogFar: 680,
  sunColor: new THREE.Color(0xfff2d8), sunInt: 3.1,
  hemiSky: new THREE.Color(0xcfe2f6), hemiGround: new THREE.Color(0x8a8e96), hemiInt: 1.5,
  ambient: 0.6, exposure: 1.12, bloom: 0.1,
};
const NIGHT = {
  skyTop: new THREE.Color(0x04060f), skyBot: new THREE.Color(0x131c30),
  fog: new THREE.Color(0x0a0f1c), fogNear: 40, fogFar: 380,
  sunColor: new THREE.Color(0x8fa8d8), sunInt: 0.25,
  hemiSky: new THREE.Color(0x1a2440), hemiGround: new THREE.Color(0x0c0e14), hemiInt: 0.35,
  ambient: 0.12, exposure: 1.05, bloom: 0.9,
};

export function buildEnvironment(scene, renderer) {
  // Sky dome
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      topColor: { value: DAY.skyTop.clone() },
      botColor: { value: DAY.skyBot.clone() },
      offset: { value: 20 }, exponent: { value: 0.7 },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 topColor; uniform vec3 botColor; uniform float offset; uniform float exponent; varying vec3 vWorld;
      void main(){ float h=normalize(vWorld+vec3(0.0,offset,0.0)).y; float t=max(pow(max(h,0.0),exponent),0.0); gl_FragColor=vec4(mix(botColor,topColor,t),1.0);} `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Stars (night)
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.85 + 0.05);
    const r = 850;
    starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Lights
  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiInt);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, DAY.ambient);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sunInt);
  sun.position.set(120, 180, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 600;
  const s = 200;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);

  // Fog
  scene.fog = new THREE.Fog(DAY.fog.clone(), DAY.fogNear, DAY.fogFar);

  // Procedural environment map for PBR reflections (self-contained).
  const envCanvas = canvas(256, 128), eg = envCanvas.getContext('2d');
  const grad = eg.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#8fb4e0'); grad.addColorStop(0.5, '#d8e4f0');
  grad.addColorStop(0.55, '#5a5e66'); grad.addColorStop(1, '#2c2e34');
  eg.fillStyle = grad; eg.fillRect(0, 0, 256, 128);
  const envTex = canvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  envTex.dispose(); pmrem.dispose();

  // Day/night state
  const state = { t: 0, target: 0 }; // 0 day, 1 night
  const tmpA = new THREE.Color(), tmpB = new THREE.Color();

  function apply(t) {
    skyMat.uniforms.topColor.value.copy(tmpA.copy(DAY.skyTop).lerp(NIGHT.skyTop, t));
    skyMat.uniforms.botColor.value.copy(tmpB.copy(DAY.skyBot).lerp(NIGHT.skyBot, t));
    scene.fog.color.copy(tmpA.copy(DAY.fog).lerp(NIGHT.fog, t));
    scene.fog.near = lerp(DAY.fogNear, NIGHT.fogNear, t);
    scene.fog.far = lerp(DAY.fogFar, NIGHT.fogFar, t);
    sun.color.copy(tmpA.copy(DAY.sunColor).lerp(NIGHT.sunColor, t));
    sun.intensity = lerp(DAY.sunInt, NIGHT.sunInt, t);
    hemi.color.copy(tmpA.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, t));
    hemi.groundColor.copy(tmpB.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, t));
    hemi.intensity = lerp(DAY.hemiInt, NIGHT.hemiInt, t);
    ambient.intensity = lerp(DAY.ambient, NIGHT.ambient, t);
    starMat.opacity = clamp((t - 0.4) / 0.6, 0, 1) * 0.9;
    renderer.toneMappingExposure = lerp(DAY.exposure, NIGHT.exposure, t);
    // sun shadows only meaningful in day
    sun.castShadow = t < 0.6;
  }
  apply(0);

  return {
    sky, stars, sun, hemi, ambient,
    get night() { return state.target; },
    get t() { return state.t; },
    get bloomStrength() { return lerp(DAY.bloom, NIGHT.bloom, state.t); },
    toggle() { state.target = state.target > 0.5 ? 0 : 1; return state.target; },
    setNight(v) { state.target = v ? 1 : 0; },
    update(dt) {
      const prev = state.t;
      state.t = clamp(state.t + Math.sign(state.target - state.t) * dt / 1.6, 0, 1);
      if (Math.abs(state.t - state.target) < 0.001) state.t = state.target;
      if (state.t !== prev) apply(state.t);
    },
  };
}