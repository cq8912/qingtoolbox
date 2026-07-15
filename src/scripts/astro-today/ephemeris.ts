import * as Astronomy from 'astronomy-engine';

export type RiseSet = { rise: Date | null; set: Date | null };

export type PlanetRow = {
  name: string;
  body: Astronomy.Body;
  altitude: number;
  azimuth: number;
};

const PLANETS: { name: string; body: Astronomy.Body }[] = [
  { name: '水星', body: Astronomy.Body.Mercury },
  { name: '金星', body: Astronomy.Body.Venus },
  { name: '火星', body: Astronomy.Body.Mars },
  { name: '木星', body: Astronomy.Body.Jupiter },
  { name: '土星', body: Astronomy.Body.Saturn },
];

function observer(lat: number, lon: number) {
  return new Astronomy.Observer(lat, lon, 0);
}

/** 月相：0 新月 → 1 满月（照明比例） */
export function moonIllumination(when: Date): number {
  return Astronomy.Illumination(Astronomy.Body.Moon, when).phase_fraction;
}

function localDayStart(when: Date) {
  const d = new Date(when);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() == b.getFullYear() && a.getMonth() == b.getMonth() && a.getDate() == b.getDate();
}

/** 取「当地日历日」的升/落，而非从当下起下一次事件 */
export function riseSet(body: Astronomy.Body, when: Date, lat: number, lon: number): RiseSet {
  const obs = observer(lat, lon);
  const start = localDayStart(when);
  const riseEv = Astronomy.SearchRiseSet(body, obs, +1, start, 1.1);
  const setEv = Astronomy.SearchRiseSet(body, obs, -1, start, 1.1);
  const rise = riseEv && sameLocalDay(riseEv.date, when) ? riseEv.date : null;
  const set = setEv && sameLocalDay(setEv.date, when) ? setEv.date : null;
  return { rise, set };
}

export function horizontal(
  body: Astronomy.Body,
  when: Date,
  lat: number,
  lon: number,
): { altitude: number; azimuth: number } {
  const eq = Astronomy.Equator(body, when, observer(lat, lon), true, true);
  const hor = Astronomy.Horizon(when, observer(lat, lon), eq.ra, eq.dec, 'normal');
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

export function planetTable(when: Date, lat: number, lon: number): PlanetRow[] {
  return PLANETS.map((p) => {
    const h = horizontal(p.body, when, lat, lon);
    return { name: p.name, body: p.body, altitude: h.altitude, azimuth: h.azimuth };
  });
}

export function sunMoonRiseSet(when: Date, lat: number, lon: number) {
  return {
    sun: riseSet(Astronomy.Body.Sun, when, lat, lon),
    moon: riseSet(Astronomy.Body.Moon, when, lat, lon),
  };
}
