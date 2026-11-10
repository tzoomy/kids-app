import type { AudioProvider, SpeechRequest } from './types';

const BCP47: Record<string, string> = { en: 'en-US', fr: 'fr-FR' };

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

  private loadVoices(): void {
    this.voices = window.speechSynthesis.getVoices();
  }

  play(request: SpeechRequest): Promise<boolean> {
    if (!this.isAvailable()) return Promise.resolve(false);
    const synth = window.speechSynthesis;
    synth.cancel();

    return new Promise<boolean>((resolve) => {
      const lang = BCP47[request.lang] ?? request.lang;
      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.lang = lang;
      utterance.rate = request.rate ?? 0.9;
      utterance.pitch = 1.1;

      const voice =
        this.voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) ??
        this.voices.find((v) => v.lang.toLowerCase().startsWith(request.lang));
      if (voice) utterance.voice = voice;

      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      try {
        synth.speak(utterance);
      } catch {
        resolve(false);
      }
    });
  }
}
