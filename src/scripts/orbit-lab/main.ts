import { drawOrbit, orbitPhaseText } from './draw';
import { hohmann } from './physics';

function $(id: string) {
  return document.getElementById(id)!;
}

export function bootOrbitLab() {
  const canvas = $('orbit-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const r1El = $('orbit-r1') as HTMLInputElement;
  const r2El = $('orbit-r2') as HTMLInputElement;
  let playing = true;
  let t = 0;
  let last = performance.now();

  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  };
  syncSize();
  window.addEventListener('resize', syncSize);

  const updateHud = () => {
    const r1 = Number(r1El.value);
    const r2 = Number(r2El.value);
    const h = hohmann(r1, r2);
    $('orbit-dv1').textContent = h.dv1.toFixed(5);
    $('orbit-dv2').textContent = h.dv2.toFixed(5);
    $('orbit-dvt').textContent = h.dvTotal.toFixed(5);
    $('orbit-a').textContent = h.a.toFixed(3);
    $('orbit-r1-val').textContent = r1.toFixed(2);
    $('orbit-r2-val').textContent = r2.toFixed(2);
    $('orbit-phase').textContent = orbitPhaseText(t);
  };

  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (playing) {
      t += dt / 8;
      if (t > 1) t = 0;
    }
    const r1 = Number(r1El.value);
    const r2 = Number(r2El.value);
    drawOrbit(ctx, canvas.width, canvas.height, r1, r2, t);
    $('orbit-phase').textContent = orbitPhaseText(t);
    requestAnimationFrame(frame);
  };

  r1El.addEventListener('input', updateHud);
  r2El.addEventListener('input', updateHud);
  $('orbit-play').addEventListener('click', () => {
    playing = !playing;
    $('orbit-play').textContent = playing ? '暂停' : '继续';
  });
  $('orbit-replay').addEventListener('click', () => {
    t = 0;
    playing = true;
    $('orbit-play').textContent = '暂停';
  });

  document.querySelectorAll('[data-r1]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      r1El.value = el.dataset.r1 || '1';
      r2El.value = el.dataset.r2 || '2';
      t = 0;
      playing = true;
      $('orbit-play').textContent = '暂停';
      updateHud();
    });
  });

  updateHud();
  requestAnimationFrame(frame);
}
