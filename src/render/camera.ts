import * as THREE from 'three';

const OFFSET = new THREE.Vector3(0, 18, 10); // 위에서 약간 기울어진 시점
const target = new THREE.Vector3();

export function followCamera(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, dt: number, snap = false) {
  target.copy(focus).add(OFFSET);
  camera.position.lerp(target, snap ? 1 : 1 - Math.exp(-5 * dt));
  camera.lookAt(camera.position.x - OFFSET.x, focus.y, camera.position.z - OFFSET.z);
}
