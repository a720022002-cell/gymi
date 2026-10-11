import * as Network from 'expo-network';

/** Phone apps: call back with true/false when the connection comes and goes. */
export function watchOnline(cb: (online: boolean) => void) {
  const read = (s: Network.NetworkState) => cb(!(s.isConnected === false || s.isInternetReachable === false));
  Network.getNetworkStateAsync().then(read, () => {});
  const sub = Network.addNetworkStateListener(read);
  return () => sub.remove();
}
