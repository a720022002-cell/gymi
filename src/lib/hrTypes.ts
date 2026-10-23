/** Where a live session's heart rate comes from: a Bluetooth sensor, the Apple Watch (Apple Health), or none. */
export type HrSource = 'ble' | 'apple' | 'none';
/** connecting / waiting (connected, no reading yet) / live / lost (reconnecting) / unavailable (no permission or not on this phone). */
export type HrStatus = 'off' | 'connecting' | 'waiting' | 'live' | 'lost' | 'unavailable';
export type SavedSensor = { id: string; name: string };
