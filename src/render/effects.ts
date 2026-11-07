import * as THREE from 'three';

const MAX = 3000;
const PER_BURST = 18;

// 처치 파티클: 터진 뒤 감속하며 작아짐
export function createParticles(scene: THREE.Scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.09, 0),
    new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    MAX,
  );
  mesh.frustumCulled = false;
  const color = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, color);
  scene.add(mesh);

  const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
  const vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX);
  const life = new Float32Array(MAX), maxLife = new Float32Array(MAX), size = new Float32Array(MAX);
  let count = 0;

  const m = new THREE.Matrix4();
  return {
    burst(x: number, y: number, z: number, base: THREE.Color, n = PER_BURST, power = 1) {
      for (let k = 0; k < n && count < MAX; k++, count++) {
        const i = count, a = Math.random() * Math.PI * 2, sp = (2 + Math.random() * 5) * power;
        px[i] = x; py[i] = y; pz[i] = z;
        vx[i] = Math.cos(a) * sp; vz[i] = Math.sin(a) * sp; vy[i] = 1 + Math.random() * 3;
        life[i] = maxLife[i] = 0.35 + Math.random() * 0.35;
        size[i] = 0.6 + Math.random() * 1.2;
        // 대부분 적 색, 일부는 흰 불꽃 (밝기 > 1 이라 bloom에 걸림)
        color.copy(k % 4 === 0 ? white : base).multiplyScalar(2.2);
        mesh.setColorAt(i, color);
      }
    },
    update(dt: number) {
      const drag = Math.exp(-4 * dt);
      for (let i = count - 1; i >= 0; i--) {
        life[i] -= dt;
        if (life[i] <= 0) {
          // 마지막 원소를 끌어와 채움
          const l = --count;
          px[i] = px[l]; py[i] = py[l]; pz[i] = pz[l]; vx[i] = vx[l]; vy[i] = vy[l]; vz[i] = vz[l];
          life[i] = life[l]; maxLife[i] = maxLife[l]; size[i] = size[l];
          mesh.getColorAt(l, color); mesh.setColorAt(i, color);
          continue;
        }
        vx[i] *= drag; vy[i] = vy[i] * drag - 6 * dt; vz[i] *= drag;
        px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      }
      for (let i = 0; i < count; i++) {
        const sc = size[i] * (life[i] / maxLife[i]);
        m.makeScale(sc, sc, sc).setPosition(px[i], py[i], pz[i]);
        mesh.setMatrixAt(i, m);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}

const SHOCK_MAX = 128, SHOCK_TIME = 0.35;

// 보체 폭발: 바닥에서 퍼지는 고리. 가산 혼합이라 색을 어둡게 하면 사라진다.
export function createShockwaves(scene: THREE.Scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide }),
    SHOCK_MAX,
  );
  mesh.frustumCulled = false;
  const color = new THREE.Color(), base = new THREE.Color(0xfff2a8);
  for (let i = 0; i < SHOCK_MAX; i++) mesh.setColorAt(i, color);
  scene.add(mesh);
  const list: { x: number; z: number; r: number; t: number }[] = [];
  const m = new THREE.Matrix4();
  return {
    add(x: number, z: number, r: number) {
      if (list.length < SHOCK_MAX) list.push({ x, z, r, t: 0 });
    },
    update(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].t += dt) >= SHOCK_TIME) list.splice(i, 1);
      list.forEach((s, i) => {
        const k = s.t / SHOCK_TIME, sc = s.r * (0.3 + 0.7 * Math.sqrt(k));
        m.makeScale(sc, 1, sc).setPosition(s.x, 0.15, s.z);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, color.copy(base).multiplyScalar(2.5 * (1 - k)));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
    },
  };
}

const POP_MAX = 32, POP_TIME = 0.8;

// "내성!" 표시: 같은 글자 텍스처를 쓰는 평면, 카메라를 향하고 위로 떠오르며 줄어든다
export function createPopups(scene: THREE.Scene, camera: THREE.Camera, text: string) {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 96;
  const g = c.getContext('2d')!;
  const font = '56px "Black Han Sans", "Pretendard", sans-serif';
  const draw = () => {
    g.clearRect(0, 0, c.width, c.height);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(20, 20, 24, 0.9)';
    g.strokeText(text, 160, 50);
    g.fillStyle = '#b8b8c0';
    g.fillText(text, 160, 50);
  };
  draw();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  void document.fonts?.load(font).then(() => { draw(); tex.needsUpdate = true; }); // 웹폰트가 늦게 오면 다시 그림
  const mesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }),
    POP_MAX,
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  scene.add(mesh);
  const list: { x: number; y: number; z: number; t: number }[] = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    add(x: number, y: number, z: number) {
      if (list.length < POP_MAX) list.push({ x: x + (Math.random() - 0.5), y, z, t: 0 });
    },
    update(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].t += dt) >= POP_TIME) list.splice(i, 1);
      list.forEach((o, i) => {
        const k = o.t / POP_TIME, sc = k < 0.15 ? k / 0.15 * 1.2 : 1.2 - (k - 0.15) * 1.4;
        p.set(o.x, o.y + k * 1.2, o.z);
        s.setScalar(Math.max(0, sc));
        mesh.setMatrixAt(i, m.compose(p, camera.quaternion, s));
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

const RAIN_MAX = 256, RAIN_SPEED = 28, RAIN_FROM = 9;

// 형질세포: 항체 표식이 위에서 비처럼 떨어진다 (가는 금빛 줄기)
export function createRain(scene: THREE.Scene) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.05, 0.7, 0.05),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0a0).multiplyScalar(2.2) }),
    RAIN_MAX,
  );
  mesh.frustumCulled = false;
  scene.add(mesh);
  const list: { x: number; y: number; z: number }[] = [];
  const m = new THREE.Matrix4();
  return {
    add(x: number, z: number) {
      if (list.length < RAIN_MAX) list.push({ x: x + (Math.random() - 0.5) * 0.4, y: RAIN_FROM + Math.random() * 3, z });
    },
    update(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].y -= RAIN_SPEED * dt) < 0.5) list.splice(i, 1);
      list.forEach((d, i) => mesh.setMatrixAt(i, m.makeTranslation(d.x, d.y, d.z)));
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
