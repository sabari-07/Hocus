/**
 * Energy-based voice-activity detection on the microphone (Web Audio, on-device).
 * Produces voiced segments in the same clock as pointer samples; the engine uses them to refine
 * when each word was spoken (fusion-engine requirement 6.3) and onboarding uses the first onset to
 * measure the recognizer lag.
 */
export class VoiceActivity {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private segs: Array<{ start: number; end: number }> = [];
  private open: number | null = null;
  private floor = 0.008;
  private quietSince = 0;
  /** Live input level 0..1 for the speech bar meter. */
  level = 0;

  async start(now: () => number) {
    this.stop();
    this.segs = [];
    this.open = null;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return;
    }
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    const buf = new Float32Array(this.analyser.fftSize);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const t = now();
      this.level = Math.min(1, rms * 12);
      const on = rms > Math.max(0.015, this.floor * 3);
      if (!on) this.floor = this.floor * 0.98 + rms * 0.02;
      if (on) {
        this.quietSince = 0;
        if (this.open === null) this.open = t;
      } else if (this.open !== null) {
        if (!this.quietSince) this.quietSince = t;
        // Close a segment after 120 ms of quiet (short gaps between syllables stay inside).
        if (t - this.quietSince > 120) {
          this.segs.push({ start: this.open, end: this.quietSince });
          this.open = null;
          this.quietSince = 0;
        }
      }
    };
    loop();
  }

  segments(): Array<{ start: number; end: number }> {
    const out = [...this.segs];
    if (this.open !== null) out.push({ start: this.open, end: this.quietSince || this.open + 50 });
    return out.filter((s) => s.end - s.start >= 60);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.level = 0;
  }
}
