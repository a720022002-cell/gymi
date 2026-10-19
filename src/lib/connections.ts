// The devices and apps people use, and where to tap inside each one so its data reaches Apple Health (iPhone) or
// Health Connect (Android), and from there Gymi. Menu names stay in English: that's how most of these apps show them.
import type { WearableProvider } from './wearables';

export type DeviceCat = 'watch' | 'ring' | 'band' | 'scale' | 'sleep' | 'app';
/** Where to tap, menu by menu. "auto": it sends by itself. null: it can't send there. */
export type Path = string[] | 'auto' | null;
export type CatalogDevice = {
  id: string;
  name: string;
  cat: DeviceCat;
  /** Its own app, where the sharing is turned on. */
  app: string;
  ios: Path;
  android: Path;
  /** Linked straight to Gymi too (no phone app in between). */
  direct?: WearableProvider;
  /** Shown when one phone can't be used, or something else to know. */
  note?: string;
};

export const CATS: [DeviceCat, string][] = [
  ['watch', 'Watches'],
  ['ring', 'Smart rings'],
  ['band', 'Straps and bands'],
  ['scale', 'Scales'],
  ['sleep', 'Sleep'],
  ['app', 'Fitness apps'],
];

const both = (p: string[]): { ios: Path; android: Path } => ({ ios: p, android: p });

export const CATALOG: CatalogDevice[] = [
  { id: 'apple', name: 'Apple Watch', cat: 'watch', app: 'Watch', ios: 'auto', android: null, note: 'Apple Watch only works with iPhone.' },
  { id: 'garmin', name: 'Garmin', cat: 'watch', app: 'Garmin Connect', ...both(['More', 'Settings', 'Connected Apps']) },
  { id: 'samsung', name: 'Galaxy Watch', cat: 'watch', app: 'Samsung Health', ios: null, android: ['⋮', 'Settings', 'Health Connect'], note: 'Galaxy Watch only works with Android phones.' },
  { id: 'polar', name: 'Polar', cat: 'watch', app: 'Polar Flow', ...both(['More', 'General settings']) },
  { id: 'coros', name: 'COROS', cat: 'watch', app: 'COROS', ...both(['Profile', 'Third-party apps']) },
  { id: 'suunto', name: 'Suunto', cat: 'watch', app: 'Suunto', ...both(['Profile', 'Settings', 'Partner services']) },
  { id: 'fitbit', name: 'Fitbit / Pixel Watch', cat: 'watch', app: 'Fitbit', ios: null, android: ['Profile', 'Settings', 'Health Connect'], note: 'Fitbit doesn’t send to Apple Health. A direct Fitbit link is coming to Gymi.' },
  { id: 'huawei', name: 'Huawei', cat: 'watch', app: 'Huawei Health', ...both(['Me', 'Privacy management', 'Data sharing']) },
  { id: 'amazfit', name: 'Amazfit', cat: 'watch', app: 'Zepp', ...both(['Profile', 'Add accounts']) },
  { id: 'xiaomi', name: 'Xiaomi', cat: 'watch', app: 'Mi Fitness', ...both(['Profile', 'Third-party data']) },
  { id: 'oura', name: 'Oura Ring', cat: 'ring', app: 'Oura', direct: 'oura', ...both(['Menu', 'Settings']) },
  { id: 'ultrahuman', name: 'Ultrahuman Ring', cat: 'ring', app: 'Ultrahuman', ...both(['Profile', 'Settings']) },
  { id: 'galaxyring', name: 'Galaxy Ring', cat: 'ring', app: 'Samsung Health', ios: null, android: ['⋮', 'Settings', 'Health Connect'], note: 'Galaxy Ring only works with Android phones.' },
  { id: 'ringconn', name: 'RingConn', cat: 'ring', app: 'RingConn', ...both(['Me']) },
  { id: 'whoop', name: 'WHOOP', cat: 'band', app: 'WHOOP', direct: 'whoop', ...both(['More', 'App Settings', 'Integrations']) },
  { id: 'xiaomiband', name: 'Xiaomi Smart Band', cat: 'band', app: 'Mi Fitness', ...both(['Profile', 'Third-party data']) },
  { id: 'withings', name: 'Withings', cat: 'scale', app: 'Withings', ...both(['Profile', 'Settings', 'Apps']) },
  { id: 'renpho', name: 'RENPHO', cat: 'scale', app: 'Renpho Health', ...both(['Me', 'Settings']) },
  { id: 'eufy', name: 'eufy', cat: 'scale', app: 'EufyLife', ...both(['Me', 'Settings']) },
  { id: 'inbody', name: 'InBody', cat: 'scale', app: 'InBody', ...both(['Settings']) },
  { id: 'garminindex', name: 'Garmin Index', cat: 'scale', app: 'Garmin Connect', ...both(['More', 'Settings', 'Connected Apps']) },
  { id: 'eightsleep', name: 'Eight Sleep', cat: 'sleep', app: 'Eight Sleep', ios: ['Profile', 'Settings'], android: ['Profile', 'Settings'] },
  { id: 'sleepcycle', name: 'Sleep Cycle', cat: 'sleep', app: 'Sleep Cycle', ...both(['Settings']) },
  { id: 'strava', name: 'Strava', cat: 'app', app: 'Strava', ...both(['You', 'Settings', 'Applications, Services, and Devices']) },
  { id: 'nike', name: 'Nike Run Club', cat: 'app', app: 'Nike Run Club', ...both(['Profile', 'Settings']) },
  { id: 'peloton', name: 'Peloton', cat: 'app', app: 'Peloton', ...both(['Profile', 'Settings', 'Apps']) },
];

/** Match a search: the device's name, its app, or its kind. */
export function searchCatalog(q: string, catName: (c: DeviceCat) => string): CatalogDevice[] {
  const s = q.trim().toLowerCase();
  if (!s) return CATALOG;
  return CATALOG.filter((d) => [d.name, d.app, catName(d.cat)].some((x) => x.toLowerCase().includes(s)));
}
