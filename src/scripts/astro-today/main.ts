import {
  DEFAULT_LAT,
  DEFAULT_LON,
  formatAz,
  formatLocalTime,
  parseLatLon,
  requestGeo,
} from '../shared/geo';
import { moonIllumination, planetTable, sunMoonRiseSet } from './ephemeris';
import { drawMoonHeroSync, moonPhaseInfo } from './moon-render';

function $(id: string) {
  return document.getElementById(id)!;
}

function fmtTime(d: Date | null) {
  return d ? formatLocalTime(d) : '—';
}

function fmtClock(d: Date | null) {
  if (!d) return '今日无升起/落下';
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function refresh(lat: number, lon: number) {
  const when = new Date();
  const illum = moonIllumination(when);
  const phase = moonPhaseInfo(when);
  const rs = sunMoonRiseSet(when, lat, lon);
  const planets = planetTable(when, lat, lon);

  $('astro-now').textContent = formatLocalTime(when);
  $('astro-illum').textContent = `${(illum * 100).toFixed(1)}%`;
  $('astro-phase-name').textContent = `${phase.emoji} ${phase.name}`;
  $('astro-sun-rise').textContent = fmtTime(rs.sun.rise);
  $('astro-sun-set').textContent = fmtTime(rs.sun.set);
  $('astro-moon-rise').textContent = fmtTime(rs.moon.rise);
  $('astro-moon-set').textContent = fmtTime(rs.moon.set);
  $('astro-pos').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  $('astro-card-phase').textContent = `${phase.name} · 亮面约 ${(illum * 100).toFixed(0)}%`;
  $('astro-card-sunset').textContent = fmtClock(rs.sun.set);

  const up = planets.filter((p) => p.altitude > 0).sort((a, b) => b.altitude - a.altitude);
  if (up.length) {
    const top = up[0];
    $('astro-card-planet').textContent = `${top.name} · ${formatAz(top.azimuth)} · 高 ${top.altitude.toFixed(0)}°`;
  } else {
    $('astro-card-planet').textContent = '亮行星都在地平线下';
  }

  const canvas = $('astro-moon') as HTMLCanvasElement;
  drawMoonHeroSync(canvas, when, illum * 100, phase.name);

  const tbody = $('astro-planets');
  tbody.innerHTML = planets
    .map(
      (p) => `<tr>
        <td>${p.name}</td>
        <td>${p.altitude.toFixed(1)}°</td>
        <td>${formatAz(p.azimuth)}</td>
        <td>${p.altitude > 0 ? '地平线上，抬头能找' : '地平线下'}</td>
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

  window.addEventListener('resize', () => {
    const p = parseLatLon(latInput.value, lonInput.value);
    if (p) refresh(p.lat, p.lon);
  });

  refresh(DEFAULT_LAT, DEFAULT_LON);
  $('astro-geo-note').textContent = '观测点：北京（默认）';

  requestGeo((pos) => {
    latInput.value = pos.lat.toFixed(4);
    lonInput.value = pos.lon.toFixed(4);
    const src = pos.source == 'gps' ? 'GPS' : '默认（北京）';
    $('astro-geo-note').textContent = `观测点：${src}`;
    refresh(pos.lat, pos.lon);
  });

  setInterval(() => {
    const p = parseLatLon(latInput.value, lonInput.value);
    if (!p) return;
    refresh(p.lat, p.lon);
  }, 60000);
}
