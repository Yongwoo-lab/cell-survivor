import * as THREE from 'three';

const OFFSET = new THREE.Vector3(0, 18, 10); // 위에서 약간 기울어진 시점
const LIFT = new THREE.Vector3(0, 70, 14); // 프롤로그: lift=1이면 이만큼 더 높은 곳에서 내려온다
const base = new THREE.Vector3(), target = new THREE.Vector3(), off = new THREE.Vector3();
let shakeAmt = 0, lift = 0, zoom = 0, zoomTarget = 0;
const lead = new THREE.Vector3(), leadTarget = new THREE.Vector3();

// 화면 흔들림: 큰 값이 우선, 시간이 지나며 잦아든다
export const shake = (amount: number) => { shakeAmt = Math.max(shakeAmt, amount); };
export const setLift = (k: number) => { lift = k; };
// 줌: 0이면 기본, +0.15면 15% 멀리, 음수면 가까이
export const setZoom = (k: number, instant = false) => { zoomTarget = k; if (instant) zoom = k; };
// 이동 방향으로 약간 앞을 본다 (게임 x, y)
export const setLead = (x: number, y: number) => { leadTarget.set(x, 0, y); };

export function followCamera(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, dt: number, snap = false) {
  zoom += (zoomTarget - zoom) * Math.min(1, dt * 3);
  lead.lerp(leadTarget, Math.min(1, dt * 2.5));
  off.copy(OFFSET).multiplyScalar(1 + zoom).addScaledVector(LIFT, lift);
  target.copy(focus).add(lead).add(off);
  base.lerp(target, snap ? 1 : 1 - Math.exp(-5 * dt));
  camera.position.copy(base);
  camera.lookAt(base.x - off.x, focus.y + lead.y, base.z - off.z);
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.5;
    camera.position.z += (Math.random() - 0.5) * shakeAmt;
    shakeAmt *= Math.exp(-7 * dt);
  }
}
