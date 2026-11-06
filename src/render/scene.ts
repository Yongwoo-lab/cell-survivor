import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03181c);
  scene.fog = new THREE.Fog(0x03181c, 20, 55);
  scene.add(new THREE.AmbientLight(0x88aaff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.1, 0.6, 0.15));
  composer.addPass(new OutputPass());

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  return { scene, camera, composer };
}
