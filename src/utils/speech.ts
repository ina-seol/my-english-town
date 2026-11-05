/** Text-to-speech via the browser's built-in voices (no network needed on most devices). */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
export function speak(text: string, enabled = true) {
  if (!enabled || !canSpeak()) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.85;
    u.pitch = 1.1;
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith('en'));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}
