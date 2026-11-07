// 피해 숫자: 숫자 10개를 그린 텍스처 한 장 + InstancedMesh. 위로 튀어 오르며 살짝 회전, 치명타는 크고 노란색.
import * as THREE from 'three';

const MAX_GLYPHS = 600, LIFE = 0.75, CRIT_AT = 20; // shortcut: 치명타 규칙이 없어 큰 한 방(20 이상)을 치명타처럼 보여 준다
const FONT = '"JetBrains Mono", "Pretendard", monospace';

const vertexShader = `
attribute float aGlyph; attribute vec4 aColor;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vUv = vec2((aGlyph + uv.x) / 10.0, uv.y); vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const fragmentShader = `
uniform sampler2D map; varying vec2 vUv; varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * vColor.a;
  if (a < 0.02) discard;
  gl_FragColor = vec4(mix(vec3(0.03, 0.02, 0.06), vColor.rgb, t.r), a); // 테두리는 어둡게, 안쪽은 색
}`;

function drawAtlas(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d')!;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = `600 52px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  for (let d = 0; d < 10; d++) {
    const x = d * 64 + 32;
    g.lineWidth = 10;
    g.strokeStyle = 'rgba(0,0,0,1)';
    g.strokeText(String(d), x, 36);
    g.fillStyle = '#fff';
    g.fillText(String(d), x, 36);
  }
}

export function createNumbers(scene: THREE.Scene, camera: THREE.Camera) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 64;
  drawAtlas(canvas);
  const tex = new THREE.CanvasTexture(canvas);
  // 웹폰트가 늦게 로드되면 다시 그린다
  void document.fonts?.load(`56px ${FONT}`).then(() => { drawAtlas(canvas); tex.needsUpdate = true; });

  const geo = new THREE.PlaneGeometry(0.55, 0.55);
  const glyph = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GLYPHS), 1).setUsage(THREE.DynamicDrawUsage);
  const color = new THREE.InstancedBufferAttribute(new Float32Array(MAX_GLYPHS * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aGlyph', glyph);
  geo.setAttribute('aColor', color);
  const mesh = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms: { map: { value: tex } }, transparent: true, depthTest: false, depthWrite: false,
  }), MAX_GLYPHS);
  mesh.frustumCulled = false;
  mesh.renderOrder = 11;
  scene.add(mesh);

  const list: { x: number; y: number; z: number; vy: number; rot: number; text: string; crit: boolean; t: number }[] = [];
  const m = new THREE.Matrix4(), local = new THREE.Matrix4(), q = new THREE.Quaternion(), rz = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);

  return {
    add(x: number, y: number, z: number, value: number) {
      const v = Math.round(value);
      if (v < 1 || list.length > 120) return;
      list.push({ x: x + (Math.random() - 0.5) * 0.5, y, z, vy: 4 + Math.random() * 1.5, rot: (Math.random() - 0.5) * 0.5, text: String(v), crit: v >= CRIT_AT, t: 0 });
    },
    update(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        if ((o.t += dt) >= LIFE) { list.splice(i, 1); continue; }
        o.y += o.vy * dt;
        o.vy -= 9 * dt;
      }
      let n = 0;
      for (const o of list) {
        const k = o.t / LIFE;
        const pop = k < 0.12 ? 0.85 + (k / 0.12) * 0.15 : 1; // 짧게 나타났다 떠오르며 사라짐
        const sc = pop * (o.crit ? 1.7 : 1);
        const alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        rz.setFromAxisAngle(Z, o.rot * k);
        q.copy(camera.quaternion).multiply(rz);
        p.set(o.x, o.y, o.z);
        s.setScalar(sc);
        m.compose(p, q, s);
        const [r, g, b] = o.crit ? [0.886, 0.722, 0.341] : [0.91, 0.894, 0.855]; // 금 / 따뜻한 미색
        for (let j = 0; j < o.text.length && n < MAX_GLYPHS; j++, n++) {
          local.makeTranslation((j - (o.text.length - 1) / 2) * 0.36, 0, 0);
          mesh.setMatrixAt(n, local.premultiply(m));
          glyph.setX(n, o.text.charCodeAt(j) - 48);
          color.setXYZW(n, r, g, b, alpha);
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      glyph.needsUpdate = color.needsUpdate = true;
    },
  };
}
