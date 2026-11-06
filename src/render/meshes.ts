import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import balance from '../data/balance.json';
import cardData from '../data/cards.json';
import dialogue from '../data/dialogue.json';
import { ENEMIES, MAX_ENEMIES, type World } from '../game/world';
import { glassy, time } from './materials';
import { createParticles, createShockwaves, createPopups, createRain } from './effects';

const COCCUS = ENEMIES.find((e) => e.id === 'coccus')!;
const T = balance.cardTuning, CELL = balance.cells;
const BOSS = ENEMIES.findIndex((e) => e.id === balance.boss.id);
const BACILLUS = ENEMIES.findIndex((e) => e.id === 'bacillus');

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

// 막대균: 이동 방향(x축)으로 긴 캡슐
const bacillusGeometry = (r: number) => new THREE.CapsuleGeometry(r * 0.5, r * 2.2, 6, 12).rotateZ(Math.PI / 2);

// 정이십면체 꼭짓점 방향 (중복 제거)
function icoDirs(detail: number) {
  const pos = new THREE.IcosahedronGeometry(1, detail).attributes.position;
  const seen = new Map<string, THREE.Vector3>();
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    seen.set(v.toArray().map((n) => n.toFixed(3)).join(), v);
  }
  return [...seen.values()];
}

// 바이러스: 작은 껍질 + 돌기 12개
function virusGeometry(r: number) {
  const parts = [new THREE.IcosahedronGeometry(r * 0.7, 1)];
  for (const d of icoDirs(0)) parts.push(new THREE.IcosahedronGeometry(r * 0.22, 0).translate(d.x * r, d.y * r, d.z * r));
  return mergeGeometries(parts);
}

// 슈퍼버그: 울퉁불퉁한 몸통 + 가시 42개
function bossGeometry(r: number) {
  const body = new THREE.IcosahedronGeometry(r * 0.85, 4);
  body.deleteAttribute('uv');
  const bump = (v: THREE.Vector3) => 1 + 0.08 * Math.sin(v.x * 3.1) * Math.sin(v.y * 2.7 + 1) * Math.sin(v.z * 3.3 + 2);
  const pos = body.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    pos.setXYZ(i, v.x * bump(v), v.y * bump(v), v.z * bump(v));
  }
  const parts: THREE.BufferGeometry[] = [mergeVertices(body)];
  const Y = new THREE.Vector3(0, 1, 0);
  for (const d of icoDirs(1)) {
    const cone = new THREE.ConeGeometry(r * 0.08, r * 0.45, 6).translate(0, r * 0.95, 0);
    cone.deleteAttribute('uv');
    parts.push(cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d)));
  }
  parts[0].computeVertexNormals();
  return mergeGeometries(parts);
}

const VARIANTS = [3, 4, 5, 6];
const LOOKS = 256; // 개체별 회전·크기는 id로 이 표에서 고른다 (swap 삭제에도 모습 유지)

export function createView(scene: THREE.Scene, camera: THREE.Camera) {
  const player = createPlayerMesh();
  scene.add(player);

  // 적: 재질은 흰색, 실제 색은 인스턴스 색 (번쩍임 = 밝은 흰색으로 교체)
  const kindColors = ENEMIES.map((d) => new THREE.Color(d.color));
  const flashColor = new THREE.Color(4, 4, 4);
  const enemyMat = glassy({
    color: 0xffffff, opacity: 0.55, rim: 0xffb36b, rimStrength: 0.7,
    emissive: 0x401200, emissiveIntensity: 0.6, depthWrite: true,
  });
  const infectedMat = glassy({
    color: 0xffffff, opacity: 0.45, rim: 0xd08cff, rimStrength: 0.9, emissive: 0x200830, wobble: 0.05, depthWrite: true,
  });
  const bossMat = glassy({
    color: 0xffffff, opacity: 0.75, rim: 0xff7080, rimStrength: 1.1, emissive: 0x300006, wobble: 0.1, depthWrite: true,
  });
  // 종류마다 InstancedMesh 묶음 (구균은 포도송이 모양 4가지)
  const kindMeshes = ENEMIES.map((d) => {
    const geos =
      d.id === 'coccus' || d.id === 'resistantCoccus' ? VARIANTS.map((k) => clusterGeometry(k, d.radius))
      : d.id === 'bacillus' ? [bacillusGeometry(d.radius)]
      : d.id === 'virus' ? [virusGeometry(d.radius)]
      : d.id === 'superbug' ? [bossGeometry(d.radius)]
      : [new THREE.SphereGeometry(d.radius, 32, 20)];
    const mat = d.id === 'superbug' ? bossMat : d.id === 'infected' ? infectedMat : enemyMat;
    return geos.map((g) => instanced(g, mat, d.id === 'superbug' ? 4 : MAX_ENEMIES, kindColors[0]));
  });
  scene.add(...kindMeshes.flat());

  // 정상 세포: 연분홍 막 + 핵
  const cellMem = instanced(new THREE.SphereGeometry(CELL.radius, 32, 20), glassy({
    color: 0x8a4a5e, opacity: 0.22, rim: 0xffb0c8, rimStrength: 0.7, wobble: 0.04,
  }), 64);
  cellMem.renderOrder = 1;
  const cellNuc = instanced(new THREE.SphereGeometry(CELL.radius * 0.38, 16, 12), glassy({
    color: 0x5a2a4a, opacity: 0.8, rim: 0xd080a0, rimStrength: 0.5, depthWrite: true,
  }), 64);
  scene.add(cellMem, cellNuc);
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
  const macroMax = Math.max(...cardData.cards.find((c) => c.id === 'macrophage')!.levels.map((l) => (l as { count: number }).count))
    + balance.evolutions.activatedMacrophage.extraCount;
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
  const popups = createPopups(scene, camera, dialogue.ui.resist);
  const noEffect = createPopups(scene, camera, dialogue.ui.noEffect);
  const rain = createRain(scene);

  // 항생제 알약: 반은 흰색, 반은 붉은 캡슐 (정점 색). 사라지기 직전 깜빡인다.
  const pillGeo = new THREE.CapsuleGeometry(0.28, 0.55, 6, 14).rotateZ(Math.PI / 2);
  const pp = pillGeo.attributes.position, pillCol = new Float32Array(pp.count * 3);
  for (let i = 0; i < pp.count; i++) {
    const c = pp.getX(i) > 0 ? [1.6, 0.35, 0.4] : [1.6, 1.6, 1.6];
    pillCol.set(c, i * 3);
  }
  pillGeo.setAttribute('color', new THREE.BufferAttribute(pillCol, 3));
  const pillMesh = instanced(pillGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), 8);
  const pillHalo = instanced(
    new THREE.RingGeometry(0.7, 0.85, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(1.2), transparent: true, opacity: 0.5, depthWrite: false }),
    8,
  );
  scene.add(pillMesh, pillHalo);
  const infectColor = new THREE.Color(0xd65cff);
  const netColor = new THREE.Color(0xbffcff), tmpColor = new THREE.Color();

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const counts = kindMeshes.map((ms) => ms.map(() => 0));

  return {
    player,
    sync(w: World, dt: number, t: number) {
      time.value = t;
      player.position.set(w.player.x, 1, w.player.y);
      // 무적 시간 동안 깜빡임
      player.visible = w.player.invuln <= 0 || Math.floor(t * 20) % 2 === 0;

      const e = w.enemies.f;
      for (const c of counts) c.fill(0);
      let marks = 0;
      for (let i = 0; i < w.enemies.count; i++) {
        const id = e.id[i], kind = e.kind[i], def = ENEMIES[kind];
        const ms = kindMeshes[kind], v = id % ms.length, j = counts[kind][v]++;
        const look = looks[id % LOOKS];
        p.set(e.x[i], def.radius + 0.1 + Math.sin(t * 2 + id) * 0.15, e.y[i]);
        if (kind === BACILLUS) q.setFromAxisAngle(UP, -Math.atan2(w.player.y - e.y[i], w.player.x - e.x[i]));
        else q.setFromAxisAngle(look.axis, look.phase + t * look.spin * (kind === BOSS ? 0.3 : 1));
        s.setScalar(kind === BOSS ? 1 : look.scale);
        ms[v].setMatrixAt(j, m.compose(p, q, s));
        // 2페이즈 보스는 더 빨갛게 맥동하며 빛난다 (밝기 > 1 → bloom)
        const col = e.flash[i] > 0 ? flashColor
          : kind === BOSS && w.boss.phase2 ? tmpColor.copy(kindColors[kind]).multiplyScalar(2.4 + Math.sin(t * 9) * 0.9)
          : kindColors[kind];
        ms[v].setColorAt(j, col);
        if (e.mark[i] > 0) {
          q.setFromAxisAngle(UP, t * 3 + id);
          s.setScalar((def.radius / COCCUS.radius) * (1 + Math.sin(t * 10) * 0.08));
          markMesh.setMatrixAt(marks++, m.compose(p, q, s));
        }
      }
      kindMeshes.forEach((ms, k) => ms.forEach((mesh, v) => {
        mesh.count = counts[k][v];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
      }));

      const cf = w.cells.f;
      for (let k = 0; k < w.cells.count; k++) {
        p.set(cf.x[k], CELL.radius * 0.8, cf.y[k]);
        q.setFromAxisAngle(UP, k);
        s.set(1, 0.75, 1);
        m.compose(p, q, s);
        cellMem.setMatrixAt(k, m);
        cellNuc.setMatrixAt(k, m);
      }
      cellMem.count = cellNuc.count = w.cells.count;
      cellMem.instanceMatrix.needsUpdate = cellNuc.instanceMatrix.needsUpdate = true;
      markMesh.count = marks;
      markMesh.instanceMatrix.needsUpdate = true;

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
        const big = w.macroR / T.orbiterRadius; // 활성화 대식세포는 더 크다
        s.set(big * (1 + Math.sin(t * 6 + k) * 0.06), big, big * (1 - Math.sin(t * 6 + k) * 0.06));
        p.y = 0.8 * big;
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

      for (const d of w.deaths) {
        if (d.kind !== BOSS) { particles.burst(d.x, 0.4, d.y, kindColors[d.kind]); continue; }
        particles.burst(d.x, 1.5, d.y, kindColors[d.kind], 160, 2.5);
        particles.burst(d.x, 1.5, d.y, flashColor, 60, 1.8);
        for (const r of [3, 5, 8]) shocks.add(d.x, d.y, r);
      }
      for (const c of w.infections) particles.burst(c.x, 0.6, c.y, infectColor, 14, 0.8);
      for (const h of w.resistHits) popups.add(h.x, 3.6, h.y);
      popups.update(dt);
      for (const h of w.noEffectHits) noEffect.add(h.x, 1.4, h.y);
      noEffect.update(dt);
      for (const r of w.rain) rain.add(r.x, r.y);
      rain.update(dt);

      const pf = w.pills.f;
      for (let k = 0; k < w.pills.count; k++) {
        const blink = pf.life[k] < 3 && Math.floor(t * 8) % 2 === 0;
        p.set(pf.x[k], 0.6 + Math.sin(t * 3 + k) * 0.15, pf.y[k]);
        q.setFromAxisAngle(UP, t * 1.5 + k);
        s.setScalar(blink ? 0 : 1);
        pillMesh.setMatrixAt(k, m.compose(p, q, s));
        p.y = 0.05;
        s.setScalar(blink ? 0 : 1 + Math.sin(t * 5) * 0.12);
        pillHalo.setMatrixAt(k, m.compose(p, q, s));
      }
      pillMesh.count = pillHalo.count = w.pills.count;
      pillMesh.instanceMatrix.needsUpdate = pillHalo.instanceMatrix.needsUpdate = true;
      for (const b of w.bursts) {
        shocks.add(b.x, b.y, b.r);
        particles.burst(b.x, 0.4, b.y, flashColor, 8, 1.4);
      }
      particles.update(dt);
      shocks.update(dt);
    },
  };
}
