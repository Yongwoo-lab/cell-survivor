import * as THREE from 'three';

const MAX = 3000;
const PER_BURST = 18;

// 처치 파티클: 터진 뒤 감속하며 작아짐
export function createParticles(scene: THREE.Scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.09, 0),
    new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    MAX,
  );
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, color);
  scene.add(mesh);

  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const life = new Float32Array(MAX), maxLife = new Float32Array(MAX), size = new Float32Array(MAX);
  let count = 0;

  const m = new THREE.Matrix4();
  return {
    burst(x: number, y: number, z: number, base: THREE.Color) {
      for (let n = 0; n < PER_BURST && count < MAX; n++, count++) {
        const i = count, a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
        px[i] = x; py[i] = y; pz[i] = z;
        vx[i] = Math.cos(a) * sp; vz[i] = Math.sin(a) * sp; vy[i] = 1 + Math.random() * 3;
        life[i] = maxLife[i] = 0.35 + Math.random() * 0.35;
        size[i] = 0.6 + Math.random() * 1.2;
        // 대부분 적 색, 일부는 흰 불꽃 (밝기 > 1 이라 bloom에 걸림)
        color.copy(n % 4 === 0 ? new THREE.Color(1, 1, 1) : base).multiplyScalar(2.2);
        mesh.setColorAt(i, color);
      }
    },
    update(dt: number) {
      const drag = Math.exp(-4 * dt);
      for (let i = count - 1; i >= 0; i--) {
        life[i] -= dt;
        if (life[i] <= 0) {
          // 마지막 원소를 끌어와 채움
          const l = --count;
          px[i] = px[l]; py[i] = py[l]; pz[i] = pz[l]; vx[i] = vx[l]; vy[i] = vy[l]; vz[i] = vz[l];
          life[i] = life[l]; maxLife[i] = maxLife[l]; size[i] = size[l];
          mesh.getColorAt(l, color); mesh.setColorAt(i, color);
          continue;
        }
        vx[i] *= drag; vy[i] = vy[i] * drag - 6 * dt; vz[i] *= drag;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      }
      for (let i = 0; i < count; i++) {
        const sc = size[i] * (life[i] / maxLife[i]);
        m.makeScale(sc, sc, sc).setPosition(px[i], py[i], pz[i]);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
