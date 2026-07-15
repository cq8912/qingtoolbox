import { geodeticAt, loadSatrec, lookAt } from './propagate';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const satrec = loadSatrec();
// TLE 历元附近抽样
const when = new Date(Date.UTC(2026, 6, 15, 12, 0, 0));
const geo = geodeticAt(satrec, when);
assert(geo != null, 'geodetic null');
assert(geo!.lat >= -90 && geo!.lat <= 90, `lat ${geo!.lat}`);
assert(geo!.lon >= -180 && geo!.lon <= 180, `lon ${geo!.lon}`);
assert(geo!.heightKm > 200 && geo!.heightKm < 600, `height ${geo!.heightKm}`);

const look = lookAt(satrec, when, 39.9, 116.4);
assert(look != null, 'look null');
assert(Number.isFinite(look!.elevation) && Number.isFinite(look!.azimuth), 'look nan');

console.log('PASS: sat-pass propagate OK');
console.log(`  ISS @ ${when.toISOString()} lat=${geo!.lat.toFixed(2)} lon=${geo!.lon.toFixed(2)} h=${geo!.heightKm.toFixed(0)}km`);
