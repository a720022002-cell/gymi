import { router } from 'expo-router';

/** Go back, or home when there's nothing to go back to (a reloaded page on the web has no history). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
