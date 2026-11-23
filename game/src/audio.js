// Costa Verde — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Music: a lazy golden-hour bassline + hats, scheduled on a step clock.
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null;
    this.enabled = false; this.step = 0; this.nextStepTime = 0;
    this.sirenOn = false; this._sirenOsc = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
      this.enabled = true;
      this.nextStepTime = this.ctx.currentTime + 0.1;
    } catch (e) { this.enabled = false; }
  }
  _tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol = 0.25, when = 0, low = 400) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  shoot() { this._noise(0.12, 0.4, 0, 2400); this._tone(180, 0.08, 'square', 0.12, 0, 60); }
  shotgun() { this._noise(0.3, 0.55, 0, 1200); }
  punch() { this._noise(0.07, 0.3, 0, 900); }
  pickup() { this._tone(660, 0.1, 'sine', 0.25); this._tone(990, 0.16, 'sine', 0.25, 0.09); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.3, i * 0.11)); }
  busted() { [392, 311, 233].forEach((f, i) => this._tone(f, 0.3, 'sawtooth', 0.2, i * 0.18)); }
  stunt() { this._tone(440, 0.35, 'sine', 0.25, 0, 1320); }
  horn() { this._tone(370, 0.18, 'square', 0.15); this._tone(466, 0.18, 'square', 0.12); }
  engine(on) { /* engine hum is driven by updateEngine below */ }
  setSiren(on) {
    if (!this.enabled) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 700; g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain(); lg.gain.value = 320;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this._sirenOsc = { o, lfo, g };
    } else if (this._sirenOsc) {
      try { this._sirenOsc.o.stop(); this._sirenOsc.lfo.stop(); } catch (e) {}
      this._sirenOsc = null;
    }
  }
  // Call every frame; schedules 16th-note steps from a fixed BPM grid.
  updateMusic(dt, intensity = 0.5) {
    if (!this.enabled) return;
    const spb = 60 / 96 / 2; // 96 BPM, 8th notes
    while (this.nextStepTime < this.ctx.currentTime + 0.15) {
      const s = this.step % 32;
      const t = this.nextStepTime - this.ctx.currentTime;
      const bassNotes = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 0, 65.4, 0,
                         55, 0, 55, 0, 65.4, 0, 49, 0, 82.4, 0, 73.4, 0, 65.4, 0, 49, 0];
      const n = bassNotes[s];
      if (n) this._tone(n, spb * 1.8, 'triangle', 0.5, Math.max(0, t));
      if (s % 4 === 2) this._noise(0.03, 0.08 * intensity, Math.max(0, t), 6000);
      if (s === 0 || s === 16) this._tone(220, 0.4, 'sine', 0.08, Math.max(0, t), 110);
      this.step++;
      this.nextStepTime += spb;
    }
  }
}
