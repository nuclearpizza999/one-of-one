/*
 * The sun's position from the NOAA solar calculator's equations (declination and
 * equation of time from the Julian century, true solar time, hour angle, zenith),
 * without the refraction correction. Accurate to a fraction of a degree, which is
 * far finer than the tone bands it feeds.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;

/**
 * The capture moment in UTC milliseconds: the zone-free wall-clock, read with the
 * local getters as exifr builds it, minus the photo's own UTC offset in minutes.
 */
export function captureInstant(takenAt: Date, utcOffsetMinutes: number): number {
  const wall = Date.UTC(
    takenAt.getFullYear(),
    takenAt.getMonth(),
    takenAt.getDate(),
    takenAt.getHours(),
    takenAt.getMinutes(),
    takenAt.getSeconds(),
  );
  return wall - utcOffsetMinutes * 60_000;
}

/** The sun's height above the horizon in degrees, negative below it, at a UTC moment and a place. */
export function sunElevation(utcMs: number, lat: number, lng: number): number {
  const jd = utcMs / DAY_MS + 2_440_587.5;
  const t = (jd - 2_451_545) / 36_525;
  const l0 = (((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360) + 360) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    Math.sin(m * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * RAD) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + centre - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD));
  const y = Math.tan((eps / 2) * RAD) ** 2;
  const eqTime =
    4 *
    DEG *
    (y * Math.sin(2 * l0 * RAD) -
      2 * e * Math.sin(m * RAD) +
      4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) -
      0.5 * y * y * Math.sin(4 * l0 * RAD) -
      1.25 * e * e * Math.sin(2 * m * RAD));
  const minutes = (((utcMs % DAY_MS) + DAY_MS) % DAY_MS) / 60_000;
  const trueSolar = (((minutes + eqTime + 4 * lng) % 1440) + 1440) % 1440;
  const hourAngle = trueSolar / 4 - 180;
  const cosZenith =
    Math.sin(lat * RAD) * Math.sin(decl) + Math.cos(lat * RAD) * Math.cos(decl) * Math.cos(hourAngle * RAD);
  return 90 - Math.acos(Math.min(1, Math.max(-1, cosZenith))) * DEG;
}
