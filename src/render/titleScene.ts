// 타이틀 3D 장면: 화면 오른쪽을 채우는 백혈구 클로즈업. 막은 숨 쉬듯 꿀렁이고 핵은 심장 박동에 맞춰 뛴다.
// 멀리서 구균이 다가왔다 사라지고, 8~12초마다 어둠 속에서 보스의 빨간 눈이 번쩍인다.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { glassy, time } from './materials';
import { clusterGeometry } from './meshes';

const GFP = 0x7bd88f, DAPI = 0x6e9bff, RED = 0xff5a4e;
const CAM = new THREE.Vector3(0, 0.3, 10);

export function createTitleScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090c);
  scene.add(new THREE.AmbientLight(0x8090a0, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);

  // 거대한 백혈구 (오른쪽)
  const cell = new THREE.Group();
  cell.position.set(3.4, -0.2, 0);
  const membrane = new THREE.Mesh(new THREE.SphereGeometry(3.3, 96, 72),
    glassy({ color: 0x06200f, opacity: 0.1, rim: GFP, rimStrength: 1.0, rimPower: 2.4, wobble: 0.16 }));
  membrane.renderOrder = 1;
  const ng = mergeVertices(new THREE.IcosahedronGeometry(1.35, 5));
  const pos = ng.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const k = 1 + 0.1 * Math.sin(v.x * 3) * Math.sin(v.y * 2.4 + 1) * Math.sin(v.z * 2.8 + 2);
    pos.setXYZ(i, v.x * k * 1.1, v.y * k * 0.9, v.z * k);
  }
  ng.computeVertexNormals();
  const nucleus = new THREE.Mesh(ng, glassy({ color: 0x18266e, opacity: 0.95, rim: 0x9db6ff, rimStrength: 0.7, rimPower: 1.8, emissive: DAPI, emissiveIntensity: 0.55, depthWrite: true }));
  nucleus.position.set(-0.3, 0.1, 0.2);
  // 세포질 과립
  const granMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GFP).multiplyScalar(0.55) });
  for (let i = 0; i < 40; i++) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 8, 6), granMat);
    g.position.setFromSphericalCoords(1.7 + Math.random() * 1.3, Math.acos(2 * Math.random() - 1), Math.random() * Math.PI * 2);
    cell.add(g);
  }
  cell.add(nucleus, membrane);
  scene.add(cell);

  // 멀리서 다가왔다 사라지는 구균 (피사계 심도로 흐릿)
  const cocMat = glassy({ color: 0xffffff, opacity: 0.7, rim: RED, rimStrength: 0.7, emissive: RED, emissiveIntensity: 0.45, depthWrite: true });
  const cocci = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(clusterGeometry(4, 0.45), cocMat);
    scene.add(m);
    // 오른쪽 절반에서만 (왼쪽 로고·메뉴 영역에는 들어오지 않게)
    return { m, t: i / 6, x: 1.5 + Math.random() * 6, y: -3 + Math.random() * 6, spin: Math.random() * 2 };
  });

  // 어둠 속 보스의 눈
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(RED).multiplyScalar(1.6), transparent: true, opacity: 0 });
  const eyes = new THREE.Group();
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8), eyeMat);
    e.scale.set(1.4, 0.45, 1);
    e.rotation.z = side * 0.25;
    e.position.x = side * 0.55;
    eyes.add(e);
  }
  eyes.position.set(-4.5, 2.2, -38);
  scene.add(eyes);

  let beat = 0, nextGlare = 4 + Math.random() * 3, glare = -1, dive = 0, t = 0;
  let onGlare: () => void = () => {};

  return {
    scene,
    camera,
    onGlare(fn: () => void) { onGlare = fn; },
    beat() { beat = 1; },
    // 시작: 카메라가 백혈구 쪽으로 빠르게 다가간다
    dive() { dive = 0.0001; },
    reset() { dive = 0; },
    resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); },
    update(dt: number) {
      t += dt;
      time.value = t;
      // 숨 쉬는 카메라
      const k = dive > 0 ? Math.min(1, (dive += dt / 0.65)) : 0, e = k * k * (3 - 2 * k);
      camera.position.set(CAM.x + Math.sin(t * 0.21) * 0.25 + e * 2.6, CAM.y + Math.sin(t * 0.33) * 0.15, CAM.z - e * 6.2);
      camera.lookAt(e * 3.2, 0, 0);
      // 막은 천천히 숨 쉬고, 핵은 박동
      const breath = 1 + Math.sin(t * 0.9) * 0.015;
      membrane.scale.setScalar(breath);
      beat = Math.max(0, beat - dt * 5);
      nucleus.scale.setScalar(1 + beat * 0.08);
      cell.rotation.y = t * 0.05;
      cocci.forEach((c) => {
        c.t = (c.t + dt / 14) % 1;
        const z = -32 + c.t * 26;
        c.m.position.set(c.x, c.y, z);
        c.m.rotation.set(t * 0.3 + c.spin, t * 0.2, 0);
        c.m.scale.setScalar(c.t < 0.1 ? c.t / 0.1 : c.t > 0.85 ? (1 - c.t) / 0.15 : 1);
      });
      // 8~12초마다 0.5초 번쩍 (깜빡임 두 번)
      if ((nextGlare -= dt) <= 0) { nextGlare = 8 + Math.random() * 4; glare = 0; onGlare(); }
      if (glare >= 0) {
        glare += dt;
        eyeMat.opacity = glare > 0.5 ? 0 : glare < 0.08 || (glare > 0.18 && glare < 0.5) ? 1 : 0.2;
        if (glare > 0.5) glare = -1;
      }
    },
  };
}
