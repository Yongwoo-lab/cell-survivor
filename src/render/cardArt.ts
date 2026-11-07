// 레벨업 카드 일러스트: 카드마다 게임 속 모양을 작은 장면으로 만들어 천천히 돌린다.
// 작은 렌더러 하나로 그린 뒤 각 카드의 2D 캔버스에 복사한다. 장면은 카드 id별로 한 번만 만든다.
import * as THREE from 'three';
import { glassy } from './materials';
import { webTexture, clusterGeometry } from './meshes';

const W = 320, H = 200;
const GFP = 0x7bd88f, DAPI = 0x6e9bff, RHO = 0xff5a4e, GOLD = 0xe2b857, YEL = 0xe2b857, HEAT = 0xff5a4e;

type Art = THREE.Group & { tick?: (t: number) => void };

const mem = (color = GFP, r = 0.8, opacity = 0.18) => new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28),
  glassy({ color: 0x0b2a14, opacity, rim: color, rimStrength: 1.2, rimPower: 2.4, wobble: 0.04 }));
const nuc = (r = 0.32) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3),
  glassy({ color: 0x18266e, opacity: 0.95, rim: 0x8fa8ff, rimStrength: 0.8, emissive: DAPI, emissiveIntensity: 0.9, depthWrite: true }));
const basic = (color: number, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
const coccus = (s = 1) => {
  const m = new THREE.Mesh(clusterGeometry(4, 0.3 * s), glassy({ color: RHO, opacity: 0.8, rim: 0xffb09a, rimStrength: 0.8, emissive: RHO, emissiveIntensity: 0.5, depthWrite: true }));
  return m;
};
const cell = (color = GFP, r = 0.8) => { const g = new THREE.Group(); const m = mem(color, r); m.renderOrder = 1; g.add(nuc(r * 0.4), m); return g; };
function antibodyY(color = YEL, s = 1) {
  const g = new THREE.Group(), mat = basic(color, 0.95);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.32 * s, 8), mat);
  stem.position.y = -0.16 * s;
  g.add(stem);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.035 * s, 0.28 * s, 8), mat);
    arm.position.set(side * 0.08 * s, 0.11 * s, 0);
    arm.rotation.z = -side * 0.6;
    g.add(arm);
  }
  return g;
}
const ring = (r: number, color: number, tube = 0.025) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 48), basic(color, 0.9));

const BUILD: Record<string, () => Art> = {
  // 대식세포가 세균을 삼키는 중
  macrophage() {
    const g: Art = new THREE.Group();
    g.add(cell(GFP, 0.95));
    const prey = [0, 1, 2].map((k) => { const c = coccus(0.8); g.add(c); return c; });
    g.tick = (t) => prey.forEach((c, k) => {
      const a = t * 0.6 + k * 2.1, r = 1.25 - ((t * 0.15 + k / 3) % 1) * 0.7;
      c.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.3, Math.sin(a) * r);
    });
    return g;
  },
  // 호중구 그물에 걸린 구균
  net() {
    const g: Art = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48),
      new THREE.MeshBasicMaterial({ map: webTexture(), color: new THREE.Color(0x7bd88f).multiplyScalar(0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -1.1;
    g.add(disc);
    [[-0.4, 0.3], [0.5, -0.2], [0.1, 0.6], [-0.2, -0.5]].forEach(([x, z]) => { const c = coccus(0.8); c.position.set(x, 0.1 + z * 0.4, z * 0.45); g.add(c); });
    return g;
  },
  // 항체가 붙어 표식 고리가 생긴 세균
  antibody() {
    const g: Art = new THREE.Group();
    const c = coccus(1.3);
    const r = ring(0.62, YEL);
    r.rotation.x = Math.PI / 2;
    g.add(c, r);
    const ys = [0, 1, 2].map((k) => { const y = antibodyY(YEL, 1.4); g.add(y); return y; });
    g.tick = (t) => ys.forEach((y, k) => {
      const a = t * 0.8 + (k * Math.PI * 2) / 3;
      y.position.set(Math.cos(a) * 0.95, Math.sin(t * 1.5 + k) * 0.15, Math.sin(a) * 0.95);
      y.rotation.z = Math.PI / 2 + a;
    });
    return g;
  },
  // 보체: 표식 달린 세균이 터지며 퍼지는 충격파
  complement() {
    const g: Art = new THREE.Group();
    g.add(coccus(1.2));
    const waves = [0, 1, 2].map(() => { const w = ring(1, YEL, 0.02); w.rotation.x = Math.PI / 2; g.add(w); return w; });
    g.tick = (t) => waves.forEach((w, k) => {
      const p = (t * 0.7 + k / 3) % 1;
      w.scale.setScalar(0.3 + p * 1.1);
      (w.material as THREE.MeshBasicMaterial).color.setHex(YEL).multiplyScalar(1 - p);
    });
    return g;
  },
  // 사이토카인: 두 세포 사이를 오가는 신호 입자
  cytokine() {
    const g: Art = new THREE.Group();
    const a = cell(GFP, 0.55), b = cell(GFP, 0.55);
    a.position.x = -0.95; b.position.x = 0.95;
    g.add(a, b);
    const dots = Array.from({ length: 10 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), basic(YEL)); g.add(d); return d; });
    g.tick = (t) => dots.forEach((d, k) => {
      const p = (t * 0.5 + k / dots.length) % 1, dir = k % 2 ? 1 : -1;
      d.position.set(dir * (-0.6 + p * 1.2), Math.sin(p * Math.PI) * 0.45 * (k % 3 ? 1 : -1), Math.cos(k) * 0.2);
    });
    return g;
  },
  // NK세포: 과립을 품은 초록 세포
  nk() {
    const g: Art = new THREE.Group();
    g.add(cell(0xb0ffc8, 0.85));
    for (let k = 0; k < 7; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic(YEL, 0.9));
      s.position.setFromSphericalCoords(0.55, Math.acos(2 * ((k + 0.5) / 7) - 1), k * 2.4);
      g.add(s);
    }
    return g;
  },
  // 기억세포: 핵을 감싸는 기억의 궤도
  memory() {
    const g: Art = new THREE.Group();
    g.add(cell(GFP, 0.6));
    const r1 = ring(0.95, DAPI, 0.018), r2 = ring(1.1, GFP, 0.012);
    g.add(r1, r2);
    g.tick = (t) => { r1.rotation.set(1.1, t * 0.6, 0); r2.rotation.set(-0.7, 0, t * 0.4); };
    return g;
  },
  // 발열: 세포 주위로 피어오르는 열기
  fever() {
    const g: Art = new THREE.Group();
    g.add(cell(HEAT, 0.65));
    const heat = Array.from({ length: 16 }, () => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), basic(HEAT, 1)); g.add(d); return d; });
    g.tick = (t) => heat.forEach((d, k) => {
      const p = (t * 0.45 + k / heat.length) % 1;
      d.position.set(Math.cos(k * 2.3) * (0.75 + p * 0.2), -0.6 + p * 1.6, Math.sin(k * 2.3) * (0.75 + p * 0.2));
      d.scale.setScalar(1 - p);
    });
    return g;
  },
};
// 진화 카드: 재료 두 개가 합쳐진 모습
const combine = (a: string, b: string, gold = true): Art => {
  const g: Art = new THREE.Group(), x = BUILD[a](), y = BUILD[b]();
  y.scale.setScalar(0.85);
  g.add(x, y);
  if (gold) { const r = ring(1.35, GOLD, 0.015); r.rotation.x = Math.PI / 2; g.add(r); }
  g.tick = (t) => { x.tick?.(t); y.tick?.(t); };
  return g;
};
BUILD.classical = () => combine('antibody', 'complement');
BUILD.activatedMacrophage = () => combine('macrophage', 'cytokine');
BUILD.plasmaCell = () => combine('memory', 'antibody');

export function createCardArt() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x8090a0, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 50);
  camera.position.set(0, 1.3, 5);
  camera.lookAt(0, 0, 0);
  const cache = new Map<string, Art>();
  let slots: { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement; art: Art; angle: number }[] = [];
  let t = 0;

  return {
    show(canvases: HTMLCanvasElement[], ids: string[]) {
      slots = ids.map((id, i) => {
        if (!cache.has(id)) cache.set(id, (BUILD[id] ?? BUILD.nk)());
        return { ctx: canvases[i].getContext('2d')!, canvas: canvases[i], art: cache.get(id)!, angle: i * 1.3 };
      });
    },
    hide() { slots = []; },
    // focus: 선택 중인 카드는 일러스트가 빨리 돈다
    render(dt: number, focus: number) {
      if (!slots.length) return;
      t += dt;
      slots.forEach((s, i) => {
        s.angle += dt * (i === focus ? 2.6 : 0.5);
        s.art.rotation.y = s.angle;
        s.art.tick?.(t);
        scene.add(s.art);
        renderer.render(scene, camera);
        scene.remove(s.art);
        s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
        s.ctx.drawImage(renderer.domElement, 0, 0, s.canvas.width, s.canvas.height);
      });
    },
  };
}
