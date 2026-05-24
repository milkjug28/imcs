class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (!muted) this.init();
  }

  getMute(): boolean {
    return this.isMuted;
  }

  playRip() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      const duration = 0.6;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const noise = Math.random() * 2 - 1;
        const fiberSettle = Math.sin(i / 100) > 0.8 ? 1.0 : 0.2;
        data[i] = noise * fiberSettle * (1 - i / bufferSize);
      }
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(350, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + duration);
      filter.Q.setValueAtTime(4, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.3, ctx.currentTime);
      oscGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      noiseNode.start();
      osc.start();
      noiseNode.stop(ctx.currentTime + duration);
      osc.stop(ctx.currentTime + duration);
    } catch { /* */ }
  }

  playScribble() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      const osc = ctx.createOscillator();
      const bandpass = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400 + Math.random() * 200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200 + Math.random() * 200, ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(1500, ctx.currentTime + 0.15);
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1500, ctx.currentTime);
      bandpass.Q.setValueAtTime(5, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch { /* */ }
  }

  playCardPop(index: number = 0) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      const delay = index * 0.12;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220 + index * 40, t);
      osc.frequency.exponentialRampToValueAtTime(650 + index * 80, t + 0.15);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch { /* */ }
  }

  playSlideWhistle(isUp: boolean = false) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startFreq = isUp ? 200 : 700;
      const endFreq = isUp ? 1000 : 1500;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      if (isUp) {
        osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + 0.6);
      } else {
        osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.3);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.7);
      }
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch { /* */ }
  }

  playCheekyMonster() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + i * 0.12;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500 + i * 50, t);
        osc.frequency.setValueAtTime(900 + i * 40, t + 0.08);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      }
    } catch { /* */ }
  }

  playBoing() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      let t = ctx.currentTime;
      for (let i = 0; i < 15; i++) {
        osc.frequency.linearRampToValueAtTime(120 + Math.sin(i * 2.5) * 80, t);
        t += 0.03;
      }
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } catch { /* */ }
  }

  playChime() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    const ctx = this.ctx;
    try {
      const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const delay = index * 0.08;
        const noteTime = ctx.currentTime + delay;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.08, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.35);
        const hipass = ctx.createBiquadFilter();
        hipass.type = 'highpass';
        hipass.frequency.setValueAtTime(400, noteTime);
        osc.connect(hipass);
        hipass.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteTime);
        osc.stop(noteTime + 0.4);
      });
    } catch { /* */ }
  }
}

export const SFX = new SoundSynthesizer();
