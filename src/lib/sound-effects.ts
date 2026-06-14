// ─────────────────────────────────────────────────────────────
// OrbitGuard v2.0 — Premium HUD Audio Synthesizer
// ─────────────────────────────────────────────────────────────

class SoundSynth {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Premium cockpit warning alert (Airbus style dual-tone warning chime)
   */
  playAlarm() {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      const playTone = (freq: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, now);

        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.3);
      };

      // Dual-tone consonant chord (perfect fourth / major third)
      playTone(523.25); // C5
      playTone(659.25); // E5
    } catch (err) {
      console.warn("Audio error:", err);
    }
  }

  /**
   * Sleek HUD touch chirp (SpaceX crew console style)
   */
  playBeep() {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      // Fast pitch sweep down creates a clean organic tap sound
      osc.frequency.setValueAtTime(2000, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1500, now);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (err) {
      console.warn("Audio error:", err);
    }
  }

  /**
   * Safe trajectory lock chime (Ambient positive confirmation)
   */
  playChime() {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      const playSoftNote = (freq: number, startOffset: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + startOffset);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1200, now + startOffset);
        
        gain.gain.setValueAtTime(0.0, now + startOffset);
        gain.gain.linearRampToValueAtTime(vol, now + startOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + 0.9);
      };

      // Gentle ascending ambient major-seventh arpeggio
      playSoftNote(523.25, 0, 0.06);   // C5
      playSoftNote(659.25, 0.1, 0.05); // E5
      playSoftNote(783.99, 0.2, 0.05); // G5
      playSoftNote(987.77, 0.3, 0.04); // B5
    } catch (err) {
      console.warn("Audio error:", err);
    }
  }

  /**
   * Triumphant success tone (soft, non-grating fanfare)
   */
  playFanfare() {
    try {
      const ctx = this.initCtx();
      const now = ctx.currentTime;

      const playFanfareTone = (freq: number, startOffset: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + startOffset);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1000, now + startOffset);

        gain.gain.setValueAtTime(0.0, now + startOffset);
        gain.gain.linearRampToValueAtTime(0.05, now + startOffset + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.1);
      };

      // Elegant ascending sci-fi notes
      playFanfareTone(587.33, 0, 0.35);    // D5
      playFanfareTone(783.99, 0.2, 0.35);  // G5
      playFanfareTone(880.00, 0.4, 0.35);  // A5
      playFanfareTone(1174.66, 0.6, 0.85); // D6
    } catch (err) {
      console.warn("Audio error:", err);
    }
  }
}

export const soundSynth = new SoundSynth();
