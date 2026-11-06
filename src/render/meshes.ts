import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import balance from '../data/balance.json';
import { COCCUS, MAX_ENEMIES, type World } from '../game/world';
import { glassy, time } from './materials';
import { createParticles } from './effects';

// 게임 (x, y) → 화면 (x, z)
function createPlayerMesh() {
  const group = new THREE.Group();

  // 살짝 울퉁불퉁한 핵: 안쪽에서 은은하게 빛남
  const ng = mergeVertices(new THREE.IcosahedronGeometry(0.45, 4));
  const pos = ng.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + 0.12 * Math.sin(v.x * 9) * Math.sin(v.y * 7 + 1) * Math.sin(v.z * 8 + 2);
    pos.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
  }
  ng.computeVertexNormals();
  const nucleus = new THREE.Mesh(ng, glassy({
    color: 0x2a1a6e, opacity: 0.9, rim: 0xb09cff, rimStrength: 2.2, rimPower: 1.8,
    emissive: 0x3a24a0, emissiveIntensity: 0.6, depthWrite: true,
  }));

  const membrane = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), glassy({
    color: 0x0f3a40, opacity: 0.12, rim: 0x3ff2e6, rimStrength: 1.4, rimPower: 2.8, wobble: 0.06,
  }));
  membrane.renderOrder = 1;
  group.add(nucleus, membrane);
  return group;
}

// 포도송이: 작은 구 k개를 뭉친 지오메트리
function clusterGeometry(k: number, r: number) {
  const parts: THREE.BufferGeometry[] = [];
  const sr = r * 0.55;
  for (let i = 0; i < k; i++) {
    const g = new THREE.SphereGeometry(sr * (0.85 + Math.random() * 0.3), 12, 10);
    if (i > 0) {
      const d = new THREE.Vector3().randomDirection().multiplyScalar(sr * 1.05);
      g.translate(d.x, d.y, d.z);
    }
    parts.push(g);
  }
  return mergeGeometries(parts);
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, cap: number, color?: THREE.Color) {
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  if (color) for (let i = 0; i < cap; i++) mesh.setColorAt(i, color);
  return mesh;
}

const VARIANTS = [3, 4, 5, 6];
const LOOKS = 256; // 개체별 회전·크기는 id로 이 표에서 고른다 (swap 삭제에도 모습 유지)

export function createView(scene: THREE.Scene) {
  const player = createPlayerMesh();
  scene.add(player);

  // 적: 재질은 흰색, 실제 색은 인스턴스 색 (번쩍임 = 밝은 흰색으로 교체)
  const enemyColor = new THREE.Color(COCCUS.color);
  const flashColor = new THREE.Color(4, 4, 4);
  const enemyMat = glassy({
    color: 0xffffff, opacity: 0.55, rim: 0xffb36b, rimStrength: 0.7,
    emissive: 0x401200, emissiveIntensity: 0.6, depthWrite: true,
  });
  const enemyMeshes = VARIANTS.map((k) => instanced(clusterGeometry(k, COCCUS.radius), enemyMat, MAX_ENEMIES, enemyColor));
  scene.add(...enemyMeshes);
  const looks = Array.from({ length: LOOKS }, () => ({
    axis: new THREE.Vector3().randomDirection(),
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.2,
    scale: 0.8 + Math.random() * 0.45,
  }));

  const shotMesh = instanced(
    new THREE.SphereGeometry(balance.shot.radius, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ffcff).multiplyScalar(2.5) }),
    256,
  );
  const gemMesh = instanced(
    new THREE.OctahedronGeometry(0.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd36b).multiplyScalar(1.4) }),
    2048,
  );
  scene.add(shotMesh, gemMesh);
  const particles = createParticles(scene);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const counts = VARIANTS.map(() => 0);

  return {
    player,
    sync(w: World, dt: number, t: number) {
      time.value = t;
      player.position.set(w.player.x, 1, w.player.y);
      // 무적 시간 동안 깜빡임
      player.visible = w.player.invuln <= 0 || Math.floor(t * 20) % 2 === 0;

      const e = w.enemies.f;
      counts.fill(0);
      for (let i = 0; i < w.enemies.count; i++) {
        const id = e.id[i], v = id % VARIANTS.length, j = counts[v]++;
        const look = looks[id % LOOKS];
        p.set(e.x[i], 0.4 + Math.sin(t * 2 + id) * 0.15, e.y[i]);
        q.setFromAxisAngle(look.axis, look.phase + t * look.spin);
        s.setScalar(look.scale);
        enemyMeshes[v].setMatrixAt(j, m.compose(p, q, s));
        enemyMeshes[v].setColorAt(j, e.flash[i] > 0 ? flashColor : enemyColor);
      }
      enemyMeshes.forEach((mesh, v) => {
        mesh.count = counts[v];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
      });

      // 투사체: 날아가는 방향으로 길쭉하게
      const sh = w.shots.f;
      for (let k = 0; k < w.shots.count; k++) {
        p.set(sh.x[k], 0.8, sh.y[k]);
        q.setFromAxisAngle(UP, -Math.atan2(sh.vy[k], sh.vx[k]));
        s.set(2.2, 1, 1);
        shotMesh.setMatrixAt(k, m.compose(p, q, s));
      }
      shotMesh.count = w.shots.count;
      shotMesh.instanceMatrix.needsUpdate = true;

      const g = w.gems.f;
      for (let k = 0; k < w.gems.count; k++) {
        p.set(g.x[k], 0.35 + Math.sin(t * 3 + k) * 0.08, g.y[k]);
        q.setFromAxisAngle(UP, t * 2 + k);
        s.setScalar(1);
        gemMesh.setMatrixAt(k, m.compose(p, q, s));
      }
      gemMesh.count = w.gems.count;
      gemMesh.instanceMatrix.needsUpdate = true;

      for (const d of w.deaths) particles.burst(d.x, 0.4, d.y, enemyColor);
      particles.update(dt);
    },
  };
}
