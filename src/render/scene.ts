import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { addBackground } from './background';

// 막별 배경 (위 → 아래): 혈관 청록, 폐 푸른빛, 림프절 보라
const ACT_BG = [
  ['#04262a', '#1a0a2e'],
  ['#04203e', '#0c1236'],
  ['#1e0a3a', '#2c0822'],
].map((pair) => pair.map((c) => new THREE.Color(c)));
const ACT_FADE = 2; // 초

function createBackground() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const cur = ACT_BG[0].map((col) => col.clone()), from = cur.map((col) => col.clone());
  let act = 0, k = 1;
  const draw = () => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, `#${cur[0].getHexString()}`);
    grd.addColorStop(1, `#${cur[1].getHexString()}`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 2, 256);
    tex.needsUpdate = true;
  };
  draw();
  // 막이 바뀌면 2초에 걸쳐 부드럽게 바꾼다
  const setAct = (a: number, dt: number) => {
    if (a !== act) {
      act = a;
      k = 0;
      cur.forEach((col, i) => from[i].copy(col));
    }
    if (k >= 1) return;
    k = Math.min(1, k + dt / ACT_FADE);
    const e = k * k * (3 - 2 * k);
    cur.forEach((col, i) => col.lerpColors(from[i], ACT_BG[act][i], e));
    draw();
  };
  return { tex, setAct };
}

// 비네팅 + 아주 약한 색수차 (OutputPass 뒤, sRGB 공간)
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0.0025 }, uVignette: { value: 1.1 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uCA; uniform float uVignette; varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      vec2 off = d * uCA;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - smoothstep(0.35, 0.85, length(d) * uVignette);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const bg = createBackground();
  scene.background = bg.tex;
  scene.add(new THREE.AmbientLight(0x6f8fd0, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  addBackground(scene, camera);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // 정말 밝은 부분(선형 휘도 > 0.85)만 번지게
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.4, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(new ShaderPass(LensShader));

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // 레벨업 빛 퍼짐: g = 0(평상시) ~ 1(최대)
  const setGlow = (g: number) => {
    bloom.strength = 0.35 + g * 1.6;
    bloom.threshold = 0.85 - g * 0.65;
  };

  return { scene, camera, composer, setGlow, setAct: bg.setAct };
}
