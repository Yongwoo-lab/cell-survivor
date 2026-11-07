const el = document.getElementById('fps')!;
// FPS는 개발 모드(?dev=1)에서만 보인다
el.hidden = new URLSearchParams(location.search).get('dev') !== '1';
let frames = 0, acc = 0;

export function tickFps(dt: number) {
  frames++;
  acc += dt;
  if (acc >= 0.5) {
    el.textContent = `${Math.round(frames / acc)} FPS`;
    frames = 0;
    acc = 0;
  }
}
