import * as THREE from 'three';

const OFFSET = new THREE.Vector3(0, 18, 10); // 위에서 약간 기울어진 시점
const LIFT = new THREE.Vector3(0, 70, 14); // 프롤로그: lift=1이면 이만큼 더 높은 곳에서 내려온다
const base = new THREE.Vector3(), target = new THREE.Vector3(), off = new THREE.Vector3();
let shakeAmt = 0, lift = 0;

// 화면 흔들림: 큰 값이 우선, 시간이 지나며 잦아든다
export const shake = (amount: number) => { shakeAmt = Math.max(shakeAmt, amount); };
export const setLift = (k: number) => { lift = k; };

export function followCamera(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, dt: number, snap = false) {
  off.copy(OFFSET).addScaledVector(LIFT, lift);
  target.copy(focus).add(off);
  base.lerp(target, snap ? 1 : 1 - Math.exp(-5 * dt));
  camera.position.copy(base);
  camera.lookAt(base.x - off.x, focus.y, base.z - off.z);
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
    camera.position.z += (Math.random() - 0.5) * shakeAmt;
    shakeAmt *= Math.exp(-7 * dt);
  }
}
