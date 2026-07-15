import { createAudioEngine } from './audio';
import { createParticles, drawParticles, updateParticles } from './particles';

function $(id: string) {
  return document.getElementById(id)!;
}

export function bootAudioViz() {
  const canvas = $('audio-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const sensEl = $('audio-sens') as HTMLInputElement;
  const countEl = $('audio-count') as HTMLInputElement;
  let paused = false;
  let engine = createAudioEngine();
  let particles = createParticles(400, 800, 400);
  let last = performance.now();

  const syncSize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const n = Math.min(800, Math.max(50, Number(countEl.value) || 400));
    particles = createParticles(n, canvas.width, canvas.height);
  };
  syncSize();
  window.addEventListener('resize', syncSize);

  const ensureEngine = () => {
    if (engine.ctx.state == 'closed') engine = createAudioEngine();
  };

  $('audio-file').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    ensureEngine();
    $('audio-status').textContent = '解码中…';
    try {
      await engine.connectFile(file);
      $('audio-status').textContent = `播放：${file.name}`;
    } catch {
      $('audio-status').textContent = '无法解码该音频';
    }
  });

  $('audio-mic').addEventListener('click', async () => {
    ensureEngine();
    $('audio-status').textContent = '请求麦克风…';
    try {
      await engine.connectMic();
      $('audio-status').textContent = '麦克风已连接';
    } catch {
      $('audio-status').textContent = '麦克风不可用或未授权';
    }
  });

  $('audio-stop').addEventListener('click', () => {
    engine.stop();
    $('audio-status').textContent = '已停止';
  });

  $('audio-pause').addEventListener('click', () => {
    paused = !paused;
    $('audio-pause').textContent = paused ? '继续画面' : '暂停画面';
  });

  countEl.addEventListener('change', syncSize);

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) {
      const freq = engine.getFrequency();
      const sens = Number(sensEl.value) || 1;
      updateParticles(particles, freq, canvas.width, canvas.height, sens, dt);
      drawParticles(ctx, particles, canvas.width, canvas.height);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
