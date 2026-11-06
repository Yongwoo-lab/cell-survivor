import * as THREE from 'three';
import type { World } from '../game/world';

// 게임 (x, y) → 화면 (x, z)
export function createPlayerMesh() {
  const group = new THREE.Group();
  const membrane = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xbffcff, emissive: 0x2fd6d6, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false }),
  );
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9ffff5, emissiveIntensity: 1.5 }),
  );
  group.add(nucleus, membrane);
  return group;
}

export function createCocciMesh(count: number, radius: number) {
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a00, emissiveIntensity: 0.8 }),
    count,
  );
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

const m = new THREE.Matrix4();
export function syncMeshes(w: World, player: THREE.Object3D, cocci: THREE.InstancedMesh, t: number) {
  player.position.set(w.player.x, 1, w.player.y);
  const c = w.cocci;
  for (let i = 0; i < c.count; i++) {
    m.makeTranslation(c.x[i], 0.4 + Math.sin(t * 2 + i) * 0.15, c.y[i]);
    cocci.setMatrixAt(i, m);
  }
  cocci.instanceMatrix.needsUpdate = true;
}
