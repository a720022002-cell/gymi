// Workout sounds on phones: short WAV files made by scripts/make-sounds.py, played with expo-audio.
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const FILES: Record<string, number> = {
  default: require('../../assets/sounds/default.wav'),
  gymbell: require('../../assets/sounds/gymbell.wav'),
  horn: require('../../assets/sounds/horn.wav'),
  lightweight: require('../../assets/sounds/lightweight.wav'),
  yeahbuddy: require('../../assets/sounds/yeahbuddy.wav'),
};

let mode = false;
let current: AudioPlayer | null = null;

/** Play one of the workout sounds by id. Mixes with music and plays in silent mode. */
export function playTone(id: string) {
  if (id === 'none') return;
  try {
    if (!mode) {
      mode = true;
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    }
    current?.release();
    const p = createAudioPlayer(FILES[id] ?? FILES.default);
    current = p;
    p.play();
    setTimeout(() => {
      if (current === p) current = null;
      p.release();
    }, 3000);
  } catch {}
}
