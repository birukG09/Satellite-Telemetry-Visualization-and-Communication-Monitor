// Satellite data utilities and constants

export const SATELLITE_TYPES = [
  'Communication',
  'Navigation',
  'Space Station',
  'Weather',
  'Military',
  'Scientific',
  'Commercial',
] as const;

export const ORBIT_CLASSES = [
  'LEO', // Low Earth Orbit (160-2000 km)
  'MEO', // Medium Earth Orbit (2000-35786 km)
  'GEO', // Geostationary Orbit (~35786 km)
] as const;

export const COUNTRIES = [
  'United States',
  'Russia',
  'China',
  'European Union',
  'Japan',
  'India',
  'Canada',
  'Brazil',
  'South Korea',
  'Australia',
  'International',
  'Luxembourg',
] as const;

export interface TLEData {
  line1: string;
  line2: string;
}

// Sample TLE data for well-known satellites
export const SAMPLE_TLE_DATA: Record<string, TLEData> = {
  'ISS': {
    line1: '1 25544U 98067A   24015.50000000  .00002182  00000+0  40768-4 0  9992',
    line2: '2 25544  51.6461 339.7939 0001220  92.8340 267.3124 15.49309239426382'
  },
  'HUBBLE': {
    line1: '1 20580U 90037B   24015.50000000  .00000234  00000+0  12345-4 0  9990',
    line2: '2 20580  28.4690 123.4567 0002345  45.6789 314.5678 15.09876543210987'
  },
  'GPS_BIIF_1': {
    line1: '1 37753U 11036A   24015.50000000 -.00000023  00000+0  00000+0 0  9997',
    line2: '2 37753  55.0000 123.4567 0000000  45.6789 314.1593  2.00561195123456'
  }
};

export function getOrbitClassByAltitude(altitudeKm: number): string {
  if (altitudeKm < 2000) return 'LEO';
  if (altitudeKm < 35786) return 'MEO';
  return 'GEO';
}

export function getOrbitPeriod(altitudeKm: number): number {
  // Calculate orbital period using Kepler's third law
  const earthRadius = 6371; // km
  const mu = 398600; // Earth's gravitational parameter km³/s²
  const a = earthRadius + altitudeKm; // semi-major axis
  const period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
  return period / 60; // convert to minutes
}

export function getOrbitalVelocity(altitudeKm: number): number {
  // Calculate orbital velocity
  const earthRadius = 6371; // km
  const mu = 398600; // Earth's gravitational parameter km³/s²
  const r = earthRadius + altitudeKm;
  return Math.sqrt(mu / r); // km/s
}

export function formatCoordinate(coord: number, type: 'lat' | 'lon'): string {
  const abs = Math.abs(coord);
  const dir = type === 'lat' 
    ? (coord >= 0 ? 'N' : 'S')
    : (coord >= 0 ? 'E' : 'W');
  return `${abs.toFixed(4)}° ${dir}`;
}

export function formatDistance(km: number): string {
  if (km >= 1000) {
    return `${(km / 1000).toFixed(1)}k km`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatTime(date: Date): string {
  return date.toISOString().slice(11, 19) + ' UTC';
}

export function isValidTLE(line1: string, line2: string): boolean {
  // Basic TLE validation
  if (line1.length !== 69 || line2.length !== 69) return false;
  if (line1[0] !== '1' || line2[0] !== '2') return false;
  
  // Check satellite numbers match
  const satNum1 = line1.substring(2, 7);
  const satNum2 = line2.substring(2, 7);
  return satNum1 === satNum2;
}
