import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import balance from '../data/balance.json';
import cards from '../data/cards.json';
import { ENEMIES, MAX_ENEMIES, type World } from '../game/world';
import { glassy, time } from './materials';
import { createParticles, createShockwaves } from './effects';

const COCCUS = ENEMIES.find((e) => e.id === 'coccus')!;
const T = balance.cardTuning;

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

// 그물 무늬: 방사선 + 동심원 (캔버스로 생성)
function webTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.lineWidth = 2;
  g.translate(128, 128);
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + Math.random() * 0.15;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 126, Math.sin(a) * 126); g.stroke();
  }
  for (let r = 22; r < 128; r += 20) {
    g.beginPath();
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2, rr = r + Math.sin(k * 3 + r) * 3;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.stroke();
  }
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(-128, -128, 256, 256);
  return new THREE.CanvasTexture(c);
}

const VARIANTS = [3, 4, 5, 6];
const LOOKS = 256; // 개체별 회전·크기는 id로 이 표에서 고른다 (swap 삭제에도 모습 유지)

export function createView(scene: THREE.Scene) {
  const player = createPlayerMesh();
  scene.add(player);

  // 적: 재질은 흰색, 실제 색은 인스턴스 색 (번쩍임 = 밝은 흰색으로 교체)
  const kindColors = ENEMIES.map((d) => new THREE.Color(d.color));
  const enemyColor = kindColors[0];
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

  const shotGeo = new THREE.SphereGeometry(balance.shot.radius, 12, 8);
  const shotMesh = instanced(shotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x9ffcff).multiplyScalar(2.5) }), 512);
  const abShotMesh = instanced(shotGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(2.2) }), 512);

  // 항체 표식: 표식 달린 적 위의 고리
  const markMesh = instanced(
    new THREE.TorusGeometry(COCCUS.radius * 1.9, 0.035, 6, 32).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(1.6), transparent: true, opacity: 0.9 }),
    MAX_ENEMIES,
  );

  // 대식세포·NK세포: 아군 세포 (청록·흰색)
  const macroMax = Math.max(...cards.find((c) => c.id === 'macrophage')!.levels.map((l) => (l as { count: number }).count));
  const macroMesh = instanced(new THREE.SphereGeometry(T.orbiterRadius, 32, 20), glassy({
    color: 0x1a5a5a, opacity: 0.35, rim: 0x9ffff0, rimStrength: 1.3, emissive: 0x0a3a3a, depthWrite: true,
  }), macroMax);
  const nkMesh = instanced(new THREE.IcosahedronGeometry(T.nkRadius, 2), glassy({
    color: 0xe8ffff, opacity: 0.6, rim: 0xffffff, rimStrength: 1.6, emissive: 0x4fd8e0, emissiveIntensity: 0.8, depthWrite: true,
  }), 8);

  // 호중구 NET: 바닥에 깔린 그물 원판 (가산 혼합, 색으로 서서히 사라짐)
  const netMesh = instanced(
    new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: webTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    16, new THREE.Color(0),
  );
  const gemMesh = instanced(
    new THREE.OctahedronGeometry(0.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd36b).multiplyScalar(1.4) }),
    2048,
  );
  scene.add(shotMesh, abShotMesh, gemMesh, markMesh, macroMesh, nkMesh, netMesh);
  const particles = createParticles(scene);
  const shocks = createShockwaves(scene);
  const netColor = new THREE.Color(0xbffcff), tmpColor = new THREE.Color();

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
      let marks = 0;
      for (let i = 0; i < w.enemies.count; i++) {
        const id = e.id[i], v = id % VARIANTS.length, j = counts[v]++;
        const look = looks[id % LOOKS];
        p.set(e.x[i], 0.4 + Math.sin(t * 2 + id) * 0.15, e.y[i]);
        q.setFromAxisAngle(look.axis, look.phase + t * look.spin);
        s.setScalar(look.scale);
        enemyMeshes[v].setMatrixAt(j, m.compose(p, q, s));
        enemyMeshes[v].setColorAt(j, e.flash[i] > 0 ? flashColor : kindColors[e.kind[i]]);
        if (e.mark[i] > 0) {
          q.setFromAxisAngle(UP, t * 3 + id);
          s.setScalar(1 + Math.sin(t * 10) * 0.08);
          markMesh.setMatrixAt(marks++, m.compose(p, q, s));
        }
      }
      markMesh.count = marks;
      markMesh.instanceMatrix.needsUpdate = true;
      enemyMeshes.forEach((mesh, v) => {
        mesh.count = counts[v];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
      });

      // 투사체: 날아가는 방향으로 길쭉하게
      const sh = w.shots.f, shotCounts = [0, 0], shotMeshes = [shotMesh, abShotMesh];
      for (let k = 0; k < w.shots.count; k++) {
        p.set(sh.x[k], 0.8, sh.y[k]);
        q.setFromAxisAngle(UP, -Math.atan2(sh.vy[k], sh.vx[k]));
        s.set(2.2, 1, 1);
        const kind = sh.kind[k];
        shotMeshes[kind].setMatrixAt(shotCounts[kind]++, m.compose(p, q, s));
      }
      shotMeshes.forEach((mesh, kind) => {
        mesh.count = shotCounts[kind];
        mesh.instanceMatrix.needsUpdate = true;
      });

      w.macro.forEach((o, k) => {
        p.set(o.x, 0.8, o.y);
        q.setFromAxisAngle(UP, t * 2 + k);
        s.set(1 + Math.sin(t * 6 + k) * 0.06, 1, 1 - Math.sin(t * 6 + k) * 0.06);
        macroMesh.setMatrixAt(k, m.compose(p, q, s));
      });
      macroMesh.count = w.macro.length;
      macroMesh.instanceMatrix.needsUpdate = true;

      const u = w.nk.f;
      for (let k = 0; k < w.nk.count; k++) {
        p.set(u.x[k], 0.9, u.y[k]);
        q.setFromAxisAngle(UP, t * 4 + k);
        s.setScalar(1);
        nkMesh.setMatrixAt(k, m.compose(p, q, s));
      }
      nkMesh.count = w.nk.count;
      nkMesh.instanceMatrix.needsUpdate = true;

      const n = w.nets.f;
      for (let k = 0; k < w.nets.count; k++) {
        const left = n.life[k] / n.maxLife[k], grow = Math.min(1, (1 - left) * n.maxLife[k] * 6); // 깔릴 때 빠르게 펼쳐짐
        p.set(n.x[k], 0.05, n.y[k]);
        q.setFromAxisAngle(UP, k);
        s.set(n.radius[k] * grow, 1, n.radius[k] * grow);
        netMesh.setMatrixAt(k, m.compose(p, q, s));
        netMesh.setColorAt(k, tmpColor.copy(netColor).multiplyScalar(0.55 * Math.min(1, left * 4)));
      }
      netMesh.count = w.nets.count;
      netMesh.instanceMatrix.needsUpdate = true;
      netMesh.instanceColor!.needsUpdate = true;

      const g = w.gems.f;
      for (let k = 0; k < w.gems.count; k++) {
        p.set(g.x[k], 0.35 + Math.sin(t * 3 + k) * 0.08, g.y[k]);
        q.setFromAxisAngle(UP, t * 2 + k);
        s.setScalar(1);
        gemMesh.setMatrixAt(k, m.compose(p, q, s));
      }
      gemMesh.count = w.gems.count;
      gemMesh.instanceMatrix.needsUpdate = true;

      for (const d of w.deaths) particles.burst(d.x, 0.4, d.y, kindColors[d.kind]);
      for (const b of w.bursts) {
        shocks.add(b.x, b.y, b.r);
        particles.burst(b.x, 0.4, b.y, flashColor, 8, 1.4);
      }
      particles.update(dt);
      shocks.update(dt);
    },
  };
}
