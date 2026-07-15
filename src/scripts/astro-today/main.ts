import {
  DEFAULT_LAT,
  DEFAULT_LON,
  formatAz,
  formatLocalTime,
  parseLatLon,
  requestGeo,
} from '../shared/geo';
import { moonIllumination, planetTable, sunMoonRiseSet } from './ephemeris';

function $(id: string) {
  return document.getElementById(id)!;
}

function drawMoon(canvas: HTMLCanvasElement, illum: number) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#010305';
  ctx.fillRect(0, 0, w, h);

  // 满盘底
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#cfd8e6';
  ctx.fill();

  // 阴影：按照明比例遮挡（简化 terminator）
  const phase = ((illum % 1) + 1) % 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.clip();
  if (phase < 0.5) {
    const k = 1 - phase * 2;
    ctx.fillStyle = '#030508';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * k, r, 0, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.fillRect(cx, cy - r, r + 2, r * 2);
  } else {
    const k = (phase - 0.5) * 2;
    ctx.fillStyle = '#030508';
    ctx.fillRect(cx - r - 2, cy - r, r + 2, r * 2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * (1 - k), r, 0, Math.PI / 2, -Math.PI / 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(0,232,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function fmtTime(d: Date | null) {
  return d ? formatLocalTime(d) : '—';
}

function refresh(lat: number, lon: number) {
  const when = new Date();
  const illum = moonIllumination(when);
  const rs = sunMoonRiseSet(when, lat, lon);
  const planets = planetTable(when, lat, lon);

  $('astro-now').textContent = formatLocalTime(when);
  $('astro-illum').textContent = `${(illum * 100).toFixed(1)}%`;
  $('astro-sun-rise').textContent = fmtTime(rs.sun.rise);
  $('astro-sun-set').textContent = fmtTime(rs.sun.set);
  $('astro-moon-rise').textContent = fmtTime(rs.moon.rise);
  $('astro-moon-set').textContent = fmtTime(rs.moon.set);
  $('astro-pos').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  const canvas = $('astro-moon') as HTMLCanvasElement;
  drawMoon(canvas, illum);

  const tbody = $('astro-planets');
  tbody.innerHTML = planets
    .map(
      (p) => `<tr>
        <td>${p.name}</td>
        <td>${p.altitude.toFixed(1)}°</td>
        <td>${formatAz(p.azimuth)}</td>
        <td>${p.altitude > 0 ? '地平线上' : '地平线下'}</td>
      </tr>`,
    )
    .join('');
}

export function bootAstroToday() {
  const latInput = $('astro-lat') as HTMLInputElement;
  const lonInput = $('astro-lon') as HTMLInputElement;
  latInput.value = String(DEFAULT_LAT);
  lonInput.value = String(DEFAULT_LON);

  const applyManual = () => {
    const p = parseLatLon(latInput.value, lonInput.value);
    if (!p) {
      $('astro-geo-note').textContent = '经纬度无效';
      return;
    }
    $('astro-geo-note').textContent = '手动观测点';
    refresh(p.lat, p.lon);
  };

  $('astro-apply').addEventListener('click', applyManual);
  $('astro-gps').addEventListener('click', () => {
    $('astro-geo-note').textContent = '定位中…';
    requestGeo((pos) => {
      latInput.value = pos.lat.toFixed(4);
      lonInput.value = pos.lon.toFixed(4);
      const src = pos.source == 'gps' ? 'GPS' : '默认（北京）';
      $('astro-geo-note').textContent = `观测点：${src}`;
      refresh(pos.lat, pos.lon);
    });
  });

  requestGeo((pos) => {
    latInput.value = pos.lat.toFixed(4);
    lonInput.value = pos.lon.toFixed(4);
    const src = pos.source == 'gps' ? 'GPS' : '默认（北京）';
    $('astro-geo-note').textContent = `观测点：${src}`;
    refresh(pos.lat, pos.lon);
  });

  // 每分钟刷新；坐标无效则跳过，避免盖掉「经纬度无效」提示
  setInterval(() => {
    const p = parseLatLon(latInput.value, lonInput.value);
    if (!p) return;
    refresh(p.lat, p.lon);
  }, 60000);
}
