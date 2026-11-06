import * as THREE from 'three';
import { glassy } from './materials';

const RBC_COUNT = 18;
const DUST_COUNT = 700;
const HALF = 45; // 카메라 주변으로 반복(wrap)되는 영역의 절반 크기

// 가운데가 오목한 원반 (Evans–Fung 단면식을 반지름 1로 정규화)
function rbcGeometry() {
  const pts: THREE.Vector2[] = [];
  const N = 16;
  const h = (r: number) => Math.sqrt(Math.max(0, 1 - r * r)) * (0.207 + 2.003 * r * r - 1.123 * r ** 4) * 0.5;
  for (let i = 0; i <= N; i++) { const r = i / N; pts.push(new THREE.Vector2(r, h(r))); }
  for (let i = N - 1; i >= 0; i--) { const r = i / N; pts.push(new THREE.Vector2(r, -h(r))); }
  const g = new THREE.LatheGeometry(pts, 40);
  g.rotateX(Math.PI / 2); // 원반 면이 z축을 보게
  return g;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const wrap = (v: number, center: number) => center + ((((v - center + HALF) % (2 * HALF)) + 2 * HALF) % (2 * HALF)) - HALF;

export function addBackground(scene: THREE.Scene, camera: THREE.Camera) {
  const rbc = new THREE.InstancedMesh(rbcGeometry(), glassy({
    color: 0x7a1a2c, opacity: 0.4, rim: 0, rimStrength: 0, rimPower: 1.5, softEdge: true,
  }), RBC_COUNT);
  rbc.renderOrder = -1;
  rbc.frustumCulled = false;
  const rbcs = Array.from({ length: RBC_COUNT }, () => ({
    x: (Math.random() * 2 - 1) * HALF, z: (Math.random() * 2 - 1) * HALF,
    y: -14 - Math.random() * 14, size: 3 + Math.random() * 2,
    vx: 0.6 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.4,
    axis: new THREE.Vector3().randomDirection(), spin: (Math.random() - 0.5) * 0.3, phase: Math.random() * 6,
  }));

  const dustPos = new Float32Array(DUST_COUNT * 3);
  const dustBase = Array.from({ length: DUST_COUNT }, () => ({
    x: (Math.random() * 2 - 1) * HALF, z: (Math.random() * 2 - 1) * HALF, y: -12 + Math.random() * 15,
    vx: 0.2 + Math.random() * 0.4, ph: Math.random() * 6,
  }));
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3).setUsage(THREE.DynamicDrawUsage));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.18, map: dotTexture(), color: 0x9fd8e0, transparent: true, opacity: 0.35, depthWrite: false,
  }));
  dust.frustumCulled = false;
  scene.add(rbc, dust);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  scene.onBeforeRender = () => {
    const t = performance.now() / 1000;
    const cx = camera.position.x, cz = camera.position.z - 20; // 카메라가 내려다보는 지점 근처
    rbcs.forEach((r, i) => {
      p.set(wrap(r.x + r.vx * t, cx), r.y, wrap(r.z + r.vz * t, cz));
      q.setFromAxisAngle(r.axis, r.phase + t * r.spin);
      s.set(r.size, r.size, r.size);
      rbc.setMatrixAt(i, m.compose(p, q, s));
    });
    rbc.instanceMatrix.needsUpdate = true;
    dustBase.forEach((d, i) => {
      dustPos[i * 3] = wrap(d.x + d.vx * t, cx);
      dustPos[i * 3 + 1] = d.y + Math.sin(t * 0.5 + d.ph) * 0.4;
      dustPos[i * 3 + 2] = wrap(d.z + Math.sin(t * 0.3 + d.ph) * 2, cz);
    });
    dustGeo.attributes.position.needsUpdate = true;
  };
}
