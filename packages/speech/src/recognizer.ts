import type { LangCode, SpeechEvent } from '@hocus/core';
import { VoiceActivity } from './vad.ts';

/* Minimal typings for the Web Speech API (not in lib.dom for every TS version). */
interface SRAlternative {
  transcript: string;
  confidence: number;
}
interface SRResult {
  isFinal: boolean;
  length: number;
  [i: number]: SRAlternative;
}
interface SRResultList {
  length: number;
  [i: number]: SRResult;
}
interface SREvent {
  resultIndex: number;
  results: SRResultList;
}
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string; message?: string }) => void) | null;
  onresult: ((e: SREvent) => void) | null;
}
type SRCtor = (new () => SR) & {
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};

export type SpeechStatus = 'unsupported' | 'idle' | 'listening' | 'error' | 'denied';
export type SpeechPrivacy = 'on-device' | 'cloud' | 'unknown';

const getCtor = (): SRCtor | undefined => {
  const w = globalThis as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

export function speechSupported(): boolean {
  return !!getCtor();
}

export interface RecognizerOptions {
  lang: LangCode;
  bcp47: string;
  emit: (e: SpeechEvent) => void;
  now?: () => number;
  /** Ask for on-device recognition when the browser offers it. */
  preferLocal?: boolean;
}

/**
 * Push-to-talk speech recognizer. Emits start / interim / final / end SpeechEvents with
 * timestamps from the same clock as the pointer, plus voiced segments from our own VAD.
 */
export class Recognizer {
  status: SpeechStatus = speechSupported() ? 'idle' : 'unsupported';
  privacy: SpeechPrivacy = 'unknown';
  continuous = false;
  private sr: SR | null = null;
  private vad = new VoiceActivity();
  private o: RecognizerOptions;
  private now: () => number;
  private gotFinal = false;
  private statusCbs = new Set<(s: SpeechStatus, detail?: string) => void>();
  private wantListening = false;

  constructor(o: RecognizerOptions) {
    this.o = o;
    this.now = o.now ?? (() => performance.now());
  }

  onStatus(fn: (s: SpeechStatus, detail?: string) => void) {
    this.statusCbs.add(fn);
    return () => this.statusCbs.delete(fn);
  }

  private set(s: SpeechStatus, detail?: string) {
    this.status = s;
    for (const fn of this.statusCbs) fn(s, detail);
  }

  setLang(lang: LangCode, bcp47: string) {
    this.o = { ...this.o, lang, bcp47 };
    if (this.sr) this.sr.lang = bcp47;
  }

  /** Check on-device availability (Chrome `SpeechRecognition.available`). */
  async checkLocal(): Promise<SpeechPrivacy> {
    const C = getCtor();
    if (!C?.available) return (this.privacy = 'cloud');
    try {
      const a = await C.available({ langs: [this.o.bcp47], processLocally: true });
      this.privacy = a === 'available' ? 'on-device' : 'cloud';
    } catch {
      this.privacy = 'cloud';
    }
    return this.privacy;
  }

  async installLocal(): Promise<boolean> {
    const C = getCtor();
    if (!C?.install) return false;
    try {
      return await C.install({ langs: [this.o.bcp47], processLocally: true });
    } catch {
      return false;
    }
  }

  private build(): SR | null {
    const C = getCtor();
    if (!C) return null;
    const sr = new C();
    sr.lang = this.o.bcp47;
    sr.interimResults = true;
    sr.continuous = this.continuous;
    sr.maxAlternatives = 3;
    if (this.o.preferLocal && this.privacy === 'on-device' && 'processLocally' in sr) sr.processLocally = true;
    sr.onstart = () => this.set('listening');
    sr.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') this.set('denied', e.error);
      else if (e.error !== 'no-speech' && e.error !== 'aborted') this.set('error', e.error);
    };
    sr.onend = () => {
      this.vad.stop();
      this.o.emit({ t: this.now(), kind: 'end', lang: this.o.lang });
      if (this.status === 'listening') this.set('idle');
      if (this.continuous && this.wantListening) setTimeout(() => this.begin(), 150);
    };
    sr.onresult = (e) => {
      const t = this.now();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const best = res[0]?.transcript?.trim() ?? '';
        if (!best) continue;
        if (res.isFinal) {
          this.gotFinal = true;
          const alts: string[] = [];
          for (let k = 1; k < res.length; k++) if (res[k]?.transcript) alts.push(res[k]!.transcript.trim());
          const vad = this.vad.segments();
          this.o.emit({ t, kind: 'final', text: best, lang: this.o.lang, ...(alts.length ? { alts } : {}), ...(vad.length ? { vad } : {}) });
        } else this.o.emit({ t, kind: 'interim', text: best, lang: this.o.lang });
      }
    };
    return sr;
  }

  private begin() {
    this.sr = this.build();
    if (!this.sr) return;
    this.gotFinal = false;
    this.o.emit({ t: this.now(), kind: 'start', lang: this.o.lang });
    void this.vad.start(this.now);
    try {
      this.sr.start();
    } catch {
      /* already started */
    }
  }

  /** Push-to-talk down. */
  start() {
    if (this.status === 'unsupported') return;
    this.wantListening = true;
    if (this.status === 'listening') return;
    this.begin();
  }

  /** Push-to-talk up: stop and let the recognizer deliver its final result. */
  stop() {
    this.wantListening = false;
    this.sr?.stop();
  }

  abort() {
    this.wantListening = false;
    this.sr?.abort();
    this.vad.stop();
  }

  /** Measured speech onset of the current/last utterance (for calibration). */
  lastOnset(): number | null {
    return this.vad.segments()[0]?.start ?? null;
  }

  get hadFinal() {
    return this.gotFinal;
  }
}
