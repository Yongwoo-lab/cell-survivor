// 주인공 호중구: 3~4갈래로 나뉜 분엽핵, 맑은 막(안쪽 산란광 + 밝은 테두리), 흐르는 과립, 하이라이트가 있는 큰 눈과 눈꺼풀.
// 게임(meshes.ts), 타이틀(titleScene.ts), 카드 일러스트(cardArt.ts)가 같은 모델을 쓴다.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { glassy } from './materials';

const GFP = 0x7bd88f, DAPI = 0x6e9bff;

// 분엽핵: 휘어진 줄을 따라 놓인 덩어리 4개 + 사이를 잇는 가는 다리
export function lobedNucleusGeometry(r: number) {
  const lobes: [number, number, number, number][] = [
    [-0.34, 0.02, 0.14, 0.2], [-0.13, 0.06, -0.12, 0.23], [0.13, 0.0, -0.08, 0.22], [0.32, -0.03, 0.16, 0.18],
  ];
  const parts: THREE.BufferGeometry[] = [];
  const v = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  lobes.forEach(([x, y, z, s], k) => {
    const g = new THREE.IcosahedronGeometry(s * r, 3);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = 1 + 0.1 * Math.sin(v.x * 30 / r + k) * Math.sin(v.y * 24 / r + 1) * Math.sin(v.z * 27 / r + 2);
      pos.setXYZ(i, v.x * n * 1.05, v.y * n * 0.82, v.z * n);
    }
    parts.push(g.translate(x * r, y * r, z * r));
    if (k === 0) return;
    const [px, py, pz] = lobes[k - 1];
    const a = new THREE.Vector3(px, py, pz).multiplyScalar(r), b = new THREE.Vector3(x, y, z).multiplyScalar(r);
    const bridge = new THREE.CylinderGeometry(0.05 * r, 0.05 * r, a.distanceTo(b), 8);
    bridge.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, b.clone().sub(a).normalize()));
    parts.push(bridge.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2));
  });
  const g = mergeVertices(mergeGeometries(parts.map((p) => {
    const q = p.index ? p.toNonIndexed() : p;
    q.deleteAttribute('uv'); q.deleteAttribute('normal');
    return q;
  })));
  g.computeVertexNormals();
  return g;
}

// ── 큰 눈: 카메라를 향한 판 하나. 흰자·홍채·동공·하이라이트, 위 눈꺼풀, 찡그림(> <), 웃는 눈(^ ^)
export const HERO_OPEN = 0, HERO_SQUINT = 1, HERO_HAPPY = 2;
const eyeVert = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const eyeFrag = `
uniform vec2 uLook; uniform float uLid; uniform float uMode; uniform float uSide;
varying vec2 vUv;
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  vec3 ink = vec3(0.03, 0.04, 0.06);
  float aa = 0.05;
  if (uMode > 1.5) { // 웃는 눈: 위로 볼록한 호
    float d = abs(length(p - vec2(0.0, -0.55)) - 0.72);
    if (d > 0.15 || p.y < -0.35) discard;
    gl_FragColor = vec4(ink, 1.0 - smoothstep(0.15 - aa, 0.15, d));
    return;
  }
  if (uMode > 0.5) { // 찡그림: > <
    vec2 q = vec2(p.x * uSide, p.y);
    float d = min(seg(q, vec2(-0.55, 0.5), vec2(0.4, 0.0)), seg(q, vec2(0.4, 0.0), vec2(-0.55, -0.5)));
    if (d > 0.15) discard;
    gl_FragColor = vec4(ink, 1.0 - smoothstep(0.15 - aa, 0.15, d));
    return;
  }
  vec2 e = p / vec2(0.82, 1.0);
  float d = length(e);
  if (d > 1.0) discard;
  // 위 눈꺼풀: uLid 0 뜸 → 1 감음. 가장자리는 살짝 휜 선.
  float lidY = mix(1.05, -0.2, uLid) - 0.18 * p.x * p.x;
  if (p.y > lidY + 0.12) discard;
  vec3 col = vec3(0.93, 0.96, 0.95);
  vec2 c = uLook * 0.3;
  float pr = length(p - c);
  if (pr < 0.56) col = mix(vec3(0.16, 0.5, 0.36), vec3(0.3, 0.78, 0.55), smoothstep(0.56, 0.2, pr)); // 홍채
  if (pr < 0.32) col = ink;
  if (length(p - c - vec2(-0.17, 0.2)) < 0.15) col = vec3(1.0); // 큰 하이라이트
  if (length(p - c - vec2(0.16, -0.16)) < 0.07) col = vec3(1.0); // 작은 하이라이트
  if (d > 0.86) col = ink; // 테두리
  if (p.y > lidY - 0.04) col = ink; // 눈꺼풀 선
  gl_FragColor = vec4(col, 1.0 - smoothstep(1.0 - aa, 1.0, d));
}`;

export function createHeroEyes(size: number) {
  const geo = new THREE.PlaneGeometry(size, size);
  const meshes = [-1, 1].map((side) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: eyeVert, fragmentShader: eyeFrag, transparent: true, depthWrite: false,
      uniforms: { uLook: { value: new THREE.Vector2() }, uLid: { value: 0 }, uMode: { value: 0 }, uSide: { value: side } },
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 6;
    m.userData.side = side;
    return m;
  });
  const right = new THREE.Vector3(), up = new THREE.Vector3(), toward = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    meshes,
    set(lx: number, ly: number, lid: number, mode: number) {
      for (const m of meshes) {
        const u = (m.material as THREE.ShaderMaterial).uniforms;
        u.uLook.value.set(lx, ly); u.uLid.value = lid; u.uMode.value = mode;
      }
    },
    // 몸 중심(부모 좌표 기준 원점)에서 반지름 r 막 앞쪽에. shift: 보는 방향으로 눈이 살짝 쏠림
    place(camera: THREE.Camera, parent: THREE.Object3D, r: number, shiftX = 0, shiftY = 0) {
      camera.getWorldQuaternion(q);
      parent.updateWorldMatrix(true, false);
      const inv = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      right.set(1, 0, 0).applyQuaternion(q).applyQuaternion(inv);
      up.set(0, 1, 0).applyQuaternion(q).applyQuaternion(inv);
      toward.set(0, 0, 1).applyQuaternion(q).applyQuaternion(inv);
      for (const m of meshes) {
        m.position.copy(toward).multiplyScalar(r * 0.98)
          .addScaledVector(up, r * (0.16 + shiftY * 0.12)).addScaledVector(right, r * (m.userData.side * 0.34 + shiftX * 0.14));
        m.quaternion.copy(inv).multiply(q);
      }
    },
  };
}

// 과립: 막 안에서 천천히 흐르는 작은 알갱이들
function createGranules(r: number, n: number) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(r * 0.035, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(GFP).multiplyScalar(0.75), transparent: true, opacity: 0.85 }), n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const seeds = Array.from({ length: n }, () => ({
    rad: r * (0.45 + Math.random() * 0.42), th: Math.acos(2 * Math.random() - 1), ph: Math.random() * Math.PI * 2,
    sp: 0.15 + Math.random() * 0.35, wob: Math.random() * 6, s: 0.6 + Math.random() * 0.9,
  }));
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), qq = new THREE.Quaternion(), s = new THREE.Vector3();
  return {
    mesh,
    update(t: number) {
      seeds.forEach((g, i) => {
        p.setFromSphericalCoords(g.rad, g.th + Math.sin(t * 0.7 + g.wob) * 0.25, g.ph + t * g.sp);
        mesh.setMatrixAt(i, m.compose(p, qq, s.setScalar(g.s)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// 호중구 모델. group 안에 body(늘이기·눌리기용) → inner(내용물). eyes는 group에 붙는다.
export function createHero(r = 1, granuleCount = 34) {
  const group = new THREE.Group(), body = new THREE.Group(), inner = new THREE.Group();
  const nucleus = new THREE.Mesh(lobedNucleusGeometry(r), glassy({
    color: 0x1e2a78, opacity: 0.95, rim: 0xa8bcff, rimStrength: 0.9, rimPower: 1.6,
    emissive: DAPI, emissiveIntensity: 0.9, wobble: 0.02 * r, depthWrite: true,
  }));
  // 안쪽 산란광: 막 안쪽 면에 은은한 청록 (탁하지 않게 가산 혼합)
  const scatter = new THREE.Mesh(new THREE.SphereGeometry(r * 0.97, 48, 32), new THREE.MeshBasicMaterial({
    color: new THREE.Color(GFP).multiplyScalar(0.09), side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const membraneMat = glassy({ color: 0x041a0c, opacity: 0.05, rim: 0xc8ffd8, rimStrength: 1.35, rimPower: 3.2, wobble: 0.05 * r });
  const membrane = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), membraneMat);
  membrane.renderOrder = 1;
  scatter.renderOrder = 1;
  const granules = createGranules(r, granuleCount);
  inner.add(nucleus, granules.mesh, scatter, membrane);
  body.add(inner);
  group.add(body);
  const eyes = createHeroEyes(r * 0.44);
  group.add(...eyes.meshes);
  return { group, body, inner, nucleus, membrane, membraneMat, granules, eyes };
}
export type Hero = ReturnType<typeof createHero>;

// 그림자: 바닥에 깔린 부드러운 원
export function softShadow(radius: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!, grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.6)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: 0x000000 }));
  m.renderOrder = -2;
  return m;
}
