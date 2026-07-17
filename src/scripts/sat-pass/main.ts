import {
  DEFAULT_LAT,
  DEFAULT_LON,
  formatAz,
  formatLocalTime,
  parseLatLon,
  requestGeo,
} from '../shared/geo';
import { loadSatrec, tleMeta } from './propagate';
import { buildSkyState, samplePassTrack, startSkyAnim, type SkyVizState } from './sky-viz';

function $(id: string) {
  return document.getElementById(id)!;
}

function elHint(deg: number) {
  if (deg >= 60) return `${deg.toFixed(0)}° · 几乎正头顶，很好找`;
  if (deg >= 30) return `${deg.toFixed(0)}° · 比较高，容易看到`;
  return `${deg.toFixed(0)}° · 偏低，贴地平线`;
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
  let lat = DEFAULT_LAT;
  let lon = DEFAULT_LON;
  const canvas = $('sat-canvas') as HTMLCanvasElement;
  startSkyAnim(canvas, () => skyState);

  const selectPass = (index: number) => {
    const passes = skyState.passes;
    if (!passes.length || index < 0 || index >= passes.length) return;
    skyState = {
      ...skyState,
      passIndex: index,
      track: samplePassTrack(satrec, lat, lon, passes[index], 6),
    };
    document.querySelectorAll('#sat-rows tr').forEach((tr, i) => {
      tr.classList.toggle('sat-row-active', i == index);
      tr.classList.toggle('sat-row-next', i == 0);
    });
    $('sat-status').textContent = `共 ${passes.length} 次过顶 · 正在演示第 ${index + 1} 次`;
  };

  const run = (la: number, lo: number) => {
    lat = la;
    lon = lo;
    skyState = buildSkyState(satrec, lat, lon);
    const passes = skyState.passes;
    const tbody = $('sat-rows');
    if (passes.length == 0) {
      tbody.innerHTML = '<tr><td colspan="5">未来 48 小时没有好看的过顶（仰角≥10°）</td></tr>';
      $('sat-next').textContent = '暂无可见过顶';
      $('sat-card-when').textContent = '未来 48h 暂无';
      $('sat-card-el').textContent = '—';
      $('sat-card-az').textContent = '—';
      $('sat-status').textContent = '换个时间或确认定位后再试';
    } else {
      const next = passes[0];
      $('sat-next').textContent = `下次：${formatLocalTime(next.max)} · 最高 ${next.maxEl.toFixed(0)}°（${formatAz(next.azAtMax)}）`;
      $('sat-card-when').textContent = formatLocalTime(next.max);
      $('sat-card-el').textContent = elHint(next.maxEl);
      $('sat-card-az').textContent = formatAz(next.azAtMax);
      tbody.innerHTML = passes
        .map(
          (p, i) => `<tr class="sat-row-pick ${i == 0 ? 'sat-row-next sat-row-active' : ''}" data-pass="${i}">
            <td>${formatLocalTime(p.start)}</td>
            <td>${formatLocalTime(p.max)}</td>
            <td>${formatLocalTime(p.end)}</td>
            <td>${elHint(p.maxEl)}</td>
            <td>${formatAz(p.azAtMax)}</td>
          </tr>`,
        )
        .join('');
      tbody.querySelectorAll('[data-pass]').forEach((tr) => {
        tr.addEventListener('click', () => {
          selectPass(Number((tr as HTMLElement).dataset.pass));
        });
      });
      $('sat-status').textContent = `共 ${passes.length} 次过顶 · 点表格行可切换动画`;
    }
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

  run(DEFAULT_LAT, DEFAULT_LON);
  $('sat-geo-note').textContent = '观测点：北京（默认）';
  requestGeo((pos) => {
    latInput.value = pos.lat.toFixed(4);
    lonInput.value = pos.lon.toFixed(4);
    $('sat-geo-note').textContent = pos.source == 'gps' ? 'GPS' : '默认（北京）';
    run(pos.lat, pos.lon);
  });
}
