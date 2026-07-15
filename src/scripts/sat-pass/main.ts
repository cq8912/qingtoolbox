import {
  DEFAULT_LAT,
  DEFAULT_LON,
  formatAz,
  formatLocalTime,
  parseLatLon,
  requestGeo,
} from '../shared/geo';
import { findPasses, loadSatrec, tleMeta } from './propagate';

function $(id: string) {
  return document.getElementById(id)!;
}

export function bootSatPass() {
  const satrec = loadSatrec();
  const meta = tleMeta();
  $('sat-updated').textContent = meta.updated;
  $('sat-note').textContent = `星历快照日期 ${meta.updated}，精度随时间下降；不自动联网更新。`;

  const latInput = $('sat-lat') as HTMLInputElement;
  const lonInput = $('sat-lon') as HTMLInputElement;
  latInput.value = String(DEFAULT_LAT);
  lonInput.value = String(DEFAULT_LON);

  const run = (lat: number, lon: number) => {
    $('sat-status').textContent = '计算中…';
    const passes = findPasses(satrec, lat, lon, new Date(), 48, 10, 30);
    const tbody = $('sat-rows');
    if (passes.length == 0) {
      tbody.innerHTML = '<tr><td colspan="5">未来 48h 内无仰角≥10° 的过顶</td></tr>';
    } else {
      tbody.innerHTML = passes
        .map(
          (p) => `<tr>
            <td>${formatLocalTime(p.start)}</td>
            <td>${formatLocalTime(p.max)}</td>
            <td>${formatLocalTime(p.end)}</td>
            <td>${p.maxEl.toFixed(1)}°</td>
            <td>${formatAz(p.azAtMax)}</td>
          </tr>`,
        )
        .join('');
    }
    $('sat-status').textContent = `共 ${passes.length} 次过顶（48h · 仰角≥10°）`;
    drawHorizon(passes);
  };

  const drawHorizon = (passes: ReturnType<typeof findPasses>) => {
    const canvas = $('sat-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#010305';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,232,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(20, h - 24);
    ctx.lineTo(w - 20, h - 24);
    ctx.stroke();
    ctx.fillStyle = 'rgba(232,244,255,0.5)';
    ctx.font = '11px monospace';
    ctx.fillText('地平线', 20, h - 8);
    if (passes.length == 0) return;
    // 草图：下一次过顶的仰角弧
    const p = passes[0];
    const peakX = w / 2;
    const peakY = h - 24 - Math.min(p.maxEl, 90) * ((h - 60) / 90);
    ctx.strokeStyle = '#00e8ff';
    ctx.beginPath();
    ctx.moveTo(40, h - 24);
    ctx.quadraticCurveTo(peakX, peakY, w - 40, h - 24);
    ctx.stroke();
    ctx.fillStyle = '#ffc857';
    ctx.beginPath();
    ctx.arc(peakX, peakY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232,244,255,0.7)';
    ctx.fillText(`下次最大仰角 ${p.maxEl.toFixed(1)}°`, peakX - 60, peakY - 10);
  };

  $('sat-apply').addEventListener('click', () => {
    const p = parseLatLon(latInput.value, lonInput.value);
    if (!p) {
      $('sat-geo-note').textContent = '经纬度无效';
      return;
    }
    $('sat-geo-note').textContent = '手动观测点';
    run(p.lat, p.lon);
  });
  $('sat-gps').addEventListener('click', () => {
    requestGeo((pos) => {
      latInput.value = pos.lat.toFixed(4);
      lonInput.value = pos.lon.toFixed(4);
      $('sat-geo-note').textContent = pos.source == 'gps' ? 'GPS' : '默认（北京）';
      run(pos.lat, pos.lon);
    });
  });

  requestGeo((pos) => {
    latInput.value = pos.lat.toFixed(4);
    lonInput.value = pos.lon.toFixed(4);
    $('sat-geo-note').textContent = pos.source == 'gps' ? 'GPS' : '默认（北京）';
    run(pos.lat, pos.lon);
  });
}
