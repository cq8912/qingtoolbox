import {
  DEFAULT_LAT,
  DEFAULT_LON,
  formatAz,
  formatLocalTime,
  parseLatLon,
  requestGeo,
} from '../shared/geo';
import { loadSatrec, tleMeta } from './propagate';
import { buildSkyState, startSkyAnim, type SkyVizState } from './sky-viz';

function $(id: string) {
  return document.getElementById(id)!;
}

export function bootSatPass() {
  const satrec = loadSatrec();
  const meta = tleMeta();
  $('sat-updated').textContent = meta.updated;

  const latInput = $('sat-lat') as HTMLInputElement;
  const lonInput = $('sat-lon') as HTMLInputElement;
  latInput.value = String(DEFAULT_LAT);
  lonInput.value = String(DEFAULT_LON);

  let skyState: SkyVizState = buildSkyState(satrec, DEFAULT_LAT, DEFAULT_LON);
  const canvas = $('sat-canvas') as HTMLCanvasElement;
  startSkyAnim(canvas, () => skyState);

  const run = (lat: number, lon: number) => {
    skyState = buildSkyState(satrec, lat, lon);
    const passes = skyState.passes;
    const tbody = $('sat-rows');
    if (passes.length == 0) {
      tbody.innerHTML = '<tr><td colspan="5">未来 48h 内无仰角≥10° 的过顶</td></tr>';
      $('sat-next').textContent = '暂无可见过顶';
    } else {
      const next = passes[0];
      $('sat-next').textContent = `最近：${formatLocalTime(next.max)} 头顶 ${next.maxEl.toFixed(0)}°（${formatAz(next.azAtMax)}）`;
      tbody.innerHTML = passes
        .map(
          (p, i) => `<tr class="${i == 0 ? 'sat-row-next' : ''}">
            <td>${formatLocalTime(p.start)}</td>
            <td>${formatLocalTime(p.max)}</td>
            <td>${formatLocalTime(p.end)}</td>
            <td>${p.maxEl.toFixed(1)}°</td>
            <td>${formatAz(p.azAtMax)}</td>
          </tr>`,
        )
        .join('');
    }
    $('sat-status').textContent = `共 ${passes.length} 次过顶 · 动画演示最近一次`;
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

  // 进入即算
  run(DEFAULT_LAT, DEFAULT_LON);
  $('sat-geo-note').textContent = '观测点：北京（默认）';
  requestGeo((pos) => {
    latInput.value = pos.lat.toFixed(4);
    lonInput.value = pos.lon.toFixed(4);
    $('sat-geo-note').textContent = pos.source == 'gps' ? 'GPS' : '默认（北京）';
    run(pos.lat, pos.lon);
  });
}
