// 눈: 카메라를 향한 작은 판 하나를 셰이더로 그린다 (뜬 눈 / > < 찡그림 / 감은 눈)
import * as THREE from 'three';

export const EYE_OPEN = 0, EYE_SQUINT_L = 1, EYE_SQUINT_R = 2, EYE_CLOSED = 3;

const vertexShader = `
attribute vec2 aLook; attribute float aMode;
varying vec2 vUv; varying vec2 vLook; varying float vMode;
void main() {
  vUv = uv; vLook = aLook; vMode = aMode;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const fragmentShader = `
varying vec2 vUv; varying vec2 vLook; varying float vMode;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec3 ink = vec3(0.05, 0.04, 0.08), white = vec3(0.8);
  if (vMode < 0.5) {
    float d = length(p);
    if (d > 1.0) discard;
    vec3 col = d > 0.8 ? ink : white;
    vec2 c = vLook * 0.36;
    if (length(p - c) < 0.46) col = ink;
    if (length(p - c - vec2(-0.16, 0.18)) < 0.12) col = white; // 눈동자 반짝임
    gl_FragColor = vec4(col, 1.0);
  } else if (vMode < 2.5) {
    vec2 q = vec2(vMode < 1.5 ? p.x : -p.x, p.y);
    float d = min(seg(q, vec2(-0.6, 0.55), vec2(0.45, 0.0)), seg(q, vec2(0.45, 0.0), vec2(-0.6, -0.55)));
    if (d > 0.17) discard;
    gl_FragColor = vec4(ink, 1.0);
  } else {
    if (abs(p.y) > 0.14 || abs(p.x) > 0.78) discard;
    gl_FragColor = vec4(ink, 1.0);
  }
}`;

export function createEyes(scene: THREE.Scene, camera: THREE.Camera, max: number) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const look = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
  const mode = new THREE.InstancedBufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aLook', look);
  geo.setAttribute('aMode', mode);
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({ vertexShader, fragmentShader, depthWrite: false, transparent: true }), max);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  scene.add(mesh);

  // 화면 기준 방향 (매 프레임 카메라에서 다시 계산)
  const right = new THREE.Vector3(), up = new THREE.Vector3(), toward = new THREE.Vector3();
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let n = 0;

  return {
    begin() {
      n = 0;
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      toward.set(0, 0, 1).applyQuaternion(camera.quaternion);
    },
    // 몸 중심 c, 반지름 r에 눈 두 개. (lx, ly): 화면에서 바라보는 방향, squint: 찡그림, closed: 감음
    pair(c: THREE.Vector3, r: number, size: number, lx: number, ly: number, squint: boolean, closed = false) {
      for (const side of [-1, 1]) {
        if (n >= max) return;
        p.copy(c).addScaledVector(toward, r * 0.95).addScaledVector(up, r * 0.18).addScaledVector(right, side * r * 0.4);
        s.setScalar(size);
        mesh.setMatrixAt(n, m.compose(p, camera.quaternion, s));
        look.setXY(n, lx, ly);
        mode.setX(n, closed ? EYE_CLOSED : squint ? (side < 0 ? EYE_SQUINT_L : EYE_SQUINT_R) : EYE_OPEN);
        n++;
      }
    },
    // 보스의 화난 눈썹 위치 (눈 위, 안쪽으로 내려간 사선)
    browPos(c: THREE.Vector3, r: number, side: number, out: THREE.Vector3) {
      return out.copy(c).addScaledVector(toward, r * 0.97).addScaledVector(up, r * 0.42).addScaledVector(right, side * r * 0.38);
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      look.needsUpdate = mode.needsUpdate = true;
    },
  };
}
