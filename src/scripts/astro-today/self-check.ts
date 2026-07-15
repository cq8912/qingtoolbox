import { moonIllumination, planetTable, sunMoonRiseSet } from './ephemeris';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const when = new Date('2024-06-21T12:00:00Z');
const lat = 39.9;
const lon = 116.4;

const illum = moonIllumination(when);
assert(illum >= 0 && illum <= 1, `moon illum out of range: ${illum}`);

const rs = sunMoonRiseSet(when, lat, lon);
assert(rs.sun.rise != null && rs.sun.set != null, 'sun rise/set missing');
assert(rs.sun.rise! < rs.sun.set!, 'sun rise should be before set');
// 下午读数仍应是「当日」日出（早于 when），而非次日
assert(rs.sun.rise!.getTime() < when.getTime(), 'today sunrise should precede afternoon when');
assert(rs.sun.rise!.toDateString() == when.toDateString(), 'sunrise not same local calendar day');

assert(rs.moon.rise != null || rs.moon.set != null, 'moon rise/set both null');

const planets = planetTable(when, lat, lon);
assert(planets.length == 5, 'expected 5 planets');
for (const p of planets) {
  assert(Number.isFinite(p.altitude) && Number.isFinite(p.azimuth), `${p.name} bad coords`);
}

console.log('PASS: astro-today ephemeris OK');
console.log(`  moon illum ${(illum * 100).toFixed(1)}% @ ${when.toISOString()}`);
console.log(`  sun rise ${rs.sun.rise!.toISOString()} set ${rs.sun.set!.toISOString()}`);
