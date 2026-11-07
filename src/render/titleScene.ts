// 타이틀 3D 장면: 화면 오른쪽을 채우는 백혈구 클로즈업. 막은 숨 쉬듯 꿀렁이고 핵은 심장 박동에 맞춰 뛴다.
// 멀리서 구균이 다가왔다 사라지고, 8~12초마다 어둠 속에서 보스의 빨간 눈이 번쩍인다.
import * as THREE from 'three';
import { glassy, time } from './materials';
import { createHero, HERO_OPEN } from './hero';
import { clusterGeometry } from './meshes';

const RED = 0xff5a4e;
const CAM = new THREE.Vector3(0, 0.3, 10);

export function createTitleScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090c);
  scene.add(new THREE.AmbientLight(0x8090a0, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);

  // 거대한 백혈구 (오른쪽): 게임 속 주인공과 같은 호중구 모델
  const hero = createHero(3.3, 70);
  const cell = hero.group, membrane = hero.body, nucleus = hero.nucleus;
  cell.position.set(3.4, -0.2, 0);
  scene.add(cell);
  let blinkIn = 2.5, blinkT = 0, lookT = 0;
  const look = new THREE.Vector2(-0.7, 0.1), lookTo = new THREE.Vector2(-0.7, 0.1);

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
      hero.inner.rotation.y = t * 0.05;
      hero.granules.update(t);
      // 눈: 대부분 왼쪽(로고·메뉴)을 보다가 가끔 두리번, 2~5초마다 깜빡
      if ((lookT -= dt) <= 0) {
        lookT = 1.5 + Math.random() * 2.5;
        if (Math.random() < 0.6) lookTo.set(-0.75, 0.05 + Math.random() * 0.2); else lookTo.set(Math.random() * 1.4 - 0.7, Math.random() * 0.8 - 0.4);
      }
      look.lerp(lookTo, Math.min(1, dt * 6));
      if ((blinkIn -= dt) <= 0) { blinkT = 0.16; blinkIn = 2 + Math.random() * 3; }
      blinkT -= dt;
      hero.eyes.set(look.x, look.y, blinkT > 0 ? Math.sin((1 - blinkT / 0.16) * Math.PI) : 0, HERO_OPEN);
      hero.eyes.place(camera, cell, 3.3 * breath, look.x * 0.5, look.y * 0.5);
      cocci.forEach((c) => {
        c.t = (c.t + dt / 14) % 1;
        const z = -32 + c.t * 26;
        c.m.position.set(c.x, c.y, z);
        c.m.rotation.set(t * 0.3 + c.spin, t * 0.2, 0);
        c.m.scale.setScalar(c.t < 0.1 ? c.t / 0.1 : c.t > 0.85 ? (1 - c.t) / 0.15 : 1);
      });
      // 8~12초마다 0.5초 번쩍 (깜빡임 두 번)
      if ((nextGlare -= dt) <= 0) { nextGlare = 8 + Math.random() * 4; glare = 0; onGlare(); lookTo.set(-0.9, 0.5); lookT = 1.2; } // 번쩍이는 쪽을 흘끗
      if (glare >= 0) {
        glare += dt;
        eyeMat.opacity = glare > 0.5 ? 0 : glare < 0.08 || (glare > 0.18 && glare < 0.5) ? 1 : 0.2;
        if (glare > 0.5) glare = -1;
      }
    },
  };
}
