/** Spoken read-back (speechSynthesis) and short synthesized sound cues (no audio assets). */
export class Voice {
  enabled = false;
  speak(text: string, bcp47: string) {
    if (!this.enabled || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(bcp47.slice(0, 2).toLowerCase()));
    if (v) u.voice = v;
    u.rate = 1.02;
    speechSynthesis.speak(u);
  }
  cancel() {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}

export type CueName = 'lock' | 'run' | 'cancel' | 'ask' | 'error';

export class Cues {
  enabled = true;
  private ctx: AudioContext | null = null;
  play(name: CueName) {
    if (!this.enabled || typeof AudioContext === 'undefined') return;
    this.ctx ??= new AudioContext();
    const ctx = this.ctx;
    const tone = (freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.06) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur + 0.02);
    };
    switch (name) {
      case 'lock':
        tone(1320, 0, 0.06, 'triangle', 0.04);
        break;
      case 'run':
        tone(660, 0, 0.18);
        tone(990, 0.07, 0.25);
        break;
      case 'cancel':
        tone(180, 0, 0.18, 'sine', 0.08);
        break;
      case 'ask':
        tone(520, 0, 0.12);
        tone(780, 0.12, 0.16);
        break;
      case 'error':
        tone(220, 0, 0.12, 'square', 0.025);
        break;
    }
  }
}
