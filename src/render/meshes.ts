import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { World } from '../game/world';
import { glassy, time } from './materials';

// 게임 (x, y) → 화면 (x, z)
export function createPlayerMesh() {
  const group = new THREE.Group();

  // 살짝 울퉁불퉁한 핵
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
    color: 0x2a1a6e, opacity: 0.9, rim: 0x7a5cff, rimStrength: 0.6, rimPower: 2, depthWrite: true,
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

const VARIANTS = [3, 4, 5, 6];
let rot: { axis: THREE.Vector3; phase: number; spin: number; scale: number }[] = [];

export function createCocciMesh(count: number, radius: number) {
  const mat = glassy({
    color: 0xff7a2e, opacity: 0.55, rim: 0xffb36b, rimStrength: 0.7,
    emissive: 0x401200, emissiveIntensity: 0.6, depthWrite: true,
  });
  const group = new THREE.Group();
  for (const k of VARIANTS) {
    const mesh = new THREE.InstancedMesh(clusterGeometry(k, radius), mat, Math.ceil(count / VARIANTS.length));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  rot = Array.from({ length: count }, () => ({
    axis: new THREE.Vector3().randomDirection(),
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.2,
    scale: 0.8 + Math.random() * 0.45,
  }));
  return group;
}

const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
export function syncMeshes(w: World, player: THREE.Object3D, cocci: THREE.Group, t: number) {
  time.value = t;
  player.position.set(w.player.x, 1, w.player.y);
  const c = w.cocci;
  const meshes = cocci.children as THREE.InstancedMesh[];
  for (let i = 0; i < c.count; i++) {
    const r = rot[i];
    p.set(c.x[i], 0.4 + Math.sin(t * 2 + i) * 0.15, c.y[i]);
    q.setFromAxisAngle(r.axis, r.phase + t * r.spin);
    s.setScalar(r.scale);
    meshes[i % meshes.length].setMatrixAt(Math.floor(i / meshes.length), m.compose(p, q, s));
  }
  for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
}
