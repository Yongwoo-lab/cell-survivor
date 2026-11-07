import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { addBackground } from './background';

// 형광 현미경: 거의 검정. 막마다 "염색 채널"이 바뀐 듯 아주 옅은 색기만 다르다 (혈관 초록, 폐 파랑, 림프절 빨강)
const ACT_BG = [
  ['#050907', '#06070c'],
  ['#04060d', '#070912'],
  ['#0a0507', '#08060c'],
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

// 현미경 렌즈 (OutputPass 뒤, sRGB 공간): 둥근 비네팅, 가장자리 색수차, 옅은 먼지·얼룩, 미세한 입자감
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uAspect: { value: 16 / 9 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uAspect; uniform float uTime; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float blob(vec2 c, float r) { return smoothstep(r, r * 0.25, length((vUv - c) * vec2(uAspect, 1.0))); }
    float ring(vec2 c, float r, float w) { return smoothstep(w, 0.0, abs(length((vUv - c) * vec2(uAspect, 1.0)) - r)); }
    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(uAspect, 1.0)) / (0.5 * uAspect); // 0 가운데, 1 좌우 끝
      vec2 off = d * (0.001 + 0.005 * r * r); // 색수차는 가장자리에서만
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      // 렌즈 위 먼지·얼룩 (화면에 고정, 아주 옅게)
      float dust = blob(vec2(0.22, 0.71), 0.035) * 0.16 + blob(vec2(0.74, 0.28), 0.05) * 0.10 + blob(vec2(0.63, 0.82), 0.018) * 0.22
                 + blob(vec2(0.37, 0.18), 0.026) * 0.12 + ring(vec2(0.83, 0.62), 0.045, 0.006) * 0.08 + ring(vec2(0.15, 0.33), 0.03, 0.005) * 0.07;
      col *= 1.0 - dust;
      col *= smoothstep(1.28, 0.55, r); // 접안렌즈처럼 둥글게 어두워짐
      col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.018;
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
  // 형광 사진은 거의 스스로 빛나는 모습: 조명은 모양만 살짝 잡는다
  scene.add(new THREE.AmbientLight(0x8090a0, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 200);
  addBackground(scene, camera);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // 정말 밝은 부분(선형 휘도 > 0.85)만 번지게
  // 빛 번짐은 평소 거의 없음. 레벨업·진화·보스 처치 순간에만 setGlow로 강하게.
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.12, 0.35, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const lens = new ShaderPass(LensShader);
  composer.addPass(lens);
  const setAspect = () => { lens.uniforms.uAspect.value = innerWidth / innerHeight; };
  setAspect();
  addEventListener('resize', setAspect);
  scene.onAfterRender = () => { lens.uniforms.uTime.value = performance.now() / 1000; };

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // 레벨업 빛 퍼짐: g = 0(평상시) ~ 1(최대)
  const setGlow = (g: number) => {
    bloom.strength = 0.12 + g * 1.5;
    bloom.threshold = 0.93 - g * 0.7;
  };

  return { scene, camera, composer, setGlow, setAct: bg.setAct };
}
