const el = document.getElementById('fps')!;
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
