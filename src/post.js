import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const ssao = new SSAOPass(scene, camera, size.x, size.y);
  ssao.kernelRadius = 0.6;
  ssao.minDistance = 0.002;
  ssao.maxDistance = 0.12;
  ssao.enabled = false; // toggle with P; off by default for the 30fps target
  composer.addPass(ssao);

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.12, 0.5, 0.85);
  composer.addPass(bloom);

  const output = new OutputPass();
  composer.addPass(output);

  return {
    composer, bloom, ssao, renderPass,
    get ssaoEnabled() { return ssao.enabled; },
    toggleSSAO() {
      ssao.enabled = !ssao.enabled;
      renderPass.enabled = !ssao.enabled;
      return ssao.enabled;
    },
    setBloom(strength) { bloom.strength = strength; },
    resize(w, h) { composer.setSize(w, h); ssao.setSize(w, h); bloom.setSize(w, h); },
    render() { composer.render(); },
  };
}