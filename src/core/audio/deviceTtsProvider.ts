import type { AudioProvider, SpeechRequest } from './types';

const BCP47: Record<string, string> = { en: 'en-US', fr: 'fr-FR', he: 'he-IL' };

/** Safety cap so a missing onend/onerror on Android Chrome cannot hang listening forever. */
export const TTS_SAFETY_TIMEOUT_MS = 8000;

/** Device Web Speech API TTS. Fragile on some Android tablets, used as the fallback. */
export class DeviceTtsProvider implements AudioProvider {
  readonly id = 'device-tts';
  private voices: SpeechSynthesisVoice[] = [];

  isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  warmup(): void {
    if (!this.isAvailable()) return;
    this.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
  }

  stop(): void {
    if (this.isAvailable()) window.speechSynthesis.cancel();
  }

  private hasVoiceFor(lang: string): boolean {
    if (!this.voices.length) this.loadVoices();
    return this.voices.some((v) => v.lang.toLowerCase().startsWith(lang) || (lang === 'he' && v.lang.toLowerCase().startsWith('iw')));
  }

  private loadVoices(): void {
    this.voices = window.speechSynthesis.getVoices();
  }

  play(request: SpeechRequest): Promise<boolean> {
    if (!this.isAvailable() || typeof SpeechSynthesisUtterance === 'undefined') {
      return Promise.resolve(false);
    }
    if (request.lang === 'he' && !this.hasVoiceFor('he')) {
      // Silence is better than Hebrew read by an English voice.
      return Promise.resolve(false);
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(ok);
      };

      const timer = window.setTimeout(() => {
        try {
          synth.cancel();
        } catch {
          // ignore
        }
        finish(false);
      }, TTS_SAFETY_TIMEOUT_MS);

      const lang = BCP47[request.lang] ?? request.lang;
      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.lang = lang;
      utterance.rate = request.rate ?? 0.9;
      utterance.pitch = 1.1;

      const voice =
        this.voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) ??
        this.voices.find((v) => v.lang.toLowerCase().startsWith(request.lang));
      if (voice) utterance.voice = voice;

      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      try {
        synth.speak(utterance);
      } catch {
        finish(false);
      }
    });
  }
}
