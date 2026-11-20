export class SoundEngine16Bit {
  private ctx: AudioContext | null = null;
  public muted = false;
  private bgmInterval: number | null = null;
  private bgmStep = 0;
  private isPlayingBgm = false;
  private tempoMs = 185;
  private activeCheck: () => boolean = () => false;

  public setActiveCheck(fn: () => boolean) {
    this.activeCheck = fn;
  }

  public init() {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      this.ctx = null;
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else if (this.activeCheck()) {
      this.startBGM(this.tempoMs);
    }
    return this.muted;
  }

  public playTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    vol = 0.11,
    slideFreq: number | null = null
  ) {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(20, slideFreq),
          now + duration
        );
      }
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignore audio errors
    }
  }

  public playNoise(
    duration: number,
    vol = 0.14,
    filterFreq = 1000,
    filterType: BiquadFilterType = 'lowpass'
  ) {
    if (this.muted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {
      // Ignore
    }
  }

  public sfxRadioStatic() {
    this.playNoise(0.22, 0.12, 2400, 'bandpass');
    this.playTone(1350, 'square', 0.05, 0.08);
    window.setTimeout(() => this.playTone(980, 'square', 0.06, 0.07), 70);
  }

  public sfxPowerUpGenerator() {
    const freqs = [180, 260, 390, 520, 780];
    freqs.forEach((f, idx) => {
      window.setTimeout(() => this.playTone(f, 'sawtooth', 0.14, 0.11, f * 1.15), idx * 80);
    });
  }

  public sfxPistol() {
    this.playNoise(0.08, 0.14, 1850, 'bandpass');
    this.playTone(320, 'square', 0.06, 0.09, 75);
  }

  public sfxPoliceShot() {
    this.playNoise(0.07, 0.08, 1600, 'bandpass');
    this.playTone(280, 'square', 0.05, 0.05, 80);
  }

  public sfxShotgun() {
    this.playNoise(0.22, 0.24, 920, 'lowpass');
    this.playTone(155, 'sawtooth', 0.15, 0.16, 40);
  }

  public sfxMachineGun() {
    this.playNoise(0.055, 0.12, 2200, 'bandpass');
    this.playTone(410, 'square', 0.045, 0.08, 110);
  }

  public sfxExplosion() {
    this.playNoise(0.6, 0.36, 420, 'lowpass');
    this.playTone(110, 'sawtooth', 0.45, 0.25, 22);
  }

  public sfxCrash() {
    this.playNoise(0.45, 0.3, 620, 'bandpass');
    this.playTone(95, 'sawtooth', 0.32, 0.2, 30);
  }

  public sfxZombieGroan() {
    const base = 70 + Math.random() * 35;
    this.playTone(base, 'sawtooth', 0.25, 0.055, base * 0.65);
  }

  public sfxHurt() {
    this.playTone(185, 'sawtooth', 0.16, 0.18, 65);
    this.playNoise(0.1, 0.14, 700);
  }

  public sfxPickup() {
    this.playTone(523.25, 'square', 0.07, 0.09);
    window.setTimeout(() => this.playTone(659.25, 'square', 0.09, 0.09), 65);
  }

  public sfxReload() {
    this.playTone(280, 'triangle', 0.06, 0.11);
    window.setTimeout(() => this.playTone(560, 'square', 0.08, 0.11), 105);
  }

  public sfxRescue() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      window.setTimeout(() => this.playTone(n, 'square', 0.11, 0.11), idx * 70);
    });
  }

  public sfxHelpCall() {
    this.playTone(660, 'triangle', 0.11, 0.045, 810);
  }

  public sfxLampBuzz() {
    this.playTone(120, 'sawtooth', 0.05, 0.025, 112);
  }

  public sfxChopperBlade() {
    this.playNoise(0.06, 0.06, 250, 'lowpass');
  }

  public sfxJump() {
    this.playTone(210, 'triangle', 0.12, 0.09, 460);
  }

  public sfxTurbo() {
    this.playTone(160, 'sawtooth', 0.22, 0.12, 520);
    this.playNoise(0.18, 0.1, 1400, 'bandpass');
  }

  public sfxZombiePop() {
    this.playNoise(0.11, 0.14, 780, 'lowpass');
    this.playTone(130, 'square', 0.09, 0.08, 45);
  }

  public sfxSteer() {
    this.playTone(250, 'triangle', 0.045, 0.06, 320);
  }

  public setTempo(ms: number) {
    if (this.tempoMs === ms) return;
    this.tempoMs = ms;
    if (this.isPlayingBgm) {
      this.stopBGM();
      this.startBGM(ms);
    }
  }

  public startBGM(ms = 185) {
    this.tempoMs = ms;
    if (this.muted || this.isPlayingBgm) return;
    this.init();
    if (!this.ctx) return;
    this.isPlayingBgm = true;
    this.bgmStep = 0;

    const bassLine = [
      73.42, 73.42, 87.31, 73.42, 98.0, 98.0, 87.31, 65.41,
      73.42, 73.42, 110.0, 98.0, 87.31, 82.41, 73.42, 65.41,
    ];
    const leadLine = [
      293.66, 0, 349.23, 0, 329.63, 293.66, 261.63, 0,
      293.66, 0, 440.0, 415.3, 349.23, 0, 329.63, 261.63,
    ];

    this.bgmInterval = window.setInterval(() => {
      if (this.muted || !this.activeCheck()) return;
      const idx = this.bgmStep % bassLine.length;
      this.playTone(bassLine[idx], 'triangle', 0.14, 0.07);
      if (leadLine[idx] > 0 && this.bgmStep % 2 === 0) {
        this.playTone(leadLine[idx], 'square', 0.12, 0.028);
      }
      if (this.bgmStep % 2 === 1) {
        this.playNoise(0.024, 0.02, 4400, 'highpass');
      }
      this.bgmStep++;
    }, this.tempoMs);
  }

  public stopBGM() {
    this.isPlayingBgm = false;
    if (this.bgmInterval !== null) {
      window.clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}
